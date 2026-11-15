/* ============================================================================
   เนื้อหาทั้งหมดของเว็บอยู่ในไฟล์นี้ไฟล์เดียว — แก้ที่นี่แล้วอัปโหลดใหม่ ไม่มีฐานข้อมูล/แอดมิน
   • ข้อความหลายภาษาเขียนเป็น { th: "ไทย", en: "English", ru: "Русский" } (เว้นว่างได้ ส่วนที่ว่างจะถูกซ่อน)
   • รูป: วางไฟล์ในโฟลเดอร์ img/ แล้วใส่ path เช่น "img/profile.jpg" หรือใช้ลิงก์ https://
   • ลิงก์ภายนอกต้องขึ้นต้นด้วย https:// เท่านั้น
   • ไม่มีการแต่งประวัติ/ความสำเร็จ/เปอร์เซ็นต์ทักษะให้ — ใส่เฉพาะที่เป็นจริง
   ============================================================================ */
window.SITE_CONTENT = {
  profile: {
    name: "Potter",
    // ชื่อ-ชั้น-ชื่อเล่น (แสดงใต้ชื่อ POTTER ในหน้าแรก) — ช่อง en / ru เว้นว่างได้ ภาษารัสเซียจะใช้อังกฤษแทน แล้วไทยตามลำดับ
    fullName: { th: "ด.ช. พัฒนพล ภักดีอำนาจ", en: "" },   // ใส่ชื่อภาษาอังกฤษในช่อง en ถ้าต้องการ
    grade:    { th: "ม.2", en: "Grade 8 (Mathayom 2)", ru: "8 класс (Матхаём 2)" },
    nickname: { th: "พอตเตอร์ (Potter)", en: "Potter" },
    photo: "img/profile.jpg",                      // วางรูปจริงของคุณชื่อ profile.jpg ในโฟลเดอร์ img/ (ถ้าไม่มี จะแสดงตัวอักษร P)
    tagline: { th: "Developer · Minecraft · 3D Modeling", en: "Developer · Minecraft · 3D Modeling" },
    intro:   { th: "ผมสร้างเว็บ โปรแกรม และม็อด Minecraft พร้อมโมเดล 3D ด้วย Blockbench", en: "I build websites, programs and Minecraft mods, with 3D models made in Blockbench.", ru: "Я создаю сайты, программы и моды для Minecraft, а 3D-модели делаю в Blockbench." },
    who:     { th: "ผมคือ ด.ช. พัฒนพล ภักดีอำนาจ ชั้น ม.2 ชื่อเล่น พอตเตอร์ (Potter) นักพัฒนาที่หลงใหลในเทคโนโลยี ชอบสร้างระบบที่ใช้งานได้จริง ตั้งแต่เว็บไซต์ บอท Discord ไปจนถึงม็อดและปลั๊กอินสำหรับเซิร์ฟเวอร์ Minecraft",
               en: "I am Potter, a Grade 8 student and developer who loves technology and building systems that really work — from websites and Discord bots to mods and plugins for Minecraft servers.",
               ru: "Я Поттер, ученик 8 класса и разработчик, увлечённый технологиями. Люблю создавать системы, которые действительно работают: от сайтов и Discord-ботов до модов и плагинов для серверов Minecraft." },
    story:    { th: "", en: "" },   // เรื่องของคุณ (รองรับ Markdown)
    journey:  { th: "", en: "" },   // เส้นทางการพัฒนา
    goals:    { th: "", en: "" },   // เป้าหมาย
    building: { th: "", en: "" },   // สิ่งที่คุณสร้าง
    learning: [],                   // เช่น ["Rust", "Kotlin"]
    interests: ["Programming", "Python", "Web Development", "Minecraft Development", "Discord Bot Development", "3D Modeling", "Badminton", "Technology"],
    email: "",                      // ถ้ากรอก จะแสดงปุ่มอีเมลในส่วนติดต่อ (เว้นว่างถ้าไม่ต้องการเปิดเผย)
    socials: [ { label: "GitHub", url: "https://github.com/Potter8899" }, { label: "Discord", url: "https://discordapp.com/users/1386368220511993937" } ]
  },

  skills: [  // category: programming | development | tools | other  (ไม่มีเปอร์เซ็นต์ — ใส่ได้เฉพาะระดับที่คุณยืนยันเองในช่อง note)
    { name: "Python", category: "programming", icon: "🐍" }, { name: "JavaScript", category: "programming", icon: "🟨" }, { name: "HTML", category: "programming", icon: "🌐" },
    { name: "CSS", category: "programming", icon: "🎨" }, { name: "Kotlin", category: "programming", icon: "🟣" }, { name: "Java", category: "programming", icon: "☕" },
    { name: "Frontend", category: "development", icon: "🖥️" }, { name: "Backend", category: "development", icon: "⚙️" }, { name: "REST API", category: "development", icon: "🔌" },
    { name: "Database", category: "development", icon: "🗄️" }, { name: "Discord Bot", category: "development", icon: "🤖" },
    { name: "VS Code", category: "tools", icon: "🧩" }, { name: "Git", category: "tools", icon: "🌿" }, { name: "GitHub", category: "tools", icon: "🐙" }, { name: "PowerShell", category: "tools", icon: "💠" },
    { name: "Minecraft Development", category: "other", icon: "⛏️" }, { name: "3D Modeling", category: "other", icon: "🧊" }, { name: "UI Design", category: "other", icon: "✨" }
  ],

  timeline: [  // ตัวอย่าง (ลบเครื่องหมายคอมเมนต์แล้วแก้เป็นเรื่องจริงของคุณ) kind: milestone | project | learning | tech | future
    // { when: "2025", kind: "milestone", title: { th: "...", en: "..." }, body: { th: "", en: "" } },
  ],

  projects: [],  // ผลงานย้ายไปแก้ง่ายๆ ที่ js/works.js แล้ว (ช่องนี้ยังใช้ได้ถ้าอยากเขียนแบบเต็ม { th, en })

  gallery: [  // category: personal | projects | screenshots | workspace | models | creative
    // { src: "img/gallery/workspace.jpg", category: "workspace", caption: { th: "โต๊ะทำงาน", en: "My desk" } },
  ],

  blog: [  // เขียนด้วย Markdown (# หัวข้อ, **หนา**, - รายการ, [ข้อความ](https://...), ``` โค้ด ```)  status: "published" | "draft" (draft จะไม่แสดง)
    // { slug: "hello-world", status: "published", date: "2026-11-15", category: "devlog", tags: ["web"], cover: "",
    //   title: { th: "สวัสดีโลก", en: "Hello world" }, excerpt: { th: "สรุปสั้นๆ", en: "Short summary" },
    //   body: { th: "# สวัสดี\n\nเนื้อหา...", en: "# Hello\n\nContent..." } },
  ]
};
