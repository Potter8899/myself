# 03 — Cloudflare Turnstile (Free)

1. Cloudflare Dashboard → Turnstile → Add widget → ใส่โดเมนเว็บ (และ `localhost` สำหรับทดสอบ) → โหมด Managed
2. **Site Key** → `TURNSTILE_SITE_KEY` (Backend ส่งให้ Frontend ผ่าน `/api/config`), **Secret Key** → `TURNSTILE_SECRET_KEY` (Backend เท่านั้น)
3. `TURNSTILE_HOSTNAMES` = hostname ที่อนุญาต (เช่น `potter-site.onrender.com`) Backend เทียบกับ `hostname` ที่ Cloudflare ส่งกลับ

สิ่งที่ Backend ทำ (`verify_captcha` ใน `backend/main.py`)
- เรียก `siteverify` ฝั่งเซิร์ฟเวอร์ทุกครั้ง ไม่เชื่อ Frontend
- **Replay protection**: เก็บ hash ของ token ในตาราง `used_captcha` (primary key) token ซ้ำถูกปฏิเสธและบันทึกเป็น security event
- แยกสถานะ: ไม่ส่ง token / ล้มเหลว / หมดอายุ (`timeout-or-duplicate`) / ใช้ซ้ำ / บริการล่ม — หมดอายุตามเวลาของ Cloudflare (ประมาณ 5 นาที)
- ตรวจ hostname, ถ้าไม่ได้ตั้ง Secret ระบบ**ปฏิเสธ (503)** ไม่ปล่อยผ่าน
- ใช้กับ: สมัคร, ล็อกอิน, รีเซ็ตรหัสผ่าน, Guestbook, Contact, เปิดตั๋วใหม่ + honeypot + rate limit + ตรวจสแปมอย่างง่าย (ลิงก์เกิน 2 / ตัวอักษรซ้ำยาว)
Frontend แสดงสถานะ: กำลังโหลด / กำลังตรวจ / ยืนยันแล้ว / ล้มเหลว / หมดอายุ + ปุ่มลองใหม่
