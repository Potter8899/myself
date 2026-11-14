"""Potter Ticket Bot (discord.py 2.x).

The database (Supabase) is the single source of truth and the message queue:
  website -> messages(sender='web', pushed=false) -> bot posts into the ticket channel -> pushed=true
  dashboard replies -> messages(sender='admin', pushed=false) -> bot posts them the same way
  Discord replies   -> bot inserts messages(sender='admin', pushed=true) -> website polls them
Nothing lives only in RAM, so a restart loses nothing: unsent rows are simply picked up again.

Secrets come from environment variables or a private `.env` file next to this script (never hard-code them).
"""
import asyncio
import io
import logging
import os
import re
import time
from pathlib import Path

import discord
from discord import app_commands
from discord.ext import tasks
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(Path(__file__).with_name(".env"))
load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("potter-bot")


def need(*names):
    for n in names:
        if os.getenv(n):
            return os.environ[n]
    raise SystemExit("Missing environment variable: " + " or ".join(names))


TOKEN = need("DISCORD_BOT_TOKEN", "DISCORD_TOKEN")
GUILD = discord.Object(id=int(need("DISCORD_GUILD_ID")))
sb = create_client(need("SUPABASE_URL"), need("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_KEY"))
START = time.time()
NO_MENTION = discord.AllowedMentions.none()

# Site palette: black / red / cyan / blue / white
NEON_RED, DARK_RED, CYAN, DEEP_BLUE, BLUE, WHITE = 0xFF304F, 0x8B101C, 0x00D9FF, 0x102B65, 0x164BFF, 0xFFFFFF


def emb(title, desc="", color=CYAN, fields=()):
    e = discord.Embed(title=title, description=desc[:4000], color=color, timestamp=discord.utils.utcnow())
    for n, v, inline in fields:
        e.add_field(name=n, value=str(v)[:1000] or "-", inline=inline)
    e.set_footer(text="POTTER PERSONAL SPACE")
    return e


# ---------------------------------------------------------------- db helpers (supabase-py is sync -> run in threads)
async def q(build):
    return await asyncio.to_thread(lambda: build().execute())


async def get_set(k):
    r = (await q(lambda: sb.table("settings").select("value").eq("key", k).limit(1))).data
    return r[0]["value"] if r else None


async def put_set(k, v):
    await q(lambda: sb.table("settings").upsert({"key": k, "value": str(v)}))


async def conf(k, env):
    """Env var wins (DISCORD_TICKET_CATEGORY_ID / DISCORD_LOG_CHANNEL_ID), otherwise the value saved by /setup."""
    return os.getenv(env) or await get_set(k)


async def count(t, **eq):
    def b():
        x = sb.table(t).select("id", count="exact").limit(1)
        for k, v in eq.items():
            x = x.eq(k, v)
        return x
    return (await q(b)).count or 0


def is_staff(m):
    return isinstance(m, discord.Member) and m.guild_permissions.manage_channels


async def ticket_by_channel(cid):
    r = (await q(lambda: sb.table("tickets").select("*, users(username,email)").eq("channel_id", str(cid)).order("id", desc=True).limit(1))).data
    return r[0] if r else None


async def add_system(tid, body, pushed=True):
    await q(lambda: sb.table("messages").insert({"ticket_id": tid, "sender": "system", "author": "system", "body": body, "pushed": pushed}))


class Bot(discord.Client):
    def __init__(self):
        i = discord.Intents.default()
        i.message_content = True  # enable "Message Content Intent" in the Developer Portal
        super().__init__(intents=i)
        self.tree = app_commands.CommandTree(self)

    async def setup_hook(self):
        self.add_view(TicketView())
        self.add_view(SnippetView())
        self.tree.copy_global_to(guild=GUILD)
        await self.tree.sync(guild=GUILD)
        pump.start()


bot = Bot()


async def log_ch():
    cid = await conf("log_channel", "DISCORD_LOG_CHANNEL_ID")
    return bot.get_channel(int(cid)) if cid else None


async def notify(embed, **kw):
    ch = await log_ch()
    if ch:
        await ch.send(embed=embed, allowed_mentions=NO_MENTION, **kw)


async def transcript_text(tid):
    msgs = (await q(lambda: sb.table("messages").select("created_at,sender,author,body").eq("ticket_id", tid).order("id"))).data
    return "\n".join(f"[{m['created_at'][:19]}] ({m['sender']}) {m['author']}: {m['body']}" for m in msgs)


# ---------------------------------------------------------------- ticket actions (shared by buttons and slash commands)
async def do_close(channel, by):
    t = await ticket_by_channel(channel.id)
    if not t or t["status"] == "closed":
        return False
    await q(lambda: sb.table("tickets").update({"status": "closed", "closed_at": "now()"}).eq("id", t["id"]))
    await add_system(t["id"], "ตั๋วถูกปิดแล้ว ขอบคุณที่ติดต่อ")
    txt = await transcript_text(t["id"])
    await notify(emb("📄 Ticket Transcript", f"ตั๋ว #{t['id']} • {t['users']['username']} • ปิดโดย {by}", DARK_RED),
                 file=discord.File(io.BytesIO(txt.encode()), f"ticket-{t['id']}.txt"))
    await channel.send(embed=emb("🔒 ตั๋วถูกปิด", f"ปิดโดย {by}", DARK_RED), view=TicketView(), allowed_mentions=NO_MENTION)
    return True


async def do_reopen(channel, by):
    t = await ticket_by_channel(channel.id)
    if not t or t["status"] != "closed":
        return "not_closed"
    try:
        await q(lambda: sb.table("tickets").update({"status": "open", "closed_at": None}).eq("id", t["id"]))
    except Exception:
        return "conflict"  # the unique index allows only one active ticket per customer
    await add_system(t["id"], "ตั๋วถูกเปิดอีกครั้ง")
    await notify(emb("🔓 Ticket Reopened", f"ตั๋ว #{t['id']} • {t['users']['username']} • โดย {by}", CYAN))
    return "ok"


async def do_claim(channel, member):
    t = await ticket_by_channel(channel.id)
    if not t:
        return "none"
    if t["status"] != "open":
        return "bad_state"
    await q(lambda: sb.table("tickets").update({"status": "claimed", "claimed_by": member.display_name}).eq("id", t["id"]))
    await add_system(t["id"], f"{member.display_name} รับเรื่องแล้ว")
    return "ok"


async def do_assign(channel, member, by):
    t = await ticket_by_channel(channel.id)
    if not t or t["status"] == "closed":
        return False
    await q(lambda: sb.table("tickets").update({"assigned_to": member.display_name}).eq("id", t["id"]))
    await add_system(t["id"], f"มอบหมายให้ {member.display_name}")
    await channel.send(embed=emb("👤 Assigned", f"{member.mention} ถูกมอบหมายโดย {by}", BLUE), allowed_mentions=discord.AllowedMentions(users=[member]))
    return True


class AssignSelect(discord.ui.UserSelect):
    def __init__(self):
        super().__init__(placeholder="เลือกทีมงานที่จะมอบหมาย", min_values=1, max_values=1)

    async def callback(self, i: discord.Interaction):
        m = self.values[0]
        if not is_staff(m):
            return await i.response.send_message("ผู้ถูกมอบหมายต้องเป็นทีมงาน (มีสิทธิ์ Manage Channels)", ephemeral=True)
        ok = await do_assign(i.channel, m, i.user.display_name)
        await i.response.send_message("มอบหมายแล้ว" if ok else "ห้องนี้ไม่ใช่ตั๋วที่เปิดอยู่", ephemeral=True)


class AssignView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=120)
        self.add_item(AssignSelect())


class TicketView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=None)

    async def guard(self, i):
        if not is_staff(i.user):
            await i.response.send_message("เฉพาะทีมงานเท่านั้น", ephemeral=True)
            return None
        t = await ticket_by_channel(i.channel_id)
        if not t:
            await i.response.send_message("ไม่พบตั๋วของห้องนี้", ephemeral=True)
        return t

    @discord.ui.button(label="Claim", emoji="🙋", style=discord.ButtonStyle.primary, custom_id="t:claim")
    async def claim(self, i, b):
        if not await self.guard(i):
            return
        r = await do_claim(i.channel, i.user)
        if r != "ok":
            return await i.response.send_message("ตั๋วนี้ไม่อยู่ในสถานะเปิด/มีคนรับแล้ว", ephemeral=True)
        await i.response.send_message(f"🙋 {i.user.mention} รับตั๋วนี้", allowed_mentions=NO_MENTION)

    @discord.ui.button(label="Assign", emoji="👤", style=discord.ButtonStyle.secondary, custom_id="t:assign")
    async def assign(self, i, b):
        if not await self.guard(i):
            return
        await i.response.send_message("เลือกทีมงาน:", view=AssignView(), ephemeral=True)

    @discord.ui.button(label="Transcript", emoji="📄", style=discord.ButtonStyle.secondary, custom_id="t:transcript")
    async def transcript(self, i, b):
        t = await self.guard(i)
        if not t:
            return
        txt = await transcript_text(t["id"])
        await i.response.send_message(file=discord.File(io.BytesIO(txt.encode()), f"ticket-{t['id']}.txt"), ephemeral=True)

    @discord.ui.button(label="Close Ticket", emoji="🔒", style=discord.ButtonStyle.danger, custom_id="t:close")
    async def close(self, i, b):
        if not await self.guard(i):
            return
        await i.response.defer()
        if not await do_close(i.channel, i.user.display_name):
            await i.followup.send("ตั๋วปิดอยู่แล้ว", ephemeral=True)

    @discord.ui.button(label="Reopen", emoji="🔓", style=discord.ButtonStyle.secondary, custom_id="t:reopen")
    async def reopen(self, i, b):
        if not await self.guard(i):
            return
        r = await do_reopen(i.channel, i.user.display_name)
        msg = {"ok": "🔓 เปิดตั๋วอีกครั้งแล้ว", "not_closed": "ตั๋วยังเปิดอยู่", "conflict": "ลูกค้ามีตั๋วใหม่เปิดอยู่แล้ว เปิดซ้ำไม่ได้"}[r]
        await i.response.send_message(msg, ephemeral=r != "ok")


# ---------------------------------------------------------------- slash commands
def staff_only(f):
    return app_commands.default_permissions(manage_channels=True)(f)


async def deny(i):
    await i.response.send_message("เฉพาะทีมงาน", ephemeral=True)


@bot.tree.command(name="setup", description="สร้างหมวดหมู่และห้องของระบบตั๋ว")
@app_commands.default_permissions(administrator=True)
async def setup(i: discord.Interaction):
    await i.response.defer(ephemeral=True)
    g = i.guild
    cat = discord.utils.get(g.categories, name="🎫 Tickets") or await g.create_category("🎫 Tickets")
    ow = {g.default_role: discord.PermissionOverwrite(view_channel=False), g.me: discord.PermissionOverwrite(view_channel=True, send_messages=True)}
    panel = discord.utils.get(g.text_channels, name="ticket-panel") or await g.create_text_channel("ticket-panel", category=cat, overwrites=ow)
    logs = discord.utils.get(g.text_channels, name="ticket-logs") or await g.create_text_channel("ticket-logs", category=cat, overwrites=ow)
    await put_set("category", cat.id)
    await put_set("log_channel", logs.id)
    await panel.send(embed=emb("ระบบตั๋ว Potter", "ข้อความจากเว็บจะสร้างห้อง `ticket-ชื่อลูกค้า` อัตโนมัติ\nพิมพ์ในห้องเพื่อตอบกลับเว็บ • ปุ่ม Claim / Assign / Transcript / Close / Reopen\nใช้ `/help` ดูคำสั่งทั้งหมด"))
    await i.followup.send("✅ ตั้งค่าเรียบร้อย", ephemeral=True)


@bot.tree.command(name="help", description="รายการคำสั่งของบอท")
async def help_cmd(i: discord.Interaction):
    await i.response.send_message(embed=emb("📖 Potter Bot — คำสั่ง", "", CYAN, [
        ("ทีมงาน", "`/setup` `/ticket` `/claim` `/assign` `/close` `/reopen` `/transcript` `/user` `/stats` `/status`", False),
        ("แจกโค้ด", "`/code <ชื่อ>` `/codepanel` `/code_add` `/code_upload` `/code_remove`", False),
        ("ทั่วไป", "`/ping` `/help`", False)]), ephemeral=True)


@bot.tree.command(name="ping", description="เช็กความหน่วงของบอท")
async def ping(i: discord.Interaction):
    await i.response.send_message(f"🏓 Pong! {bot.latency * 1000:.0f} ms", ephemeral=True)


@bot.tree.command(name="close", description="ปิดตั๋วของห้องนี้")
@staff_only
async def close_cmd(i: discord.Interaction):
    if not is_staff(i.user):
        return await deny(i)
    await i.response.defer(ephemeral=True)
    ok = await do_close(i.channel, i.user.display_name)
    await i.followup.send("ปิดตั๋วแล้ว" if ok else "ห้องนี้ไม่ใช่ตั๋วที่เปิดอยู่", ephemeral=True)


@bot.tree.command(name="reopen", description="เปิดตั๋วของห้องนี้อีกครั้ง")
@staff_only
async def reopen_cmd(i: discord.Interaction):
    if not is_staff(i.user):
        return await deny(i)
    r = await do_reopen(i.channel, i.user.display_name)
    await i.response.send_message({"ok": "🔓 เปิดตั๋วอีกครั้งแล้ว", "not_closed": "ตั๋วยังเปิดอยู่/ไม่ใช่ห้องตั๋ว", "conflict": "ลูกค้ามีตั๋วใหม่เปิดอยู่แล้ว"}[r], ephemeral=True)


@bot.tree.command(name="claim", description="รับตั๋วของห้องนี้")
@staff_only
async def claim_cmd(i: discord.Interaction):
    if not is_staff(i.user):
        return await deny(i)
    r = await do_claim(i.channel, i.user)
    await i.response.send_message({"ok": f"🙋 {i.user.display_name} รับตั๋วนี้", "none": "ไม่พบตั๋วของห้องนี้", "bad_state": "ตั๋วนี้ไม่อยู่ในสถานะเปิด/มีคนรับแล้ว"}[r], ephemeral=r != "ok")


@bot.tree.command(name="assign", description="มอบหมายตั๋วให้ทีมงาน")
@staff_only
async def assign_cmd(i: discord.Interaction, staff: discord.Member):
    if not is_staff(i.user):
        return await deny(i)
    if not is_staff(staff):
        return await i.response.send_message("ผู้ถูกมอบหมายต้องเป็นทีมงาน (มีสิทธิ์ Manage Channels)", ephemeral=True)
    ok = await do_assign(i.channel, staff, i.user.display_name)
    await i.response.send_message("มอบหมายแล้ว" if ok else "ห้องนี้ไม่ใช่ตั๋วที่เปิดอยู่", ephemeral=True)


@bot.tree.command(name="transcript", description="ดึง transcript ของตั๋ว (ห้องนี้ หรือระบุเลข)")
@staff_only
async def transcript_cmd(i: discord.Interaction, number: int | None = None):
    if not is_staff(i.user):
        return await deny(i)
    tid = number
    if not tid:
        t = await ticket_by_channel(i.channel_id)
        tid = t["id"] if t else None
    if not tid:
        return await i.response.send_message("ไม่พบตั๋ว", ephemeral=True)
    await i.response.defer(ephemeral=True)
    txt = await transcript_text(tid)
    await i.followup.send(file=discord.File(io.BytesIO((txt or "(ไม่มีข้อความ)").encode()), f"ticket-{tid}.txt"), ephemeral=True)


@bot.tree.command(name="ticket", description="ดูข้อมูลตั๋ว (ห้องนี้ หรือระบุเลข)")
@staff_only
async def ticket_cmd(i: discord.Interaction, number: int | None = None):
    if not is_staff(i.user):
        return await deny(i)
    if number:
        t = ((await q(lambda: sb.table("tickets").select("*, users(username)").eq("id", number).limit(1))).data or [None])[0]
    else:
        t = await ticket_by_channel(i.channel_id)
    if not t:
        return await i.response.send_message("ไม่พบตั๋ว", ephemeral=True)
    n = await count("messages", ticket_id=t["id"])
    await i.response.send_message(embed=emb(f"🎫 ตั๋ว #{t['id']}", "", CYAN, [
        ("ลูกค้า", t["users"]["username"], True), ("สถานะ", t["status"], True), ("รับโดย", t["claimed_by"] or "-", True),
        ("มอบหมาย", t.get("assigned_to") or "-", True), ("ข้อความ", n, True)]), ephemeral=True)


@bot.tree.command(name="user", description="ดูข้อมูลผู้ใช้เว็บ")
@staff_only
async def user_cmd(i: discord.Interaction, username: str):
    if not is_staff(i.user):
        return await deny(i)
    r = (await q(lambda: sb.table("users").select("id,username,email,role,created_at").ilike("username", username[:20]).limit(1))).data
    if not r:
        return await i.response.send_message("ไม่พบผู้ใช้", ephemeral=True)
    u = r[0]
    n = await count("tickets", user_id=u["id"])
    await i.response.send_message(embed=emb(f"👤 {u['username']}", "", BLUE, [
        ("อีเมล", u["email"], True), ("Role", u["role"], True), ("สมัคร", u["created_at"][:10], True), ("ตั๋ว", n, True)]), ephemeral=True)


async def stats_embed():
    return emb("📊 สถิติ", "", CYAN, [
        ("ผู้ใช้", await count("users"), True), ("ข้อความ", await count("messages"), True),
        ("ตั๋ว (เปิด/รับแล้ว/ปิด)", f"{await count('tickets', status='open')} / {await count('tickets', status='claimed')} / {await count('tickets', status='closed')}", False),
        ("ติดต่อใหม่", await count("contact_messages", status="new"), True), ("Guestbook รอตรวจ", await count("guestbook_entries", status="pending"), True)])


@bot.tree.command(name="stats", description="สถิติการใช้งาน")
@staff_only
async def stats_cmd(i: discord.Interaction):
    if not is_staff(i.user):
        return await deny(i)
    await i.response.defer(ephemeral=True)
    await i.followup.send(embed=await stats_embed(), ephemeral=True)


@bot.tree.command(name="status", description="สถานะบอท")
@staff_only
async def status_cmd(i: discord.Interaction):
    if not is_staff(i.user):
        return await deny(i)
    await i.response.defer(ephemeral=True)
    e = await stats_embed()
    e.title = f"🟢 Online • ping {bot.latency * 1000:.0f} ms • uptime {int(time.time() - START) // 60} นาที"
    await i.followup.send(embed=e, ephemeral=True)


# ---------------------------------------------------------------- website/dashboard -> Discord (queue in the database)
async def ensure_channel(t):
    g = bot.get_guild(GUILD.id)
    if g is None:
        raise RuntimeError("guild not cached yet")
    cid = await conf("category", "DISCORD_TICKET_CATEGORY_ID")
    cat = g.get_channel(int(cid)) if cid else None
    name = "ticket-" + (re.sub(r"[^a-z0-9_-]", "", t["users"]["username"].lower()) or str(t["id"]))
    ow = {g.default_role: discord.PermissionOverwrite(view_channel=False), g.me: discord.PermissionOverwrite(view_channel=True, send_messages=True, manage_channels=True)}
    ch = await g.create_text_channel(name, category=cat, overwrites=ow, topic=f"Ticket #{t['id']}")
    await q(lambda: sb.table("tickets").update({"channel_id": str(ch.id)}).eq("id", t["id"]))
    await ch.send(embed=emb(f"🎫 ตั๋ว #{t['id']} — {t['users']['username']}", f"อีเมล: {t['users']['email']}\nพิมพ์ในห้องนี้เพื่อตอบกลับเว็บ"), view=TicketView(), allowed_mentions=NO_MENTION)
    await notify(emb("🆕 มีตั๋วใหม่", f"{ch.mention} • {t['users']['username']}", CYAN))
    return ch


SECURITY_TITLES = {
    "error": ("⚠️ Backend Error", DARK_RED), "captcha_down": ("⚠️ Turnstile ใช้งานไม่ได้", DARK_RED),
    "captcha_reuse": ("🛡️ Security: replayed CAPTCHA token", NEON_RED), "honeypot": ("🛡️ Security: honeypot ถูกกระตุ้น", NEON_RED),
    "guestbook_report": ("🚩 Guestbook ถูกรายงาน", BLUE), "admin_role": ("🔑 เปลี่ยน role ผู้ใช้", BLUE),
    "admin_user_delete": ("🗑️ ลบผู้ใช้", BLUE), "admin_reset_code": ("🔐 ออกรหัสรีเซ็ตรหัสผ่าน", BLUE)}

_last_err_notice = 0.0


async def push_messages():
    rows = (await q(lambda: sb.table("messages").select("*").in_("sender", ["web", "admin", "system"]).eq("pushed", False).order("id").limit(20))).data
    for m in rows:
        try:
            t = (await q(lambda: sb.table("tickets").select("*, users(username,email)").eq("id", m["ticket_id"]).limit(1))).data[0]
            ch = bot.get_channel(int(t["channel_id"])) if t["channel_id"] else None
            if ch is None:
                if t["status"] == "closed" and m["sender"] != "web":
                    ch = None  # nothing to post into for dashboard/system notes on a ticket that never got a channel
                else:
                    ch = await ensure_channel(t)
            if ch is not None:
                if m["sender"] == "web":
                    await ch.send(f"**{m['author']}:** {m['body']}"[:2000], allowed_mentions=NO_MENTION)
                elif m["sender"] == "admin":
                    await ch.send(embed=emb(f"💬 {m['author']} (Dashboard)", m["body"], BLUE), allowed_mentions=NO_MENTION)
                else:
                    await ch.send(embed=emb("ℹ️", m["body"], DEEP_BLUE), allowed_mentions=NO_MENTION)
            await q(lambda: sb.table("messages").update({"pushed": True}).eq("id", m["id"]))
        except Exception:
            n = (m.get("push_attempts") or 0) + 1
            log.exception("push failed for message %s (attempt %s)", m["id"], n)
            upd = {"push_attempts": n, **({"pushed": True} if n >= 5 else {})}  # give up after 5 tries so one bad row cannot block the queue
            await q(lambda: sb.table("messages").update(upd).eq("id", m["id"]))
            if n >= 5:
                await notify(emb("⚠️ Bot Error", f"ส่งข้อความ #{m['id']} เข้า Discord ไม่สำเร็จ 5 ครั้ง จึงข้าม", DARK_RED))


@tasks.loop(seconds=3)
async def pump():
    global _last_err_notice
    try:
        await put_set("bot_heartbeat", time.time())
        for u in (await q(lambda: sb.table("users").select("id,username").eq("notified", False).limit(20))).data:
            await notify(emb("👤 สมาชิกใหม่", u["username"], DEEP_BLUE))
            await q(lambda: sb.table("users").update({"notified": True}).eq("id", u["id"]))
        for c in (await q(lambda: sb.table("contact_messages").select("*").eq("notified", False).order("id").limit(10))).data:
            await notify(emb("📬 ข้อความติดต่อใหม่", c["message"][:1500], CYAN, [
                ("จาก", c["name"], True), ("หัวข้อ", c["subject"], True), ("อีเมล", c["email"] or "-", True)]))
            await q(lambda: sb.table("contact_messages").update({"notified": True}).eq("id", c["id"]))
        for e in (await q(lambda: sb.table("activity_logs").select("*").eq("notified", False).in_("kind", list(SECURITY_TITLES)).limit(10))).data:
            title, color = SECURITY_TITLES[e["kind"]]
            await notify(emb(title, f"`{e['kind']}` {e['detail'] or ''}", color))
            await q(lambda: sb.table("activity_logs").update({"notified": True}).eq("id", e["id"]))
        await push_messages()
    except Exception as ex:
        log.exception("pump error")
        if time.time() - _last_err_notice > 600:  # at most one bot-error notice per 10 minutes
            _last_err_notice = time.time()
            try:
                await notify(emb("⚠️ Bot Error", f"`{type(ex).__name__}` ใน pump loop — ดู log ของเซิร์ฟเวอร์", DARK_RED))
            except Exception:
                pass


@pump.before_loop
async def _w():
    await bot.wait_until_ready()


# ---------------------------------------------------------------- Discord -> website
@bot.event
async def on_message(m: discord.Message):
    if m.author.bot or not m.guild or not is_staff(m.author) or not m.content:
        return
    t = await ticket_by_channel(m.channel.id)
    if not t or t["status"] == "closed":
        return
    await q(lambda: sb.table("messages").insert({"ticket_id": t["id"], "sender": "admin", "author": m.author.display_name, "body": m.content[:1500], "pushed": True}))
    try:
        await m.add_reaction("✅")
    except discord.HTTPException:
        pass


@bot.tree.error
async def on_tree_error(i: discord.Interaction, err: app_commands.AppCommandError):
    log.exception("command error", exc_info=err)
    msg = "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง"
    try:
        await (i.followup.send(msg, ephemeral=True) if i.response.is_done() else i.response.send_message(msg, ephemeral=True))
    except Exception:
        pass


# ---------------------------------------------------------------- code / file distribution (existing feature)
EXT = {"python": "py", "py": "py", "java": "java", "js": "js", "javascript": "js", "json": "json", "yaml": "yml", "yml": "yml",
       "html": "html", "css": "css", "sql": "sql", "bash": "sh", "sh": "sh", "kt": "kt", "kotlin": "kt", "lua": "lua"}


def fname(s):
    base = re.sub(r"[^A-Za-z0-9_-]+", "_", s["title"]).strip("_") or "snippet"
    return f"{base}.{EXT.get(s['language'].lower(), 'txt')}"


async def snippet_list():
    return (await q(lambda: sb.table("code_snippets").select("id,title,language,description,downloads").order("title"))).data


def panel_embed(items):
    e = emb("📦 แจกโค้ด / ไฟล์", "เลือกรายการจากเมนูด้านล่าง บอทจะส่งโค้ดให้เฉพาะคุณ" if items else "ยังไม่มีรายการ ใช้ `/code_add` หรือ `/code_upload` เพื่อเพิ่ม")
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
        for k, v in eq.items():
            x = x.eq(k, v)
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
        if not s:
            return await i.response.send_message("ไม่พบรายการนี้แล้ว", ephemeral=True)
        await deliver(i, s)


class SnippetView(discord.ui.View):
    def __init__(self, items=None):
        super().__init__(timeout=None)
        self.add_item(SnippetSelect(items))


async def refresh_panel():
    cid, mid = await get_set("snip_channel"), await get_set("snip_message")
    ch = bot.get_channel(int(cid)) if cid else None
    if not ch or not mid:
        return
    try:
        items = await snippet_list()
        await (await ch.fetch_message(int(mid))).edit(embed=panel_embed(items), view=SnippetView(items))
    except discord.NotFound:
        pass


async def title_ac(i: discord.Interaction, cur: str):
    return [app_commands.Choice(name=s["title"][:100], value=s["title"][:100]) for s in await snippet_list() if cur.lower() in s["title"].lower()][:25]


class AddSnippet(discord.ui.Modal, title="เพิ่มโค้ดที่แจก"):
    f_title = discord.ui.TextInput(label="ชื่อ", max_length=50)
    f_lang = discord.ui.TextInput(label="ภาษา (python, java, js, json, text …)", max_length=15, default="text")
    f_desc = discord.ui.TextInput(label="คำอธิบายสั้นๆ", max_length=100, required=False)
    f_body = discord.ui.TextInput(label="เนื้อหา", style=discord.TextStyle.paragraph, max_length=4000)

    async def on_submit(self, i: discord.Interaction):
        t = self.f_title.value.strip()
        if await get_snippet(title=t):
            return await i.response.send_message("มีชื่อนี้อยู่แล้ว", ephemeral=True)
        await q(lambda: sb.table("code_snippets").insert({"title": t, "language": self.f_lang.value.strip() or "text", "description": self.f_desc.value.strip(),
                                                          "content": self.f_body.value, "created_by": i.user.display_name}))
        await i.response.send_message(f"✅ เพิ่ม **{t}** แล้ว", ephemeral=True)
        await refresh_panel()


@bot.tree.command(name="codepanel", description="โพสต์แผงแจกโค้ด (เมนูเลือก) ในห้องนี้")
@staff_only
async def codepanel(i: discord.Interaction):
    if not is_staff(i.user):
        return await deny(i)
    items = await snippet_list()
    await i.response.send_message(embed=panel_embed(items), view=SnippetView(items))
    m = await i.original_response()
    await put_set("snip_channel", m.channel.id)
    await put_set("snip_message", m.id)


@bot.tree.command(name="code_add", description="เพิ่มโค้ด/ข้อความที่แจก (พิมพ์ในฟอร์ม)")
@staff_only
async def code_add(i: discord.Interaction):
    if not is_staff(i.user):
        return await deny(i)
    await i.response.send_modal(AddSnippet())


@bot.tree.command(name="code_upload", description="เพิ่มไฟล์ข้อความ/โค้ดที่แจกจากไฟล์แนบ (ไม่เกิน 200 KB)")
@staff_only
async def code_upload(i: discord.Interaction, file: discord.Attachment, title: str, description: str = ""):
    if not is_staff(i.user):
        return await deny(i)
    if file.size > 200_000:
        return await i.response.send_message("ไฟล์ใหญ่เกิน 200 KB", ephemeral=True)
    try:
        text = (await file.read()).decode("utf-8")
    except UnicodeDecodeError:
        return await i.response.send_message("รองรับเฉพาะไฟล์ข้อความ (UTF-8)", ephemeral=True)
    title = title.strip()[:50]
    if await get_snippet(title=title):
        return await i.response.send_message("มีชื่อนี้อยู่แล้ว", ephemeral=True)
    lang = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "text"
    await q(lambda: sb.table("code_snippets").insert({"title": title, "language": lang[:15], "description": description[:100], "content": text, "created_by": i.user.display_name}))
    await i.response.send_message(f"✅ เพิ่ม **{title}** แล้ว", ephemeral=True)
    await refresh_panel()


@bot.tree.command(name="code_remove", description="ลบรายการที่แจก")
@staff_only
@app_commands.autocomplete(title=title_ac)
async def code_remove(i: discord.Interaction, title: str):
    if not is_staff(i.user):
        return await deny(i)
    if not await get_snippet(title=title):
        return await i.response.send_message("ไม่พบรายการ", ephemeral=True)
    await q(lambda: sb.table("code_snippets").delete().eq("title", title))
    await i.response.send_message(f"🗑️ ลบ **{title}** แล้ว", ephemeral=True)
    await refresh_panel()


@bot.tree.command(name="code", description="ขอรับโค้ดที่แจก")
@app_commands.autocomplete(title=title_ac)
async def code_get(i: discord.Interaction, title: str):
    s = await get_snippet(title=title)
    if not s:
        return await i.response.send_message("ไม่พบรายการ", ephemeral=True)
    await deliver(i, s)


@bot.event
async def on_ready():
    log.info("Logged in as %s", bot.user)


if __name__ == "__main__":
    bot.run(TOKEN)
