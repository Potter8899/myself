# 01 — ติดตั้งและรันบนเครื่องตัวเอง

ต้องมี: Python 3.12, บัญชี Supabase และ Cloudflare Turnstile (ฟรีทั้งคู่) ดู 02 และ 03 ก่อน

```bash
cd potter-personal-space
cp .env.example backend/.env        # แก้ค่าในไฟล์ (ใช้เฉพาะส่วน BACKEND) และตั้ง SERVE_FRONTEND=1
cd backend && python -m venv .venv && . .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --port 8000        # เปิด http://localhost:8000  (Dashboard: /admin.html)
```
- ตอนทดสอบ local ใส่ `localhost` ในรายชื่อโดเมนของ Turnstile widget และตั้ง `TURNSTILE_HOSTNAMES=localhost`, `CORS_ORIGINS=http://localhost:8000`
- สมัครสมาชิกบนเว็บ แล้วรัน SQL ตั้งตัวเองเป็นเจ้าของ (ดู 02): `update users set role='owner' where username='ชื่อของคุณ';`
- เข้า `/admin.html` → Profile & About → อัปโหลดรูปจริงของคุณและกรอกข้อมูล (ช่องที่ว่างจะถูกซ่อนบนเว็บ ไม่มีการแต่งข้อมูลให้)
- รัน Bot แยก: ดู 05 (ในเครื่อง: `cd bot && pip install -r requirements.txt && python bot.py` โดยมีไฟล์ `bot/.env`)

## รันเทสต์
`sh tests/run_all.sh` (ส่วนเบราว์เซอร์ต้อง `pip install playwright && playwright install chromium`) รายละเอียดใน 06
