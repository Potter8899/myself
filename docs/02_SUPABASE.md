# 02 — Supabase (Free)

1. สร้างโปรเจกต์ที่ https://supabase.com (แผน Free)
2. **SQL Editor** → รันตามลำดับ:
   1. `database/001_base_setup.sql` (ตารางผู้ใช้/ตั๋ว/ข้อความ/ล็อก/RLS เดิม รันซ้ำได้)
   2. `database/migrations/002_portfolio.sql` (ตาราง portfolio, blog, guestbook, contact, role 5 ระดับ, bucket รูปภาพ, ข้อมูลเริ่มต้น)
3. **Project Settings → API**: คัดลอก Project URL และ **secret / service_role key** → ใส่ `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (Backend และ Bot เท่านั้น **ห้ามใส่ใน Frontend**)
4. ทุกตารางเปิด RLS และไม่มี policy + `revoke` จาก anon/authenticated ดังนั้น publishable/anon key เข้าถึงข้อมูลไม่ได้ และเว็บไม่เคยคุย Supabase ตรง
5. Storage: bucket `portfolio` ถูกสร้างโดย SQL (public อ่านได้, จำกัด 3 MB, เฉพาะ jpeg/png/webp/gif) การอัปโหลด/ลบทำผ่าน Backend ที่ตรวจสิทธิ์และตรวจไบต์จริงของไฟล์เท่านั้น
6. ตั้งตัวเองเป็นเจ้าของ (หลังสมัครบนเว็บแล้ว): `update users set role='owner' where username='ชื่อของคุณ';`

## Roles
| role | ทำอะไรได้ |
|---|---|
| visitor | ดู portfolio, เขียน guestbook/contact (ผ่าน CAPTCHA) |
| user | + แชต/ตั๋ว, เปลี่ยนรหัสผ่าน |
| moderator | + Dashboard: Guestbook, Contact, Tickets, Logs, Security, Discord |
| admin | + แก้เนื้อหาทั้งหมด, อัปโหลดรูป, Settings, ดูผู้ใช้, ออกรหัสรีเซ็ตรหัสผ่าน (เฉพาะผู้ที่ role ต่ำกว่า) |
| owner | + เปลี่ยน role, ลบผู้ใช้ |

ข้อควรรู้: โควตา Free ของ Supabase (ขนาดฐานข้อมูล, Storage, การพักโปรเจกต์เมื่อไม่มีการใช้งาน) เปลี่ยนได้ ตรวจที่หน้าราคาของ Supabase ก่อนใช้งานจริง
