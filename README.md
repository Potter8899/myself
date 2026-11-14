# POTTER PERSONAL SPACE

เว็บ portfolio ธีม Deep Space + Backend (FastAPI) + Supabase + Cloudflare Turnstile + Admin Dashboard + Discord Ticket Bot
พัฒนาต่อจาก `My_Self.zip` เดิม (รักษาระบบสมาชิก ตั๋ว แชต แจกโค้ด และ schema เดิมไว้ทั้งหมด)

```
frontend/   เว็บสาธารณะ + admin.html (ไฟล์สแตติก ไม่ต้อง build ยกเว้น build.sh บน Render)
backend/    FastAPI (main.py, core.py = logic ที่ทดสอบได้) + tests
bot/        Discord bot (discord.py)
database/   001_base_setup.sql (เดิม) + migrations/002_portfolio.sql
docs/       01 ติดตั้ง · 02 Supabase · 03 Turnstile · 04 Render · 05 bot-hosting.net · 06 รายงานทดสอบ
tests/      frontend/md test, e2e (Playwright), run_all.sh
render.yaml · .env.example · .python-version
```

## สถาปัตยกรรม
```
Browser ──(static)──► Render Static Site (frontend/)
   │  HTTPS+JSON
   ▼
Render Web Service (backend/, FastAPI)  ──► Supabase (Postgres + Storage)  ◄──  Discord Bot (bot-hosting.net)
   ▲ Turnstile siteverify                       DB = แหล่งข้อมูลหลักและคิวข้อความ        │
   └── Cloudflare Turnstile                                                               ▼ Discord
```

## ทำอะไรได้ (สรุป)
- **หน้าเว็บ**: Hero + การ์ดโปรไฟล์ 3D (เบลอ/มืดตอนปกติ → ชัด/แสงขาว/tilt/ขอบนีออนตอน hover, รีเซ็ตตอนเมาส์ออก, คลิกเปิด lightbox เต็มจอ, รองรับสัมผัส), About + Timeline, Skills (กรองหมวด, คลิกเพื่อดูโปรเจกต์ที่เกี่ยวข้อง, ไม่มี % ที่ไม่ได้ยืนยัน), Projects (ค้นหา/กรอง/Featured/modal+หน้ารายละเอียด/แกลเลอรีรูป), Gallery (masonry, lazy, lightbox ซูม), Blog (Markdown, draft/publish, หมวด, แท็ก, ค้นหา, แบ่งหน้า, เวลาอ่าน), Guestbook (ตรวจสอบ/รายงาน), Contact → แจ้ง Discord, TH/EN, SEO (meta, OG, JSON-LD, sitemap/robots ผ่าน `build.sh`), ลดการเคลื่อนไหว (reduced motion)
- **บัญชี**: สมัคร/ล็อกอิน/ออกจากระบบ/เปลี่ยนรหัสผ่าน/ออกจากทุกอุปกรณ์/รีเซ็ตด้วยรหัสจาก admin, 5 role (visitor, user, moderator, admin, owner) ตรวจสิทธิ์ฝั่ง Backend ทุก endpoint
- **Dashboard** (`/admin.html`): Overview (ตัวเลขจริงจาก DB), Profile & About, Skills, Projects, Project images, Timeline, Gallery, Blog (editor + preview), Guestbook, Contact, Tickets (ตอบ/รับ/ปิด/เปิดใหม่), Users, Discord, Security, Settings, Activity logs, อัปโหลดรูปขึ้น Supabase Storage
- **Discord**: ดู `docs/05_BOT_HOSTING.md`

## สิ่งที่ตัดสินใจต่างจากพรอมต์ (และเหตุผล)
| พรอมต์ | ที่ทำจริง | เหตุผล |
|---|---|---|
| Bot เรียก Backend ด้วย `BOT_API_SECRET` | Bot อ่าน/เขียนคิวใน Supabase โดยตรง | Backend บน Render ฟรีหลับ การโพลจะปลุกมัน (ห้ามกันหลับ) และไม่ทำให้ข้อความหายเมื่อ Backend หลับ ข้อแลกเปลี่ยน: service key ต้องอยู่บนโฮสต์ของบอท |
| ตารางแยก `technologies`, `gallery_categories`, `blog_categories`, `admin_roles`, `ticket_assignments`, `discord_guild_settings`, `discord_ticket_mappings`, `notification_events` | ใช้คอลัมน์ในตารางเดิม: tags (jsonb), category, `users.role`, `tickets.assigned_to/channel_id`, `settings`, flag `notified/pushed` | ลดความซับซ้อน ไม่ซ้ำซ้อนกับ schema เดิม |
| Supabase Auth | ตาราง `users` + scrypt + HMAC token เดิม | รักษาบัญชีเดิม ไม่ต้องย้ายผู้ใช้ |
| WebSocket | Polling (แชต 4 วิ เฉพาะตอนเปิดแผง, บอท 3 วิ) | เหมาะกับ Render/bot-hosting ฟรี |
| ลืมรหัสผ่านทางอีเมล | admin ออกรหัสครั้งเดียว 30 นาที | ไม่มีบริการอีเมลฟรีที่ตั้งค่าไว้ |
| Ticket categories | ยังไม่ทำ | ไม่ได้อยู่ในระบบเดิมและไม่ใช่ส่วนที่จำเป็นต่อการทำงาน |
| รูปโปรไฟล์ | ไม่มีรูปจริงในแพ็กเกจ | ห้ามสร้างรูปบุคคลแทน: อัปโหลดรูปของคุณใน Dashboard (ถ้ายังไม่มีจะแสดงตัวอักษร P) |
เนื้อหาเริ่มต้นใน DB มีเฉพาะที่มาจากโปรเจกต์เดิมและรายการที่คุณระบุในพรอมต์ (ทักษะ, ความสนใจ, GitHub `Potter8899`, 3 โปรเจกต์เดิม) ไม่มีประวัติ/ความสำเร็จ/เปอร์เซ็นต์ที่แต่งขึ้น

## ความปลอดภัย (สรุป)
scrypt + salt · token HMAC พร้อมเวอร์ชัน (ยกเลิก session ได้) · ล็อกอินไม่รั่วว่ามีผู้ใช้หรือไม่ (เวลา+ข้อความเท่ากัน) · Turnstile ฝั่งเซิร์ฟเวอร์ + replay + hostname + honeypot + rate limit · ไม่ใช้ cookie → ไม่เสี่ยง CSRF (ใช้ Authorization header) · ไม่มี `innerHTML` ในโค้ดเว็บ (กัน XSS) + CSP · URL ที่รับต้อง `https://` · อัปโหลดตรวจ magic bytes ไม่เชื่อ Content-Type, ชื่อไฟล์สุ่ม · RLS ทุกตาราง · IP เก็บเป็น hash เท่านั้น · ไม่มี secret ใน ZIP (`.env.example` เท่านั้น)

## เริ่มต้นเร็ว
`docs/02` (Supabase) → `docs/03` (Turnstile) → `docs/01` (รันในเครื่อง) → `docs/04` (Render) → `docs/05` (Bot) · สถานะการทดสอบ: `docs/06`
**ถ้า secret เคยหลุดหรือเคยอยู่ใน repo สาธารณะ** (เช่น anon key เดิมตามที่ README เก่าเตือน, Discord token) ให้หมุน/รีเซ็ตก่อนใช้งานจริง
