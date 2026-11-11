/**
 * Potter Portfolio & Minecraft 3D Modeler
 * Multi-Language, Space Canvas, Anti-Bot Registration, Two-Way Discord Ticket Bot & Supabase
 */

(function () {
  "use strict";

  // --- Configuration ---
  const BOT_API_URL = "http://localhost:5000";
  const BOT_WS_URL = "ws://localhost:5000/api/chat/ws";

  const RESERVED_NAMES = [
    "admin",
    "administrator",
    "แอดมิน",
    "potter",
    "พอตเตอร์",
    "moderator",
    "system",
    "root",
    "bot",
    "discord",
    "ผู้ดูแล",
    "админ",
    "модератор"
  ];

  const DEFAULT_IMAGES = [
    { src: "img/p1.jpg", title: "Potter Avatar & 3D Project", isSample: false },
    {
      src: "data:image/svg+xml," + encodeURIComponent(`
        <svg xmlns='http://www.w3.org/2000/svg' width='600' height='750' viewBox='0 0 600 750'>
          <defs>
            <linearGradient id='bgGrad' x1='0%' y1='0%' x2='100%' y2='100%'>
              <stop offset='0%' stop-color='#0f172a'/>
              <stop offset='50%' stop-color='#1e1b4b'/>
              <stop offset='100%' stop-color='#090d16'/>
            </linearGradient>
          </defs>
          <rect width='600' height='750' fill='url(#bgGrad)'/>
          <g transform='translate(300, 360) scale(1.6)'>
            <polygon points='0,-60 60,-25 0,10 -60,-25' fill='#2de2ff' opacity='0.9'/>
            <polygon points='-60,-25 0,10 0,80 -60,45' fill='#1b94ad' opacity='0.95'/>
            <polygon points='0,10 60,-25 60,45 0,80' fill='#0f6274' opacity='0.95'/>
            <polygon points='0,-60 0,10 60,-25' fill='#ffffff' opacity='0.2'/>
          </g>
          <text x='300' y='540' font-size='26' fill='#2de2ff' font-weight='bold' text-anchor='middle' font-family='sans-serif'>Minecraft 3D Boss Model</text>
          <text x='300' y='575' font-size='16' fill='#94a3b8' text-anchor='middle' font-family='sans-serif'>Blockbench • Custom Animations</text>
        </svg>`),
      title: "Minecraft 3D Boss Model",
      isSample: true,
    },
    {
      src: "data:image/svg+xml," + encodeURIComponent(`
        <svg xmlns='http://www.w3.org/2000/svg' width='600' height='750' viewBox='0 0 600 750'>
          <defs>
            <linearGradient id='bgSword' x1='0%' y1='0%' x2='100%' y2='100%'>
              <stop offset='0%' stop-color='#090d16'/>
              <stop offset='50%' stop-color='#2e1065'/>
              <stop offset='100%' stop-color='#0f172a'/>
            </linearGradient>
          </defs>
          <rect width='600' height='750' fill='url(#bgSword)'/>
          <g transform='translate(300, 350) rotate(45) scale(1.4)'>
            <polygon points='0,-90 14,-20 6,40 -6,40 -14,-20' fill='#c084fc'/>
            <polygon points='0,-90 0,40 14,-20' fill='#e9d5ff' opacity='0.7'/>
            <rect x='-25' y='40' width='50' height='10' rx='4' fill='#2de2ff'/>
            <rect x='-7' y='50' width='14' height='40' rx='3' fill='#475569'/>
            <circle cx='0' cy='96' r='9' fill='#c084fc'/>
          </g>
          <text x='300' y='540' font-size='26' fill='#c084fc' font-weight='bold' text-anchor='middle' font-family='sans-serif'>Custom Fantasy Weapons</text>
          <text x='300' y='575' font-size='16' fill='#94a3b8' text-anchor='middle' font-family='sans-serif'>ItemsAdder & Oraxen Ready</text>
        </svg>`),
      title: "Custom Fantasy Weapons",
      isSample: true,
    },
  ];

  // --- Multi-Language Translations ---
  const I18N = {
    th: {
      langName: "ไทย",
      heroGreeting: "สวัสดีครับ ผมชื่อเล่น",
      heroName: "พอตเตอร์",
      typeStrings: [
        "นักทำโมเดล 3D Minecraft (Blockbench)",
        "ผู้พัฒนามอดและระบบ Minecraft",
        "นักพัฒนาเว็บ แอป และเครื่องมือเฉพาะทาง",
      ],
      welcomeTitle: "ยินดีต้อนรับสู่ Portfolio ของ พอตเตอร์",
      welcomeDesc:
        "รับทำโมเดล Minecraft 3D (Blockbench) พัฒนามอด และระบบซอฟต์แวร์",
      langSelectLabel: "เลือกภาษา / Select Language / Выберите язык",
      tabRegister: "เปิดตั๋วใหม่ / สมัครสมาชิก",
      tabLogin: "เข้าสู่ระบบ (มีบัญชีแล้ว)",
      nameInputLabel: "ชื่อผู้ใช้ (Username) - กันชื่อซ้ำ",
      namePlaceholder: "กรอกชื่อผู้ใช้...",
      emailInputLabel: "อีเมลของคุณ (สำหรับติดต่อและรับแจ้งเตือน)",
      emailPlaceholder: "name@example.com",
      passInputLabel: "รหัสผ่าน (Password - ขั้นต่ำ 6 ตัวอักษร)",
      passPlaceholder: "กำหนดรหัสผ่านของคุณ...",
      antiBotLabel: "ระบบตรวจสอบความปลอดภัย (Anti-Bot Challenge)",
      antiBotErr: "คำตอบคำนวณไม่ถูกต้อง กรุณาลองใหม่",
      nameEmpty: "กรุณาระบุชื่อผู้ใช้",
      nameTaken: "ชื่อผู้ใช้นี้ถูกใช้งานแล้ว โปรดเลือกชื่ออื่น",
      nameReserved: "ชื่อนี้เป็นชื่อสงวนของระบบ กรุณาใช้ชื่ออื่น",
      nameAvailable: "ชื่อนี้สามารถใช้งานได้",
      emailInvalid: "รูปแบบอีเมลไม่ถูกต้อง",
      passShort: "รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร",
      loginNotFound: "ไม่พบบัญชีนี้ในระบบ กรุณาสมัครสมาชิกใหม่",
      loginWrongPass: "รหัสผ่านไม่ถูกต้อง",
      authSubmitRegister: "เข้าสู่เว็บไซต์ & เริ่มแชต",
      authSubmitLogin: "เข้าสู่ระบบ",
      tabs: {
        about: "เกี่ยวกับ",
        projects: "ผลงาน & โมเดล",
        gallery: "แกลเลอรี",
        hire: "รับทำโมเดล & งาน",
        chat: "สอบถามงาน / แชต Discord",
        code: "แจกโค้ด",
        contact: "ติดต่อ",
      },
      aboutHead: "เกี่ยวกับผม",
      factNameLabel: "ชื่อ",
      factNameVal: "พัฒนพล ภักดีอำนาจ (พอตเตอร์)",
      factSpecLabel: "ความเชี่ยวชาญ",
      factSpecVal: "Minecraft 3D Modeling (Blockbench), Mod & Web Dev",
      factSchoolLabel: "โรงเรียน",
      factSchoolVal: "แก่นนครวิทยาลัย (มัธยมศึกษาปีที่ 2)",
      aboutBio:
        "รักการสร้างสรรค์โมเดล 3D สไตล์บล็อกและม็อบแฟนตาซีสำหรับ Minecraft ควบคู่กับการพัฒนาเว็บไซต์ แอปพลิเคชัน และมอดสำหรับเซิร์ฟเวอร์ ออกแบบจริง ลงมือทำจริง และพร้อมรับงานสั่งทำคุณภาพสูง",
      projectsHead: "ผลงาน & โมเดลที่เคยทำ",
      galleryHead: "แกลเลอรีรูปภาพ & โมเดล",
      galleryUploadBtn: "เลือกรูปเพิ่ม",
      resetGalleryBtn: "รีเซ็ตรูปภาพ",
      galleryNotice:
        "ลากรูปมาวางได้ • กดปุ่มลบเพื่อลบรูปที่ไม่ต้องการ • กดที่รูปเพื่อดูขนาดเต็ม",
      deleteConfirm: "คุณต้องการลบรูปนี้ใช่หรือไม่?",
      hireHead: "บริการรับทำโมเดล & รับงาน",
      hireCtaText:
        "สนใจสั่งงานหรือต้องการสอบถามประเมินราคา สามารถกดทักแชตในหน้านี้ได้เลยครับ",
      goToChatBtn: "ไปยังห้องแชตสอบถามงาน",
      chatHead: "ระบบตั๋วสอบถามงาน & แชตสองทางกับ Discord",
      chatSubtitle:
        "พิมพ์ข้อความที่นี่ ข้อความจะส่งตรงไปยังห้อง Ticket ใน Discord ของพอตเตอร์ และเมื่อพอตเตอร์พิมพ์ตอบกลับใน Discord ข้อความจะปรากฏที่นี่ทันที",
      chatInputPlaceholder: "พิมพ์ข้อความสอบถามงาน...",
      chatSendBtn: "ส่งข้อความ",
      clearChatBtn: "ล้างประวัติแชต",
      clearConfirm: "คุณต้องการลบประวัติการสนทนาทั้งหมดของคุณใช่หรือไม่?",
      chatNote:
        "ระบบเชื่อมต่อโดยตรงกับ Discord Ticket Bot • แอดมินตอบกลับจาก Discord โดยตรง",
      ticketStatusOpen: "ตั๋วเปิดอยู่ (Ticket Open)",
      ticketStatusClosed: "ตั๋วถูกปิดแล้ว (Ticket Closed)",
      botOnlineText: "Discord Bot พร้อมใช้งาน",
      autoWelcome:
        "สวัสดีครับ! ข้อความที่คุณพิมพ์ในห้องนี้จะส่งตรงเข้าห้อง Ticket ในเซิร์ฟเวอร์ Discord ของผมทันที เมื่อผมตอบใน Discord ข้อความจะปรากฏที่นี่แบบ Realtime ครับ",
      codeHead: "แจกโค้ด & ตัวอย่าง",
      codeTitle: "ตัวอย่างโค้ด: หน่วงเวลาใน JavaScript",
      codeCopy: "คัดลอก",
      codeCopied: "คัดลอกแล้ว",
      codeNote: "โค้ดและไลบรารีเพิ่มเติมจะทยอยอัปเดตลงบน GitHub",
      contactHead: "ช่องทางการติดต่อ",
      contactChatDesc: "สอบถามงานในเว็บได้ทันที ส่งตรงเข้า Discord ของพอตเตอร์",
      contactGoChat: "เปิดแชตตั๋วสอบถาม",
      dropText: "วางรูปที่นี่เพื่อเพิ่มในแกลเลอรี",
      p1Title: "Custom Minecraft 3D Mobs & Bosses",
      p1Desc: "ออกแบบโมเดลบอส อาวุธ และสัตว์ประหลาดสำหรับเซิร์ฟเวอร์ Minecraft พร้อมแอนิเมชันโจมตีและสกิล รองรับ MythicMobs และ ItemsAdder",
      p2Title: "มอด Minecraft Forge / Spigot Plugins",
      p2Desc: "มอดระบบร้านค้าในเกม มอดกู้คืนบล็อกกระจก และระบบจัดการ NPC อัจฉริยะสำหรับคอมมูนิตี้",
      p3Title: "SHARK Shop",
      p3Desc: "เว็บร้านค้าออนไลน์ โทนม่วง-ฟ้าโมเดิร์น รองรับหลายภาษา มีระบบจัดการสินค้าและเติมเงิน",
      p4Title: "AI Badminton Referee",
      p4Desc: "แอปพลิเคชันกรรมการและผู้ตัดสินแบดมินตัน ใช้กล้องประมวลผลตำแหน่งลูกและนับคะแนนอัตโนมัติ",
      p5Title: "Potter Notify Bridge",
      p5Desc: "ระบบส่งการแจ้งเตือนจากมือถือไปแสดงผลบนหน้าจอคอมพิวเตอร์ผ่านเครือข่ายภายในบ้าน",
      srv1Title: "โมเดล Minecraft 3D (Blockbench)",
      srv1Desc: "รับทำโมเดลบอส ม็อบ สัตว์ อาวุธ ชุดเกราะ ไอเทม และเฟอร์นิเจอร์ พร้อมแอนิเมชันโจมตี/เดิน รองรับ ModelEngine, MythicMobs, ItemsAdder, Java & Bedrock",
      srv2Title: "มอดและปลั๊กอิน Minecraft",
      srv2Desc: "พัฒนา Forge / Fabric mod, Spigot / Paper plugins, ระบบเควสต์, ระบบร้านค้า และกลไกเฉพาะทางสำหรับเซิร์ฟเวอร์",
      srv3Title: "พัฒนาเว็บไซต์ & เว็บร้านค้า",
      srv3Desc: "ทำเว็บพอร์ตโฟลิโอ เว็บร้านค้าไอเทมเกม ออกแบบ UI ทันสมัย รองรับมือถือและคอมพิวเตอร์",
      srv4Title: "แอป Android & ซอฟต์แวร์ Windows",
      srv4Desc: "พัฒนาโปรแกรมเครื่องมือเฉพาะทาง แอปพลิเคชันด้วย Kotlin และเครื่องมือเชื่อมโยงข้อมูล",
      srv5Title: "สคริปต์ & Discord Ticket Bot",
      srv5Desc: "พัฒนาบอท Discord สองทาง ระบบตั๋วสอบถามงานอัตโนมัติ และการเชื่อมต่อฐานข้อมูล",
    },
    en: {
      langName: "EN",
      heroGreeting: "Hello, my nickname is",
      heroName: "Potter",
      typeStrings: [
        "Minecraft 3D Modeler (Blockbench)",
        "Minecraft Mod & System Developer",
        "Web, App & Custom Tools Developer",
      ],
      welcomeTitle: "Welcome to Potter's Portfolio",
      welcomeDesc:
        "Specialist in Minecraft 3D Modeling (Blockbench), custom mod development, and software engineering.",
      langSelectLabel: "Select Language / เลือกภาษา / Выберите язык",
      tabRegister: "Open New Ticket / Register",
      tabLogin: "Sign In (Existing User)",
      nameInputLabel: "Username (Unique check)",
      namePlaceholder: "Enter your username...",
      emailInputLabel: "Your Email (for notifications)",
      emailPlaceholder: "name@example.com",
      passInputLabel: "Password (Min 6 chars)",
      passPlaceholder: "Choose a secure password...",
      antiBotLabel: "Security Verification (Anti-Bot Challenge)",
      antiBotErr: "Incorrect math calculation. Please retry.",
      nameEmpty: "Please enter a username",
      nameTaken: "This username is already taken. Please choose another.",
      nameReserved: "This name is reserved by the system. Please pick another.",
      nameAvailable: "This username is available",
      emailInvalid: "Invalid email format",
      passShort: "Password must be at least 6 characters",
      loginNotFound: "Account not found. Please register first.",
      loginWrongPass: "Incorrect password",
      authSubmitRegister: "Enter Portfolio & Start Chat",
      authSubmitLogin: "Sign In",
      tabs: {
        about: "About",
        projects: "Works & Models",
        gallery: "Gallery",
        hire: "Commissions",
        chat: "Discord Ticket Chat",
        code: "Code Snippets",
        contact: "Contact",
      },
      aboutHead: "About Me",
      factNameLabel: "Name",
      factNameVal: "Phatthanaphon Phakdeiamnat (Potter)",
      factSpecLabel: "Expertise",
      factSpecVal: "Minecraft 3D Modeling (Blockbench), Mod & Web Dev",
      factSchoolLabel: "School",
      factSchoolVal: "Kaennakhon Witthayalai School (Grade 8)",
      aboutBio:
        "Passionate about creating 3D blocky and fantasy models for Minecraft alongside developing web applications and server mods. Dedicated to delivering high-quality, game-ready assets.",
      projectsHead: "Portfolio & Minecraft Models",
      galleryHead: "Photo & Model Gallery",
      galleryUploadBtn: "Add Images",
      resetGalleryBtn: "Reset Gallery",
      galleryNotice:
        "Drag & drop images • Click Delete to remove images • Click image for full view",
      deleteConfirm: "Do you want to delete this image?",
      hireHead: "Services & Commissions",
      hireCtaText:
        "Interested in custom 3D models or tech development? Chat directly with me below.",
      goToChatBtn: "Open Commission Chat",
      chatHead: "Discord Two-Way Ticket Chat",
      chatSubtitle:
        "Type your message here. It forwards directly into Potter's Discord ticket channel, and Potter's Discord replies appear here in real-time.",
      chatInputPlaceholder: "Type your message or project details...",
      chatSendBtn: "Send Message",
      clearChatBtn: "Clear History",
      clearConfirm: "Are you sure you want to clear your chat history?",
      chatNote:
        "Directly connected to Discord Ticket Bot • Admin replies right from Discord",
      ticketStatusOpen: "Ticket Open",
      ticketStatusClosed: "Ticket Closed",
      botOnlineText: "Discord Bot Online",
      autoWelcome:
        "Hi! Any message you type here creates a dedicated ticket in my Discord server. When I reply in Discord, you will see my message right here in real-time!",
      codeHead: "Code Snippets",
      codeTitle: "Code Snippet: Delay Promise in JavaScript",
      codeCopy: "Copy",
      codeCopied: "Copied!",
      codeNote: "More code repositories and libraries are updated on GitHub.",
      contactHead: "Contact Channels",
      contactChatDesc: "Chat directly on the website, forwards straight into Discord",
      contactGoChat: "Open Ticket Chat",
      dropText: "Drop images here to add to gallery",
      p1Title: "Custom Minecraft 3D Mobs & Bosses",
      p1Desc: "Designing 3D bosses, custom fantasy mobs, and weaponry for Minecraft servers with fluid animations. Compatible with MythicMobs and ItemsAdder.",
      p2Title: "Minecraft Forge Mods & Spigot Plugins",
      p2Desc: "In-game store mods, glass recovery mechanics, and smart NPC interactions for multiplayer communities.",
      p3Title: "SHARK Shop",
      p3Desc: "Modern e-commerce platform with dual-language support, inventory management, and instant top-ups.",
      p4Title: "AI Badminton Referee",
      p4Desc: "Mobile referee app powered by camera computer vision to detect shuttlecock landings and track live scores automatically.",
      p5Title: "Potter Notify Bridge",
      p5Desc: "Real-time notification forwarding system from mobile devices to desktop PC over local Wi-Fi network.",
      srv1Title: "Minecraft 3D Modeling (Blockbench)",
      srv1Desc: "Custom bosses, mobs, weapons, armor sets, and furniture with fluid attack/idle animations. Ready for ModelEngine, MythicMobs, ItemsAdder.",
      srv2Title: "Minecraft Mods & Server Plugins",
      srv2Desc: "Forge / Fabric mods, Spigot / Paper plugins, custom shops, quest lines, and specialized gameplay mechanics.",
      srv3Title: "Web & Store Development",
      srv3Desc: "Modern portfolios, gaming webshops, sleek responsive UI for desktop and mobile devices.",
      srv4Title: "Android & Windows Applications",
      srv4Desc: "Custom utility software, Android apps with Kotlin, and cross-platform desktop integration.",
      srv5Title: "Automation Scripts & Discord Bots",
      srv5Desc: "Python automations, Discord webhook bots, and real-time database integrations.",
    },
    ru: {
      langName: "RU",
      heroGreeting: "Привет, меня зовут",
      heroName: "Поттер",
      typeStrings: [
        "3D Моделер Minecraft (Blockbench)",
        "Разработчик модов и систем Minecraft",
        "Разработчик веб-сайтов и приложений",
      ],
      welcomeTitle: "Добро пожаловать в портфолио Поттера",
      welcomeDesc:
        "Специалист по 3D моделированию для Minecraft (Blockbench), разработке модов и программного обеспечения.",
      langSelectLabel: "Выберите язык / Select Language / เลือกภาษา",
      tabRegister: "Новый тикет / Регистрация",
      tabLogin: "Войти (Есть аккаунт)",
      nameInputLabel: "Имя пользователя (Проверка уникальности)",
      namePlaceholder: "Ваш никнейм...",
      emailInputLabel: "Ваш Email (для уведомлений)",
      emailPlaceholder: "name@example.com",
      passInputLabel: "Пароль (минимум 6 символов)",
      passPlaceholder: "Введите пароль...",
      antiBotLabel: "Проверка безопасности (Анти-Бот)",
      antiBotErr: "Неверный ответ. Попробуйте еще раз.",
      nameEmpty: "Пожалуйста, введите имя пользователя",
      nameTaken: "Это имя уже занято. Пожалуйста, выберите другое.",
      nameReserved: "Это имя зарезервировано системой.",
      nameAvailable: "Имя свободно",
      emailInvalid: "Некорректный формат email",
      passShort: "Пароль должен содержать минимум 6 символов",
      loginNotFound: "Аккаунт не найден. Пожалуйста, зарегистрируйтесь.",
      loginWrongPass: "Неверный пароль",
      authSubmitRegister: "Войти и начать чат",
      authSubmitLogin: "Войти",
      tabs: {
        about: "Обо мне",
        projects: "Модели и работы",
        gallery: "Галерея",
        hire: "Заказы",
        chat: "Тикет-чат Discord",
        code: "Код",
        contact: "Контакты",
      },
      aboutHead: "Обо мне",
      factNameLabel: "Имя",
      factNameVal: "Паттанапон Пакдиамнат (Поттер)",
      factSpecLabel: "Специализация",
      factSpecVal: "3D Моделирование Minecraft (Blockbench), Моды и Веб",
      factSchoolLabel: "Школа",
      factSchoolVal: "Школа Кэннакхон Виттаялай (8 класс)",
      aboutBio:
        "Создаю уникальные 3D модели мобов, боссов и оружия для Minecraft, а также разрабатываю моды для серверов и веб-сервисы. Качественно и с вниманием к деталям.",
      projectsHead: "Проекты и 3D Модели",
      galleryHead: "Галерея Моделей и Фото",
      galleryUploadBtn: "Добавить фото",
      resetGalleryBtn: "Сбросить",
      galleryNotice:
        "Перетащите фото • Кнопка Удалить убирает фото • Кликните для полного просмотра",
      deleteConfirm: "Вы действительно хотите удалить это изображение?",
      hireHead: "Услуги и разработка на заказ",
      hireCtaText:
        "Хотите заказать 3D модель для Minecraft? Задайте вопрос прямо в чате на сайте.",
      goToChatBtn: "Перейти в чат заказов",
      chatHead: "Двусторонний чат тикетов с Discord",
      chatSubtitle:
        "Ваше сообщение поступит прямо в тикет-канал Discord Поттера, а ответы Поттера из Discord мгновенно появятся здесь в реальном времени.",
      chatInputPlaceholder: "Напишите сообщение или детали заказа...",
      chatSendBtn: "Отправить",
      clearChatBtn: "Очистить историю",
      clearConfirm: "Вы уверены, что хотите удалить историю чата?",
      chatNote:
        "Прямая связь с Discord Ticket Bot • Администратор отвечает напрямую из Discord",
      ticketStatusOpen: "Тикет открыт",
      ticketStatusClosed: "Тикет закрыт",
      botOnlineText: "Discord Bot онлайн",
      autoWelcome:
        "Здравствуйте! Ваши сообщения создают отдельный тикет в моем Discord сервере. Когда я отвечу в Discord, сообщение сразу появится здесь в реальном времени!",
      codeHead: "Примеры кода",
      codeTitle: "Пример: Задержка выполнения в JavaScript",
      codeCopy: "Копировать",
      codeCopied: "Скопировано",
      codeNote: "Дополнительные репозитории и код доступны на GitHub.",
      contactHead: "Контакты",
      contactChatDesc: "Прямой тикет-чат прямо на сайте с пересылкой в Discord",
      contactGoChat: "Открыть тикет-чат",
      dropText: "Перетащите изображение сюда для добавления",
      p1Title: "Кастомные 3D мобы и боссы Minecraft",
      p1Desc: "3D модели боссов, мобов и фэнтезийного оружия для серверов Minecraft с боевыми анимациями. Совместимо с MythicMobs и ItemsAdder.",
      p2Title: "Моды Forge и плагины Spigot",
      p2Desc: "Внутриигровые магазины, возврат стекла и NPC с настраиваемым поведением для мультиплеера.",
      p3Title: "SHARK Shop",
      p3Desc: "Современный онлайн-магазин с поддержкой нескольких языков, каталогом и системой пополнения баланса.",
      p4Title: "AI Badminton Referee",
      p4Desc: "Мобильное приложение для судейства в бадминтоне с распознаванием падения волана через камеру и подсчетом очков.",
      p5Title: "Potter Notify Bridge",
      p5Desc: "Пересылка уведомлений со смартфона на компьютер в реальном времени по локальной сети.",
      srv1Title: "3D Моделирование Minecraft (Blockbench)",
      srv1Desc: "Кастомные боссы, мобы, оружие, броня и мебель с плавными анимациями. Подходит для ModelEngine, MythicMobs, ItemsAdder.",
      srv2Title: "Моды и плагины для Minecraft",
      srv2Desc: "Моды на Forge / Fabric, плагины Spigot / Paper, магазины, квесты и механики серверов.",
      srv3Title: "Веб-сайты и интернет-магазины",
      srv3Desc: "Портфолио, магазины игровых предметов, адаптивный интерфейс для телефонов и ПК.",
      srv4Title: "Android и Windows приложения",
      srv4Desc: "Утилиты, мобильные приложения на Kotlin и мосты интеграции данных для Windows.",
      srv5Title: "Скрипты автоматизации и боты Discord",
      srv5Desc: "Python скрипты, боты с Discord Webhook и подключение к базам данных.",
    },
  };

  // --- App State ---
  let currentLang = localStorage.getItem("potter_portfolio_lang") || "th";
  let currentUsername = localStorage.getItem("potter_portfolio_user") || "";
  let currentUserEmail = localStorage.getItem("potter_portfolio_email") || "";
  let sessionId =
    localStorage.getItem("potter_session_id") ||
    "user_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
  localStorage.setItem("potter_session_id", sessionId);

  let authMode = "register"; // 'register' or 'login'
  let mathAnswer = 0;
  let wsSocket = null;
  let botOnline = false;

  // --- Gallery State ---
  let galleryItems = [];
  try {
    const saved = localStorage.getItem("potter_gallery_items");
    galleryItems = saved ? JSON.parse(saved) : DEFAULT_IMAGES.slice();
  } catch (e) {
    galleryItems = DEFAULT_IMAGES.slice();
  }

  // --- Accounts Registry (Anti-duplicate & Anti-Bot) ---
  function getRegisteredAccounts() {
    try {
      const list = JSON.parse(localStorage.getItem("potter_accounts") || "[]");
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function saveRegisteredAccounts(list) {
    try {
      localStorage.setItem("potter_accounts", JSON.stringify(list));
    } catch (e) {}
  }

  function isUsernameTaken(name) {
    const clean = name.trim().toLowerCase();
    if (!clean) return { taken: false, reason: "empty" };
    if (RESERVED_NAMES.includes(clean)) return { taken: true, reason: "reserved" };

    const accounts = getRegisteredAccounts();
    const found = accounts.find((a) => a.username.toLowerCase() === clean);
    if (found && found.username.toLowerCase() !== currentUsername.toLowerCase()) {
      return { taken: true, reason: "duplicate" };
    }
    return { taken: false };
  }

  // --- Anti-Bot Math Question Generator ---
  function generateMathQuestion() {
    const n1 = Math.floor(Math.random() * 9) + 1;
    const n2 = Math.floor(Math.random() * 9) + 1;
    mathAnswer = n1 + n2;
    const box = document.getElementById("mathQuestionBox");
    if (box) box.textContent = `คำนวณ: ${n1} + ${n2} = ?`;
    const input = document.getElementById("antiBotInput");
    if (input) input.value = "";
    const msg = document.getElementById("antiBotMsg");
    if (msg) msg.textContent = "";
  }

  document.getElementById("refreshMathBtn")?.addEventListener("click", generateMathQuestion);

  // --- Interactive Space Dots Canvas Background ---
  const canvas = document.getElementById("bg");
  const ctx = canvas.getContext("2d");
  let W = innerWidth;
  let H = innerHeight;
  let stars = [];
  let meteors = [];
  let mouse = { x: W / 2, y: H / 2, tx: W / 2, ty: H / 2 };

  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const STAR_COLORS = ["#ffffff", "#d0f4ff", "#2de2ff", "#c4b5fd", "#fdf2f8"];

  function createStar() {
    const depth = Math.random();
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      depth: depth,
      r: depth * 1.5 + 0.5,
      baseAlpha: 0.2 + depth * 0.65,
      twinkleSpeed: 0.015 + Math.random() * 0.03,
      phase: Math.random() * Math.PI * 2,
      color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
    };
  }

  function initStarfield() {
    const count = Math.min(Math.floor((W * H) / 4500), 220);
    stars = [];
    for (let i = 0; i < count; i++) {
      stars.push(createStar());
    }
  }

  function spawnMeteor() {
    meteors.push({
      x: Math.random() * W * 0.8,
      y: Math.random() * (H * 0.3),
      length: 80 + Math.random() * 90,
      speed: 12 + Math.random() * 10,
      angle: Math.PI / 4 + (Math.random() - 0.5) * 0.2,
      alpha: 1,
      fade: 0.02 + Math.random() * 0.02,
    });
  }

  setInterval(() => {
    if (Math.random() > 0.4 && meteors.length < 2) {
      spawnMeteor();
    }
  }, 7000);

  function renderStars() {
    ctx.clearRect(0, 0, W, H);

    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;
    const offsetX = (mouse.x - W / 2) * 0.03;
    const offsetY = (mouse.y - H / 2) * 0.03;

    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      s.phase += s.twinkleSpeed;
      const alpha = Math.max(0.08, s.baseAlpha + Math.sin(s.phase) * 0.3);

      const px = s.x - offsetX * s.depth;
      const py = s.y - offsetY * s.depth;

      ctx.save();
      ctx.fillStyle = s.color;
      ctx.globalAlpha = Math.min(alpha, 1);
      ctx.beginPath();
      ctx.arc(px, py, s.r, 0, Math.PI * 2);
      ctx.fill();

      if (s.depth > 0.85) {
        ctx.shadowColor = s.color;
        ctx.shadowBlur = 6;
        ctx.fill();
      }
      ctx.restore();
    }

    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      const ex = m.x + Math.cos(m.angle) * m.length;
      const ey = m.y + Math.sin(m.angle) * m.length;

      const grad = ctx.createLinearGradient(m.x, m.y, ex, ey);
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(1, `rgba(45,226,255,${m.alpha})`);

      ctx.save();
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.restore();

      m.x += Math.cos(m.angle) * m.speed;
      m.y += Math.sin(m.angle) * m.speed;
      m.alpha -= m.fade;

      if (m.alpha <= 0 || m.x > W + 100 || m.y > H + 100) {
        meteors.splice(i, 1);
      }
    }

    requestAnimationFrame(renderStars);
  }

  resizeCanvas();
  initStarfield();
  renderStars();

  window.addEventListener("resize", () => {
    resizeCanvas();
    initStarfield();
  });
  window.addEventListener("pointermove", (e) => {
    mouse.tx = e.clientX;
    mouse.ty = e.clientY;
  });

  // Stardust click effect
  window.addEventListener("pointerdown", (e) => {
    for (let k = 0; k < 7; k++) {
      const p = document.createElement("div");
      const ang = (k / 7) * Math.PI * 2;
      const dist = 30 + Math.random() * 40;
      p.style.position = "fixed";
      p.style.zIndex = "99";
      p.style.pointerEvents = "none";
      p.style.left = e.clientX + "px";
      p.style.top = e.clientY + "px";
      p.style.width = "4px";
      p.style.height = "4px";
      p.style.borderRadius = "50%";
      p.style.background = k % 2 === 0 ? "var(--cyan)" : "#ffffff";
      p.style.boxShadow = "0 0 8px var(--cyan)";
      p.style.transition = "transform 0.65s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.65s";
      document.body.appendChild(p);

      requestAnimationFrame(() => {
        p.style.transform = `translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist}px) scale(0)`;
        p.style.opacity = "0";
      });

      setTimeout(() => p.remove(), 700);
    }
  });

  // --- Multi-Language UI Engine ---
  function applyLanguage(lang) {
    if (!I18N[lang]) lang = "th";
    currentLang = lang;
    localStorage.setItem("potter_portfolio_lang", lang);

    const t = I18N[lang];
    document.documentElement.lang = lang;

    const setSafe = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    const langCur = document.getElementById("langCurrentText");
    if (langCur) langCur.textContent = t.langName;

    // Welcome Form
    setSafe("welcomeTitle", t.welcomeTitle);
    setSafe("welcomeDesc", t.welcomeDesc);
    setSafe("langSelectLabel", t.langSelectLabel);
    setSafe("tabModeRegister", t.tabRegister);
    setSafe("tabModeLogin", t.tabLogin);
    setSafe("nameInputLabel", t.nameInputLabel);
    setSafe("emailInputLabel", t.emailInputLabel);
    setSafe("passInputLabel", t.passInputLabel);
    setSafe("antiBotLabel", t.antiBotLabel);
    setSafe(
      "authSubmitText",
      authMode === "register" ? t.authSubmitRegister : t.authSubmitLogin
    );

    const uInp = document.getElementById("authUsernameInput");
    if (uInp) uInp.placeholder = t.namePlaceholder;
    const eInp = document.getElementById("authEmailInput");
    if (eInp) eInp.placeholder = t.emailPlaceholder;
    const pInp = document.getElementById("authPassInput");
    if (pInp) pInp.placeholder = t.passPlaceholder;

    // Hero & Tabs
    setSafe("heroGreeting", t.heroGreeting);
    setSafe("heroName", t.heroName);
    Object.keys(t.tabs).forEach((key) => {
      setSafe(`tab-${key}`, t.tabs[key]);
    });

    // About & Projects
    setSafe("aboutHead", t.aboutHead);
    setSafe("factNameLabel", t.factNameLabel);
    setSafe("factNameVal", t.factNameVal);
    setSafe("factSpecLabel", t.factSpecLabel);
    setSafe("factSpecVal", t.factSpecVal);
    setSafe("factSchoolLabel", t.factSchoolLabel);
    setSafe("factSchoolVal", t.factSchoolVal);
    setSafe("aboutBio", t.aboutBio);

    setSafe("projectsHead", t.projectsHead);
    setSafe("p1Title", t.p1Title);
    setSafe("p1Desc", t.p1Desc);
    setSafe("p2Title", t.p2Title);
    setSafe("p2Desc", t.p2Desc);
    setSafe("p3Title", t.p3Title);
    setSafe("p3Desc", t.p3Desc);
    setSafe("p4Title", t.p4Title);
    setSafe("p4Desc", t.p4Desc);
    setSafe("p5Title", t.p5Title);
    setSafe("p5Desc", t.p5Desc);

    // Gallery
    setSafe("galleryHead", t.galleryHead);
    setSafe("galleryNotice", t.galleryNotice);
    setSafe("resetGalleryBtn", t.resetGalleryBtn);
    const gUp = document.getElementById("galleryUploadBtn");
    if (gUp) {
      const inp = gUp.querySelector("input");
      gUp.textContent = t.galleryUploadBtn + " ";
      if (inp) gUp.appendChild(inp);
    }

    // Services
    setSafe("hireHead", t.hireHead);
    setSafe("hireCtaText", t.hireCtaText);
    setSafe("goToChatBtn", t.goToChatBtn);
    setSafe("srv1Title", t.srv1Title);
    setSafe("srv1Desc", t.srv1Desc);
    setSafe("srv2Title", t.srv2Title);
    setSafe("srv2Desc", t.srv2Desc);
    setSafe("srv3Title", t.srv3Title);
    setSafe("srv3Desc", t.srv3Desc);
    setSafe("srv4Title", t.srv4Title);
    setSafe("srv4Desc", t.srv4Desc);
    setSafe("srv5Title", t.srv5Title);
    setSafe("srv5Desc", t.srv5Desc);

    // Chat
    setSafe("chatHead", t.chatHead);
    setSafe("chatSubtitle", t.chatSubtitle);
    setSafe("chatSendBtn", t.chatSendBtn);
    setSafe("clearChatBtn", t.clearChatBtn);
    setSafe("chatNote", t.chatNote);
    const chatInput = document.getElementById("chatInput");
    if (chatInput) chatInput.placeholder = t.chatInputPlaceholder;

    // Code & Contact
    setSafe("codeHead", t.codeHead);
    setSafe("codeTitle", t.codeTitle);
    setSafe("copy", t.codeCopy);
    setSafe("codeNote", t.codeNote);
    setSafe("contactHead", t.contactHead);
    setSafe("contactChatDesc", t.contactChatDesc);
    setSafe("contactGoChat", t.contactGoChat);

    const dropEl = document.getElementById("drop");
    if (dropEl) {
      const span = dropEl.querySelector("span");
      if (span) span.textContent = t.dropText;
    }

    startTypingAnimation(t.typeStrings);

    document.querySelectorAll(".lang-pill").forEach((pill) => {
      pill.classList.toggle("active", pill.dataset.lang === lang);
    });
  }

  // --- Hero Typing Effect ---
  let typingTimer = null;
  function startTypingAnimation(strings) {
    if (typingTimer) clearTimeout(typingTimer);
    const el = document.getElementById("type");
    if (!el) return;

    let strIdx = 0;
    let charIdx = 0;
    let isDeleting = false;

    function typeLoop() {
      const current = strings[strIdx % strings.length];
      if (isDeleting) {
        charIdx--;
        el.textContent = current.substring(0, charIdx);
      } else {
        charIdx++;
        el.textContent = current.substring(0, charIdx);
      }

      let speed = isDeleting ? 30 : 65;

      if (!isDeleting && charIdx === current.length) {
        speed = 2200;
        isDeleting = true;
      } else if (isDeleting && charIdx === 0) {
        isDeleting = false;
        strIdx++;
        speed = 450;
      }

      typingTimer = setTimeout(typeLoop, speed);
    }

    typeLoop();
  }

  // --- Tabs Navigation ---
  const tabs = [].slice.call(document.querySelectorAll(".tab"));
  const panels = [].slice.call(document.querySelectorAll(".panel"));
  const tabIds = tabs.map((t) => t.dataset.t);

  function showTab(id) {
    if (tabIds.indexOf(id) < 0) id = "about";
    tabs.forEach((t) => {
      const on = t.dataset.t === id;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
    });
    panels.forEach((p) => {
      p.hidden = p.id !== id;
    });
  }

  tabs.forEach((t, i) => {
    t.addEventListener("click", () => {
      location.hash = t.dataset.t;
    });
  });

  window.addEventListener("hashchange", () => {
    showTab(location.hash.slice(1));
  });

  document.getElementById("goToChatBtn")?.addEventListener("click", () => {
    location.hash = "chat";
  });
  document.getElementById("contactGoChat")?.addEventListener("click", () => {
    location.hash = "chat";
  });

  // --- Gallery with Delete Button ---
  const grid = document.getElementById("grid");
  const lb = document.getElementById("lb");
  const lbi = lb.querySelector("img");
  const heroCard = document.getElementById("heroCard");

  if (heroCard) {
    heroCard.querySelector("img").src = DEFAULT_IMAGES[0].src;
    heroCard.onclick = () => {
      lbi.src = DEFAULT_IMAGES[0].src;
      lb.classList.add("on");
    };
  }

  function saveGallery() {
    try {
      localStorage.setItem("potter_gallery_items", JSON.stringify(galleryItems));
    } catch (e) {}
  }

  function renderGallery() {
    if (!grid) return;
    grid.innerHTML = "";

    galleryItems.forEach((item, index) => {
      const card = document.createElement("div");
      card.className = "card";
      card.tabIndex = 0;

      const img = document.createElement("img");
      img.src = item.src;
      img.alt = item.title || "Minecraft 3D Artwork";
      img.loading = "lazy";
      card.appendChild(img);

      if (item.title) {
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = item.title;
        card.appendChild(tag);
      }

      // Delete Button
      const delBtn = document.createElement("button");
      delBtn.className = "card-delete-btn";
      delBtn.type = "button";
      delBtn.textContent = "✕ ลบ";
      delBtn.title = "ลบรูปภาพนี้";

      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const t = I18N[currentLang] || I18N.th;
        if (confirm(t.deleteConfirm || "คุณต้องการลบรูปนี้ใช่หรือไม่?")) {
          galleryItems.splice(index, 1);
          saveGallery();
          renderGallery();
        }
      });

      card.appendChild(delBtn);

      card.addEventListener("click", () => {
        lbi.src = item.src;
        lb.classList.add("on");
      });

      grid.appendChild(card);
    });
  }

  function addImagesToGallery(files) {
    const valid = [].filter.call(files, (f) => /^image\//.test(f.type));
    if (!valid.length) return;

    valid.forEach((f) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        galleryItems.unshift({
          src: e.target.result,
          title: f.name.replace(/\.[^/.]+$/, "").substring(0, 24),
          isSample: false,
        });
        saveGallery();
        renderGallery();
      };
      reader.readAsDataURL(f);
    });

    location.hash = "gallery";
  }

  document.getElementById("resetGalleryBtn")?.addEventListener("click", () => {
    galleryItems = DEFAULT_IMAGES.slice();
    saveGallery();
    renderGallery();
  });

  document.getElementById("file")?.addEventListener("change", (e) => {
    addImagesToGallery(e.target.files);
    e.target.value = "";
  });

  const drop = document.getElementById("drop");
  ["dragenter", "dragover"].forEach((ev) => {
    window.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.add("on");
    });
  });
  window.addEventListener("dragleave", (e) => {
    if (!e.relatedTarget) drop.classList.remove("on");
  });
  window.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("on");
    if (e.dataTransfer && e.dataTransfer.files) {
      addImagesToGallery(e.dataTransfer.files);
    }
  });

  lb.addEventListener("click", () => lb.classList.remove("on"));
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") lb.classList.remove("on");
  });

  // --- Auth Switcher: Register / Login Tabs ---
  const tabModeRegister = document.getElementById("tabModeRegister");
  const tabModeLogin = document.getElementById("tabModeLogin");
  const emailBlock = document.getElementById("emailBlock");
  const antiBotBlock = document.getElementById("antiBotBlock");
  const authSubmitText = document.getElementById("authSubmitText");

  tabModeRegister?.addEventListener("click", () => {
    authMode = "register";
    tabModeRegister.classList.add("active");
    tabModeLogin.classList.remove("active");
    if (emailBlock) emailBlock.hidden = false;
    if (antiBotBlock) antiBotBlock.hidden = false;
    const t = I18N[currentLang] || I18N.th;
    if (authSubmitText) authSubmitText.textContent = t.authSubmitRegister;
    generateMathQuestion();
  });

  tabModeLogin?.addEventListener("click", () => {
    authMode = "login";
    tabModeLogin.classList.add("active");
    tabModeRegister.classList.remove("active");
    if (emailBlock) emailBlock.hidden = true;
    if (antiBotBlock) antiBotBlock.hidden = true;
    const t = I18N[currentLang] || I18N.th;
    if (authSubmitText) authSubmitText.textContent = t.authSubmitLogin;
  });

  // --- Auth Form Submit with Strict Validation & Anti-Bot ---
  const authForm = document.getElementById("authForm");
  const authUsernameInput = document.getElementById("authUsernameInput");
  const authEmailInput = document.getElementById("authEmailInput");
  const authPassInput = document.getElementById("authPassInput");
  const antiBotInput = document.getElementById("antiBotInput");
  const hpWebsiteCheck = document.getElementById("hpWebsiteCheck");

  const usernameCheckMsg = document.getElementById("usernameCheckMsg");
  const emailCheckMsg = document.getElementById("emailCheckMsg");
  const passCheckMsg = document.getElementById("passCheckMsg");
  const antiBotMsg = document.getElementById("antiBotMsg");
  const welcomeOverlay = document.getElementById("welcomeOverlay");

  // Real-time username check on input
  authUsernameInput?.addEventListener("input", (e) => {
    const t = I18N[currentLang] || I18N.th;
    const val = e.target.value.trim();

    if (!val) {
      usernameCheckMsg.className = "name-msg err";
      usernameCheckMsg.textContent = t.nameEmpty;
      return;
    }

    if (authMode === "register") {
      const check = isUsernameTaken(val);
      if (check.taken) {
        usernameCheckMsg.className = "name-msg err";
        usernameCheckMsg.textContent =
          check.reason === "reserved" ? t.nameReserved : t.nameTaken;
      } else {
        usernameCheckMsg.className = "name-msg ok";
        usernameCheckMsg.textContent = t.nameAvailable;
      }
    } else {
      usernameCheckMsg.textContent = "";
    }
  });

  authForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const t = I18N[currentLang] || I18N.th;

    // 1. Anti-Bot Honeypot Trap Check
    if (hpWebsiteCheck && hpWebsiteCheck.value) {
      console.warn("Bot detected via honeypot trap.");
      return;
    }

    const username = (authUsernameInput ? authUsernameInput.value : "").trim();
    const email = (authEmailInput ? authEmailInput.value : "").trim();
    const password = (authPassInput ? authPassInput.value : "").trim();

    // Reset error messages
    usernameCheckMsg.textContent = "";
    emailCheckMsg.textContent = "";
    passCheckMsg.textContent = "";
    antiBotMsg.textContent = "";

    // 2. Validate Username
    if (!username) {
      usernameCheckMsg.className = "name-msg err";
      usernameCheckMsg.textContent = t.nameEmpty;
      authUsernameInput.focus();
      return;
    }

    // 3. Mode: Register
    if (authMode === "register") {
      const check = isUsernameTaken(username);
      if (check.taken) {
        usernameCheckMsg.className = "name-msg err";
        usernameCheckMsg.textContent =
          check.reason === "reserved" ? t.nameReserved : t.nameTaken;
        authUsernameInput.focus();
        return;
      }

      // Email Format Check
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        emailCheckMsg.className = "name-msg err";
        emailCheckMsg.textContent = t.emailInvalid;
        authEmailInput.focus();
        return;
      }

      // Password Length Check
      if (!password || password.length < 6) {
        passCheckMsg.className = "name-msg err";
        passCheckMsg.textContent = t.passShort;
        authPassInput.focus();
        return;
      }

      // Anti-Bot Math Puzzle Check
      const answerGiven = parseInt(antiBotInput ? antiBotInput.value : "", 10);
      if (isNaN(answerGiven) || answerGiven !== mathAnswer) {
        antiBotMsg.className = "name-msg err";
        antiBotMsg.textContent = t.antiBotErr;
        generateMathQuestion();
        antiBotInput.focus();
        return;
      }

      // Register Account
      const accounts = getRegisteredAccounts();
      accounts.push({
        username: username,
        email: email,
        password: password,
        sessionId: sessionId,
        created: Date.now(),
      });
      saveRegisteredAccounts(accounts);

      currentUsername = username;
      currentUserEmail = email;
      localStorage.setItem("potter_portfolio_user", currentUsername);
      localStorage.setItem("potter_portfolio_email", currentUserEmail);

      // Create Ticket in Discord Bot
      createTicketInDiscordBot(username, email, "เปิดตั๋วสอบถามงานใหม่จากหน้าเว็บไซต์");
    } else {
      // 4. Mode: Login
      const accounts = getRegisteredAccounts();
      const account = accounts.find(
        (a) => a.username.toLowerCase() === username.toLowerCase()
      );

      if (!account) {
        usernameCheckMsg.className = "name-msg err";
        usernameCheckMsg.textContent = t.loginNotFound;
        return;
      }

      if (account.password !== password) {
        passCheckMsg.className = "name-msg err";
        passCheckMsg.textContent = t.loginWrongPass;
        return;
      }

      currentUsername = account.username;
      currentUserEmail = account.email;
      if (account.sessionId) sessionId = account.sessionId;
      localStorage.setItem("potter_portfolio_user", currentUsername);
      localStorage.setItem("potter_portfolio_email", currentUserEmail);
      localStorage.setItem("potter_session_id", sessionId);
    }

    updateUserDisplay();

    // Close Overlay with smooth fade
    welcomeOverlay.classList.add("hide");
    setTimeout(() => {
      welcomeOverlay.style.display = "none";
    }, 400);

    // Initialize Two-Way Discord WebSocket connection
    connectDiscordBotWS();
    ensureInitialChatGreeting();
  });

  function updateUserDisplay() {
    const disp = document.getElementById("currentUserNameDisplay");
    if (disp) {
      disp.textContent = currentUsername
        ? `${currentUsername} (${currentUserEmail || "User"})`
        : "แขก";
    }
  }

  // Switch User / Logout button
  document.getElementById("switchUserBtn")?.addEventListener("click", () => {
    if (welcomeOverlay) {
      welcomeOverlay.style.display = "grid";
      welcomeOverlay.classList.remove("hide");
      generateMathQuestion();
      if (authUsernameInput) authUsernameInput.value = currentUsername;
    }
  });

  // Language Pills in Welcome Modal
  document.querySelectorAll(".lang-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      applyLanguage(pill.dataset.lang);
    });
  });

  // Language dropdown in nav
  const langSwitchBtn = document.getElementById("langSwitchBtn");
  const langMenu = document.getElementById("langMenu");
  langSwitchBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    langMenu.hidden = !langMenu.hidden;
  });
  document.querySelectorAll(".menu-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      applyLanguage(btn.dataset.lang);
      langMenu.hidden = true;
    });
  });
  window.addEventListener("click", () => {
    if (langMenu) langMenu.hidden = true;
  });

  // --- Two-Way Discord Ticket Bot Integration ---
  const chatMessagesEl = document.getElementById("chatMessages");
  const chatForm = document.getElementById("chatForm");
  const chatInput = document.getElementById("chatInput");
  const clearChatBtn = document.getElementById("clearChatBtn");
  const ticketStatusBadge = document.getElementById("ticketStatusBadge");
  const ticketStatusText = document.getElementById("ticketStatusText");
  const botLiveBadge = document.getElementById("botLiveBadge");

  function getSessionMessages() {
    try {
      const stored = localStorage.getItem(`potter_chat_msgs_${sessionId}`);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  }

  function saveSessionMessages(msgs) {
    try {
      localStorage.setItem(`potter_chat_msgs_${sessionId}`, JSON.stringify(msgs));
    } catch (e) {}
  }

  function ensureInitialChatGreeting() {
    const msgs = getSessionMessages();
    if (msgs.length === 0) {
      const t = I18N[currentLang] || I18N.th;
      const initial = {
        id: "msg_init_" + Date.now(),
        session_id: sessionId,
        sender_name: "Potter (Admin)",
        sender_role: "admin",
        content: t.autoWelcome,
        created_at: new Date().toISOString(),
      };
      msgs.push(initial);
      saveSessionMessages(msgs);
    }
    renderChatMessages();
  }

  function renderChatMessages() {
    if (!chatMessagesEl) return;
    const msgs = getSessionMessages();
    chatMessagesEl.innerHTML = "";
    msgs.forEach((m) => appendChatMessage(m, false));
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  }

  function appendChatMessage(m, shouldScroll = true) {
    if (!chatMessagesEl) return;

    const wrap = document.createElement("div");
    const isMine = m.sender_role === "user";
    const isSysAdmin = m.sender_role === "admin";

    wrap.className = `chat-msg ${isMine ? "mine" : "theirs"} ${isSysAdmin ? "admin" : ""}`;

    const meta = document.createElement("div");
    meta.className = "msg-meta";

    const timeStr = m.created_at
      ? new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "";

    if (isSysAdmin) {
      meta.innerHTML = `<span class="discord-tag">DISCORD ADMIN</span> <b>${m.sender_name}</b> • <small>${timeStr}</small>`;
    } else {
      meta.innerHTML = `<b>${m.sender_name}</b> • <small>${timeStr}</small>`;
    }

    const bubble = document.createElement("div");
    bubble.className = "msg-bubble";
    bubble.textContent = m.content;

    wrap.appendChild(meta);
    wrap.appendChild(bubble);
    chatMessagesEl.appendChild(wrap);

    if (shouldScroll) {
      chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    }
  }

  // Two-Way WebSocket to Python Discord Bot
  function connectDiscordBotWS() {
    try {
      const wsUrl = `${BOT_WS_URL}?session_id=${encodeURIComponent(sessionId)}`;
      wsSocket = new WebSocket(wsUrl);

      wsSocket.onopen = () => {
        botOnline = true;
        updateBotStatusBadge(true);
      };

      wsSocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "chat_message") {
            const msgs = getSessionMessages();
            // Avoid duplicate by ID
            if (!msgs.some((x) => x.id === data.id)) {
              msgs.push(data);
              saveSessionMessages(msgs);
              appendChatMessage(data, true);
            }
          } else if (data.type === "ticket_closed") {
            setTicketStatus("closed");
            const msgs = getSessionMessages();
            const closedMsg = {
              id: "msg_closed_" + Date.now(),
              session_id: sessionId,
              sender_name: "Potter (Admin)",
              sender_role: "admin",
              content: data.message,
              created_at: data.created_at,
            };
            msgs.push(closedMsg);
            saveSessionMessages(msgs);
            appendChatMessage(closedMsg, true);
          }
        } catch (ex) {
          console.warn("Error parsing WS packet:", ex);
        }
      };

      wsSocket.onclose = () => {
        botOnline = false;
        updateBotStatusBadge(false);
        // Try reconnecting in 5s
        setTimeout(connectDiscordBotWS, 5000);
      };

      wsSocket.onerror = () => {
        botOnline = false;
        updateBotStatusBadge(false);
      };
    } catch (e) {
      console.warn("WebSocket initialization error:", e);
      updateBotStatusBadge(false);
    }
  }

  function updateBotStatusBadge(online) {
    if (botLiveBadge) {
      botLiveBadge.className = online ? "bot-badge-online" : "badge badge-warning";
      botLiveBadge.innerHTML = online
        ? `<span class="dot-online"></span> <span>Discord Bot ออนไลน์</span>`
        : `<span class="dot-online" style="background:#ffd166;"></span> <span>โหมดสำรอง (เชื่อมต่อ Bot...)</span>`;
    }
  }

  function setTicketStatus(status) {
    const t = I18N[currentLang] || I18N.th;
    if (ticketStatusBadge && ticketStatusText) {
      if (status === "closed") {
        ticketStatusBadge.className = "ticket-status-pill closed";
        ticketStatusText.textContent = t.ticketStatusClosed;
      } else {
        ticketStatusBadge.className = "ticket-status-pill open";
        ticketStatusText.textContent = t.ticketStatusOpen;
      }
    }
  }

  // Create Ticket in Bot via REST
  async function createTicketInDiscordBot(username, email, initialMsg) {
    try {
      await fetch(`${BOT_API_URL}/api/ticket/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          username: username,
          email: email,
          initial_message: initialMsg,
        }),
      });
    } catch (e) {
      // Local bot may not be running yet, silent fallback
    }
  }

  // Chat Form Submit (User sends message -> Bot Ticket Channel in Discord)
  chatForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = (chatInput ? chatInput.value : "").trim();
    if (!text) return;

    chatInput.value = "";

    const msgObj = {
      id: "msg_user_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      session_id: sessionId,
      sender_name: currentUsername || "Client",
      sender_role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };

    // Save and render locally
    const msgs = getSessionMessages();
    msgs.push(msgObj);
    saveSessionMessages(msgs);
    appendChatMessage(msgObj, true);

    // 1. Send via WebSocket if alive
    if (wsSocket && wsSocket.readyState === WebSocket.OPEN) {
      wsSocket.send(
        JSON.stringify({
          action: "send_message",
          session_id: sessionId,
          sender_name: currentUsername || "Client",
          email: currentUserEmail || "",
          content: text,
        })
      );
    } else {
      // 2. Fallback via HTTP POST to bot
      try {
        await fetch(`${BOT_API_URL}/api/chat/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionId,
            sender_name: currentUsername || "Client",
            content: text,
          }),
        });
      } catch (err) {
        console.warn("Bot REST fallback note:", err);
      }
    }
  });

  // Clear Chat History Button
  clearChatBtn?.addEventListener("click", () => {
    const t = I18N[currentLang] || I18N.th;
    if (confirm(t.clearConfirm)) {
      localStorage.removeItem(`potter_chat_msgs_${sessionId}`);
      ensureInitialChatGreeting();
    }
  });

  // --- Code Copy Button ---
  const cp = document.getElementById("copy");
  const sn = document.getElementById("snippet");
  cp?.addEventListener("click", () => {
    const t = I18N[currentLang] || I18N.th;
    try {
      navigator.clipboard.writeText(sn.textContent).then(() => {
        cp.textContent = t.codeCopied;
        setTimeout(() => (cp.textContent = t.codeCopy), 1500);
      });
    } catch (e) {
      const range = document.createRange();
      range.selectNodeContents(sn);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand("copy");
      cp.textContent = t.codeCopied;
      setTimeout(() => (cp.textContent = t.codeCopy), 1500);
    }
  });

  // --- Initial Page Setup ---
  applyLanguage(currentLang);
  showTab(location.hash.slice(1));
  renderGallery();
  generateMathQuestion();

  if (!currentUsername) {
    if (welcomeOverlay) {
      welcomeOverlay.style.display = "grid";
      welcomeOverlay.classList.remove("hide");
    }
  } else {
    if (welcomeOverlay) welcomeOverlay.style.display = "none";
    updateUserDisplay();
    connectDiscordBotWS();
    ensureInitialChatGreeting();
  }
})();
