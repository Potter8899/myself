# Potter Personal Space

เว็บพอร์ตโฟลิโอธีมอวกาศ + Backend (FastAPI) + Discord Ticket Bot (discord.py) + Supabase + Cloudflare Turnstile

## โครงสร้าง
- `web/` — Frontend (`content.js` = ข้อมูลทั้งหมดของเว็บ แก้ที่เดียว, `img/profile.jpg` = รูปของคุณ)
- `server.py` — Backend API (สมัคร/ล็อกอิน, ตรวจ Turnstile ฝั่งเซิร์ฟเวอร์, rate limit, honeypot, ตั๋ว/แชต) และเสิร์ฟเว็บ
- `bot.py` — Discord Bot
- `setup.sql` — ตารางใหม่ + ย้ายข้อมูลเดิม + RLS (ไฟล์เดียว)

## ติดตั้ง
1. **รูปโปรไฟล์**: วางรูปจริงที่ `web/img/profile.jpg` (ถ้าไม่มีจะแสดงตัวอักษร P แทน)
2. **Supabase**: เปิด SQL Editor รัน `setup.sql` ทั้งไฟล์ แล้วคัดลอก Project URL และ **`service_role` / secret key** (ไม่ใช่ publishable/anon key)
3. `cp .env.example .env` แล้วกรอกค่า (ห้าม commit `.env`)
4. `pip install -r requirements.txt`
5. รัน Backend: `uvicorn server:app --port 8000` → เปิด http://localhost:8000
6. รัน Bot (อีกหน้าต่าง): `python bot.py`

## ตั้งค่า Cloudflare Turnstile
Cloudflare Dashboard → Turnstile → Add widget → ใส่โดเมนของคุณ (ทดสอบ local ใส่ `localhost`) → นำ **Site Key** ใส่ `TURNSTILE_SITEKEY` และ **Secret Key** ใส่ `TURNSTILE_SECRET`
- Secret อยู่ใน Backend เท่านั้น Frontend ได้เฉพาะ Site Key ผ่าน `/api/config`
- Backend ตรวจ token กับ siteverify เอง, กันโทเคนซ้ำ (ตาราง `used_captcha`), แยกสถานะหมดอายุ/ล้มเหลว
- ถ้า Turnstile ล่ม หรือไม่ได้ตั้ง Secret ระบบจะ **ปฏิเสธ** (503) ไม่ปล่อยผ่าน
- ต้องผ่าน CAPTCHA ตอน สมัคร, ล็อกอิน และเปิดตั๋วใหม่

## ตั้งค่า Discord Bot
1. https://discord.com/developers/applications → New Application → Bot → Reset Token (ใส่ `DISCORD_TOKEN`) และเปิด **MESSAGE CONTENT INTENT**
2. OAuth2 → URL Generator: scopes `bot` + `applications.commands`; permissions: Manage Channels, View Channels, Send Messages, Read Message History, Add Reactions, Attach Files → เชิญเข้าเซิร์ฟเวอร์
3. เปิด Developer Mode คัดลอก Server ID ใส่ `DISCORD_GUILD_ID`
4. รัน `/setup` ใน Discord (สร้างหมวด `🎫 Tickets`, `ticket-panel`, `ticket-logs`)

**การทำงาน**: ลูกค้าพิมพ์ในเว็บ → บอทสร้างห้อง `ticket-ชื่อ` (ไม่ซ้ำ เพราะมี unique index ตั๋วที่เปิดอยู่) → คุณพิมพ์ตอบในห้อง (ต้องมีสิทธิ์ Manage Channels) → ขึ้นบนเว็บภายใน ~2.5 วินาที พร้อม ✅ ใน Discord
คำสั่ง: `/setup` `/close` `/ticket` `/user` `/stats` `/status` ปุ่ม Claim / Close / Reopen, Transcript ส่งเข้า `ticket-logs`, แจ้งเตือนสมาชิกใหม่/ตั๋วใหม่/error
Dashboard: แถบท้ายเว็บแสดง Bot Online/Offline (heartbeat), จำนวนตั๋ว ผู้ใช้ ข้อความ

## ย้ายข้อมูลจากระบบเดิม
`setup.sql` ย้ายบัญชี/ตั๋ว/ข้อความจาก `chat_*` และล็อกตารางเก่าให้ในตัว รหัสผ่านเดิมรองรับกรณีเก็บเป็น plaintext หรือ SHA-256 และจะถูกเปลี่ยนเป็น scrypt เมื่อผู้ใช้ล็อกอินครั้งแรก ถ้าเดิมใช้ hash แบบอื่น (เช่น bcrypt) ผู้ใช้เหล่านั้นล็อกอินไม่ได้ ต้องสมัครใหม่
**หลังย้าย ควรหมุน anon key ใน Supabase** เพราะ key เดิมเคยอ่านข้อมูลทั้งหมดได้

## แจกโค้ดด้วย UI ใน Discord
- `/codepanel` โพสต์แผงที่มีเมนูเลือก ผู้ใช้เลือกรายการแล้วบอทส่งโค้ด + ไฟล์ให้แบบเห็นคนเดียว (ephemeral)
- แอดมิน: `/code_add` (ฟอร์มพิมพ์โค้ด ไม่เกิน 4000 ตัวอักษร), `/code_upload` (แนบไฟล์ข้อความ ไม่เกิน 200 KB), `/code_remove`
- ทุกคน: `/code <ชื่อ>` (มี autocomplete) แผงจะอัปเดตเมนูเองเมื่อเพิ่ม/ลบ และนับจำนวนที่ดาวน์โหลด
- ต้องรัน `setup.sql` ใหม่ (มีตาราง `code_snippets` เพิ่ม)

## Token ใน bot.py
แก้บรรทัด `DISCORD_TOKEN = "PASTE_YOUR_DISCORD_BOT_TOKEN_HERE"` ที่ต้นไฟล์ **อย่า commit ไฟล์ที่ใส่ token แล้วขึ้น GitHub สาธารณะ** (repo นี้เป็น public) ถ้า token หลุด ให้ Reset Token ที่ Developer Portal ทันที

## ความปลอดภัย (สรุป)
- รหัสผ่านเก็บแบบ scrypt + salt, session เป็น HMAC token อายุ 7 วัน
- RLS เปิดทุกตาราง ไม่มี policy และ revoke anon/authenticated → เข้าถึงได้เฉพาะ service_role ของ Backend/Bot; Frontend ไม่คุย Supabase ตรง
- Bot ↔ Backend ใช้ service key ผ่านฐานข้อมูลเดียวกัน (ไม่มี endpoint เปิดให้ Bot เรียก จึงไม่มีช่องให้ปลอมตัว)
- Validation ทั้งฝั่งเซิร์ฟเวอร์และฐานข้อมูล, query ผ่าน client แบบ parameterized, Frontend ใช้ `textContent` กัน XSS, CSP + security headers
- Rate limit: สมัคร 5/ชม., ล็อกอิน 10/10 นาที, ข้อความ 20/นาที (เก็บในหน่วยความจำ ใช้ได้กับ 1 process; ถ้าขยายหลาย instance ให้ย้ายไป Redis)
- ตั้ง `TRUST_PROXY=1` เฉพาะเมื่ออยู่หลัง Cloudflare/Nginx เพื่ออ่าน IP จริง

## Deploy
- VPS: รัน `uvicorn server:app --host 127.0.0.1 --port 8000` + `python bot.py` ด้วย systemd/pm2 แล้วใช้ Nginx/Caddy ทำ HTTPS (Let's Encrypt) ชี้มาที่พอร์ต 8000; ตั้ง `ALLOWED_ORIGIN` เป็นโดเมนจริง
- แพลตฟอร์ม (Railway/Render/Fly): สร้าง 2 service จาก repo เดียว (start command: `uvicorn server:app --host 0.0.0.0 --port $PORT` และ `python bot.py`) ใส่ env ตาม `.env.example`
- GitHub Pages / Netlify ใช้ไม่ได้เพราะต้องมี Backend

## หมายเหตุ
ชุดนี้เขียนใหม่ทั้งหมดเพราะผมอ่านไฟล์เดิมใน repo ไม่ได้ (เห็นแค่รายการไฟล์และ README) ให้ย้ายไฟล์เดิมไปโฟลเดอร์สำรองก่อนวางทับ และถ้ามีข้อมูลผู้ใช้เดิมใน Supabase ต้องย้ายเข้าตารางใหม่เอง
