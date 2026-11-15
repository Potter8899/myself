import json, os, re, sys, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."); PORT = 8941
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(("", PORT), functools.partial(Q, directory=ROOT)); threading.Thread(target=srv.serve_forever, daemon=True).start()
fails = []
def check(n, c, extra=""):
    print(("PASS " if c else "FAIL ") + n + ("" if c else " " + str(extra)))
    if not c: fails.append(n)
TEST_CONTENT = """window.SITE_CONTENT = {
 profile:{name:"Potter",photo:"img/p.png",tagline:{th:"นักพัฒนา",en:"Developer"},intro:{th:"สวัสดี",en:"Hi"},who:{th:"ผมคือ **Potter**",en:"I am **Potter**"},story:{th:"",en:""},learning:["Rust"],interests:["Python"],email:"me@example.com",
   socials:[{label:"GitHub",url:"https://github.com/Potter8899"},{label:"Evil",url:"javascript:window.PWNED=1"},{label:"Plain",url:"http://insecure.example"}]},
 skills:[{name:"Python",category:"programming",icon:"🐍"},{name:"Git",category:"tools",icon:"🌿"}],
 timeline:[{when:"2024",kind:"milestone",title:{th:"เริ่ม",en:"Started"},body:{th:"",en:""}}],
 projects:[{slug:"alpha",category:"ai",status:"live",featured:true,cover:"",github:"https://github.com/x/y",demo:"http://no-https.example",tags:["Py"],title:{th:"อัลฟา",en:"Alpha"},summary:{th:"สรุป",en:"Summary"},body:{th:"# หัวข้อ",en:"# Heading\\n\\n<script>window.PWNED=2</script> [bad](javascript:window.PWNED=3)"},images:[{src:"img/p.png",caption:{th:"ภาพ",en:"Shot"}}]}],
 gallery:[{src:"img/p.png",category:"personal",caption:{th:"ก",en:"One"}},{src:"img/p.png",category:"personal",caption:{th:"ข",en:"Two"}},{src:"javascript:1",category:"personal",caption:{th:"x",en:"bad"}}],
 blog:[{slug:"hello",status:"published",date:"2026-11-01",category:"devlog",tags:["t"],cover:"",title:{th:"สวัสดีโลก",en:"Hello world"},excerpt:{th:"ย่อ",en:"Excerpt"},body:{th:"x",en:"Hi <img src=x onerror=window.PWNED=4> [bad](javascript:window.PWNED=5) [ok](https://example.com)\\n\\n```\\n<b>raw</b>\\n```"}},
        {slug:"secret",status:"draft",date:"2026-11-02",category:"devlog",tags:[],cover:"",title:{th:"ร่าง",en:"Draft post"},excerpt:{th:"",en:""},body:{th:"d",en:"d"}}]
};"""
PNG = open(os.path.join(ROOT, "img", "favicon.svg"), "rb").read()
import struct, zlib
def png():
    def ch(t, d): c = struct.pack(">I", len(d)) + t + d; return c + struct.pack(">I", zlib.crc32(t + d))
    raw = b"".join(b"\x00" + bytes([40, 90, 200]) * 40 for _ in range(50)); return b"\x89PNG\r\n\x1a\n" + ch(b"IHDR", struct.pack(">IIBBBBB", 40, 50, 8, 2, 0, 0, 0)) + ch(b"IDAT", zlib.compress(raw)) + ch(b"IEND", b"")
IMG = png()
with sync_playwright() as p:
    b = p.chromium.launch()
    def mk(vw=1280, content=True, reduced=False, first=False):
        ctx = b.new_context(viewport={"width": vw, "height": 900}, reduced_motion="reduce" if reduced else "no-preference"); pg = ctx.new_page(); errs = []; hosts = set()
        pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text) if m.type == "error" and "Failed to load resource" not in m.text and "ERR_FAILED" not in m.text else None)
        pg.on("request", lambda r: hosts.add(re.sub(r"^(\w+://[^/]+).*", r"\1", r.url)))
        pg.route(re.compile(r"https://fonts\..*"), lambda r, q: r.abort())
        if content: pg.route("**/js/content.js", lambda r, q: r.fulfill(status=200, content_type="application/javascript", body=TEST_CONTENT))
        # media.js is stubbed: the tests use their own photo/gallery (media.js itself is tested at the end)
        pg.route("**/js/works.js", lambda r, q: r.fulfill(status=200, content_type="application/javascript", body="window.WORKS=[];" if content else open(os.path.join(ROOT, "js", "works.js"), encoding="utf-8").read()))
        pg.route("**/js/media.js", lambda r, q: r.fulfill(status=200, content_type="application/javascript", body='window.MEDIA={profilePhoto:"",gallery:[],files:[{name:"Demo file",file:"files/demo.zip"},{name:"Evil",file:"javascript:1"}]};' if content else "window.MEDIA={};"))
        pg.route("**/img/p.png", lambda r, q: r.fulfill(status=200, content_type="image/png", body=IMG))
        
        if not first: pg.add_init_script("localStorage.setItem('ps_lang','en')")
        return pg, errs, hosts
    pg, errs, hosts = mk(); pg.goto(f"http://localhost:{PORT}/index.html"); pg.wait_for_selector(".proj", state="attached"); pg.wait_for_timeout(900); pg.add_style_tag(content="body.has-tabs main>[data-pane]:not(.pane-on){display:block!important;animation:none!important}", ) ; pg.evaluate("document.querySelectorAll('.fxi').forEach(e=>e.classList.add('in'))")  # legacy checks look at every section at once; the tab test below removes this override
    check("no JS errors", not errs, errs)
    check("only same-origin requests (plus fonts, which are blocked here)", all(h.startswith("http://localhost") or "fonts.g" in h for h in hosts), hosts)
    check("no forms / inputs for posting data on the page", pg.locator("form, textarea, input[type=password], #chat, #authModal").count() == 0)
    check("hero name letters", pg.locator("#heroName span").count() == 6)
    check("hero text from content.js", pg.locator("#intro").inner_text() == "Hi" and pg.locator("#tagline").inner_text() == "Developer")
    check("skills grouped", pg.locator("#skillList section").count() == 2)
    check("timeline", "Started" in pg.locator("#timelineList").inner_text())
    check("empty About sections hidden (story/journey/goals not shown)", not any(x in pg.locator("#aboutBody").inner_text() for x in ["My story", "My goals", "My development journey"]))
    check("project card; non-https demo link NOT rendered; https GitHub rendered", pg.locator(".proj h3").inner_text() == "Alpha" and pg.locator(".proj a[href^='http://']").count() == 0 and pg.locator(".proj a[href='https://github.com/x/y']").count() == 1)
    check("socials: only https links kept", pg.locator("#stripSocial a").count() == 1 and pg.locator("#contactLinks a[href^='mailto:']").count() == 1 and pg.evaluate("window.PWNED") is None)
    check("gallery skips invalid image URL", pg.locator(".masonry figure").count() == 2)
    check("blog: published shown, draft hidden", pg.locator(".post h3").all_inner_texts() == ["Hello world"] and "Draft post" not in pg.locator("body").inner_text())
    check("no skill percentages", not re.search(r"\d+\s?%", pg.locator("#skills").inner_text()))
    pg.screenshot(path="/tmp/web_top.png")
    pg.click("#langBtn"); pg.wait_for_timeout(200); check("switch to Thai", pg.locator("#navLinks a").first.inner_text() == "หน้าแรก" and pg.locator(".proj h3").inner_text() == "อัลฟา" and "Guestbook" not in pg.locator("#navLinks").inner_text() and pg.locator("#navLinks a").count() == 7)
    pg.click("#langBtn")
    pg.evaluate("window.scrollTo(0,0)"); card = pg.locator("#profileCard"); pg.wait_for_function("document.getElementById('profileImg').complete && !document.getElementById('profileImg').hidden")
    check("photo shown, letter fallback not displayed", pg.evaluate("getComputedStyle(document.getElementById('fallback')).display") == "none")
    check("normal state blurred + dimmed", "blur" in pg.evaluate("getComputedStyle(document.getElementById('profileImg')).filter"))
    bb = card.bounding_box(); pg.mouse.move(bb["x"] + bb["width"] * .8, bb["y"] + bb["height"] * .2); pg.wait_for_timeout(900)
    check("hover: sharp + 3D tilt", pg.evaluate("getComputedStyle(document.getElementById('profileImg')).filter") == "none" and "matrix3d" in pg.evaluate("getComputedStyle(document.getElementById('profileCard')).transform"))
    pg.mouse.move(5, 500)
    try: pg.wait_for_function("!document.getElementById('profileCard').style.transform", timeout=5000); ok = True
    except Exception: ok = False
    check("leave: spring settles, blur restored", ok and "blur" in pg.evaluate("getComputedStyle(document.getElementById('profileImg')).filter"))
    card.click(); pg.wait_for_selector("#lightbox:not([hidden])"); pg.keyboard.press("Escape"); check("click opens lightbox; ESC closes", pg.locator("#lightbox").is_hidden())
    card.click(); pg.mouse.click(10, 10); check("click outside closes", pg.locator("#lightbox").is_hidden()); card.click(); pg.click("#lightbox .x"); check("close button closes", pg.locator("#lightbox").is_hidden())
    pg.locator(".masonry figure").nth(0).click(); pg.click("#lbNext"); check("gallery next + caption", pg.locator("#lbCap").inner_text() == "Two"); pg.click("#lbImg"); check("zoom toggles", pg.evaluate("document.getElementById('lbImg').classList.contains('zoomed')")); pg.keyboard.press("Escape")
    pg.evaluate("location.hash='#/project/alpha'"); pg.wait_for_selector("#projModal:not([hidden])")
    check("project detail + XSS inert", pg.locator("#pmTitle").inner_text() == "Alpha" and pg.evaluate("window.PWNED") is None and pg.locator("#projSheet script, #projSheet a[href^='javascript']").count() == 0 and pg.locator("#projSheet .shots img").count() == 1)
    pg.keyboard.press("Escape"); check("ESC closes + hash restored", pg.locator("#projModal").is_hidden() and pg.evaluate("location.hash") == "#projects")
    pg.evaluate("location.hash='#/blog/hello'"); pg.wait_for_selector("#reader:not([hidden])")
    check("blog XSS inert, only https link kept", pg.evaluate("window.PWNED") is None and pg.eval_on_selector_all("#readerSheet a", "e=>e.map(a=>a.getAttribute('href'))") == ["https://example.com"] and pg.locator("#readerSheet img[src='x']").count() == 0)
    check("code fence raw", pg.locator("#readerSheet pre").inner_text() == "<b>raw</b>"); pg.keyboard.press("Escape")
    pg.evaluate("location.hash='#/blog/secret'"); pg.wait_for_timeout(300); check("draft post URL does not open", pg.locator("#reader").is_hidden())
    pg.evaluate("location.hash='#/project/nope'"); pg.wait_for_timeout(200); check("unknown project URL harmless", pg.locator("#projModal").is_hidden())
    pg.fill("#projQ", "zzz"); pg.wait_for_timeout(200); check("project search no result", "No results" in pg.locator("#projList").inner_text()); pg.fill("#projQ", "")
    pg.evaluate("document.querySelectorAll('style').forEach(s=>{ if (s.textContent.indexOf('!important')>=0 && s.textContent.indexOf('data-pane')>=0) s.remove(); })"); pg.click("#navLinks a[data-nav=gallery]"); pg.wait_for_timeout(500); check("tabs: gallery tab shows only gallery", pg.locator("#navLinks a.on").get_attribute("data-nav") == "gallery" and pg.locator("#gallery").is_visible() and not pg.locator("#projects").is_visible() and not pg.locator("#top").is_visible())
    check("no JS errors after interaction", not errs, errs)
    pm, merrs, _ = mk(375); pm.goto(f"http://localhost:{PORT}/index.html"); pm.wait_for_selector(".proj", state="attached"); pm.wait_for_timeout(800)
    check("mobile: no horizontal overflow", pm.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), pm.evaluate("document.documentElement.scrollWidth"))
    pm.click("#menuBtn"); pm.wait_for_timeout(400); check("mobile menu opens", pm.evaluate("getComputedStyle(document.getElementById('navLinks')).visibility") == "visible")
    pm.click("#navLinks a[data-nav=projects]"); pm.wait_for_timeout(900); check("mobile nav click opens tab + closes menu", pm.locator("#projects").is_visible() and not pm.locator("#about").is_visible() and pm.evaluate("getComputedStyle(document.getElementById('navLinks')).visibility") == "hidden"); check("mobile no errors", not merrs, merrs)
    pr, _, _ = mk(1000, reduced=True); pr.goto(f"http://localhost:{PORT}/index.html"); pr.wait_for_timeout(600)
    check("reduced motion", pr.evaluate("getComputedStyle(document.querySelector('#heroName span')).opacity") == "1" and pr.evaluate("getComputedStyle(document.querySelector('.nebula')).animationName") == "none")
    # shipped default content (no override): sections show friendly empty states, no errors
    pd, derrs, _ = mk(content=False); pd.goto(f"http://localhost:{PORT}/index.html"); pd.wait_for_selector(".proj", state="attached"); pd.wait_for_timeout(700); pd.add_style_tag(content="body.has-tabs main>[data-pane]:not(.pane-on){display:block!important}")
    check("default content.js: 2 projects, 18 skills, empty gallery/blog show 'coming soon', no errors", pd.locator(".proj").count() == 2 and pd.locator(".skill").count() == 18 and "Nothing here yet" in pd.locator("#blogList").inner_text() and "Nothing here yet" in pd.locator("#galList").inner_text() and not derrs, derrs)
    check("no profile photo yet: letter fallback IS shown (card not blank) and click does not open lightbox", pd.evaluate("getComputedStyle(document.getElementById('fallback')).display") != "none" and pd.locator("#fallback").inner_text() == "P")
    pd.locator("#profileCard").click(); pd.wait_for_timeout(200); check("fallback card click: no lightbox", pd.locator("#lightbox").is_hidden())
    try: pd.wait_for_function("getComputedStyle(document.querySelector('#heroName span:last-child')).opacity === '1'", timeout=8000); shown = True
    except Exception: shown = False
    check("hero name letters visible after intro animation", shown)
    pd.screenshot(path="/tmp/web_default.png")
    # new: name card, bigger photo, media.js (gallery + files), tabs on default content
    check("name card shows full name / grade / nickname", pd.locator("#nameCard dd").count() == 3 and "พัฒนพล ภักดีอำนาจ" in pd.locator("#nameCard").inner_text() and "Potter" in pd.locator("#nameCard").inner_text())
    check("profile photo is large on desktop", pd.locator("#profileCard").bounding_box()["width"] >= 480, pd.locator("#profileCard").bounding_box())
    pd.evaluate("document.querySelectorAll('style').forEach(s=>{ if (s.textContent.indexOf('!important')>=0 && s.textContent.indexOf('data-pane')>=0) s.remove(); })")
    check("default: only the home tab is visible", pd.locator("#top").is_visible() and not pd.locator("#about").is_visible() and not pd.locator("#contact").is_visible())
    pd.click("#navLinks a[data-nav=about]"); pd.wait_for_timeout(300); check("tab: About opens alone + URL hash", pd.locator("#about").is_visible() and not pd.locator("#top").is_visible() and pd.evaluate("location.hash") == "#about")
    pd.go_back(); pd.wait_for_timeout(300); check("browser Back returns to the previous tab", pd.locator("#top").is_visible() and not pd.locator("#about").is_visible())
    pn, nerrs, _ = mk(); pn.route("**/js/media.js", lambda r, q: r.fulfill(status=200, content_type="application/javascript", body='window.MEDIA={profilePhoto:"",gallery:["img/p.png",{src:"img/p.png",caption:"Cap"},{src:"javascript:1"}],files:[{name:"Demo file",file:"files/demo.zip"},{name:"Evil",file:"javascript:1"}]};'))
    pn.goto(f"http://localhost:{PORT}/index.html#gallery"); pn.wait_for_timeout(900)
    check("media.js: gallery items added (bad src skipped)", pn.locator("#galList figure").count() == 4 and "Cap" in pn.locator("#galList").inner_text(), pn.locator("#galList figure").count())
    check("media.js: files list (only safe paths)", pn.locator("#fileList a").count() == 1 and pn.locator("#fileList a").get_attribute("href") == "files/demo.zip" and "Demo file" in pn.locator("#fileList").inner_text())
    check("direct link #gallery opens that tab", pn.locator("#gallery").is_visible() and not pn.locator("#top").is_visible() and not nerrs, nerrs)
    pn.click("#navLinks a[data-nav=top]"); pn.wait_for_timeout(300)
    pn.close(); pq, qerrs, _ = mk(); pq.route("**/js/media.js", lambda r, q: r.fulfill(status=200, content_type="application/javascript", body='window.MEDIA={profilePhoto:"",profilePrompt:"Make it <b>dark</b>"};'))
    pq.goto(f"http://localhost:{PORT}/index.html"); pq.wait_for_function("document.getElementById('profileImg').complete && !document.getElementById('profileImg').hidden"); pq.click("#profileCard"); pq.wait_for_timeout(400)
    check("profile click shows the AI prompt (as plain text)", pq.locator("#lbPrompt").is_visible() and pq.locator("#lbpText").inner_text() == "Make it <b>dark</b>" and pq.locator("#lbPrompt b").count() == 0 and not qerrs, qerrs)

    # ---- first visit: language gate -> loading screen -> site
    pgt, gerrs, _ = mk(first=True); pgt.goto(f"http://localhost:{PORT}/index.html"); pgt.wait_for_timeout(500)
    check("first visit: language gate shown, loader not shown yet", pgt.locator("#gate").is_visible() and not pgt.locator("#loader").is_visible())
    check("gate offers Thai and English", pgt.locator("#gate [data-lang]").count() == 2)
    pgt.wait_for_timeout(3000); check("gate stays up (not auto-dismissed by the 2.5s safety timer)", pgt.locator("#gate").is_visible() and pgt.locator("#loader").count() == 1)
    pgt.click("#gate [data-lang=th]"); pgt.wait_for_timeout(250)
    check("after choosing: gate gone, loading screen with progress bar shown", not pgt.locator("#gate").is_visible() and pgt.locator("#loader").is_visible() and pgt.locator("#lbarFill").count() == 1)
    check("loading screen text is in the chosen language (Thai)", "จักรวาล" in pgt.locator("#loadMsg").inner_text())
    check("language saved for next visit", pgt.evaluate("localStorage.getItem('ps_lang')") == "th")
    pgt.wait_for_function("!document.getElementById('loader')", timeout=8000); check("loader finishes and is removed, site is in Thai", pgt.locator("#navLinks a").first.inner_text() == "หน้าแรก" and not gerrs, gerrs)
    pgt.reload(); pgt.wait_for_timeout(500); check("returning visitor: no gate", not pgt.locator("#gate").is_visible())
    pgt.goto(f"http://localhost:{PORT}/index.html?gate"); pgt.wait_for_timeout(300); check("?gate previews the gate again", pgt.locator("#gate").is_visible())
    pge, _, _ = mk(first=True); pge.goto(f"http://localhost:{PORT}/index.html"); pge.wait_for_timeout(300); pge.click("#gate [data-lang=en]"); pge.wait_for_function("!document.getElementById('loader')", timeout=8000)
    check("English choice -> English site", pge.locator("#navLinks a").first.inner_text() == "Home" and pge.evaluate("document.documentElement.lang") == "en")
    # ---- works.js: simple works list
    pw, werrs, _ = mk(); pw.route("**/js/works.js", lambda r, q: r.fulfill(status=200, content_type="application/javascript", body="window.WORKS=[{title:'งานหนึ่ง',titleEn:'Work One',desc:'คำอธิบาย',type:'bot',tags:'Py, Bot',link:'https://example.com',img:'img/p.png'},{title:'Hidden',hidden:true},{title:'Plain <b>x</b>',type:'weird',status:'zzz',link:'javascript:1',images:['img/p.png'],id:'my-id'},{desc:'no title'}];"))
    pw.goto(f"http://localhost:{PORT}/index.html#projects"); pw.wait_for_selector(".proj", state="attached"); pw.wait_for_timeout(500)
    check("works.js: entries become project cards (hidden / untitled skipped)", pw.locator(".proj").count() == 3, pw.locator(".proj").count())
    check("works.js: English title used in EN, Thai desc fallback", "Work One" in pw.locator("#projList").inner_text() and "คำอธิบาย" in pw.locator("#projList").inner_text())
    check("works.js: type alias 'bot' -> Discord Bots chip, comma tags split", "Discord Bots" in pw.locator("#projList").inner_text() and pw.locator(".proj .chip", has_text="Bot").count() >= 1)
    check("works.js: https link kept, javascript: link dropped, text stays plain", pw.locator(".proj a[href='https://example.com']").count() == 1 and pw.locator(".proj a[href^='javascript']").count() == 0 and pw.locator(".proj b").count() == 0 and pw.evaluate("window.PWNED") is None)
    pw.goto(f"http://localhost:{PORT}/index.html#/project/my-id"); pw.wait_for_timeout(500); check("works.js: custom id gives a direct link to the detail sheet", pw.locator("#projModal").is_visible() and not werrs, werrs)
    b.close()
print("\nFAILED:", fails if fails else "none"); sys.exit(1 if fails else 0)
