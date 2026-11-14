# 04 — Render (Frontend static + Backend web service)

Render ใช้เฉพาะเว็บและ Backend **ไม่ใช้รัน Discord Bot**

## ข้อจำกัดของแผน Free (ตามเอกสาร Render ณ 14 พ.ย. 2026 — ตรวจซ้ำก่อนใช้งาน)
- Web service ฟรี **หยุดทำงานเมื่อไม่มีทราฟฟิกประมาณ 15 นาที** และคำขอแรกหลังจากนั้นใช้เวลาราว 1 นาทีเพื่อ "ปลุก" (cold start)
- ระบบไฟล์ชั่วคราว: ไฟล์ที่เขียนลงดิสก์หายเมื่อรีสตาร์ท → รูปทั้งหมดเก็บใน Supabase Storage
- มีโควตาชั่วโมง/แบนด์วิดท์ต่อเดือน
ออกแบบรองรับ: เว็บแสดงข้อความ "เซิร์ฟเวอร์กำลังตื่น" เมื่อคำขอช้าเกิน 4 วินาที, timeout 75 วินาที, ปุ่มลองใหม่ทุกส่วน, ไม่มีการ ping เพื่อกันหลับ และ **ไม่อ้างว่าออนไลน์ 24/7** (Rate limit เก็บในหน่วยความจำจึงรีเซ็ตเมื่อ cold start)
Bot อ่านคิวจาก Supabase โดยตรง ไม่เรียก Backend จึงไม่ปลุก Backend และไม่พลาดข้อความตอนที่ Backend หลับ

## ขั้นตอน
1. อัปโหลดโปรเจกต์ขึ้น GitHub (ไม่มี `.env` — มี `.gitignore` ให้แล้ว) → Render → New → **Blueprint** → เลือก repo (ใช้ `render.yaml`)
2. กรอกค่า `sync: false` ตาม `.env.example`: Backend `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_HOSTNAMES`, `CORS_ORIGINS`; Frontend `API_URL`, `SITE_URL` (`SESSION_SECRET` สร้างให้อัตโนมัติ)
3. ลำดับที่ง่ายที่สุด: สร้างทั้งสอง service ก่อนเพื่อรู้ URL จริง แล้วกลับมาใส่ `CORS_ORIGINS` / `TURNSTILE_HOSTNAMES` (Backend) และ `API_URL` / `SITE_URL` (Frontend) แล้ว redeploy
4. ตรวจ: เปิด `https://<api>/health` ต้องได้ `{"ok":true}` (เพิ่ม `?deep=1` เพื่อทดสอบฐานข้อมูล) แล้วเปิดเว็บ
5. โดเมนของตัวเอง: เปลี่ยน `connect-src` ใน `render.yaml` (headers) ให้รวมโดเมน API ของคุณ แล้วอัปเดต `CORS_ORIGINS` / `TURNSTILE_HOSTNAMES`

**หมายเหตุ**: ผมไม่ได้ deploy ให้ — Render ต้องล็อกอินบัญชีของคุณ ไฟล์นี้ยังไม่เคยถูก deploy จริง
