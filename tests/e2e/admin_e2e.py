import json, threading, http.server, socketserver, functools, sys, re
from playwright.sync_api import sync_playwright
import os; ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "frontend"); PORT = 8912
BI = lambda t, e="": {"th": t, "en": e or t}
role = {"v": "owner"}; calls = []; uploaded = []
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(("", PORT), functools.partial(Q, directory=ROOT)); threading.Thread(target=srv.serve_forever, daemon=True).start()
def api(route, request):
    path = re.sub(r"^http://localhost:\d+", "", request.url).split("?")[0]; m = request.method; calls.append((m, path, (request.post_data_buffer or b"").decode("utf-8", "replace"), request.headers.get("content-type")))
    R = lambda d, s=200: route.fulfill(status=s, content_type="application/json", body=json.dumps(d))
    if path == "/api/config": return R({"sitekey": "k"})
    if path == "/api/login": return R({"token": "tk", "username": "potter", "role": role["v"]})
    if path == "/api/me": return R({"username": "potter", "role": role["v"]}) if request.headers.get("authorization") == "Bearer tk" else R({"error": "unauthorized"}, 401)
    if path == "/api/admin/overview": return R({"users": 9, "projects": 3, "tickets": 5, "tickets_open": 2, "tickets_closed": 3, "messages": 40, "contact_new": 1, "guestbook_pending": 0, "blog_published": 1, "blog_draft": 2, "gallery": 4, "skills": 18, "bot_online": True, "recent": [{"id": 1, "kind": "admin_create", "detail": "projects#1 by <img src=x onerror=window.PWNED=1>", "created_at": "2026-11-01T00:00:00Z"}]})
    if path == "/api/admin/projects" and m == "GET": return R({"items": [{"id": 1, "slug": "alpha", "category": "ai", "status": "live", "featured": True, "visible": True, "title": BI("อัลฟา", "Alpha"), "summary": BI(""), "body": BI(""), "tags": ["x"], "cover_url": "", "github_url": "", "demo_url": "", "sort": 1}], "total": 1, "page": 1, "size": 25})
    if path == "/api/admin/projects" and m == "POST": return R({"id": 2})
    if path == "/api/admin/upload": uploaded.append(request.post_data_buffer); return R({"url": "https://x.supabase.co/storage/v1/object/public/portfolio/a.png"})
    if path == "/api/admin/tickets": return R({"items": [{"id": 7, "status": "open", "claimed_by": None, "assigned_to": None, "created_at": "2026-11-01T00:00:00Z", "users": {"username": "eve"}}], "total": 1, "page": 1, "size": 20})
    if path == "/api/admin/tickets/7/messages": return R({"items": [{"id": 1, "sender": "web", "author": "eve", "body": "hi <b>x</b>", "pushed": True, "created_at": "2026-11-01T00:00:00Z"}]})
    if path == "/api/admin/tickets/7/reply": return R({"ok": True})
    if path == "/api/admin/users": return R({"items": [{"id": 1, "username": "potter", "email": "p@x", "role": "owner", "created_at": "2026-11-01T00:00:00Z"}, {"id": 2, "username": "eve", "email": "e@x", "role": "user", "created_at": "2026-11-01T00:00:00Z"}], "total": 2, "page": 1, "size": 25})
    if path == "/api/admin/users/2/reset-code": return R({"code": "ABC123xyz", "expires_minutes": 30})
    if path == "/api/admin/settings": return R({"settings": {"guestbook_enabled": "1", "guestbook_require_approval": "0", "contact_enabled": "1"}, "discord": {"category": "123"}})
    if path.startswith("/api/admin/"): return R({"items": [], "total": 0, "page": 1, "size": 25})
    return R({"error": "not_found"}, 404)
TS = "window.turnstile={n:0,render:function(el,o){var id=++this.n;setTimeout(function(){o.callback('tok-'+id+'-'+Date.now())},50);return id},reset:function(){}}"
fails = []
def check(n, c, extra=""):
    print(("PASS " if c else "FAIL ") + n + ("" if c else " " + str(extra)));
    if not c: fails.append(n)
with sync_playwright() as p:
    b = p.chromium.launch()
    def mk(token=True, r="owner", w=1280):
        role["v"] = r; ctx = b.new_context(viewport={"width": w, "height": 900}); pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text) if m.type == "error" and "Failed to load resource" not in m.text else None)
        pg.route(re.compile(r".*/api/.*"), api); pg.route("https://challenges.cloudflare.com/**", lambda r, q: r.fulfill(status=200, content_type="application/javascript", body=TS)); pg.route(re.compile(r"https://(fonts|x\.supabase).*"), lambda r, q: r.abort())
        if token: pg.add_init_script("localStorage.setItem('ps_token','tk')")
        return pg, errs
    # gate
    pg, errs = mk(token=False); pg.goto(f"http://localhost:{PORT}/admin.html"); pg.wait_for_selector("#gate:not([hidden])")
    check("no token -> login gate, app hidden", pg.locator("#app").is_hidden() and pg.locator("#gate").is_visible())
    pg.fill("[name=username]", "potter"); pg.fill("[name=password]", "password123"); pg.wait_for_function("document.querySelector('.cap-status').dataset.s==='verified'"); pg.click("#loginForm button[type=submit]"); pg.wait_for_selector("#app:not([hidden])")
    check("login opens dashboard", pg.locator("#whoName").inner_text() == "potter")
    nav = pg.locator("#sideNav a").all_inner_texts()
    check("owner sees all 16 pages", len(nav) == 16 and "Users" in nav and "Security" in nav and "Activity logs" in nav, nav)
    pg.wait_for_selector(".stat"); check("overview shows real counts from API", "Total users" in pg.locator("#view").inner_text() and pg.locator(".stat b").first.inner_text() == "9")
    check("activity detail text is escaped (XSS inert)", pg.evaluate("window.PWNED") is None and pg.locator("#view img").count() == 0)
    pg.screenshot(path="/tmp/admin_overview.png")
    # CRUD
    pg.click("#sideNav a[data-id=projects]"); pg.wait_for_selector(".tbl tbody tr"); check("projects table lists data", "Alpha" in pg.locator(".tbl").inner_text())
    pg.click("text=+ New"); pg.wait_for_selector("#editor:not([hidden])")
    pg.fill("#editFields input[maxlength='60']", "my-new"); pg.locator("#editFields select").nth(0).select_option("discord_bot"); pg.locator("#editFields .bi input").first.fill("ชื่อ"); pg.locator("#editFields .bi textarea").nth(0).fill("# Hi <script>window.PWNED=2</script> [x](javascript:alert(1))")
    check("markdown preview inert", pg.evaluate("window.PWNED") is None and pg.locator(".preview script").count() == 0 and pg.locator(".preview a").count() == 0)
    pg.locator("#editFields input[type=file]").first.set_input_files({"name": "a.png", "mimeType": "image/png", "buffer": b"\x89PNG\r\n\x1a\n" + b"0" * 20}); pg.wait_for_timeout(400)
    check("upload sends raw bytes with image content-type; URL filled", len(uploaded) == 1 and any(c[1] == "/api/admin/upload" and c[3] == "image/png" for c in calls) and "storage/v1/object/public/portfolio" in pg.locator("#editFields .imgf input[type=text]").input_value())
    calls.clear(); pg.click("#editForm button[type=submit]"); pg.wait_for_timeout(400)
    post = [json.loads(c[2]) for c in calls if c[0] == "POST" and c[1] == "/api/admin/projects"]
    check("create POST body has typed fields", len(post) == 1 and post[0]["slug"] == "my-new" and post[0]["category"] == "discord_bot" and post[0]["title"]["th"] == "ชื่อ" and post[0]["visible"] is True and post[0]["featured"] is False and isinstance(post[0]["tags"], list) and isinstance(post[0]["sort"], int), post)
    check("editor closes after save", pg.locator("#editor").is_hidden())
    # tickets
    pg.click("#sideNav a[data-id=tickets]"); pg.wait_for_selector(".tbl tbody tr"); check("ticket shows customer name", "eve" in pg.locator(".tbl").inner_text()); pg.get_by_role("button", name="Open", exact=True).click(); pg.wait_for_selector(".convo .m")
    check("ticket message escaped", pg.locator(".convo .m b").count() == 0 and "hi <b>x</b>" in pg.locator(".convo .m").inner_text())
    calls.clear(); pg.fill(".convo textarea", "answer"); pg.click("text=Send reply"); pg.wait_for_timeout(300); check("reply POST", any(c[1] == "/api/admin/tickets/7/reply" and json.loads(c[2])["body"] == "answer" for c in calls))
    # users
    pg.click("#sideNav a[data-id=users]"); pg.wait_for_selector(".tbl tbody tr"); pg.locator("tr", has_text="eve").locator("text=Reset code").click(); pg.wait_for_selector(".codebox")
    check("reset code displayed once", pg.locator(".codebox").inner_text() == "ABC123xyz"); check("owner sees role dropdown for others but not self", pg.locator("tr", has_text="eve").locator("select").count() == 1 and pg.locator("tr", has_text="potter").locator("select").count() == 0)
    pg.click("#sideNav a[data-id=settings]"); pg.wait_for_selector(".switch"); check("settings toggles", pg.locator(".switch").count() == 3)
    check("no JS errors (owner session)", not errs, errs); pg.set_viewport_size({"width": 375, "height": 800}); pg.click("#sideNav a[data-id=projects]"); pg.wait_for_timeout(500)
    check("mobile: dashboard has no horizontal overflow", pg.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), pg.evaluate("document.documentElement.scrollWidth"))
    # moderator
    pm, merr = mk(r="moderator"); pm.goto(f"http://localhost:{PORT}/admin.html"); pm.wait_for_selector("#app:not([hidden])"); mn = pm.locator("#sideNav a").all_inner_texts()
    check("moderator menu limited (no users/settings/projects)", "Tickets" in mn and "Guestbook" in mn and "Users" not in mn and "Settings" not in mn and "Projects" not in mn, mn)
    # plain user
    pu, _ = mk(r="user"); pu.goto(f"http://localhost:{PORT}/admin.html"); pu.wait_for_selector("#gate:not([hidden])"); check("regular user is sent back to the gate", pu.locator("#app").is_hidden() and "not staff" in pu.locator("#gateMsg").inner_text())
    # expired session
    pe, _ = mk(token=False); pe.add_init_script("localStorage.setItem('ps_token','stale')"); pe.goto(f"http://localhost:{PORT}/admin.html"); pe.wait_for_selector("#gate:not([hidden])"); check("stale token -> gate with message", "expired" in pe.locator("#gateMsg").inner_text().lower())
    b.close()
print("\nFAILED:", fails if fails else "none"); sys.exit(1 if fails else 0)
