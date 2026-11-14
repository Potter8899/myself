# 05 — Discord Bot บน bot-hosting.net

## สิ่งที่ตรวจจากวิกิทางการ (wiki.bot-hosting.net, 14 พ.ย. 2026)
- ระบบทำงานด้วย **เหรียญ (coins)**: ได้เหรียญฟรีจากการเข้าใช้งาน/ทำกิจกรรม และเซิร์ฟเวอร์ใช้เหรียญเป็นรายสัปดาห์/เดือน — **เหรียญฟรีอาจไม่พอสำหรับเปิดตลอด** ตรวจจำนวนเหรียญและค่าใช้จ่ายในหน้า dashboard ก่อน และ**อย่าซื้อแพ็กเกจเสียเงิน**หากต้องการคงเงื่อนไข "ไม่มีค่าใช้จ่าย"
- สร้างเซิร์ฟเวอร์ภาษา Python → อัปโหลดไฟล์ (อัปโหลด .zip แล้วกด Unarchive ได้) → แท็บ Startup ระบุไฟล์หลัก (`bot.py`) → ติดตั้งแพ็กเกจจาก `requirements.txt`
## สิ่งที่วิกิ **ไม่ระบุ** (ห้ามสมมติ — เช็กในหน้า panel ของคุณ)
เวอร์ชัน Python ที่ใช้ได้จริง, ขีดจำกัด RAM/CPU/พื้นที่, นโยบายรีสตาร์ท/uptime, และ **ช่องกรอก Environment Variables** — เพราะฉะนั้นบอทอ่านค่าจาก env ก่อน และ **ถ้าไม่มี จะอ่านไฟล์ `.env` ที่อยู่ข้าง `bot.py`** (ไฟล์นี้ไม่อยู่ใน ZIP ที่ส่งมอบ ให้สร้างและอัปโหลดผ่าน File Manager เอง)
การเชื่อมต่อ Discord Gateway เป็นการเชื่อมต่อขาออก (outbound) ตามปกติของ discord.py: ตรวจว่าเซิร์ฟเวอร์เริ่มและล็อกอินได้จริงจากหน้า Console หลังเริ่ม

## ขั้นตอน
1. https://discord.com/developers/applications → New Application → Bot → Reset Token (เก็บเป็นความลับ) และเปิด **Message Content Intent**
2. OAuth2 → URL Generator: scopes `bot` + `applications.commands`; permissions: Manage Channels, View Channels, Send Messages, Read Message History, Add Reactions, Attach Files, Embed Links → เชิญบอทเข้าเซิร์ฟเวอร์ (เปิด Developer Mode เพื่อคัดลอก Server ID)
3. สร้างไฟล์ `.env` (ในเครื่อง ไม่ commit):
```
DISCORD_BOT_TOKEN=...
DISCORD_GUILD_ID=...
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SECRET_KEY=...
# ไม่บังคับ: DISCORD_TICKET_CATEGORY_ID=  DISCORD_LOG_CHANNEL_ID=
```
4. ใน bot-hosting.net: สร้างเซิร์ฟเวอร์ Python → อัปโหลดโฟลเดอร์ `bot/` (`bot.py`, `requirements.txt`) + `.env` → Startup file = `bot.py` → Start
5. ใน Discord รัน `/setup` (สร้างหมวด `🎫 Tickets`, `ticket-panel`, `ticket-logs`) แล้วทดสอบ `/ping`

## การทำงาน (ฐานข้อมูลคือคิวและแหล่งข้อมูลหลัก)
เว็บ/Dashboard เขียนข้อความลงตาราง `messages` (`pushed=false`) → บอทโพลทุก 3 วินาทีแล้วโพสต์เข้าห้องตั๋ว → `pushed=true` ; แอดมินพิมพ์ในห้อง → บอทบันทึก `messages` → เว็บโพลทุก 4 วินาทีเฉพาะตอนเปิดแผงแชต
- บอทรีสตาร์ท/ออฟไลน์: ข้อความที่ค้างถูกส่งต่อเมื่อกลับมา ไม่มีอะไรเก็บใน RAM อย่างเดียว
- ส่งไม่สำเร็จจะลองใหม่ สูงสุด 5 ครั้งต่อข้อความ แล้วข้ามพร้อมแจ้งใน log channel (แถวเดียวไม่บล็อกคิว)
- ตั๋วซ้ำถูกกันด้วย unique index ในฐานข้อมูล
- เลือกใช้ฐานข้อมูลตรงแทน HTTP→Backend เพราะ Backend บน Render ฟรีหลับ และการโพลทุกไม่กี่วินาทีจะปลุกมัน (ซึ่งขัดกับข้อกำหนดห้ามกันหลับ) ข้อแลกเปลี่ยน: Secret key ของ Supabase ต้องอยู่บนโฮสต์ของบอทด้วย

## คำสั่ง
ทีมงาน (ต้องมีสิทธิ์ Manage Channels): `/setup` `/ticket` `/claim` `/assign` `/close` `/reopen` `/transcript` `/user` `/stats` `/status` · ทั่วไป: `/help` `/ping` · แจกโค้ด: `/code` `/codepanel` `/code_add` `/code_upload` `/code_remove`
ปุ่มในห้องตั๋ว: Claim, Assign (เลือกทีมงาน), Transcript, Close Ticket, Reopen
แจ้งเตือนใน log channel: สมาชิกใหม่, ตั๋วใหม่, ตั๋วปิด/เปิดซ้ำ (พร้อม transcript), ข้อความติดต่อใหม่, Backend error, Bot error (ไม่เกิน 1 ครั้ง/10 นาที), Security (honeypot, token ซ้ำ, Turnstile ล่ม, รายงาน Guestbook, เปลี่ยน role/ลบผู้ใช้/ออกรหัสรีเซ็ต)
