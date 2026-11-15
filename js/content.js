/* ============================================================================
   เนื้อหาทั้งหมดของเว็บอยู่ในไฟล์นี้ไฟล์เดียว — แก้ที่นี่แล้วอัปโหลดใหม่ ไม่มีฐานข้อมูล/แอดมิน
   • ข้อความสองภาษาเขียนเป็น { th: "ไทย", en: "English" } (เว้นว่างได้ ส่วนที่ว่างจะถูกซ่อน)
   • รูป: วางไฟล์ในโฟลเดอร์ img/ แล้วใส่ path เช่น "img/profile.jpg" หรือใช้ลิงก์ https://
   • ลิงก์ภายนอกต้องขึ้นต้นด้วย https:// เท่านั้น
   • ไม่มีการแต่งประวัติ/ความสำเร็จ/เปอร์เซ็นต์ทักษะให้ — ใส่เฉพาะที่เป็นจริง
   ============================================================================ */
window.SITE_CONTENT = {
  profile: {
    name: "Potter",
    photo: "img/profile.jpg",                      // วางรูปจริงของคุณชื่อ profile.jpg ในโฟลเดอร์ img/ (ถ้าไม่มี จะแสดงตัวอักษร P)
    tagline: { th: "Developer · Minecraft · 3D Modeling", en: "Developer · Minecraft · 3D Modeling" },
    intro:   { th: "ผมสร้างเว็บ โปรแกรม และม็อด Minecraft พร้อมโมเดล 3D ด้วย Blockbench", en: "I build websites, programs and Minecraft mods, with 3D models made in Blockbench." },
    who:     { th: "ผมคือ Potter นักพัฒนาที่หลงใหลในเทคโนโลยี ชอบสร้างระบบที่ใช้งานได้จริง ตั้งแต่เว็บไซต์ บอท Discord ไปจนถึงม็อดและปลั๊กอินสำหรับเซิร์ฟเวอร์ Minecraft",
               en: "I am Potter, a developer who loves technology and building systems that really work — from websites and Discord bots to mods and plugins for Minecraft servers." },
    story:    { th: "", en: "" },   // เรื่องของคุณ (รองรับ Markdown)
    journey:  { th: "", en: "" },   // เส้นทางการพัฒนา
    goals:    { th: "", en: "" },   // เป้าหมาย
    building: { th: "", en: "" },   // สิ่งที่คุณสร้าง
    learning: [],                   // เช่น ["Rust", "Kotlin"]
    interests: ["Programming", "Python", "Web Development", "Minecraft Development", "Discord Bot Development", "3D Modeling", "Badminton", "Technology"],
    email: "",                      // ถ้ากรอก จะแสดงปุ่มอีเมลในส่วนติดต่อ (เว้นว่างถ้าไม่ต้องการเปิดเผย)
    socials: [ { label: "GitHub", url: "https://github.com/Potter8899" } ]
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

  projects: [  // category: website | application | discord_bot | minecraft | ai | experiment   status: live | wip | planned | archived
    { slug: "deadzone-server-tools", category: "minecraft", status: "live", featured: true, cover: "", github: "", demo: "", tags: ["Forge", "Java", "GeckoLib"],
      title: { th: "DeadZone Server Tools", en: "DeadZone Server Tools" }, summary: { th: "ม็อดและปลั๊กอินสำหรับเซิร์ฟเวอร์ Minecraft 1.20.1", en: "Mods and plugins for a Minecraft 1.20.1 server." },
      body: { th: "", en: "" }, images: [] /* [{ src: "img/shot1.png", caption: { th: "", en: "" } }] */ },
    { slug: "discord-ticket-bot", category: "discord_bot", status: "live", featured: true, cover: "", github: "", demo: "", tags: ["Python", "discord.py", "Supabase"],
      title: { th: "Discord Ticket Bot", en: "Discord Ticket Bot" }, summary: { th: "ระบบตั๋วสองทางเชื่อมเว็บไซต์แบบเรียลไทม์", en: "A two-way ticket system connected to the website in near real time." }, body: { th: "", en: "" }, images: [] },
    { slug: "3d-models", category: "minecraft", status: "live", featured: false, cover: "", github: "", demo: "", tags: ["Blockbench", "Animation"],
      title: { th: "3D Models", en: "3D Models" }, summary: { th: "โมเดลและแอนิเมชันสำหรับ Minecraft", en: "Models and animations for Minecraft." }, body: { th: "", en: "" }, images: [] }
  ],

  gallery: [  // category: personal | projects | screenshots | workspace | models | creative
    // { src: "img/gallery/workspace.jpg", category: "workspace", caption: { th: "โต๊ะทำงาน", en: "My desk" } },
  ],

  blog: [  // เขียนด้วย Markdown (# หัวข้อ, **หนา**, - รายการ, [ข้อความ](https://...), ``` โค้ด ```)  status: "published" | "draft" (draft จะไม่แสดง)
    // { slug: "hello-world", status: "published", date: "2026-11-15", category: "devlog", tags: ["web"], cover: "",
    //   title: { th: "สวัสดีโลก", en: "Hello world" }, excerpt: { th: "สรุปสั้นๆ", en: "Short summary" },
    //   body: { th: "# สวัสดี\n\nเนื้อหา...", en: "# Hello\n\nContent..." } },
  ]
};
