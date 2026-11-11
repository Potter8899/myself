"""
Potter Portfolio - Discord Bot & Ticket Bridge
Two-Way Realtime Communication between Website Chat and Discord Server
"""

import os
import sys
import json
import asyncio
import logging
from datetime import datetime, timezone
from dotenv import load_dotenv

import discord
from discord import app_commands
from discord.ext import commands
import aiohttp
from aiohttp import web

# Load environment variables
load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DISCORD_TOKEN = os.getenv("DISCORD_TOKEN", "")
GUILD_ID = os.getenv("DISCORD_GUILD_ID", None)
PORT = int(os.getenv("PORT", 5000))
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("PotterTicketBot")

# Helper for timezone-aware UTC datetime
def get_utc_now():
    return datetime.now(timezone.utc)

# In-Memory State
TICKETS = {}
CHANNEL_TO_SESSION = {}
WS_CLIENTS = {}


# --- Discord Bot Setup ---
class TicketBot(commands.Bot):
    def __init__(self):
        intents = discord.Intents.default()
        intents.message_content = True
        intents.guilds = True
        super().__init__(command_prefix="!", intents=intents)
        self.web_app = None
        self.web_runner = None

    async def setup_hook(self):
        # Start web server
        asyncio.create_task(self.start_web_server())

        # Sync slash commands
        try:
            if GUILD_ID:
                guild = discord.Object(id=int(GUILD_ID))
                self.tree.copy_global_to(guild=guild)
                await self.tree.sync(guild=guild)
                logger.info(f"Slash commands synced to guild {GUILD_ID}")
            else:
                await self.tree.sync()
                logger.info("Global slash commands synced successfully")
        except Exception as e:
            logger.warning(f"Error syncing slash commands: {e}")

    async def start_web_server(self):
        app = web.Application(middlewares=[cors_middleware])

        # Static Web Routes (Allows viewing the website directly at http://localhost:5000/)
        app.router.add_get("/", handle_serve_index)
        app.router.add_get("/style.css", handle_serve_css)
        app.router.add_get("/script.js", handle_serve_js)
        app.router.add_get("/favicon.ico", handle_favicon)
        img_dir = os.path.join(BASE_DIR, "img")
        if os.path.isdir(img_dir):
            app.router.add_static("/img/", path=img_dir, name="img")

        # API & WebSocket Endpoints
        app.router.add_get("/api/status", handle_status)
        app.router.add_post("/api/ticket/create", handle_create_ticket)
        app.router.add_post("/api/chat/send", handle_web_chat_send)
        app.router.add_get("/api/chat/messages", handle_get_messages)
        app.router.add_get("/api/chat/ws", handle_chat_ws)

        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, "0.0.0.0", PORT)
        await site.start()
        logger.info(f"Website & API running at http://localhost:{PORT}")


bot = TicketBot()


# --- CORS Middleware ---
@web.middleware
async def cors_middleware(request, handler):
    if request.method == "OPTIONS":
        response = web.Response()
    else:
        try:
            response = await handler(request)
        except web.HTTPException as http_ex:
            # Let aiohttp handle standard 404/redirects cleanly
            response = http_ex
        except Exception as ex:
            logger.error(f"HTTP handler error: {ex}")
            response = web.json_response({"error": str(ex)}, status=500)

    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS, PUT, DELETE"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, x-requested-with"
    return response


# --- Static Web Handlers ---
async def handle_serve_index(request):
    index_file = os.path.join(BASE_DIR, "index.html")
    if os.path.exists(index_file):
        return web.FileResponse(index_file)
    return web.Response(text="Potter Portfolio Server is Online!")

async def handle_serve_css(request):
    css_file = os.path.join(BASE_DIR, "style.css")
    if os.path.exists(css_file):
        return web.FileResponse(css_file)
    return web.Response(status=404)

async def handle_serve_js(request):
    js_file = os.path.join(BASE_DIR, "script.js")
    if os.path.exists(js_file):
        return web.FileResponse(js_file)
    return web.Response(status=404)

async def handle_favicon(request):
    return web.Response(status=204)


# --- Ticket Channel UI Views ---
class TicketChannelView(discord.ui.View):
    def __init__(self, session_id: str):
        super().__init__(timeout=None)
        self.session_id = session_id

    @discord.ui.button(label="ปิดตั๋วนี้ (Close Ticket)", style=discord.ButtonStyle.danger, emoji="🔒")
    async def close_ticket_btn(self, interaction: discord.Interaction, button: discord.ui.Button):
        await close_ticket_logic(interaction, self.session_id)

    @discord.ui.button(label="ข้อมูลลูกค้า (Client Info)", style=discord.ButtonStyle.secondary, emoji="👤")
    async def info_btn(self, interaction: discord.Interaction, button: discord.ui.Button):
        ticket = TICKETS.get(self.session_id)
        if not ticket:
            await interaction.response.send_message("ไม่พบข้อมูลตั๋วนี้ในระบบ", ephemeral=True)
            return

        embed = discord.Embed(
            title=f"ข้อมูลตั๋ว: {ticket.get('username')}",
            color=0x2DE2FF,
            timestamp=get_utc_now()
        )
        embed.add_field(name="ชื่อผู้ใช้", value=ticket.get("username", "-"), inline=True)
        embed.add_field(name="อีเมล", value=ticket.get("email", "-"), inline=True)
        embed.add_field(name="Session ID", value=self.session_id, inline=False)
        embed.add_field(name="สถานะ", value="🟢 กำลังสนทนา (Open)", inline=True)
        embed.add_field(name="จำนวนข้อความ", value=str(len(ticket.get("messages", []))), inline=True)
        await interaction.response.send_message(embed=embed, ephemeral=True)


# --- Close Ticket Logic ---
async def close_ticket_logic(interaction_or_channel, session_id: str):
    channel = interaction_or_channel if isinstance(interaction_or_channel, discord.TextChannel) else interaction_or_channel.channel
    ticket = TICKETS.get(session_id)
    if ticket:
        ticket["status"] = "closed"

    # Broadcast closed event to web client
    await broadcast_to_session(session_id, {
        "type": "ticket_closed",
        "session_id": session_id,
        "message": "ตั๋วการสนทนานี้ถูกปิดโดยแอดมินเรียบร้อยแล้ว หากต้องการสอบถามเพิ่มเติมสามารถเปิดตั๋วใหม่ได้ตลอดเวลาครับ",
        "sender_name": "Potter (Admin)",
        "sender_role": "admin",
        "created_at": get_utc_now().isoformat()
    })

    # Notify in Discord
    close_embed = discord.Embed(
        title="🔒 ปิดตั๋วเรียบร้อยแล้ว",
        description="ตั๋วการสนทนานี้ถูกปิดแล้ว ห้องนี้จะถูกลบอัตโนมัติในอีก 5 วินาที...",
        color=0xFF2E56,
        timestamp=get_utc_now()
    )

    if hasattr(interaction_or_channel, "response"):
        await interaction_or_channel.response.send_message(embed=close_embed)
    else:
        await channel.send(embed=close_embed)

    await asyncio.sleep(5)
    try:
        if session_id in TICKETS and TICKETS[session_id].get("channel_id") == channel.id:
            del CHANNEL_TO_SESSION[channel.id]
        await channel.delete(reason="Ticket closed by admin")
    except Exception as e:
        logger.warning(f"Could not delete channel {channel.name}: {e}")


# --- Control Panel Helper ---
def build_panel_embed(guild):
    category_name = "🎫 ตั๋วสอบถามงาน (Tickets)"
    category = discord.utils.get(guild.categories, name=category_name)
    panel_embed = discord.Embed(
        title="🎮 ระบบตั๋วสอบถามงาน Potter Portfolio & Minecraft 3D",
        description=(
            "ระบบเชื่อมต่อการสนทนาจากหน้าเว็บไซต์เข้าสู่ Discord แบบ Real-time สองทาง\n\n"
            "**วิธีทำงานของระบบ:**\n"
            "1. เมื่อลูกค้าส่งข้อความสอบถามจากหน้าเว็บ บอทจะสร้างห้อง `#ticket-<ชื่อลูกค้า>` ในหมวดหมู่นี้อัตโนมัติ\n"
            "2. แอดมินสามารถพิมพ์คุยตอบกลับในห้องตั๋วนั้นได้ทันที ข้อความจะถูกส่งกลับไปยังหน้าเว็บของลูกค้าโดยตรง\n"
            "3. เมื่อคุยงานเสร็จสิ้น สามารถกดปุ่ม **'ปิดตั๋วนี้'** หรือพิมพ์คำสั่ง `/close` ในห้องตั๋วเพื่อปิดห้อง\n"
        ),
        color=0x2DE2FF,
        timestamp=get_utc_now()
    )
    panel_embed.add_field(name="หมวดหมู่ตั๋ว", value=category.name if category else category_name, inline=True)
    panel_embed.add_field(name="พอร์ตเซิร์ฟเวอร์", value=f"http://localhost:{PORT}", inline=True)
    panel_embed.add_field(name="สถานะเซิร์ฟเวอร์", value="🟢 พร้อมรับข้อความจากหน้าเว็บ", inline=False)
    panel_embed.set_footer(text="Potter Discord Bridge • Minecraft 3D Modeler & Developer")
    return panel_embed


# --- Slash Command: /setup ---
@bot.tree.command(name="setup", description="สร้างหมวดหมู่ตั๋วและแผงควบคุมระบบสอบถามงานเว็บไซต์อัตโนมัติ")
@app_commands.checks.has_permissions(administrator=True)
async def setup_cmd(interaction: discord.Interaction):
    guild = interaction.guild
    if not guild:
        await interaction.response.send_message("คำสั่งนี้ใช้ได้เฉพาะในเซิร์ฟเวอร์เท่านั้น", ephemeral=True)
        return

    await interaction.response.defer(thinking=True)

    # 1. Create or find Ticket Category
    category_name = "🎫 ตั๋วสอบถามงาน (Tickets)"
    category = discord.utils.get(guild.categories, name=category_name)
    if not category:
        category = await guild.create_category(category_name)

    # 2. Create or find Log Channel
    log_channel_name = "📋-ประวัติข้อความ"
    log_channel = discord.utils.get(category.text_channels, name=log_channel_name)
    if not log_channel:
        log_channel = await guild.create_text_channel(log_channel_name, category=category)

    # 3. Create or find Control Panel Channel
    panel_channel_name = "📌-จัดการระบบตั๋ว"
    panel_channel = discord.utils.get(category.text_channels, name=panel_channel_name)
    if not panel_channel:
        panel_channel = await guild.create_text_channel(panel_channel_name, category=category)

    # 4. Post Control Panel Embed UI
    embed = build_panel_embed(guild)
    await panel_channel.send(embed=embed)

    await interaction.followup.send(
        f"ติดตั้งระบบตั๋วเรียบร้อยแล้ว!\n"
        f"• หมวดหมู่: **{category.name}**\n"
        f"• แผงควบคุม: {panel_channel.mention}\n"
        f"• ประวัติ: {log_channel.mention}",
        ephemeral=True
    )


# --- Slash Command: /ui (Alias to show control UI) ---
@bot.tree.command(name="ui", description="แสดงแผงควบคุมระบบตั๋วและสถานะของบอท (Ticket Panel UI)")
async def ui_cmd(interaction: discord.Interaction):
    guild = interaction.guild
    if not guild:
        await interaction.response.send_message("คำสั่งนี้ใช้ได้เฉพาะในเซิร์ฟเวอร์เท่านั้น", ephemeral=True)
        return

    embed = build_panel_embed(guild)
    embed.add_field(name="จำนวนตั๋วปัจจุบัน", value=f"{len(TICKETS)} ตั๋ว", inline=True)
    await interaction.response.send_message(embed=embed)


# --- Slash Command: /close ---
@bot.tree.command(name="close", description="ปิดตั๋วการสนทนานี้และลบห้องตั๋ว")
async def close_cmd(interaction: discord.Interaction):
    channel = interaction.channel
    session_id = CHANNEL_TO_SESSION.get(channel.id)

    # Fallback: check topic
    if not session_id and getattr(channel, "topic", None) and "ticket_session:" in channel.topic:
        for part in channel.topic.split("|"):
            if "ticket_session:" in part:
                session_id = part.split(":")[1].strip()

    if not session_id:
        await interaction.response.send_message("คำสั่งนี้ใช้ได้เฉพาะในห้องตั๋วของลูกค้าเท่านั้น", ephemeral=True)
        return

    await close_ticket_logic(interaction, session_id)


# --- On Message Event (Discord -> Web Bridge) ---
@bot.event
async def on_message(message: discord.Message):
    if message.author.bot or not message.guild:
        return

    channel = message.channel
    session_id = CHANNEL_TO_SESSION.get(channel.id)

    # Check topic fallback
    if not session_id and getattr(channel, "topic", None) and "ticket_session:" in channel.topic:
        for part in channel.topic.split("|"):
            if "ticket_session:" in part:
                session_id = part.split(":")[1].strip()
                CHANNEL_TO_SESSION[channel.id] = session_id

    # If message is inside an active ticket channel
    if session_id:
        reply_content = message.content.strip()
        if not reply_content:
            return

        msg_obj = {
            "id": f"msg_admin_{int(get_utc_now().timestamp() * 1000)}",
            "session_id": session_id,
            "sender_name": f"{message.author.display_name} (แอดมิน Discord)",
            "sender_role": "admin",
            "content": reply_content,
            "created_at": get_utc_now().isoformat()
        }

        # Store in ticket history
        if session_id in TICKETS:
            TICKETS[session_id].setdefault("messages", []).append(msg_obj)

        # Broadcast to web browser via WebSocket
        await broadcast_to_session(session_id, {
            "type": "chat_message",
            **msg_obj
        })

        # Add reaction in Discord to confirm it was forwarded to the web client
        try:
            await message.add_reaction("✅")
        except Exception:
            pass


# --- Helper: Create or Find Ticket Channel in Discord ---
async def get_or_create_ticket_channel(session_id: str, username: str, email: str, initial_msg: str):
    if not bot.guilds:
        logger.warning("Bot is not in any Discord server yet!")
        return None

    guild = bot.guilds[0]
    if GUILD_ID:
        g = bot.get_guild(int(GUILD_ID))
        if g:
            guild = g

    ticket = TICKETS.get(session_id)
    if ticket and ticket.get("channel_id"):
        ch = guild.get_channel(ticket["channel_id"])
        if ch:
            return ch

    category_name = "🎫 ตั๋วสอบถามงาน (Tickets)"
    category = discord.utils.get(guild.categories, name=category_name)
    if not category:
        category = await guild.create_category(category_name)

    clean_name = "".join(c if c.isalnum() else "-" for c in username.lower()).strip("-")
    clean_name = clean_name[:20] if clean_name else "user"
    channel_name = f"ticket-{clean_name}"

    topic = f"ticket_session:{session_id} | user:{username} | email:{email}"
    channel = await guild.create_text_channel(channel_name, category=category, topic=topic)

    CHANNEL_TO_SESSION[channel.id] = session_id
    if session_id not in TICKETS:
        TICKETS[session_id] = {
            "username": username,
            "email": email,
            "channel_id": channel.id,
            "status": "open",
            "messages": []
        }
    else:
        TICKETS[session_id]["channel_id"] = channel.id

    # Send Welcome Embed into the newly created ticket channel
    embed = discord.Embed(
        title="🎫 มีการเปิดตั๋วสอบถามงานใหม่จากหน้าเว็บไซต์!",
        description=f"ลูกค้าชื่อ **{username}** ได้เปิดตั๋วสอบถามสั่งทำโมเดลหรือปรึกษางาน\nสามารถพิมพ์ตอบกลับในห้องนี้ได้ทันที ข้อความจะส่งไปยังหน้าเว็บของลูกค้า",
        color=0x2DE2FF,
        timestamp=get_utc_now()
    )
    embed.add_field(name="👤 ชื่อลูกค้า (Username)", value=username, inline=True)
    embed.add_field(name="📧 อีเมล (Email)", value=email, inline=True)
    embed.add_field(name="🆔 Session ID", value=f"`{session_id}`", inline=False)
    if initial_msg:
        embed.add_field(name="💬 ข้อความแรกจากลูกค้า", value=f">>> {initial_msg}", inline=False)
    embed.set_footer(text="ตอบกลับในห้องนี้เพื่อแชตคุยกับลูกค้าได้เลย")

    view = TicketChannelView(session_id)
    await channel.send(embed=embed, view=view)
    return channel


# --- Helper: Broadcast Message to Web Clients ---
async def broadcast_to_session(session_id: str, data: dict):
    clients = WS_CLIENTS.get(session_id, set())
    dead = set()
    for ws in clients:
        try:
            await ws.send_json(data)
        except Exception:
            dead.add(ws)
    for d in dead:
        clients.discard(d)


# --- REST & WebSocket API Handlers ---
async def handle_status(request):
    return web.json_response({
        "status": "online",
        "bot_user": str(bot.user) if bot.user else "Not logged in",
        "guilds_count": len(bot.guilds),
        "active_tickets": len(TICKETS),
        "timestamp": get_utc_now().isoformat()
    })


async def handle_create_ticket(request):
    try:
        data = await request.json()
    except Exception:
        return web.json_response({"error": "Invalid JSON"}, status=400)

    session_id = data.get("session_id")
    username = data.get("username", "Guest")
    email = data.get("email", "unknown@mail.com")
    initial_msg = data.get("initial_message", "")

    if not session_id:
        return web.json_response({"error": "session_id is required"}, status=400)

    if session_id not in TICKETS:
        TICKETS[session_id] = {
            "username": username,
            "email": email,
            "status": "open",
            "messages": []
        }

    channel = None
    if bot.is_ready():
        channel = await get_or_create_ticket_channel(session_id, username, email, initial_msg)

    return web.json_response({
        "ok": True,
        "session_id": session_id,
        "channel_id": channel.id if channel else None,
        "status": "open"
    })


async def handle_web_chat_send(request):
    try:
        data = await request.json()
    except Exception:
        return web.json_response({"error": "Invalid JSON"}, status=400)

    session_id = data.get("session_id")
    sender_name = data.get("sender_name", "Client")
    content = data.get("content", "").strip()

    if not session_id or not content:
        return web.json_response({"error": "session_id and content required"}, status=400)

    ticket = TICKETS.setdefault(session_id, {
        "username": sender_name,
        "email": "client@web.com",
        "status": "open",
        "messages": []
    })

    msg_obj = {
        "id": f"msg_user_{int(get_utc_now().timestamp() * 1000)}",
        "session_id": session_id,
        "sender_name": sender_name,
        "sender_role": "user",
        "content": content,
        "created_at": get_utc_now().isoformat()
    }
    ticket.setdefault("messages", []).append(msg_obj)

    # Forward to Discord Ticket Channel
    if bot.is_ready():
        ch_id = ticket.get("channel_id")
        channel = None
        if ch_id:
            channel = bot.get_channel(ch_id)
        if not channel:
            channel = await get_or_create_ticket_channel(session_id, sender_name, ticket.get("email", ""), content)

        if channel:
            await channel.send(f"💬 **[Web] {sender_name}:** {content}")

    return web.json_response({"ok": True, "message": msg_obj})


async def handle_get_messages(request):
    session_id = request.query.get("session_id")
    if not session_id:
        return web.json_response({"error": "session_id required"}, status=400)

    ticket = TICKETS.get(session_id, {})
    return web.json_response({
        "session_id": session_id,
        "status": ticket.get("status", "open"),
        "messages": ticket.get("messages", [])
    })


async def handle_chat_ws(request):
    ws = web.WebSocketResponse()
    await ws.prepare(request)

    session_id = request.query.get("session_id")
    if not session_id:
        await ws.close(code=web.WSCloseCode.PROTOCOL_ERROR)
        return ws

    WS_CLIENTS.setdefault(session_id, set()).add(ws)
    logger.info(f"WebSocket client connected for session {session_id}")

    try:
        ticket = TICKETS.get(session_id, {})
        await ws.send_json({
            "type": "init",
            "status": ticket.get("status", "open"),
            "messages": ticket.get("messages", [])
        })

        async for msg in ws:
            if msg.type == aiohttp.WSMsgType.TEXT:
                try:
                    payload = json.loads(msg.data)
                    action = payload.get("action")
                    if action == "send_message":
                        content = payload.get("content", "").strip()
                        sender = payload.get("sender_name", "Client")
                        if content:
                            msg_obj = {
                                "id": f"msg_user_{int(get_utc_now().timestamp() * 1000)}",
                                "session_id": session_id,
                                "sender_name": sender,
                                "sender_role": "user",
                                "content": content,
                                "created_at": get_utc_now().isoformat()
                            }
                            TICKETS.setdefault(session_id, {
                                "username": sender,
                                "email": payload.get("email", ""),
                                "status": "open",
                                "messages": []
                            }).setdefault("messages", []).append(msg_obj)

                            await broadcast_to_session(session_id, {
                                "type": "chat_message",
                                **msg_obj
                            })

                            if bot.is_ready():
                                ch_id = TICKETS[session_id].get("channel_id")
                                channel = bot.get_channel(ch_id) if ch_id else None
                                if not channel:
                                    channel = await get_or_create_ticket_channel(
                                        session_id, sender, payload.get("email", ""), content
                                    )
                                if channel:
                                    await channel.send(f"💬 **[Web] {sender}:** {content}")
                except Exception as ex:
                    logger.warning(f"Error handling WS message: {ex}")
            elif msg.type == aiohttp.WSMsgType.ERROR:
                logger.warning(f"WS connection closed with error {ws.exception()}")
    finally:
        WS_CLIENTS.get(session_id, set()).discard(ws)
        logger.info(f"WebSocket client disconnected for session {session_id}")

    return ws


# --- Main Entry Point ---
def main():
    if not DISCORD_TOKEN or DISCORD_TOKEN == "YOUR_DISCORD_BOT_TOKEN_HERE":
        print("=" * 65)
        print("⚠️  ยังไม่ได้ใส่ DISCORD_TOKEN ในไฟล์ .env")
        print("วิธีรับ Bot Token:")
        print("1. ไปที่ https://discord.com/developers/applications")
        print("2. สร้าง Application -> แท็บ 'Bot' -> กด 'Reset Token' แล้วคัดลอกมา")
        print("3. นำมาใส่ในไฟล์ .env ในโฟลเดอร์นี้: DISCORD_TOKEN=your_token_here")
        print("4. เปิดใช้งาน Privileged Gateway Intents: 'MESSAGE CONTENT INTENT' ในหน้า Bot ด้วยนะ")
        print("=" * 65)
        print(f"กำลังเริ่มระบบ Website & API Server ในโหมด Local ที่พอร์ต {PORT}...")

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        app = web.Application(middlewares=[cors_middleware])
        app.router.add_get("/", handle_serve_index)
        app.router.add_get("/style.css", handle_serve_css)
        app.router.add_get("/script.js", handle_serve_js)
        app.router.add_get("/favicon.ico", handle_favicon)
        img_dir = os.path.join(BASE_DIR, "img")
        if os.path.isdir(img_dir):
            app.router.add_static("/img/", path=img_dir, name="img")
        app.router.add_get("/api/status", handle_status)
        app.router.add_post("/api/ticket/create", handle_create_ticket)
        app.router.add_post("/api/chat/send", handle_web_chat_send)
        app.router.add_get("/api/chat/messages", handle_get_messages)
        app.router.add_get("/api/chat/ws", handle_chat_ws)

        web.run_app(app, port=PORT)
        return

    print("=" * 65)
    print("กำลังเริ่มการทำงานของ Potter Discord Ticket Bot...")
    print(f"หน้าเว็บไซต์และ API Server: http://localhost:{PORT}")
    print("=" * 65)
    bot.run(DISCORD_TOKEN)


if __name__ == "__main__":
    main()
