"""Potter Ticket Bot (discord.py 2.x) — ใช้ Supabase ตัวเดียวกับ Backend (service key, อยู่ฝั่งเซิร์ฟเวอร์เท่านั้น)"""
import os, io, re, time, asyncio, logging
import discord
from discord import app_commands
from discord.ext import tasks
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
logging.basicConfig(level=logging.INFO)
GUILD = discord.Object(id=int(os.environ["DISCORD_GUILD_ID"]))  # หรือเปลี่ยนเป็นเลขตรงๆ เช่น discord.Object(id=123456789)
sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
# ใส่ Discord Bot Token ที่บรรทัดนี้ (ห้ามอัปโหลดไฟล์นี้ขึ้น GitHub สาธารณะ ไม่งั้น Discord จะรีเซ็ต token ให้อัตโนมัติ)
DISCORD_TOKEN = "PASTE_YOUR_DISCORD_BOT_TOKEN_HERE"
START = time.time()
NO_MENTION = discord.AllowedMentions.none()

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
async def on_ready(): logging.info("Logged in as %s", bot.user)

_tok = DISCORD_TOKEN if not DISCORD_TOKEN.startswith("PASTE_") else os.getenv("DISCORD_TOKEN", "")
if not _tok: raise SystemExit("ยังไม่ได้ใส่ DISCORD_TOKEN ในบรรทัดบนของ bot.py")
bot.run(_tok)
