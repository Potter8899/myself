import json, struct, zlib, threading, http.server, socketserver, functools, sys, re
from playwright.sync_api import sync_playwright
import os; ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "frontend"); PORT = 8911
def png():
    def ch(t, d): c = struct.pack(">I", len(d)) + t + d; return c + struct.pack(">I", zlib.crc32(t + d))
    raw = b"".join(b"\x00" + bytes([40, 90, 200]) * 40 for _ in range(50))
    return b"\x89PNG\r\n\x1a\n" + ch(b"IHDR", struct.pack(">IIBBBBB", 40, 50, 8, 2, 0, 0, 0)) + ch(b"IDAT", zlib.compress(raw)) + ch(b"IEND", b"")
PNG = png()
BI = lambda th, en="": {"th": th, "en": en or th}
SITE = {"profile": {"name": "Potter", "tagline": BI("นักพัฒนา", "Developer"), "intro": BI("ผมสร้างเว็บ", "I build things"), "who": BI("ผมคือ **Potter**", "I am **Potter**"), "story": BI("", ""), "journey": BI("", ""), "goals": BI("", ""), "building": BI("", ""),
        "learning": ["Rust"], "interests": ["Python", "Badminton"], "photo_url": "https://x.supabase.co/p.png", "contact_email": "me@example.com", "socials": [{"label": "GitHub", "url": "https://github.com/Potter8899"}]},
  "skills": [{"id": 1, "name": "Python", "category": "programming", "icon": "🐍", "note": BI(""), "sort": 1}, {"id": 2, "name": "Git", "category": "tools", "icon": "🌿", "note": BI(""), "sort": 1}],
  "timeline": [{"id": 1, "when_label": "2024", "kind": "milestone", "title": BI("เริ่มทำ Discord bot", "Started the Discord bot"), "body": BI("")}], "flags": {"guestbook": True, "contact": True}}
PROJ = [{"id": 1, "slug": "alpha", "category": "ai", "status": "live", "featured": True, "cover_url": "", "github_url": "https://github.com/x/y", "demo_url": "", "tags": ["Py"], "title": BI("อัลฟา", "Alpha"), "summary": BI("สรุป", "Summary"), "sort": 1}]
PROJ_D = {**PROJ[0], "body": BI("# หัวข้อ\n\nข้อความ **หนา**", "# Heading\n\nText **bold**"), "images": [{"id": 1, "image_url": "https://x.supabase.co/p.png", "caption": BI("ภาพ", "Shot"), "sort": 1}]}
POST = {"id": 1, "slug": "hello", "category": "devlog", "tags": ["t"], "cover_url": "", "title": BI("สวัสดีโลก", "Hello world"), "excerpt": BI("ย่อ", "Excerpt"), "read_min": 2, "published_at": "2026-11-01T00:00:00+00:00",
        "body": BI("Hi <script>window.PWNED=1</script> <img src=x onerror=window.PWNED=2> [bad](javascript:window.PWNED=3) [ok](https://example.com)\n\n```\n<b>raw</b>\n```")}
GAL = [{"id": i, "image_url": "https://x.supabase.co/p.png", "category": "personal", "caption": BI("ภาพ %d" % i, "Pic %d" % i)} for i in range(1, 4)]
calls = []
def api(route, request):
    u = request.url; path = re.sub(r"^http://localhost:\d+", "", u).split("?")[0]; m = request.method
    calls.append((m, path, request.post_data))
    R = lambda d, s=200: route.fulfill(status=s, content_type="application/json", body=json.dumps(d))
    if path == "/api/site": return R(SITE)
    if path == "/api/config": return R({"sitekey": "test-key"})
    if path == "/api/projects": return R({"items": PROJ, "total": 1, "page": 1, "size": 12})
    if path == "/api/projects/alpha": return R(PROJ_D)
    if path == "/api/gallery": return R({"items": GAL, "total": 3, "page": 1, "size": 18})
    if path == "/api/blog": return R({"items": [POST], "total": 1, "page": 1, "size": 9, "categories": ["devlog"]})
    if path == "/api/blog/hello": return R(POST)
    if path == "/api/guestbook" and m == "GET": return R({"items": [{"id": 5, "display_name": "Fan<b>", "message": "<script>1</script>สวยมาก", "created_at": "2026-11-02T00:00:00+00:00"}], "total": 1, "page": 1, "size": 10})
    if path == "/api/guestbook" and m == "POST": return R({"ok": True, "status": "approved"})
    if path == "/api/contact": return R({"ok": True})
    if path == "/api/stats": return R({"bot_online": True, "tickets": 3, "users": 9, "messages": 40})
    if path == "/api/login": return R({"token": "tk", "username": "potter", "role": "owner"})
    if path == "/api/me": return R({"username": "potter", "role": "owner"})
    if path == "/api/messages" and m == "GET": return R({"ticket": None, "messages": []})
    if path == "/api/messages" and m == "POST": return R({"ok": True})
    return R({"error": "not_found"}, 404)
TS = "window.turnstile={n:0,render:function(el,o){var id=++this.n;setTimeout(function(){o.callback('tok-'+id+'-'+Date.now())},50);return id},reset:function(id){}}"
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(("", PORT), functools.partial(Q, directory=ROOT)); threading.Thread(target=srv.serve_forever, daemon=True).start()
fails = []
def check(name, cond, extra=""):
    print(("PASS " if cond else "FAIL ") + name + (" " + str(extra) if (extra and not cond) else "")); 
    if not cond: fails.append(name)
with sync_playwright() as p:
    b = p.chromium.launch()
    def page_for(vw=1280, vh=900, token=None):
        ctx = b.new_context(viewport={"width": vw, "height": vh}); pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text) if m.type == "error" and "ERR_FAILED" not in m.text and "Failed to load resource" not in m.text else None)
        pg.route(re.compile(r".*/api/.*"), api)
        pg.route("https://challenges.cloudflare.com/**", lambda r, q: r.fulfill(status=200, content_type="application/javascript", body=TS))
        pg.route("https://x.supabase.co/**", lambda r, q: r.fulfill(status=200, content_type="image/png", body=PNG))
        pg.route(re.compile(r"https://fonts\..*"), lambda r, q: r.abort())
        if token: pg.add_init_script("localStorage.setItem('ps_token','tk');localStorage.setItem('ps_user','potter');localStorage.setItem('ps_role','owner')")
        pg.add_init_script("localStorage.setItem('ps_lang','en')")
        return pg, errs
    pg, errs = page_for(); pg.goto(f"http://localhost:{PORT}/index.html"); pg.wait_for_selector(".proj"); pg.wait_for_selector(".masonry figure"); pg.wait_for_timeout(900)
    check("no JS errors on load", not errs, errs)
    check("hero name split into letters", pg.locator("#heroName span").count() == 6)
    check("project card rendered", pg.locator(".proj h3").inner_text() == "Alpha")
    check("skills grouped by category", pg.locator("#skillList section").count() == 2)
    check("timeline item", "Started the Discord bot" in pg.locator("#timelineList").inner_text())
    check("gallery 3 items lazy", pg.locator(".masonry img[loading=lazy]").count() == 3)
    check("blog row + category chip", pg.locator(".post h3").inner_text() == "Hello world" and pg.locator("#blogCats button").count() == 2)
    check("guestbook text is escaped (no injected nodes)", pg.locator("#gbList script, #gbList b b").count() == 0 and "Fan<b>" in pg.locator("#gbList").inner_text())
    check("bot status footer", "Bot online" in pg.locator("#botStatus").inner_text())
    check("no skill percentages anywhere", not re.search(r"\d+\s?%", pg.locator("#skills").inner_text()))
    check("honeypot is off-screen", pg.locator("#gbForm .hp").bounding_box()["x"] < -1000)
    pg.screenshot(path="/tmp/desktop_top.png"); pg.locator("#projects").scroll_into_view_if_needed(); pg.wait_for_timeout(700); pg.screenshot(path="/tmp/desktop_projects.png")
    # language switch
    pg.click("#langBtn"); pg.wait_for_timeout(200)
    check("switch to Thai: nav + content", pg.locator("#navLinks a").first.inner_text() == "หน้าแรก" and pg.locator(".proj h3").inner_text() == "อัลฟา" and pg.evaluate("document.documentElement.lang") == "th")
    pg.click("#langBtn"); pg.wait_for_timeout(100)
    # profile card
    pg.evaluate("window.scrollTo(0,0)"); card = pg.locator("#profileCard"); pg.wait_for_function("document.getElementById('profileImg').complete && !document.getElementById('profileImg').hidden")
    check("photo visible and letter fallback NOT displayed when a photo loaded", pg.evaluate("getComputedStyle(document.getElementById('fallback')).display") == "none" and pg.locator("#profileImg").is_visible())
    f0 = pg.evaluate("getComputedStyle(document.getElementById('profileImg')).filter")
    check("normal state is blurred + dimmed", "blur" in f0 and "brightness" in f0, f0)
    bb = card.bounding_box(); pg.mouse.move(bb["x"] + bb["width"] * .8, bb["y"] + bb["height"] * .2); pg.wait_for_timeout(900)
    check("hover: hot class, filter cleared, 3D tilt applied", pg.evaluate("document.getElementById('profileCard').classList.contains('hot')") and pg.evaluate("getComputedStyle(document.getElementById('profileImg')).filter") == "none" and "rotate" in (card.get_attribute("style") or "") or "matrix3d" in pg.evaluate("getComputedStyle(document.getElementById('profileCard')).transform"))
    pg.screenshot(path="/tmp/card_hover.png", clip={"x": bb["x"] - 40, "y": bb["y"] - 40, "width": bb["width"] + 80, "height": bb["height"] + 80})
    pg.mouse.move(5, 500)
    try: pg.wait_for_function("!document.getElementById('profileCard').style.transform", timeout=5000); settled = True
    except Exception: settled = False
    check("leave: spring settles back to rest (transform cleared)", settled, card.get_attribute("style"))
    check("leave: hot class removed and blur restored", not pg.evaluate("document.getElementById('profileCard').classList.contains('hot')") and "blur" in pg.evaluate("getComputedStyle(document.getElementById('profileImg')).filter"))
    card.click(); pg.wait_for_selector("#lightbox:not([hidden])")
    check("click opens fullscreen lightbox", pg.locator("#lbImg").is_visible())
    pg.screenshot(path="/tmp/lightbox.png")
    pg.keyboard.press("Escape"); check("ESC closes lightbox", pg.locator("#lightbox").is_hidden())
    card.click(); pg.mouse.click(10, 10); check("click outside closes lightbox", pg.locator("#lightbox").is_hidden())
    card.click(); pg.click("#lightbox .x"); check("close button closes lightbox", pg.locator("#lightbox").is_hidden())
    # gallery lightbox navigation + zoom
    pg.locator(".masonry figure").nth(0).click(); pg.click("#lbNext"); pg.wait_for_timeout(100); check("gallery lightbox next + caption", pg.locator("#lbCap").inner_text() == "Pic 2")
    pg.click("#lbImg"); check("click zooms image", pg.evaluate("document.getElementById('lbImg').classList.contains('zoomed')")); pg.keyboard.press("Escape")
    # project route
    pg.evaluate("location.hash='#/project/alpha'"); pg.wait_for_selector("#projModal:not([hidden])")
    check("project detail via hash", pg.locator("#pmTitle").inner_text() == "Alpha" and pg.locator("#projSheet h2").count() >= 1 and pg.locator("#projSheet .shots img").count() == 1)
    pg.keyboard.press("Escape"); check("ESC closes project + hash restored", pg.locator("#projModal").is_hidden() and pg.evaluate("location.hash") == "#projects")
    # blog XSS
    pg.evaluate("location.hash='#/blog/hello'"); pg.wait_for_selector("#reader:not([hidden])")
    check("markdown XSS payloads inert", pg.evaluate("window.PWNED") is None and pg.locator("#readerSheet script").count() == 0 and pg.locator("#readerSheet img[src='x']").count() == 0)
    hrefs = pg.eval_on_selector_all("#readerSheet a", "els=>els.map(a=>a.getAttribute('href'))")
    check("only https links survive", hrefs == ["https://example.com"], hrefs)
    check("code fence shown raw", pg.locator("#readerSheet pre").inner_text() == "<b>raw</b>")
    pg.keyboard.press("Escape")
    # guestbook submit
    calls.clear(); pg.fill("#gbForm [name=name]", "Tester"); pg.fill("#gbForm [name=message]", "Hello!"); pg.wait_for_function("document.querySelector('#gbForm .cap-status').dataset.s==='verified'")
    pg.click("#gbForm button[type=submit]"); pg.wait_for_timeout(500)
    posted = [json.loads(c[2]) for c in calls if c[0] == "POST" and c[1] == "/api/guestbook"]
    check("guestbook POST carries captcha token + empty honeypot", len(posted) == 1 and posted[0]["captcha"].startswith("tok-") and posted[0]["website"] == "" and posted[0]["name"] == "Tester", posted)
    # contact: blocked without captcha completion? (invalid email -> client validation)
    pg.fill("#ctForm [name=name]", "N"); pg.fill("#ctForm [name=subject]", "S"); pg.fill("#ctForm [name=message]", "M"); pg.fill("#ctForm [name=email]", "not-an-email"); pg.wait_for_function("document.querySelector('#ctForm .cap-status').dataset.s==='verified'")
    calls.clear(); pg.click("#ctForm button[type=submit]"); pg.wait_for_timeout(300); check("invalid email blocked client-side", not [c for c in calls if c[1] == "/api/contact"])
    pg.fill("#ctForm [name=email]", ""); pg.click("#ctForm button[type=submit]"); pg.wait_for_timeout(500); check("contact submitted", any(c[1] == "/api/contact" and c[0] == "POST" for c in calls))
    # auth
    pg.click("#authBtn"); pg.wait_for_selector("#authModal:not([hidden])"); pg.fill("#authForm [name=username]", "potter"); pg.fill("#authForm [name=password]", "password123")
    pg.wait_for_function("document.querySelector('#authCap .cap-status').dataset.s==='verified'"); pg.click("#authSubmit"); pg.wait_for_timeout(500)
    check("login updates button + shows dashboard link for owner", "potter" in pg.locator("#authBtn").inner_text() and pg.locator("#dashLink").is_visible())
    pg.click("#chatFab"); check("chat panel opens when logged in", pg.locator("#chat").is_visible()); pg.click("#chatClose")
    # nav active section + progress
    pg.evaluate("document.getElementById('gallery').scrollIntoView()"); pg.wait_for_timeout(1800); check("active nav follows scroll", pg.locator("#navLinks a.on").get_attribute("data-nav") == "gallery")
    check("scroll progress moves", pg.evaluate("getComputedStyle(document.getElementById('progress')).transform") != "matrix(1, 0, 0, 1, 0, 0)" and pg.evaluate("document.getElementById('progress').style.transform") != "scaleX(0)")
    check("no JS errors after interaction", not errs, errs)
    # mobile
    pm, merrs = page_for(375, 800); pm.goto(f"http://localhost:{PORT}/index.html"); pm.wait_for_selector(".proj"); pm.wait_for_timeout(900)
    check("mobile: no horizontal overflow", pm.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), pm.evaluate("document.documentElement.scrollWidth"))
    check("mobile: menu hidden then opens", pm.evaluate("getComputedStyle(document.getElementById('navLinks')).visibility") == "hidden")
    pm.click("#menuBtn"); pm.wait_for_timeout(400); check("mobile menu opens", pm.evaluate("getComputedStyle(document.getElementById('navLinks')).visibility") == "visible"); pm.screenshot(path="/tmp/mobile_menu.png")
    pm.click("#navLinks a[data-nav=projects]"); pm.wait_for_timeout(700); check("mobile nav click closes menu + scrolls", pm.evaluate("getComputedStyle(document.getElementById('navLinks')).visibility") == "hidden" and pm.evaluate("scrollY") > 300)
    pm.evaluate("window.scrollTo(0,0)"); pm.wait_for_timeout(300); pm.screenshot(path="/tmp/mobile_top.png")
    # mobile touch on profile card
    pm.evaluate("window.scrollTo(0,0)"); check("mobile: no JS errors", not merrs, merrs)
    # reduced motion
    ctx = b.new_context(viewport={"width": 1000, "height": 700}, reduced_motion="reduce"); pr = ctx.new_page(); pr.route(re.compile(r".*/api/.*"), api); pr.route("https://**", lambda r, q: r.abort())
    pr.goto(f"http://localhost:{PORT}/index.html"); pr.wait_for_timeout(600)
    check("reduced motion: letters visible immediately, nebula static", pr.evaluate("getComputedStyle(document.querySelector('#heroName span')).opacity") == "1" and pr.evaluate("getComputedStyle(document.querySelector('.nebula')).animationName") == "none")
    b.close()
print("\nFAILED:", fails if fails else "none"); sys.exit(1 if fails else 0)
