/* ============================================================================
   WORKS — ไฟล์เดียวสำหรับ "เพิ่ม / แก้ / ลบ ผลงาน" (แท็บ ผลงาน) ไม่ต้องแตะ content.js
   วิธีเพิ่มผลงานใหม่:  คัดลอกบล็อก { ... }, ตัวอย่างด้านล่างไปวาง แล้วแก้ข้อความ
   • เรียงตามลำดับในไฟล์นี้ (บนสุดแสดงก่อน) · featured: true จะถูกดันขึ้นก่อนและการ์ดใหญ่กว่า
   • ใส่เฉพาะ title กับ desc ก็พอ ที่เหลือไม่ใส่ได้หมด · ข้อความเป็นภาษาไทยธรรมดา (อยากมีอังกฤษด้วยใส่ titleEn / descEn / detailEn)
   • ซ่อนผลงานชั่วคราวโดยไม่ลบ: ใส่ hidden: true
   • รูป: วางไฟล์ในโฟลเดอร์ img/works/ ชื่อภาษาอังกฤษ/ตัวเลขไม่มีเว้นวรรค แล้วใส่ img: "img/works/ชื่อไฟล์.png"
   • ลิงก์ต้องขึ้นต้นด้วย https:// เท่านั้น · ทุกบล็อกต้องมี , ปิดท้าย

   ช่องที่ใช้ได้ (ทั้งหมดไม่บังคับ ยกเว้น title):
     title      ชื่อผลงาน                       titleEn  ชื่อภาษาอังกฤษ (ไม่ใส่ = ใช้ชื่อไทย)
     desc       คำอธิบายสั้น 1 บรรทัด            descEn   (ไม่ใส่ = ใช้ภาษาไทย)
     detail     รายละเอียดยาว (Markdown ได้)     detailEn
     type       minecraft | website | app | bot | ai | experiment
     status     live (ใช้งานอยู่) | wip (กำลังทำ) | planned (วางแผน) | archived (เก็บถาวร)
     img        รูปปก     images  รูปประกอบในหน้ารายละเอียด เช่น ["img/works/a.png", "img/works/b.png"]
     tags       "Forge, Java, GeckoLib"  (คั่นด้วยคอมมา)
     link       ลิงก์ดูของจริง/ดาวน์โหลด (https://)     github  ลิงก์ GitHub (https://)
     featured   true = ผลงานเด่น          hidden  true = ซ่อน
     id         ชื่อสำหรับลิงก์ตรง (a-z 0-9 - เท่านั้น) ไม่ใส่ก็ได้
   ============================================================================ */
window.WORKS = [

  // ===== ตัวอย่าง (ลบ // หน้าบรรทัดแล้วแก้เป็นผลงานจริง) =====
  // {
  //   title: "ชื่อผลงานของผม",
  //   desc: "อธิบายสั้นๆ ว่าคืออะไร",
  //   type: "minecraft",
  //   status: "live",
  //   img: "img/works/my-work.png",
  //   tags: "Forge, Java",
  //   link: "https://example.com",
  //   github: "https://github.com/Potter8899/my-work",
  //   featured: true,
  // },

  { id: "3d-models", title: "3D Models", desc: "โมเดลและแอนิเมชันสำหรับ Minecraft", descEn: "Models and animations for Minecraft.",
    type: "minecraft", status: "live", tags: "Blockbench, Animation" },

];
