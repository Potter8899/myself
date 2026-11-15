/* ============================================================================
   MEDIA — ไฟล์เดียวสำหรับ "เพิ่มรูป / ไฟล์" (ไม่ต้องแตะ content.js)
   วิธีใช้: 1) เอาไฟล์ไปวางในโฟลเดอร์  2) เพิ่มชื่อไฟล์ลงในรายการด้านล่าง  3) อัปโหลดขึ้น GitHub ใหม่
   • ตั้งชื่อไฟล์เป็นภาษาอังกฤษ/ตัวเลข ไม่มีเว้นวรรค  เช่น  my-room.jpg  (ห้ามใช้ "รูป 1.jpg")
   • ลิงก์ภายนอกต้องขึ้นต้นด้วย https:// เท่านั้น
   ============================================================================ */
window.MEDIA = {

  // 1) รูปโปรไฟล์ (รูปใหญ่ในหน้าแรก) — วางไฟล์ไว้ที่ img/ แล้วใส่ชื่อ
  profilePhoto: "img/profile.jpg",

  // 1.1) พรอมต์ที่ใช้ทำรูปโปรไฟล์ — จะแสดงตอนคนกดดูรูปโปรไฟล์ (เว้นว่าง "" ถ้าไม่ต้องการแสดง)
  profilePrompt: `Use the uploaded face photo as the identity reference. Create an ultra-realistic full-body mirror selfie matching the reference image as closely as possible.
Face and mask:
* The person must wear a realistic red Spider-Man mask.
* Include the iconic black spider-web pattern.
* Large white Spider-Man eye lenses with black outlines.
* The mask must fully cover the entire face.
* Preserve the person's identity only as an underlying reference; do not show their uncovered face.

Pose and composition:
* Full-body mirror selfie.
* Standing straight in front of a large mirror.
* Holding a smartphone in front of the mask with one hand.
* Relaxed, natural posture.
* Centered composition.

Environment:
* Minimalist room.
* Dark charcoal gray wall.
* Dark tiled floor with subtle reflections.
* Large vertical mirror.

Lighting and atmosphere:
* Very dark cinematic lighting.
* Low exposure.
* Deep shadows.
* Mysterious dark aesthetic.
* Subtle ambient lighting.

Photography:
* Photorealistic smartphone photography.
* Full-body framing.
* Vertical 9:16 aspect ratio.
* Realistic mirror reflections.
* Natural human proportions.

IMPORTANT:
Recreate the reference image's overall appearance, pose, framing, environment, and dark atmosphere. Do not invent a different outfit or change the scene. The red Spider-Man mask is essential.`,

  // 2) แกลเลอรี — วางรูปไว้ที่ img/gallery/ แล้วเพิ่มบรรทัดละรูป
  //    เขียนแบบสั้น:   "img/gallery/a.jpg",
  //    หรือมีคำอธิบาย: { src: "img/gallery/b.jpg", caption: "ห้องของผม" },
  //    หมวด (ไม่บังคับ): personal | projects | screenshots | workspace | models | creative
  gallery: [
    // "img/gallery/a.jpg",
    // { src: "img/gallery/b.jpg", caption: "ห้องของผม", category: "workspace" },
  ],

  // 3) ไฟล์ให้ดาวน์โหลด — วางไฟล์ไว้ที่ files/ แล้วเพิ่มบรรทัดละไฟล์
  files: [
    // { name: "ม็อดของผม v1", file: "files/my-mod-v1.zip", note: "สำหรับ Minecraft 1.20.1" },
  ]
};
