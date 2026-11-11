/**
 * Potter Portfolio & Minecraft 3D Modeler
 * Multi-language, Cosmic Space Particles, Live Chat, Supabase SQL & Discord Webhook
 */

(function () {
  "use strict";

  // --- Constants & Config ---
  const DISCORD_WEBHOOK_URL =
    "https://discord.com/api/webhooks/1570097164334407695/sUv2lkPahdHU2lUHkeJZqRrLFooyFDBMGBc37NF1KHr45m4OR-012riYPTytXRFghhRD";
  const ADMIN_PASSCODE = "potter2026";
  const RESERVED_NAMES = [
    "admin",
    "administrator",
    "แอดมิน",
    "potter",
    "พอตเตอร์",
    "moderator",
    "system",
    "root",
    "ผู้ดูแล",
    "бот",
    "админ",
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
          <!-- Cube 3D isometric representation for Minecraft model -->
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
            <!-- Stylized Fantasy Blade -->
            <polygon points='0,-90 14,-20 6,40 -6,40 -14,-20' fill='#c084fc'/>
            <polygon points='0,-90 0,40 14,-20' fill='#e9d5ff' opacity='0.7'/>
            <rect x='-25' y='40' width='50' height='10' rx='4' fill='#2de2ff'/>
            <rect x='-7' y='50' width='14' height='40' rx='3' fill='#475569'/>
            <circle cx='0' cy='96' r='9' fill='#c084fc'/>
          </g>
          <text x='300' y='540' font-size='26' fill='#c084fc' font-weight='bold' text-anchor='middle' font-family='sans-serif'>Custom Weapon Set</text>
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
        "ผู้เชี่ยวชาญด้านการทำโมเดล Minecraft 3D (Blockbench) พัฒนามอด และสร้างสรรค์ซอฟต์แวร์",
      langSelectLabel: "เลือกภาษา / Select Language / Выберите язык",
      nameInputLabel: "ระบุชื่อของคุณ (สำหรับใช้ในระบบและแชต)",
      namePlaceholder: "กรอกชื่อหรือฉายาของคุณ...",
      enterBtnText: "เข้าสู่เว็บไซต์",
      nameAvailable: "ชื่อนี้สามารถใช้งานได้",
      nameTaken: "ชื่อนี้ถูกใช้งานแล้ว โปรดเลือกชื่ออื่น",
      nameReserved: "ชื่อนี้เป็นชื่อสงวนของระบบ กรุณาใช้ชื่ออื่น",
      nameEmpty: "กรุณาระบุชื่อก่อนเข้าใช้งาน",
      tabs: {
        about: "เกี่ยวกับ",
        projects: "ผลงาน & โมเดล",
        gallery: "แกลเลอรี",
        hire: "รับทำโมเดล & งาน",
        chat: "สอบถามงาน / แชต",
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
      chatHead: "สอบถามงาน & พูดคุยโดยตรง",
      chatSubtitle:
        "พิมพ์ข้อความสอบถามสั่งทำโมเดล Minecraft หรือปรึกษางานได้ที่นี่ ข้อความจะแจ้งเตือนเข้า Discord ของผมทันที",
      chatInputPlaceholder: "พิมพ์ข้อความสอบถามงาน...",
      chatSendBtn: "ส่งข้อความ",
      clearChatBtn: "ล้างประวัติแชต",
      clearConfirm: "คุณต้องการลบประวัติการสนทนาทั้งหมดของคุณใช่หรือไม่?",
      chatNote:
        "ระบบจะจดจำประวัติแชตของคุณไว้ และแจ้งเตือนแอดมินผ่าน Discord ทันทีเมื่อคุณส่งข้อความ",
      liveStatusText: "พร้อมส่งแจ้งเตือน Discord",
      autoWelcome:
        "สวัสดีครับ! สนใจสั่งทำโมเดล Minecraft 3D (Blockbench, ModelEngine, MythicMobs) มอด หรือระบบเว็บ สามารถพิมพ์รายละเอียดทิ้งไว้ได้เลยครับ ข้อความจะส่งเข้า Discord ของผมทันทีครับ",
      adminBadge: "แอดมินพอตเตอร์",
      clientBadge: "คุณ",
      codeHead: "แจกโค้ด & ตัวอย่าง",
      codeTitle: "ตัวอย่างโค้ด: หน่วงเวลาใน JavaScript",
      codeCopy: "คัดลอก",
      codeCopied: "คัดลอกแล้ว",
      codeNote: "โค้ดและไลบรารีเพิ่มเติมจะทยอยอัปเดตลงบน GitHub",
      contactHead: "ช่องทางการติดต่อ",
      contactChatDesc: "สอบถามงานในเว็บได้ทันทีที่แท็บแชต",
      contactGoChat: "เปิดแชตสอบถาม",
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
      srv5Title: "สคริปต์ & Discord Webhook Bot",
      srv5Desc: "เขียนสคริปต์ Python ทำงานอัตโนมัติ ระบบบอทแจ้งเตือนเข้า Discord และการเชื่อมต่อฐานข้อมูล",
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
      nameInputLabel: "Enter your nickname (for chat and session)",
      namePlaceholder: "Enter your nickname...",
      enterBtnText: "Enter Portfolio",
      nameAvailable: "This name is available",
      nameTaken: "This name is already taken. Please pick another.",
      nameReserved: "This name is reserved by the system. Please choose another.",
      nameEmpty: "Please enter a nickname to proceed.",
      tabs: {
        about: "About",
        projects: "Works & Models",
        gallery: "Gallery",
        hire: "Commissions",
        chat: "Inquiry Chat",
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
      chatHead: "Commission & Inquiry Chat",
      chatSubtitle:
        "Ask questions or commission Minecraft 3D models directly here. Messages notify my Discord immediately.",
      chatInputPlaceholder: "Type your message or project details...",
      chatSendBtn: "Send Message",
      clearChatBtn: "Clear History",
      clearConfirm: "Are you sure you want to clear your chat history?",
      chatNote:
        "Your chat history is remembered and will notify the admin via Discord as soon as you send a message.",
      liveStatusText: "Discord Webhook Ready",
      autoWelcome:
        "Hello! If you want to commission custom Minecraft 3D models (Blockbench, ModelEngine, MythicMobs) or dev projects, leave a message here! It goes directly to my Discord.",
      adminBadge: "Admin Potter",
      clientBadge: "You",
      codeHead: "Code Snippets",
      codeTitle: "Code Snippet: Delay Promise in JavaScript",
      codeCopy: "Copy",
      codeCopied: "Copied!",
      codeNote: "More code repositories and libraries are updated on GitHub.",
      contactHead: "Contact Channels",
      contactChatDesc: "Chat directly on the website for commission inquiries",
      contactGoChat: "Open Chat",
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
      nameInputLabel: "Введите ваш никнейм (для общения в чате)",
      namePlaceholder: "Ваш никнейм...",
      enterBtnText: "Войти в портфолио",
      nameAvailable: "Имя доступно",
      nameTaken: "Это имя уже занято. Пожалуйста, выберите другое.",
      nameReserved: "Это имя зарезервировано системой. Выберите другое.",
      nameEmpty: "Пожалуйста, введите никнейм для продолжения.",
      tabs: {
        about: "Обо мне",
        projects: "Модели и работы",
        gallery: "Галерея",
        hire: "Заказы",
        chat: "Чат заказов",
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
      chatHead: "Чат заказов и вопросов",
      chatSubtitle:
        "Задавайте любые вопросы или заказывайте модели здесь. Сообщения сразу поступают ко мне в Discord.",
      chatInputPlaceholder: "Напишите сообщение или детали заказа...",
      chatSendBtn: "Отправить",
      clearChatBtn: "Очистить историю",
      clearConfirm: "Вы уверены, что хотите удалить историю чата?",
      chatNote:
        "История сохраняется локально и сразу отправляет оповещение администратору в Discord.",
      liveStatusText: "Discord Webhook активен",
      autoWelcome:
        "Здравствуйте! Если вас интересует заказ 3D моделей Minecraft (Blockbench, ModelEngine, MythicMobs) или разработка, напишите сюда! Я сразу получу сообщение в Discord.",
      adminBadge: "Админ Поттер",
      clientBadge: "Вы",
      codeHead: "Примеры кода",
      codeTitle: "Пример: Задержка выполнения в JavaScript",
      codeCopy: "Копировать",
      codeCopied: "Скопировано",
      codeNote: "Дополнительные репозитории и код доступны на GitHub.",
      contactHead: "Контакты",
      contactChatDesc: "Прямой чат на сайте для быстрого ответа",
      contactGoChat: "Открыть чат",
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
  let sessionId =
    localStorage.getItem("potter_session_id") ||
    "user_" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  localStorage.setItem("potter_session_id", sessionId);

  let isAdmin = false;
  let activeAdminSession = null;
  let supabaseClient = null;

  // --- Gallery Items State ---
  let galleryItems = [];
  try {
    const saved = localStorage.getItem("potter_gallery_items");
    galleryItems = saved ? JSON.parse(saved) : DEFAULT_IMAGES.slice();
  } catch (e) {
    galleryItems = DEFAULT_IMAGES.slice();
  }

  // --- Registered Users Registry (to prevent duplicates) ---
  function getRegisteredUsers() {
    try {
      const list = JSON.parse(localStorage.getItem("potter_registered_users") || "[]");
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function registerUser(name, sessId) {
    const users = getRegisteredUsers();
    const existing = users.find(
      (u) => u.name.toLowerCase() === name.toLowerCase() && u.sessionId !== sessId
    );
    if (!existing) {
      const idx = users.findIndex((u) => u.sessionId === sessId);
      if (idx >= 0) {
        users[idx].name = name;
        users[idx].updated = Date.now();
      } else {
        users.push({ name, sessionId: sessId, created: Date.now() });
      }
      localStorage.setItem("potter_registered_users", JSON.stringify(users));
    }
  }

  function isUsernameTaken(name, currentSessId) {
    const clean = name.trim().toLowerCase();
    if (!clean) return { taken: false, reason: "empty" };
    if (RESERVED_NAMES.includes(clean)) {
      return { taken: true, reason: "reserved" };
    }
    const users = getRegisteredUsers();
    const found = users.find(
      (u) => u.name.toLowerCase() === clean && u.sessionId !== currentSessId
    );
    if (found) {
      return { taken: true, reason: "duplicate" };
    }
    return { taken: false };
  }

  // --- Supabase Config & Init ---
  function initSupabase() {
    const url = localStorage.getItem("potter_supabase_url");
    const key = localStorage.getItem("potter_supabase_key");
    const badge = document.getElementById("supabaseStatusBadge");

    if (url && key && window.supabase && window.supabase.createClient) {
      try {
        supabaseClient = window.supabase.createClient(url, key);
        if (badge) {
          badge.className = "badge badge-success";
          badge.textContent = "เชื่อมต่อ Supabase สำเร็จ (Realtime & SQL Active)";
        }
        setupSupabaseRealtime();
      } catch (err) {
        console.warn("Supabase init error:", err);
        if (badge) {
          badge.className = "badge badge-warning";
          badge.textContent = "เชื่อมต่อ Supabase ล้มเหลว (ตรวจสอบ URL/Key)";
        }
      }
    } else {
      if (badge) {
        badge.className = "badge badge-warning";
        badge.textContent = "โหมด Local + Discord (ยังไม่เชื่อมต่อ Supabase)";
      }
    }
  }

  function setupSupabaseRealtime() {
    if (!supabaseClient) return;
    try {
      supabaseClient
        .channel("public:chat_messages")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "chat_messages" },
          (payload) => {
            const msg = payload.new;
            if (!msg) return;
            // If belongs to current active session, append to chat view
            const targetSess = isAdmin ? activeAdminSession : sessionId;
            if (msg.session_id === targetSess) {
              appendChatMessage(msg, false);
            }
          }
        )
        .subscribe();
    } catch (e) {
      console.warn("Supabase realtime subscribe error:", e);
    }
  }

  // --- Interactive Space Dots & Canvas Background ---
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
    const depth = Math.random(); // 0 (far) to 1 (near)
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
      angle: (Math.PI / 4) + (Math.random() - 0.5) * 0.2,
      alpha: 1,
      fade: 0.02 + Math.random() * 0.02,
    });
  }

  // Interval for random subtle shooting stars
  setInterval(() => {
    if (Math.random() > 0.4 && meteors.length < 2) {
      spawnMeteor();
    }
  }, 7000);

  function renderStars() {
    ctx.clearRect(0, 0, W, H);

    // Smooth mouse parallax
    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;
    const offsetX = (mouse.x - W / 2) * 0.03;
    const offsetY = (mouse.y - H / 2) * 0.03;

    // Draw stars
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

      // Subtle glow for closest stars
      if (s.depth > 0.85) {
        ctx.shadowColor = s.color;
        ctx.shadowBlur = 6;
        ctx.fill();
      }
      ctx.restore();
    }

    // Draw meteors (shooting stars)
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

  // Stardust effect on click
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

    // Update Language Dropdown Button Text
    const langCur = document.getElementById("langCurrentText");
    if (langCur) langCur.textContent = t.langName;

    // Update Welcome Modal Text
    const setSafe = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    setSafe("welcomeTitle", t.welcomeTitle);
    setSafe("welcomeDesc", t.welcomeDesc);
    setSafe("langSelectLabel", t.langSelectLabel);
    setSafe("nameInputLabel", t.nameInputLabel);
    const winp = document.getElementById("welcomeUsernameInput");
    if (winp) winp.placeholder = t.namePlaceholder;
    setSafe("enterBtnText", t.enterBtnText);

    // Update Hero
    setSafe("heroGreeting", t.heroGreeting);
    setSafe("heroName", t.heroName);

    // Update Tabs
    Object.keys(t.tabs).forEach((key) => {
      setSafe(`tab-${key}`, t.tabs[key]);
    });

    // Update About
    setSafe("aboutHead", t.aboutHead);
    setSafe("factNameLabel", t.factNameLabel);
    setSafe("factNameVal", t.factNameVal);
    setSafe("factSpecLabel", t.factSpecLabel);
    setSafe("factSpecVal", t.factSpecVal);
    setSafe("factSchoolLabel", t.factSchoolLabel);
    setSafe("factSchoolVal", t.factSchoolVal);
    setSafe("aboutBio", t.aboutBio);

    // Update Projects
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

    // Update Gallery
    setSafe("galleryHead", t.galleryHead);
    setSafe("galleryNotice", t.galleryNotice);
    setSafe("resetGalleryBtn", t.resetGalleryBtn);
    const gUp = document.getElementById("galleryUploadBtn");
    if (gUp) {
      const inp = gUp.querySelector("input");
      gUp.textContent = t.galleryUploadBtn + " ";
      if (inp) gUp.appendChild(inp);
    }

    // Update Services / Hire
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

    // Update Live Chat
    setSafe("chatHead", t.chatHead);
    setSafe("chatSubtitle", t.chatSubtitle);
    setSafe("chatSendBtn", t.chatSendBtn);
    setSafe("clearChatBtn", t.clearChatBtn);
    setSafe("chatNote", t.chatNote);
    setSafe("liveStatusText", t.liveStatusText);
    const chatInput = document.getElementById("chatInput");
    if (chatInput) chatInput.placeholder = t.chatInputPlaceholder;

    // Update Code & Contact
    setSafe("codeHead", t.codeHead);
    setSafe("codeTitle", t.codeTitle);
    setSafe("copy", t.codeCopy);
    setSafe("codeNote", t.codeNote);
    setSafe("contactHead", t.contactHead);
    setSafe("contactChatDesc", t.contactChatDesc);
    setSafe("contactGoChat", t.contactGoChat);

    // Dropzone text
    const dropEl = document.getElementById("drop");
    if (dropEl) {
      const span = dropEl.querySelector("span");
      if (span) span.textContent = t.dropText;
    }

    // Restart Typing Animation for New Language
    startTypingAnimation(t.typeStrings);

    // Sync Active Lang Pills in Welcome Modal
    document.querySelectorAll(".lang-pill").forEach((pill) => {
      pill.classList.toggle("active", pill.dataset.lang === lang);
    });
  }

  // --- Typing Effect in Hero ---
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
        speed = 2200; // Hold at end
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
    t.addEventListener("keydown", (e) => {
      const n = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (n) {
        const next = tabs[(i + n + tabs.length) % tabs.length];
        next.focus();
        location.hash = next.dataset.t;
      }
    });
  });

  window.addEventListener("hashchange", () => {
    showTab(location.hash.slice(1));
  });

  // External buttons that switch tabs
  document.getElementById("goToChatBtn")?.addEventListener("click", () => {
    location.hash = "chat";
  });
  document.getElementById("contactGoChat")?.addEventListener("click", () => {
    location.hash = "chat";
  });

  // --- Gallery & Visible Cards with Deletion ---
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
    } catch (e) {
      console.warn("Could not save gallery to localStorage", e);
    }
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

      // Tag
      if (item.title) {
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = item.title;
        card.appendChild(tag);
      }

      // Delete Button (Allows user to remove any image from gallery)
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

      // Open Lightbox on Card Click
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

  // Reset Gallery
  document.getElementById("resetGalleryBtn")?.addEventListener("click", () => {
    galleryItems = DEFAULT_IMAGES.slice();
    saveGallery();
    renderGallery();
  });

  // File Upload
  document.getElementById("file")?.addEventListener("change", (e) => {
    addImagesToGallery(e.target.files);
    e.target.value = "";
  });

  // Drag and Drop
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

  // Lightbox close
  lb.addEventListener("click", () => lb.classList.remove("on"));
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") lb.classList.remove("on");
  });

  // --- Welcoming / Loading Screen & Unique Username Flow ---
  const welcomeOverlay = document.getElementById("welcomeOverlay");
  const welcomeInput = document.getElementById("welcomeUsernameInput");
  const nameStatus = document.getElementById("nameStatus");
  const nameCheckMsg = document.getElementById("nameCheckMsg");
  const enterBtn = document.getElementById("enterBtn");
  const currentUserNameDisplay = document.getElementById("currentUserNameDisplay");

  function validateUsername(val) {
    const t = I18N[currentLang] || I18N.th;
    const trimmed = val.trim();

    if (!trimmed) {
      nameCheckMsg.className = "name-msg err";
      nameCheckMsg.textContent = t.nameEmpty;
      enterBtn.disabled = true;
      return false;
    }

    const check = isUsernameTaken(trimmed, sessionId);
    if (check.taken) {
      nameCheckMsg.className = "name-msg err";
      nameCheckMsg.textContent =
        check.reason === "reserved" ? t.nameReserved : t.nameTaken;
      enterBtn.disabled = true;
      return false;
    }

    nameCheckMsg.className = "name-msg ok";
    nameCheckMsg.textContent = t.nameAvailable;
    enterBtn.disabled = false;
    return true;
  }

  if (welcomeInput) {
    welcomeInput.addEventListener("input", (e) => {
      validateUsername(e.target.value);
    });

    welcomeInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !enterBtn.disabled) {
        enterBtn.click();
      }
    });
  }

  // Language Pills in Welcome Modal
  document.querySelectorAll(".lang-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      const l = pill.dataset.lang;
      applyLanguage(l);
      if (welcomeInput && welcomeInput.value) {
        validateUsername(welcomeInput.value);
      }
    });
  });

  // Enter Button in Welcome Modal
  enterBtn?.addEventListener("click", () => {
    const chosen = (welcomeInput ? welcomeInput.value : "").trim();
    if (!validateUsername(chosen)) return;

    currentUsername = chosen;
    localStorage.setItem("potter_portfolio_user", currentUsername);
    registerUser(currentUsername, sessionId);

    // Save user to Supabase if connected
    if (supabaseClient) {
      supabaseClient
        .from("chat_users")
        .upsert({
          username: currentUsername,
          session_id: sessionId,
          language: currentLang,
          last_active: new Date().toISOString(),
        })
        .then(() => {})
        .catch((e) => console.warn("Supabase user upsert error:", e));
    }

    updateUserDisplay();

    // Smoothly close overlay
    welcomeOverlay.classList.add("hide");
    setTimeout(() => {
      welcomeOverlay.style.display = "none";
    }, 400);

    // Check if initial chat welcome message exists
    ensureInitialChatGreeting();
  });

  function updateUserDisplay() {
    if (currentUserNameDisplay) {
      currentUserNameDisplay.textContent = currentUsername || "แขก";
    }
  }

  // Change name button in top navbar
  document.getElementById("changeNameBtn")?.addEventListener("click", () => {
    if (welcomeOverlay) {
      welcomeOverlay.style.display = "grid";
      welcomeOverlay.classList.remove("hide");
      if (welcomeInput) {
        welcomeInput.value = currentUsername;
        validateUsername(currentUsername);
        welcomeInput.focus();
      }
    }
  });

  // Language switch dropdown in top navbar
  const langSwitchBtn = document.getElementById("langSwitchBtn");
  const langMenu = document.getElementById("langMenu");

  langSwitchBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    langMenu.hidden = !langMenu.hidden;
  });

  document.querySelectorAll(".menu-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const l = btn.dataset.lang;
      applyLanguage(l);
      langMenu.hidden = true;
    });
  });

  window.addEventListener("click", () => {
    if (langMenu) langMenu.hidden = true;
  });

  // --- Live Inquiry Chat System ---
  const chatMessagesEl = document.getElementById("chatMessages");
  const chatForm = document.getElementById("chatForm");
  const chatInput = document.getElementById("chatInput");
  const clearChatBtn = document.getElementById("clearChatBtn");

  function getSessionMessages(sessId) {
    try {
      const stored = localStorage.getItem(`potter_chat_msgs_${sessId}`);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  }

  function saveSessionMessages(sessId, msgs) {
    try {
      localStorage.setItem(`potter_chat_msgs_${sessId}`, JSON.stringify(msgs));
    } catch (e) {}
  }

  function ensureInitialChatGreeting() {
    const msgs = getSessionMessages(sessionId);
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
      saveSessionMessages(sessionId, msgs);
    }
    renderChatMessages();
  }

  function renderChatMessages() {
    if (!chatMessagesEl) return;
    const targetSession = isAdmin ? activeAdminSession || sessionId : sessionId;
    const msgs = getSessionMessages(targetSession);

    chatMessagesEl.innerHTML = "";

    msgs.forEach((m) => {
      appendChatMessage(m, false);
    });

    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  }

  function appendChatMessage(m, shouldScroll = true) {
    if (!chatMessagesEl) return;

    const wrap = document.createElement("div");
    const isMine = (!isAdmin && m.sender_role === "user") || (isAdmin && m.sender_role === "admin");
    const isSysAdmin = m.sender_role === "admin";

    wrap.className = `chat-msg ${isMine ? "mine" : "theirs"} ${isSysAdmin ? "admin" : ""}`;

    const meta = document.createElement("div");
    meta.className = "msg-meta";

    const timeStr = m.created_at
      ? new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "";

    if (isSysAdmin) {
      meta.innerHTML = `<span class="admin-tag">ADMIN</span> <b>${m.sender_name}</b> • <small>${timeStr}</small>`;
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

  // Send Discord Webhook Notification
  async function notifyDiscordWebhook(username, messageText, userLang, sessId) {
    if (!DISCORD_WEBHOOK_URL) return;

    const payload = {
      username: "Potter Portfolio Inquiry",
      avatar_url: "https://raw.githubusercontent.com/FortAwesome/Font-Awesome/master/svgs/solid/cube.svg",
      embeds: [
        {
          title: "ข้อความสอบถามงานใหม่! (New Commission Inquiry)",
          description: messageText,
          color: 3007231, // #2DE2FF
          fields: [
            { name: "ชื่อผู้ติดต่อ (Client)", value: username || "Guest", inline: true },
            { name: "ภาษา (Language)", value: userLang.toUpperCase(), inline: true },
            { name: "เซสชัน (Session ID)", value: sessId.slice(0, 16), inline: true },
            {
              name: "เวลาที่ส่ง (Timestamp)",
              value: new Date().toLocaleString("th-TH"),
              inline: false,
            },
          ],
          footer: {
            text: "Potter Portfolio • Minecraft 3D Modeler & Developer",
          },
        },
      ],
    };

    try {
      await fetch(DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.warn("Discord Webhook notification error:", err);
    }
  }

  // Handle Chat Form Submit
  chatForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = (chatInput ? chatInput.value : "").trim();
    if (!text) return;

    chatInput.value = "";

    const targetSession = isAdmin ? activeAdminSession || sessionId : sessionId;
    const role = isAdmin ? "admin" : "user";
    const sender = isAdmin ? "Potter (Admin)" : currentUsername || "Client";

    const msgObj = {
      id: "msg_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      session_id: targetSession,
      sender_name: sender,
      sender_role: role,
      content: text,
      created_at: new Date().toISOString(),
    };

    // Save to local session
    const msgs = getSessionMessages(targetSession);
    msgs.push(msgObj);
    saveSessionMessages(targetSession, msgs);

    // Append to UI immediately
    appendChatMessage(msgObj, true);

    // Send Discord Webhook when user inquiries
    if (!isAdmin) {
      notifyDiscordWebhook(sender, text, currentLang, sessionId);
    }

    // Save to Supabase if connected
    if (supabaseClient) {
      supabaseClient
        .from("chat_messages")
        .insert({
          session_id: targetSession,
          sender_name: sender,
          sender_role: role,
          content: text,
        })
        .then(() => {})
        .catch((err) => console.warn("Supabase insert error:", err));
    }
  });

  // Clear Chat History Button
  clearChatBtn?.addEventListener("click", () => {
    const t = I18N[currentLang] || I18N.th;
    if (confirm(t.clearConfirm)) {
      const targetSession = isAdmin ? activeAdminSession || sessionId : sessionId;
      localStorage.removeItem(`potter_chat_msgs_${targetSession}`);
      ensureInitialChatGreeting();
    }
  });

  // --- Admin Modal & Mode Switcher ---
  const adminModal = document.getElementById("adminModal");
  const openAdminBtn = document.getElementById("openAdminBtn");
  const closeAdminModal = document.getElementById("closeAdminModal");
  const adminAuthBlock = document.getElementById("adminAuthBlock");
  const adminDashBlock = document.getElementById("adminDashBlock");
  const adminPassInput = document.getElementById("adminPassInput");
  const adminLoginBtn = document.getElementById("adminLoginBtn");
  const adminAuthErr = document.getElementById("adminAuthErr");
  const adminSessionList = document.getElementById("adminSessionList");

  openAdminBtn?.addEventListener("click", () => {
    adminModal.hidden = false;
    if (isAdmin) {
      adminAuthBlock.hidden = true;
      adminDashBlock.hidden = false;
      renderAdminSessions();
    } else {
      adminAuthBlock.hidden = false;
      adminDashBlock.hidden = true;
      if (adminPassInput) {
        adminPassInput.value = "";
        adminPassInput.focus();
      }
    }
  });

  closeAdminModal?.addEventListener("click", () => {
    adminModal.hidden = true;
  });

  adminLoginBtn?.addEventListener("click", () => {
    const pass = (adminPassInput ? adminPassInput.value : "").trim();
    if (pass === ADMIN_PASSCODE) {
      isAdmin = true;
      adminAuthErr.textContent = "";
      adminAuthBlock.hidden = true;
      adminDashBlock.hidden = false;
      renderAdminSessions();
    } else {
      adminAuthErr.textContent = "รหัสผ่านแอดมินไม่ถูกต้อง (ค่าเริ่มต้น: potter2026)";
    }
  });

  function renderAdminSessions() {
    if (!adminSessionList) return;
    adminSessionList.innerHTML = "";

    const users = getRegisteredUsers();
    if (users.length === 0) {
      adminSessionList.innerHTML = `<div class="muted">ยังไม่มีรายการแชตจากลูกค้า</div>`;
      return;
    }

    users.forEach((u) => {
      const div = document.createElement("div");
      div.className = `session-item ${activeAdminSession === u.sessionId ? "active" : ""}`;
      div.innerHTML = `
        <div>
          <b>${u.name}</b>
          <br><small class="muted">ID: ${u.sessionId.substring(0, 14)}...</small>
        </div>
        <button type="button" class="btn btn-sm btn-primary">ดูแชต & ตอบ</button>
      `;

      div.addEventListener("click", () => {
        activeAdminSession = u.sessionId;
        adminModal.hidden = true;
        location.hash = "chat";
        renderChatMessages();
      });

      adminSessionList.appendChild(div);
    });
  }

  // Admin Dashboard Tabs
  document.querySelectorAll(".admin-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document
        .querySelectorAll(".admin-tab")
        .forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      const target = tab.dataset.atab;
      document.getElementById("atabChats").hidden = target !== "chats";
      document.getElementById("atabSql").hidden = target !== "sql";
    });
  });

  // Supabase Config Save
  const cfgUrl = document.getElementById("cfgSupabaseUrl");
  const cfgKey = document.getElementById("cfgSupabaseKey");
  const saveSupabaseCfg = document.getElementById("saveSupabaseCfg");
  const resetSupabaseCfg = document.getElementById("resetSupabaseCfg");

  if (cfgUrl) cfgUrl.value = localStorage.getItem("potter_supabase_url") || "";
  if (cfgKey) cfgKey.value = localStorage.getItem("potter_supabase_key") || "";

  saveSupabaseCfg?.addEventListener("click", () => {
    const u = (cfgUrl ? cfgUrl.value : "").trim();
    const k = (cfgKey ? cfgKey.value : "").trim();
    localStorage.setItem("potter_supabase_url", u);
    localStorage.setItem("potter_supabase_key", k);
    initSupabase();
    alert("บันทึกการตั้งค่า Supabase เรียบร้อยแล้ว!");
  });

  resetSupabaseCfg?.addEventListener("click", () => {
    localStorage.removeItem("potter_supabase_url");
    localStorage.removeItem("potter_supabase_key");
    if (cfgUrl) cfgUrl.value = "";
    if (cfgKey) cfgKey.value = "";
    supabaseClient = null;
    initSupabase();
    alert("รีเซ็ตการตั้งค่าเรียบร้อยแล้ว");
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
      // Fallback
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

  // --- Initial Setup Execution ---
  // 1. Language Setup
  applyLanguage(currentLang);

  // 2. Initial Tab
  showTab(location.hash.slice(1));

  // 3. Render Gallery
  renderGallery();

  // 4. Check User Onboarding / Welcome Modal
  if (!currentUsername) {
    if (welcomeOverlay) {
      welcomeOverlay.style.display = "grid";
      welcomeOverlay.classList.remove("hide");
    }
  } else {
    if (welcomeOverlay) {
      welcomeOverlay.style.display = "none";
    }
    registerUser(currentUsername, sessionId);
    updateUserDisplay();
    ensureInitialChatGreeting();
  }

  // 5. Initialize Supabase
  initSupabase();
})();
