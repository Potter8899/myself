"""Potter Personal Space — Backend API (FastAPI) + Ticket Bot (discord.py) รวมในไฟล์เดียว
รัน: uvicorn server:app --port 8000   (ต้องใช้ worker เดียวเท่านั้น ห้ามใส่ --workers)
Render: Start Command = uvicorn server:app --host 0.0.0.0 --port $PORT
บอทจะเริ่มทำงานพร้อม FastAPI อัตโนมัติ (ใน event loop เดียวกัน)

.env ที่ต้องมี:
  SUPABASE_URL, SUPABASE_SERVICE_KEY, SESSION_SECRET
  TURNSTILE_SECRET, TURNSTILE_SITEKEY, ALLOWED_ORIGIN (ถ้าต้องการ), TRUST_PROXY=1 (ถ้าอยู่หลัง proxy)
  DISCORD_TOKEN, DISCORD_GUILD_ID   (ถ้าไม่ใส่ จะรันเฉพาะเว็บ API ไม่เปิดบอท)
"""
import os, io, re, time, json, hmac, hashlib, base64, asyncio, logging
from collections import defaultdict, deque
from contextlib import asynccontextmanager
import httpx
import discord
from discord import app_commands
from discord.ext import tasks
from dotenv import load_dotenv
from fastapi import FastAPI, Request, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, ValidationError
from supabase import create_client

load_dotenv(); load_dotenv("/etc/secrets/.env")   # รองรับ Secret Files ของ Render
logging.basicConfig(level=logging.INFO)
log = logging.getLogger("potter")

# ======================= ค่าตั้งต้นร่วม =======================
SB = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
sb = SB                                          # ใช้ client ตัวเดียวกันทั้งเว็บและบอท
SECRET = os.environ["SESSION_SECRET"].encode()
TS_SECRET = os.getenv("TURNSTILE_SECRET", "")
SITEKEY = os.getenv("TURNSTILE_SITEKEY", "")
TRUST_PROXY = os.getenv("TRUST_PROXY", "0") == "1"
BOT_TOKEN = os.getenv("DISCORD_TOKEN", "")       # ห้ามฝัง token ลงในโค้ด
GUILD_ID = int(os.getenv("DISCORD_GUILD_ID", "0") or 0)
GUILD = discord.Object(id=GUILD_ID)
START = time.time()
NO_MENTION = discord.AllowedMentions.none()
RESERVED = {"admin", "administrator", "potter", "root", "system", "mod", "support", "bot"}
USER_RE = re.compile(r"^[A-Za-z0-9_]{3,20}$")
MAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,189}\.[^@\s]{2,}$")


def audit(kind, detail, ip, notify=False):
    try:
        SB.table("activity_logs").insert({"kind": kind, "detail": detail[:300], "notified": not notify,
            "ip_hash": hashlib.sha256(SECRET + ip.encode()).hexdigest()[:16]}).execute()
    except Exception: log.warning("audit failed")


# ======================= ส่วนบอท Discord =======================
async def q(build):                       # รัน query แบบ sync ใน thread
    return (await asyncio.to_thread(lambda: build().execute()))
async def get_set(k):
    r = (await q(lambda: sb.table("settings").select("value").eq("key", k).limit(1))).data
    return r[0]["value"] if r else None
async def put_set(k, v): await q(lambda: sb.table("settings").upsert({"key": k, "value": str(v)}))
async def count(t, **eq):
    def b():
        x = sb.table(t).select("id", count="exact").limit(1)
        for k, v in eq.items(): x = x.eq(k, v)
        return x
    return (await q(b)).count or 0
def is_admin(m): return isinstance(m, discord.Member) and m.guild_permissions.manage_channels
async def ticket_by_channel(cid):
    r = (await q(lambda: sb.table("tickets").select("*, users(username,email)").eq("channel_id", str(cid)).order("id", desc=True).limit(1))).data
    return r[0] if r else None

class Bot(discord.Client):
    def __init__(self):
        i = discord.Intents.default(); i.message_content = True
        super().__init__(intents=i); self.tree = app_commands.CommandTree(self)
    async def setup_hook(self):
        self.add_view(TicketView()); self.add_view(SnippetView())
        self.tree.copy_global_to(guild=GUILD); await self.tree.sync(guild=GUILD)
        self.tree.clear_commands(guild=None); await self.tree.sync()   # ล้างคำสั่ง global เก่าที่ค้างบน Discord (เช่น /ui) ไม่ให้เกิด CommandNotFound
        pump.start()
bot = Bot()

async def log_ch():
    cid = await get_set("log_channel")
    return bot.get_channel(int(cid)) if cid else None
async def notify(embed):
    ch = await log_ch()
    if ch: await ch.send(embed=embed, allowed_mentions=NO_MENTION)

# ---------- ปุ่ม ----------
async def do_close(channel, by):
    t = await ticket_by_channel(channel.id)
    if not t or t["status"] == "closed": return False
    await q(lambda: sb.table("tickets").update({"status": "closed", "closed_at": "now()"}).eq("id", t["id"]))
    await q(lambda: sb.table("messages").insert({"ticket_id": t["id"], "sender": "system", "author": "system", "body": "ตั๋วถูกปิดแล้ว ขอบคุณที่ติดต่อ", "pushed": True}))
    msgs = (await q(lambda: sb.table("messages").select("created_at,author,body").eq("ticket_id", t["id"]).order("id"))).data
    txt = "\n".join(f"[{m['created_at'][:19]}] {m['author']}: {m['body']}" for m in msgs)
    ch = await log_ch()
    if ch: await ch.send(f"📄 Transcript ตั๋ว #{t['id']} ({t['users']['username']}) ปิดโดย {by}", file=discord.File(io.BytesIO(txt.encode()), f"ticket-{t['id']}.txt"), allowed_mentions=NO_MENTION)
    await channel.send(embed=discord.Embed(title="🔒 ตั๋วถูกปิด", description=f"ปิดโดย {by}", color=0x8B101C), view=TicketView(), allowed_mentions=NO_MENTION)
    return True

class TicketView(discord.ui.View):
    def __init__(self): super().__init__(timeout=None)
    async def guard(self, i):
        if not is_admin(i.user): await i.response.send_message("เฉพาะแอดมินเท่านั้น", ephemeral=True); return None
        t = await ticket_by_channel(i.channel_id)
        if not t: await i.response.send_message("ไม่พบตั๋วของห้องนี้", ephemeral=True)
        return t
    @discord.ui.button(label="Claim", emoji="🙋", style=discord.ButtonStyle.primary, custom_id="t:claim")
    async def claim(self, i, b):
        t = await self.guard(i)
        if not t: return
        if t["status"] != "open": return await i.response.send_message("ตั๋วนี้ไม่อยู่ในสถานะเปิด/มีคนรับแล้ว", ephemeral=True)
        await q(lambda: sb.table("tickets").update({"status": "claimed", "claimed_by": i.user.display_name}).eq("id", t["id"]))
        await q(lambda: sb.table("messages").insert({"ticket_id": t["id"], "sender": "system", "author": "system", "body": f"{i.user.display_name} รับเรื่องแล้ว", "pushed": True}))
        await i.response.send_message(f"🙋 {i.user.mention} รับตั๋วนี้", allowed_mentions=NO_MENTION)
    @discord.ui.button(label="Close Ticket", emoji="🔒", style=discord.ButtonStyle.danger, custom_id="t:close")
    async def close(self, i, b):
        if not await self.guard(i): return
        await i.response.defer()
        if not await do_close(i.channel, i.user.display_name): await i.followup.send("ตั๋วปิดอยู่แล้ว", ephemeral=True)
    @discord.ui.button(label="Reopen", emoji="🔓", style=discord.ButtonStyle.secondary, custom_id="t:reopen")
    async def reopen(self, i, b):
        t = await self.guard(i)
        if not t: return
        if t["status"] != "closed": return await i.response.send_message("ตั๋วยังเปิดอยู่", ephemeral=True)
        try: await q(lambda: sb.table("tickets").update({"status": "open", "closed_at": None}).eq("id", t["id"]))
        except Exception: return await i.response.send_message("ลูกค้ามีตั๋วใหม่เปิดอยู่แล้ว เปิดซ้ำไม่ได้", ephemeral=True)
        await q(lambda: sb.table("messages").insert({"ticket_id": t["id"], "sender": "system", "author": "system", "body": "ตั๋วถูกเปิดอีกครั้ง", "pushed": True}))
        await i.response.send_message("🔓 เปิดตั๋วอีกครั้งแล้ว")

# ---------- Slash commands ----------
@bot.tree.command(name="setup", description="สร้างหมวดหมู่และห้องของระบบตั๋ว")
@app_commands.default_permissions(administrator=True)
async def setup(i: discord.Interaction):
    await i.response.defer(ephemeral=True); g = i.guild
    cat = discord.utils.get(g.categories, name="🎫 Tickets") or await g.create_category("🎫 Tickets")
    ow = {g.default_role: discord.PermissionOverwrite(view_channel=False), g.me: discord.PermissionOverwrite(view_channel=True, send_messages=True)}
    panel = discord.utils.get(g.text_channels, name="ticket-panel") or await g.create_text_channel("ticket-panel", category=cat, overwrites=ow)
    logs = discord.utils.get(g.text_channels, name="ticket-logs") or await g.create_text_channel("ticket-logs", category=cat, overwrites=ow)
    await put_set("category", cat.id); await put_set("log_channel", logs.id)
    e = discord.Embed(title="ระบบตั๋ว Potter", color=0x00D9FF, description="ข้อความจากเว็บจะสร้างห้อง `ticket-ชื่อลูกค้า` อัตโนมัติ\nพิมพ์ในห้องเพื่อตอบกลับเว็บ • ปุ่ม Claim / Close / Reopen • `/close` `/ticket` `/user` `/stats` `/status`")
    await panel.send(embed=e)
    await i.followup.send("✅ ตั้งค่าเรียบร้อย", ephemeral=True)

def admin_only(f): return app_commands.default_permissions(manage_channels=True)(f)

@bot.tree.command(name="close", description="ปิดตั๋วของห้องนี้")
@admin_only
async def close_cmd(i: discord.Interaction):
    if not is_admin(i.user): return await i.response.send_message("เฉพาะแอดมิน", ephemeral=True)
    await i.response.defer(ephemeral=True)
    ok = await do_close(i.channel, i.user.display_name)
    await i.followup.send("ปิดตั๋วแล้ว" if ok else "ห้องนี้ไม่ใช่ตั๋วที่เปิดอยู่", ephemeral=True)

@bot.tree.command(name="ticket", description="ดูข้อมูลตั๋ว (ห้องนี้ หรือระบุเลข)")
@admin_only
async def ticket_cmd(i: discord.Interaction, number: int | None = None):
    if not is_admin(i.user): return await i.response.send_message("เฉพาะแอดมิน", ephemeral=True)
    if number: t = ((await q(lambda: sb.table("tickets").select("*, users(username)").eq("id", number).limit(1))).data or [None])[0]
    else: t = await ticket_by_channel(i.channel_id)
    if not t: return await i.response.send_message("ไม่พบตั๋ว", ephemeral=True)
    n = await count("messages", ticket_id=t["id"])
    await i.response.send_message(f"🎫 #{t['id']} • {t['users']['username']} • สถานะ **{t['status']}** • รับโดย {t['claimed_by'] or '-'} • {n} ข้อความ", ephemeral=True)

@bot.tree.command(name="user", description="ดูข้อมูลผู้ใช้เว็บ")
@admin_only
async def user_cmd(i: discord.Interaction, username: str):
    if not is_admin(i.user): return await i.response.send_message("เฉพาะแอดมิน", ephemeral=True)
    r = (await q(lambda: sb.table("users").select("id,username,email,role,created_at").ilike("username", username[:20]).limit(1))).data
    if not r: return await i.response.send_message("ไม่พบผู้ใช้", ephemeral=True)
    u = r[0]; n = await count("tickets", user_id=u["id"])
    await i.response.send_message(f"👤 **{u['username']}** • {u['email']} • role {u['role']} • สมัคร {u['created_at'][:10]} • ตั๋ว {n}", ephemeral=True)

async def stats_text():
    return (f"👥 ผู้ใช้ {await count('users')} • 🎫 ตั๋วทั้งหมด {await count('tickets')} "
            f"(เปิด {await count('tickets', status='open')} / รับแล้ว {await count('tickets', status='claimed')} / ปิด {await count('tickets', status='closed')}) "
            f"• 💬 ข้อความ {await count('messages')}")
@bot.tree.command(name="stats", description="สถิติการใช้งาน")
@admin_only
async def stats_cmd(i: discord.Interaction):
    if not is_admin(i.user): return await i.response.send_message("เฉพาะแอดมิน", ephemeral=True)
    await i.response.send_message(await stats_text(), ephemeral=True)
@bot.tree.command(name="status", description="สถานะบอท")
@admin_only
async def status_cmd(i: discord.Interaction):
    if not is_admin(i.user): return await i.response.send_message("เฉพาะแอดมิน", ephemeral=True)
    await i.response.send_message(f"🟢 Online • ping {bot.latency*1000:.0f} ms • uptime {int(time.time()-START)//60} นาที\n{await stats_text()}", ephemeral=True)

# ---------- เว็บ -> Discord ----------
async def ensure_channel(t):
    g = bot.get_guild(GUILD.id); cid = await get_set("category")
    cat = g.get_channel(int(cid)) if cid else None
    name = "ticket-" + re.sub(r"[^a-z0-9_-]", "", t["users"]["username"].lower())
    ow = {g.default_role: discord.PermissionOverwrite(view_channel=False), g.me: discord.PermissionOverwrite(view_channel=True, send_messages=True, manage_channels=True)}
    ch = await g.create_text_channel(name, category=cat, overwrites=ow, topic=f"Ticket #{t['id']}")
    await q(lambda: sb.table("tickets").update({"channel_id": str(ch.id)}).eq("id", t["id"]))
    e = discord.Embed(title=f"🎫 ตั๋ว #{t['id']} — {t['users']['username']}", color=0x00D9FF, description=f"อีเมล: {t['users']['email']}\nพิมพ์ในห้องนี้เพื่อตอบกลับเว็บ")
    await ch.send(embed=e, view=TicketView(), allowed_mentions=NO_MENTION)
    await notify(discord.Embed(title="🆕 มีตั๋วใหม่", description=f"{ch.mention} • {t['users']['username']}", color=0x00D9FF))
    return ch

@tasks.loop(seconds=2)
async def pump():
    try:
        await put_set("bot_heartbeat", time.time())
        for u in (await q(lambda: sb.table("users").select("id,username").eq("notified", False).limit(20))).data:
            await notify(discord.Embed(title="👤 สมาชิกใหม่", description=u["username"], color=0x102B65))
            await q(lambda: sb.table("users").update({"notified": True}).eq("id", u["id"]))
        for e in (await q(lambda: sb.table("activity_logs").select("*").eq("notified", False).in_("kind", ["error", "captcha_down"]).limit(10))).data:
            await notify(discord.Embed(title="⚠️ ข้อผิดพลาดของระบบ", description=f"`{e['kind']}` {e['detail'] or ''}", color=0x8B101C))
            await q(lambda: sb.table("activity_logs").update({"notified": True}).eq("id", e["id"]))
        for m in (await q(lambda: sb.table("messages").select("*").eq("sender", "web").eq("pushed", False).order("id").limit(20))).data:
            t = (await q(lambda: sb.table("tickets").select("*, users(username,email)").eq("id", m["ticket_id"]).limit(1))).data[0]
            ch = bot.get_channel(int(t["channel_id"])) if t["channel_id"] else None
            if ch is None: ch = await ensure_channel(t)
            await ch.send(f"**{m['author']}:** {m['body']}", allowed_mentions=NO_MENTION)
            await q(lambda: sb.table("messages").update({"pushed": True}).eq("id", m["id"]))
    except Exception:
        logging.exception("pump error")

@pump.before_loop
async def _w(): await bot.wait_until_ready()

# ---------- Discord -> เว็บ ----------
@bot.event
async def on_message(m: discord.Message):
    if m.author.bot or not m.guild or not is_admin(m.author) or not m.content: return
    t = await ticket_by_channel(m.channel.id)
    if not t or t["status"] == "closed": return
    await q(lambda: sb.table("messages").insert({"ticket_id": t["id"], "sender": "admin", "author": m.author.display_name, "body": m.content[:1500], "pushed": True}))
    await m.add_reaction("✅")

# ---------- แจกโค้ด / ไฟล์ ด้วย UI ----------
EXT = {"python": "py", "py": "py", "java": "java", "js": "js", "javascript": "js", "json": "json", "yaml": "yml", "yml": "yml",
       "html": "html", "css": "css", "sql": "sql", "bash": "sh", "sh": "sh", "kt": "kt", "kotlin": "kt", "lua": "lua"}
def fname(s):
    base = re.sub(r"[^A-Za-z0-9_-]+", "_", s["title"]).strip("_") or "snippet"
    return f"{base}.{EXT.get(s['language'].lower(), 'txt')}"
async def snippet_list():
    return (await q(lambda: sb.table("code_snippets").select("id,title,language,description,downloads").order("title"))).data
def panel_embed(items):
    e = discord.Embed(title="📦 แจกโค้ด / ไฟล์", color=0x00D9FF,
                      description="เลือกรายการจากเมนูด้านล่าง บอทจะส่งโค้ดให้เฉพาะคุณ" if items else "ยังไม่มีรายการ ใช้ `/code_add` หรือ `/code_upload` เพื่อเพิ่ม")
    for s in items[:10]:
        e.add_field(name=f"{s['title']} · {s['language']}", value=f"{s['description'] or '-'}\n⬇️ {s['downloads']}", inline=False)
    return e
async def deliver(i: discord.Interaction, s):
    await q(lambda: sb.table("code_snippets").update({"downloads": s["downloads"] + 1}).eq("id", s["id"]))
    f = discord.File(io.BytesIO(s["content"].encode()), fname(s))
    txt = f"**{s['title']}** ({s['language']})"
    if len(s["content"]) <= 1700:
        txt += f"\n```{s['language']}\n{s['content'].replace('```', '`' + chr(0x200b) + '``')}\n```"
    await i.response.send_message(txt, file=f, ephemeral=True)
async def get_snippet(**eq):
    def b():
        x = sb.table("code_snippets").select("*").limit(1)
        for k, v in eq.items(): x = x.eq(k, v)
        return x
    r = (await q(b)).data
    return r[0] if r else None

class SnippetSelect(discord.ui.Select):
    def __init__(self, items=None):
        opts = [discord.SelectOption(label=s["title"][:100], value=str(s["id"]), description=(s["description"] or s["language"])[:100])
                for s in (items or [])[:25]] or [discord.SelectOption(label="(ยังไม่มีรายการ)", value="0")]
        super().__init__(custom_id="snip:pick", placeholder="เลือกโค้ดที่ต้องการ…", options=opts)
    async def callback(self, i: discord.Interaction):
        s = await get_snippet(id=int(self.values[0]))
        if not s: return await i.response.send_message("ไม่พบรายการนี้แล้ว", ephemeral=True)
        await deliver(i, s)
class SnippetView(discord.ui.View):
    def __init__(self, items=None):
        super().__init__(timeout=None); self.add_item(SnippetSelect(items))

async def refresh_panel():
    cid, mid = await get_set("snip_channel"), await get_set("snip_message")
    ch = bot.get_channel(int(cid)) if cid else None
    if not ch or not mid: return
    try:
        items = await snippet_list()
        await (await ch.fetch_message(int(mid))).edit(embed=panel_embed(items), view=SnippetView(items))
    except discord.NotFound: pass

async def title_ac(i: discord.Interaction, cur: str):
    return [app_commands.Choice(name=s["title"][:100], value=s["title"][:100]) for s in await snippet_list() if cur.lower() in s["title"].lower()][:25]

class AddSnippet(discord.ui.Modal, title="เพิ่มโค้ดที่แจก"):
    f_title = discord.ui.TextInput(label="ชื่อ", max_length=50)
    f_lang = discord.ui.TextInput(label="ภาษา (python, java, js, json, text …)", max_length=15, default="text")
    f_desc = discord.ui.TextInput(label="คำอธิบายสั้นๆ", max_length=100, required=False)
    f_body = discord.ui.TextInput(label="เนื้อหา", style=discord.TextStyle.paragraph, max_length=4000)
    async def on_submit(self, i: discord.Interaction):
        t = self.f_title.value.strip()
        if await get_snippet(title=t): return await i.response.send_message("มีชื่อนี้อยู่แล้ว", ephemeral=True)
        await q(lambda: sb.table("code_snippets").insert({"title": t, "language": self.f_lang.value.strip() or "text", "description": self.f_desc.value.strip(),
                                                          "content": self.f_body.value, "created_by": i.user.display_name}))
        await i.response.send_message(f"✅ เพิ่ม **{t}** แล้ว", ephemeral=True); await refresh_panel()

@bot.tree.command(name="codepanel", description="โพสต์แผงแจกโค้ด (เมนูเลือก) ในห้องนี้")
@admin_only
async def codepanel(i: discord.Interaction):
    if not is_admin(i.user): return await i.response.send_message("เฉพาะแอดมิน", ephemeral=True)
    items = await snippet_list()
    await i.response.send_message(embed=panel_embed(items), view=SnippetView(items))
    m = await i.original_response()
    await put_set("snip_channel", m.channel.id); await put_set("snip_message", m.id)

@bot.tree.command(name="code_add", description="เพิ่มโค้ด/ข้อความที่แจก (พิมพ์ในฟอร์ม)")
@admin_only
async def code_add(i: discord.Interaction):
    if not is_admin(i.user): return await i.response.send_message("เฉพาะแอดมิน", ephemeral=True)
    await i.response.send_modal(AddSnippet())

@bot.tree.command(name="code_upload", description="เพิ่มไฟล์ข้อความ/โค้ดที่แจกจากไฟล์แนบ (ไม่เกิน 200 KB)")
@admin_only
async def code_upload(i: discord.Interaction, file: discord.Attachment, title: str, description: str = ""):
    if not is_admin(i.user): return await i.response.send_message("เฉพาะแอดมิน", ephemeral=True)
    if file.size > 200_000: return await i.response.send_message("ไฟล์ใหญ่เกิน 200 KB", ephemeral=True)
    try: text = (await file.read()).decode("utf-8")
    except UnicodeDecodeError: return await i.response.send_message("รองรับเฉพาะไฟล์ข้อความ (UTF-8)", ephemeral=True)
    title = title.strip()[:50]
    if await get_snippet(title=title): return await i.response.send_message("มีชื่อนี้อยู่แล้ว", ephemeral=True)
    lang = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "text"
    await q(lambda: sb.table("code_snippets").insert({"title": title, "language": lang[:15], "description": description[:100], "content": text, "created_by": i.user.display_name}))
    await i.response.send_message(f"✅ เพิ่ม **{title}** แล้ว", ephemeral=True); await refresh_panel()

@bot.tree.command(name="code_remove", description="ลบรายการที่แจก")
@admin_only
@app_commands.autocomplete(title=title_ac)
async def code_remove(i: discord.Interaction, title: str):
    if not is_admin(i.user): return await i.response.send_message("เฉพาะแอดมิน", ephemeral=True)
    if not await get_snippet(title=title): return await i.response.send_message("ไม่พบรายการ", ephemeral=True)
    await q(lambda: sb.table("code_snippets").delete().eq("title", title))
    await i.response.send_message(f"🗑️ ลบ **{title}** แล้ว", ephemeral=True); await refresh_panel()

@bot.tree.command(name="code", description="ขอรับโค้ดที่แจก")
@app_commands.autocomplete(title=title_ac)
async def code_get(i: discord.Interaction, title: str):
    s = await get_snippet(title=title)
    if not s: return await i.response.send_message("ไม่พบรายการ", ephemeral=True)
    await deliver(i, s)

@bot.event
async def on_ready(): log.info("Discord bot logged in as %s", bot.user)


# ======================= ส่วนเว็บ API (FastAPI) =======================
def _bot_done(t: asyncio.Task):
    if not t.cancelled() and t.exception():
        log.error("Discord bot หยุดทำงาน: %r (เว็บ API ยังทำงานต่อ)", t.exception())

@asynccontextmanager
async def lifespan(_):
    task = None
    if BOT_TOKEN and GUILD_ID:
        task = asyncio.create_task(bot.start(BOT_TOKEN))
        task.add_done_callback(_bot_done)
    else:
        log.warning("ไม่พบ DISCORD_TOKEN / DISCORD_GUILD_ID ใน .env — รันเฉพาะเว็บ API ไม่เปิดบอท")
    yield
    if task:
        await bot.close()
        await asyncio.gather(task, return_exceptions=True)

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
origin = os.getenv("ALLOWED_ORIGIN", "")
if origin:
    app.add_middleware(CORSMiddleware, allow_origins=[origin], allow_methods=["GET", "POST"], allow_headers=["Content-Type", "Authorization"])

@app.exception_handler(HTTPException)
async def _http(_, e): return JSONResponse({"error": e.detail}, status_code=e.status_code)
@app.exception_handler(ValidationError)
async def _val(_, e): return JSONResponse({"error": "bad_input"}, status_code=400)
@app.exception_handler(Exception)
async def _any(req, e):
    log.exception("unhandled")
    audit("error", f"{req.url.path}: {type(e).__name__}", "", notify=True)   # ไม่ใส่ข้อมูลผู้ใช้/secret ใน log
    return JSONResponse({"error": "server_error"}, status_code=500)

@app.middleware("http")
async def sec_headers(req, nxt):
    r = await nxt(req)
    r.headers.update({"X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "same-origin",
        "Content-Security-Policy": "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; "
                                   "connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'"})
    return r

def ip_of(req: Request) -> str:
    if TRUST_PROXY:   # เปิดเฉพาะเมื่ออยู่หลัง Cloudflare/Nginx ที่เชื่อถือได้
        return req.headers.get("cf-connecting-ip") or req.headers.get("x-forwarded-for", "").split(",")[0].strip() or "0"
    return req.client.host if req.client else "0"

_hits = defaultdict(deque)
def limit(key, n, per):
    dq, now = _hits[key], time.time()
    while dq and dq[0] < now - per: dq.popleft()
    if len(dq) >= n: raise HTTPException(429, "rate_limited")
    dq.append(now)

def hash_pw(pw):
    salt = os.urandom(16); h = hashlib.scrypt(pw.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)
    return salt.hex() + ":" + h.hex()
def check_pw(pw, stored):
    try:
        s, h = stored.split(":"); n = hashlib.scrypt(pw.encode(), salt=bytes.fromhex(s), n=2**14, r=8, p=1, dklen=32)
        return hmac.compare_digest(n.hex(), h)
    except Exception: return False

def make_token(uid):
    p = base64.urlsafe_b64encode(json.dumps({"u": uid, "e": int(time.time()) + 7 * 86400}).encode()).decode()
    return p + "." + hmac.new(SECRET, p.encode(), hashlib.sha256).hexdigest()
def user_from(auth):
    try:
        p, sig = (auth or "").removeprefix("Bearer ").split(".")
        if not hmac.compare_digest(sig, hmac.new(SECRET, p.encode(), hashlib.sha256).hexdigest()): raise ValueError
        d = json.loads(base64.urlsafe_b64decode(p))
        if d["e"] < time.time(): raise ValueError
        r = SB.table("users").select("id,username,role").eq("id", d["u"]).limit(1).execute().data
        if r: return r[0]
    except Exception: pass
    raise HTTPException(401, "unauthorized")

async def verify_captcha(token, ip):
    if not TS_SECRET: raise HTTPException(503, "captcha_unavailable")      # ไม่ข้ามการตรวจสอบเด็ดขาด
    if not token or len(token) > 2048: raise HTTPException(400, "captcha_required")
    th = hashlib.sha256(token.encode()).hexdigest()
    try: await q(lambda: SB.table("used_captcha").insert({"token_hash": th}))      # PK ซ้ำ = โทเคนถูกใช้ซ้ำ
    except Exception:
        audit("captcha_reuse", "", ip); raise HTTPException(400, "captcha_reused")
    try:
        async with httpx.AsyncClient(timeout=8) as c:
            r = await c.post("https://challenges.cloudflare.com/turnstile/v0/siteverify", data={"secret": TS_SECRET, "response": token, "remoteip": ip})
        d = r.json()
    except Exception:
        audit("captcha_down", "", ip, notify=True); raise HTTPException(503, "captcha_unavailable")
    if not d.get("success"):
        codes = d.get("error-codes", [])
        audit("captcha_fail", ",".join(codes), ip)
        raise HTTPException(400, "captcha_expired" if "timeout-or-duplicate" in codes else "captcha_failed")

class Reg(BaseModel):
    username: str = Field(max_length=20); email: str = Field(max_length=254); password: str = Field(min_length=8, max_length=72)
    captcha: str = ""; website: str = ""
class Login(BaseModel):
    username: str = Field(max_length=20); password: str = Field(max_length=72); captcha: str = ""; website: str = ""
class Msg(BaseModel):
    body: str = Field(min_length=1, max_length=1500); captcha: str = ""

def trap(honey, ip):
    if honey:
        audit("honeypot", "", ip); raise HTTPException(400, "rejected")

@app.get("/api/config")
def config(): return {"sitekey": SITEKEY}

@app.post("/api/register")
async def register(b: Reg, req: Request):
    ip = ip_of(req); limit("reg" + ip, 5, 3600); trap(b.website, ip)
    u = b.username.strip()
    if not USER_RE.match(u) or u.lower() in RESERVED or not MAIL_RE.match(b.email.strip()): raise HTTPException(400, "bad_input")
    await verify_captcha(b.captcha, ip)
    if (await q(lambda: SB.table("users").select("id").ilike("username", u).limit(1))).data: raise HTTPException(409, "username_taken")
    ph = await asyncio.to_thread(hash_pw, b.password)
    row = (await q(lambda: SB.table("users").insert({"username": u, "email": b.email.strip(), "pass_hash": ph}))).data[0]
    audit("register", u, ip)
    return {"token": make_token(row["id"]), "username": u}

@app.post("/api/login")
async def login(b: Login, req: Request):
    ip = ip_of(req); limit("login" + ip, 10, 600); trap(b.website, ip)
    await verify_captcha(b.captcha, ip)
    r = (await q(lambda: SB.table("users").select("id,username,pass_hash").ilike("username", b.username.strip()).limit(1))).data
    if r and r[0]["pass_hash"].startswith("legacy:"):   # บัญชีที่ย้ายมาจากระบบเดิม: ตรวจแบบ plaintext หรือ sha256 แล้วเปลี่ยนเป็น scrypt ทันที
        old = r[0]["pass_hash"][7:]
        if hmac.compare_digest(old, b.password) or hmac.compare_digest(old.lower(), hashlib.sha256(b.password.encode()).hexdigest()):
            r[0]["pass_hash"] = await asyncio.to_thread(hash_pw, b.password)
            await q(lambda: SB.table("users").update({"pass_hash": r[0]["pass_hash"]}).eq("id", r[0]["id"]))
    if not r or not await asyncio.to_thread(check_pw, b.password, r[0]["pass_hash"]):
        audit("login_fail", b.username[:20], ip); raise HTTPException(401, "bad_credentials")
    return {"token": make_token(r[0]["id"]), "username": r[0]["username"]}

@app.get("/api/me")
def me(authorization: str = Header("")): u = user_from(authorization); return {"username": u["username"]}

def latest_ticket(uid):
    r = SB.table("tickets").select("id,status").eq("user_id", uid).order("id", desc=True).limit(1).execute().data
    return r[0] if r else None

@app.get("/api/messages")
def messages(tid: int = 0, after: int = 0, authorization: str = Header("")):
    u = user_from(authorization); limit("poll%d" % u["id"], 60, 60)
    t = latest_ticket(u["id"])
    if not t: return {"ticket": None, "messages": []}
    if t["id"] != tid: after = 0
    m = SB.table("messages").select("id,sender,author,body").eq("ticket_id", t["id"]).gt("id", after).order("id").limit(100).execute().data
    return {"ticket": t, "messages": m}

@app.post("/api/messages")
async def send(b: Msg, req: Request, authorization: str = Header("")):
    ip = ip_of(req); u = await asyncio.to_thread(user_from, authorization); limit("msg%d" % u["id"], 20, 60)
    body = b.body.strip()
    if not body: raise HTTPException(400, "bad_input")
    t = await asyncio.to_thread(latest_ticket, u["id"])
    if not t or t["status"] == "closed":
        await verify_captcha(b.captcha, ip)            # เปิดตั๋วใหม่ต้องผ่าน CAPTCHA เสมอ
        try: t = (await q(lambda: SB.table("tickets").insert({"user_id": u["id"]}))).data[0]
        except Exception: t = await asyncio.to_thread(latest_ticket, u["id"])    # unique index กันตั๋วซ้ำ
        audit("ticket_open", u["username"], ip)
    await q(lambda: SB.table("messages").insert({"ticket_id": t["id"], "sender": "web", "author": u["username"], "body": body}))
    return {"ok": True}

@app.get("/api/stats")
def stats():
    c = lambda t: SB.table(t).select("id", count="exact").limit(1).execute().count or 0
    hb = SB.table("settings").select("value").eq("key", "bot_heartbeat").limit(1).execute().data
    online = bool(hb) and time.time() - float(hb[0]["value"]) < 30
    return {"bot_online": online, "tickets": c("tickets"), "users": c("users"), "messages": c("messages")}

@app.get("/healthz")
def healthz(): return {"ok": True}                  # Render Health Check Path

# ต้องอยู่ท้ายสุดเสมอ (ไม่งั้นจะทับ route /api/*)
WEB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")
if os.path.isdir(WEB_DIR):
    app.mount("/", StaticFiles(directory=WEB_DIR, html=True), name="web")
else:
    log.warning("ไม่พบโฟลเดอร์ web/ ที่ %s — เสิร์ฟเฉพาะ /api/*", WEB_DIR)