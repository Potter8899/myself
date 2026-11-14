# 06 — รายงานการทดสอบ (ตรงตามที่ทำจริง)

วันที่ทดสอบ: 14–15 พ.ย. 2026 · สภาพแวดล้อม: Python 3.12, Node 22, Chromium (Playwright) · **ไม่มีเครือข่ายออกภายนอก** และติดตั้ง FastAPI / discord.py / supabase ไม่ได้

## ทดสอบแล้วและผ่าน
| ส่วน | วิธี | ผล |
|---|---|---|
| Backend: logic หลัก (`core.py`) | unittest 11 ข้อ: scrypt, token/หมดอายุ/ปลอม, rate limit, role, ตรวจชนิดรูปจากไบต์จริง, URL ปลอดภัย, validation ทุกตาราง, สแปม | ผ่านทั้งหมด |
| Backend: ตัว handler ของ `main.py` | unittest 16 ข้อ บน **FastAPI จำลอง + Supabase จำลองในหน่วยความจำ** (`backend/tests/stubs`): สมัคร/ล็อกอิน/token ซ้ำ/CAPTCHA ล้มเหลว-ไม่มี secret/hostname, เปลี่ยนรหัสผ่านทำให้ session เก่าตาย, รหัสเดิม (legacy) รวมรหัสไทย, สิทธิ์แต่ละ role, กฎจัดการผู้ใช้, รหัสรีเซ็ต (ครั้งเดียว/หมดอายุ), CRUD + draft ซ่อนจากสาธารณะ, Guestbook (honeypot, สแปม, รายงาน 3 ครั้ง, อนุมัติ, rate limit), Contact, ตั๋ว (CAPTCHA เปิดตั๋วใหม่, คิวส่ง Discord, ห้ามซ้ำ, IDOR), อัปโหลด (SVG/PHP/exe ถูกปฏิเสธ, เกิน 3 MB, สิทธิ์), ลำดับ route | ผ่านทั้งหมด |
| ทดสอบว่าเทสต์จับบั๊กได้จริง | ทำให้โค้ดผิดโดยตั้งใจ 4 แบบ (ข้ามเช็กสิทธิ์ / ปิด replay protection / ไม่เช็กเวอร์ชัน token / รับไฟล์ทุกชนิด) | เทสต์ล้มทั้ง 4 แบบ |
| Frontend: Markdown/XSS | node 8 ข้อ (script/onerror/javascript:/data: ไม่ถูกสร้างเป็น node) | ผ่าน |
| Frontend: เว็บสาธารณะ | Chromium จริง 42 ข้อ (API จำลอง): โหลดไม่มี JS error, ทุก section, สลับ TH/EN, การ์ดโปรไฟล์ (เบลอ→ชัด, tilt, ออกแล้วรีเซ็ต, คลิกเปิด lightbox, ESC/คลิกนอก/ปุ่มปิด), lightbox ในแกลเลอรี (ถัดไป/ซูม), route ของโปรเจกต์/บล็อก, XSS ในบทความ, ฟอร์ม Guestbook/Contact ส่ง token + honeypot, ล็อกอิน, แชต, nav active, progress bar, มือถือ 375px ไม่ล้นจอ + เมนู, reduced motion | ผ่านทั้งหมด (รัน 3 รอบ ผลเหมือนกัน) |
| Frontend: Admin | Chromium จริง 21 ข้อ: ประตูล็อกอิน, เมนูตาม role (owner 16 หน้า / moderator จำกัด / user ถูกปฏิเสธ / token หมดอายุ), ตัวเลขภาพรวม, สร้างข้อมูล (body ตรง schema), อัปโหลดรูป (raw bytes), preview markdown ปลอดภัย, ตั๋ว+ตอบ, รหัสรีเซ็ต, settings, มือถือ | ผ่านทั้งหมด |
| ภาพหน้าจอ | ตรวจด้วยตา: เจอและแก้ 2 บั๊ก (ตัวอักษรสำรอง "P" บังรูปโปรไฟล์เพราะ CSS ทับ `hidden`; หน้ามือถือล้นจอ) | แก้แล้ว + เพิ่มเทสต์กันซ้ำ |
| `build.sh`, ไฟล์ Python/JS | รันสคริปต์จริง (สร้าง config.js, sitemap, robots, canonical; ปฏิเสธ URL ไม่ใช่ https), `py_compile`, `node --check` | ผ่าน |

## ยังไม่ได้ทดสอบ (ต้องทำเองหลัง deploy)
- **FastAPI / uvicorn จริง** (เทสต์ใช้ตัวจำลองที่เรียกฟังก์ชัน handler ตรงๆ ไม่ผ่าน HTTP, CORS, middleware, การ parse JSON/Header ของ FastAPI จริง) และการติดตั้ง `requirements.txt` ยังไม่เคยรัน
- **Supabase จริง**: SQL migration ยังไม่เคยรันบน Postgres จริง, PostgREST/Storage/RLS ตามจริง, ไวยากรณ์ `like`/`in_`/join `users(...)` ฝั่ง supabase-py
- **Cloudflare Turnstile จริง** (ในเทสต์ใช้ widget/endpoint จำลอง)
- **Discord Bot ทั้งตัว**: `bot.py` ผ่านแค่ตรวจไวยากรณ์ — Login, Slash commands, ปุ่ม, สร้างห้องตั๋ว, ตอบสองทาง, กู้คืนหลังรีสตาร์ท ยังไม่เคยรันกับ Discord จริง
- **Render build/start** และ **bot-hosting.net startup/Python version/ขีดจำกัด/เหรียญ** (ไม่มีสิทธิ์เข้าบัญชี)
- ฟอนต์ Google Fonts (บล็อกในสภาพแวดล้อมทดสอบ ใช้ฟอนต์สำรองแทน), ประสิทธิภาพบนเครื่องจริง/ iPhone จริง/ touch จริง (ทดสอบ pointer event เท่านั้น)

## ข้อจำกัดที่ทราบ
- Rate limit เก็บในหน่วยความจำ (1 process) รีเซ็ตเมื่อ Backend หลับ/รีสตาร์ท; จำกัดขนาด request ด้วย Content-Length (อัปโหลดนับไบต์จริงระหว่างสตรีม)
- ไม่มีบริการอีเมล: รีเซ็ตรหัสผ่านต้องให้ admin ออกรหัส
- ไม่มีการแปลงรูปเป็น WebP/AVIF ฝั่งเซิร์ฟเวอร์ (มี lazy loading + จำกัด 3 MB แนะนำอัปโหลดเป็น WebP)
- ลิงก์บทความ/โปรเจกต์ใช้ hash (`#/blog/slug`) แชร์ได้ แต่เสิร์ชเอนจินไม่ index แยกรายหน้า; sitemap มีเฉพาะหน้าแรก
- ลบแถวข้อมูลไม่ลบไฟล์ใน Storage อัตโนมัติ (มี endpoint `DELETE /api/admin/upload?url=`)
- ปิดตั๋วจาก Dashboard ไม่ส่ง transcript เข้า Discord (ปิดจาก Discord จะส่ง)
