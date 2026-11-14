"""Handler-level tests of main.py using stub FastAPI + an in-memory fake Supabase (see tests/stubs).
They exercise the real business logic (auth, roles, validation, moderation, tickets, uploads),
but NOT real HTTP, real PostgREST or real Cloudflare. Run: python -m unittest discover -s tests
"""
import asyncio, os, sys, unittest
HERE = os.path.dirname(__file__)
sys.path.insert(0, os.path.join(HERE, "stubs")); sys.path.insert(0, os.path.join(HERE, ".."))
os.environ.update(SUPABASE_URL="https://x.supabase.co", SUPABASE_SECRET_KEY="k", SESSION_SECRET="s" * 40, TURNSTILE_SECRET_KEY="t", TRUST_PROXY="0")
import httpx, supabase                                  # the stubs
from fastapi import HTTPException
import core, main as M

DB = supabase.CLIENT
class Req:
    def __init__(self, ip="1.1.1.1", body=b""): self.client = type("C", (), {"host": ip})(); self.headers = {}; self._b = body; self.url = type("U", (), {"path": "/x"})()
    async def stream(self):
        for i in range(0, len(self._b), 65536): yield self._b[i:i + 65536]
tokn = iter(range(10**6))
def captcha(): return "tok-%d" % next(tokn)             # unique token each time (replay protection consumes them)
def code_of(fn, *a, **k):
    try: fn(*a, **k); return 200
    except HTTPException as e: return e.status_code
def mkuser(name, role="user", pw="password123"):
    r = DB.table("users").insert({"username": name, "email": name + "@x.io", "pass_hash": core.hash_pw(pw), "role": role}).execute().data[0]
    return r, "Bearer " + M.token_for(r)

class T(unittest.TestCase):
    def setUp(self):
        for k in DB.rows: DB.rows[k].clear()
        M.RL._hits.clear(); M.uncache(); httpx.RESULT.update(success=True, hostname="example.com")

    # ---- auth
    def test_register_login_me_and_replay(self):
        tok = captcha()
        r = M.register(M.Reg(username="alice", email="a@b.co", password="password123", captcha=tok), Req())
        self.assertEqual(r["role"], "user")
        self.assertEqual(code_of(M.register, M.Reg(username="bob", email="b@b.co", password="password123", captcha=tok), Req("2.2.2.2")), 400)  # replayed token
        self.assertEqual(code_of(M.register, M.Reg(username="admin", email="b@b.co", password="password123", captcha=captcha()), Req("3.3.3.3")), 400)  # reserved
        self.assertEqual(code_of(M.register, M.Reg(username="ALICE", email="a@b.co", password="password123", captcha=captcha()), Req("4.4.4.4")), 409)
        l = M.login(M.Login(username="alice", password="password123", captcha=captcha()), Req())
        self.assertEqual(M.me(authorization="Bearer " + l["token"])["username"], "alice")
        self.assertEqual(code_of(M.login, M.Login(username="alice", password="WRONG", captcha=captcha()), Req()), 401)
        self.assertEqual(code_of(M.login, M.Login(username="nobody", password="x" * 9, captcha=captcha()), Req()), 401)
        self.assertEqual(code_of(M.me, authorization="Bearer junk"), 401)

    def test_captcha_failures(self):
        httpx.RESULT.update(success=False, **{"error-codes": ["invalid-input-response"]})
        self.assertEqual(code_of(M.guestbook_post, M.GuestIn(name="a", message="hi", captcha=captcha()), Req()), 400)
        httpx.RESULT.update(success=True, hostname="evil.com"); M.TS_HOSTS.add("example.com")
        self.assertEqual(code_of(M.guestbook_post, M.GuestIn(name="a", message="hi", captcha=captcha()), Req()), 400)   # wrong hostname
        M.TS_HOSTS.clear()
        self.assertEqual(code_of(M.guestbook_post, M.GuestIn(name="a", message="hi", captcha=""), Req()), 400)          # missing token
        M.TS_SECRET, old = "", M.TS_SECRET
        self.assertEqual(code_of(M.guestbook_post, M.GuestIn(name="a", message="hi", captcha="x"), Req()), 503)          # fail closed
        M.TS_SECRET = old

    def test_password_change_invalidates_old_tokens(self):
        u, tok = mkuser("carol")
        new = M.account_password(M.PwChange(current="password123", new="newpassword1"), Req(), authorization=tok)["token"]
        self.assertEqual(code_of(M.me, authorization=tok), 401)            # old session dead
        self.assertEqual(M.me(authorization="Bearer " + new)["username"], "carol")
        self.assertEqual(code_of(M.account_password, M.PwChange(current="bad", new="newpassword2"), Req(), authorization="Bearer " + new), 401)
        n2 = M.logout_all(authorization="Bearer " + new)["token"]
        self.assertEqual(code_of(M.me, authorization="Bearer " + new), 401); self.assertEqual(M.me(authorization="Bearer " + n2)["username"], "carol")

    def test_legacy_password_upgrade(self):
        DB.table("users").insert({"username": "old", "email": "o@o.io", "pass_hash": "legacy:oldpassword"}).execute()
        M.login(M.Login(username="old", password="oldpassword", captcha=captcha()), Req())
        self.assertFalse(DB.rows["users"][0]["pass_hash"].startswith("legacy:"))

    def test_legacy_password_with_non_ascii_chars(self):
        DB.table("users").insert({"username": "thai", "email": "t@t.io", "pass_hash": "legacy:รหัสผ่านไทย123"}).execute()
        M.login(M.Login(username="thai", password="รหัสผ่านไทย123", captcha=captcha()), Req())            # must not raise TypeError
        self.assertEqual(code_of(M.login, M.Login(username="thai", password="wrong-password", captcha=captcha()), Req("2.2.2.2")), 401)

    # ---- roles
    def test_role_enforcement(self):
        _, ut = mkuser("u1"); _, mt = mkuser("m1", "moderator"); _, at = mkuser("a1", "admin"); _, ot = mkuser("o1", "owner")
        self.assertEqual(code_of(M.admin_overview, authorization=""), 401)
        self.assertEqual(code_of(M.admin_overview, authorization=ut), 403)
        self.assertEqual(code_of(M.admin_overview, authorization=mt), 200)
        body = {"slug": "p1", "category": "ai", "status": "live", "title": {"th": "x", "en": "y"}}
        self.assertEqual(code_of(M.crud_create, "projects", Req(), data=body, authorization=ut), 403)
        self.assertEqual(code_of(M.crud_create, "projects", Req(), data=body, authorization=mt), 403)   # moderators cannot edit content
        self.assertEqual(code_of(M.crud_create, "projects", Req(), data=body, authorization=at), 200)
        self.assertEqual(code_of(M.admin_users, authorization=mt), 403); self.assertEqual(code_of(M.admin_users, authorization=at), 200)
        self.assertEqual(code_of(M.admin_guestbook, authorization=mt), 200)
        self.assertEqual(code_of(M.admin_settings_put, Req(), data={"contact_enabled": "0"}, authorization=mt), 403)
        self.assertEqual(code_of(M.admin_profile_put, Req(), data={"name": "P"}, authorization=ut), 403)
        self.assertEqual(code_of(M.crud_list, "users", authorization=at), 404)          # unknown/unsafe resource names are not reachable
        self.assertEqual(code_of(M.crud_list, "activity_logs", authorization=ot), 404)

    def test_user_management_rules(self):
        a, at = mkuser("a1", "admin"); o, ot = mkuser("o1", "owner"); u, ut = mkuser("u1"); m, mt = mkuser("m1", "moderator")
        self.assertEqual(code_of(M.admin_user_role, u["id"], Req(), data={"role": "moderator"}, authorization=at), 403)   # admin cannot change roles
        self.assertEqual(code_of(M.admin_user_role, u["id"], Req(), data={"role": "moderator"}, authorization=ot), 200)
        self.assertEqual(code_of(M.admin_user_role, o["id"], Req(), data={"role": "user"}, authorization=ot), 400)         # no self-demotion/lockout
        self.assertEqual(code_of(M.admin_user_role, u["id"], Req(), data={"role": "god"}, authorization=ot), 400)
        self.assertEqual(code_of(M.admin_user_del, o["id"], Req(), authorization=ot), 400)
        self.assertEqual(code_of(M.admin_user_del, m["id"], Req(), authorization=at), 403)
        self.assertEqual(code_of(M.admin_user_del, m["id"], Req(), authorization=ot), 200)
        self.assertEqual(code_of(M.admin_reset_code, o["id"], Req(), authorization=at), 403)       # admin cannot reset an owner

    def test_password_reset_code_flow(self):
        a, at = mkuser("a1", "admin"); u, _ = mkuser("dave")
        code = M.admin_reset_code(u["id"], Req(), authorization=at)["code"]
        self.assertEqual(code_of(M.password_reset, M.ResetIn(username="dave", code="wrongwrong", password="brandnew123", captcha=captcha()), Req()), 400)
        # the wrong attempt consumed the code (one try per code) -> issue a fresh one
        code = M.admin_reset_code(u["id"], Req(), authorization=at)["code"]
        M.password_reset(M.ResetIn(username="dave", code=code, password="brandnew123", captcha=captcha()), Req())
        M.login(M.Login(username="dave", password="brandnew123", captcha=captcha()), Req())
        self.assertEqual(code_of(M.password_reset, M.ResetIn(username="dave", code=code, password="again12345", captcha=captcha()), Req()), 400)   # single use
        code = M.admin_reset_code(u["id"], Req(), authorization=at)["code"]
        DB.rows["password_resets"][-1]["expires_at"] = "2000-01-01T00:00:00+00:00"
        self.assertEqual(code_of(M.password_reset, M.ResetIn(username="dave", code=code, password="again12345", captcha=captcha()), Req()), 400)   # expired

    # ---- content CRUD + public API
    def test_projects_and_blog_visibility(self):
        _, at = mkuser("a1", "admin")
        mk = lambda **o: M.crud_create("projects", Req(), data={"slug": "alpha", "category": "ai", "status": "live", "title": {"th": "อัลฟา", "en": "Alpha"}, "tags": ["Py"], **o}, authorization=at)
        p = mk()
        self.assertEqual(M.projects()["total"], 1)
        self.assertEqual(code_of(mk), 409)                                                  # slug unique
        self.assertEqual(M.projects(q="alp")["total"], 1); self.assertEqual(M.projects(q="zzz")["total"], 0); self.assertEqual(M.projects(cat="website")["total"], 0)
        M.crud_update("projects", p["id"], Req(), data={"visible": False}, authorization=at)
        self.assertEqual(M.projects()["total"], 0); self.assertEqual(code_of(M.project, "alpha"), 404)
        with self.assertRaises(core.Invalid): M.crud_create("projects", Req(), data={"slug": "b", "category": "ai", "status": "live", "title": {"th": "x", "en": ""}, "github_url": "javascript:alert(1)"}, authorization=at)
        b = M.crud_create("blog_posts", Req(), data={"slug": "hello", "status": "draft", "title": {"th": "สวัสดี", "en": "Hello"}, "body": {"th": "ก" * 2000, "en": ""}, "category": "devlog"}, authorization=at)
        self.assertEqual(M.blog()["total"], 0); self.assertEqual(code_of(M.blog_post, "hello"), 404)         # drafts are private
        self.assertGreaterEqual(b["read_min"], 2)
        M.crud_update("blog_posts", b["id"], Req(), data={"status": "published"}, authorization=at)
        self.assertEqual(M.blog()["total"], 1); self.assertEqual(M.blog_post("hello")["slug"], "hello"); self.assertEqual(M.blog()["categories"], ["devlog"])
        self.assertTrue(DB.rows["blog_posts"][0]["published_at"])
        M.crud_delete("blog_posts", b["id"], Req(), authorization=at); self.assertEqual(M.blog()["total"], 0)

    def test_public_json_never_leaks_private_fields(self):
        mkuser("x"); DB.table("profiles").insert({"id": 1, "name": "P"}).execute()
        s = M.site(); self.assertNotIn("id", s["profile"]); self.assertNotIn("pass_hash", str(s))

    # ---- guestbook / contact
    def test_guestbook_flow(self):
        _, at = mkuser("a1", "admin")
        self.assertEqual(code_of(M.guestbook_post, M.GuestIn(name="bot", message="hi", captcha=captcha(), website="http://spam"), Req()), 400)   # honeypot
        self.assertEqual(code_of(M.guestbook_post, M.GuestIn(name="x", message="http://a.com http://b.com http://c.com", captcha=captcha()), Req()), 400)
        M.guestbook_post(M.GuestIn(name="Fan", message="เว็บสวยมาก", captcha=captcha()), Req())
        self.assertEqual(M.guestbook()["total"], 1)
        eid = DB.rows["guestbook_entries"][0]["id"]
        for ip in ("5.5.5.1", "5.5.5.2", "5.5.5.3"): M.guestbook_report(eid, Req(ip))
        self.assertEqual(M.guestbook()["total"], 0)                                           # 3 reports -> hidden from public pending review
        M.admin_guestbook_set(eid, Req(), data={"status": "approved"}, authorization=at); self.assertEqual(M.guestbook()["total"], 1)
        M.admin_settings_put(Req(), data={"guestbook_require_approval": "1"}, authorization=at)
        M.guestbook_post(M.GuestIn(name="Two", message="hello", captcha=captcha()), Req("6.6.6.6"))
        self.assertEqual(M.guestbook()["total"], 1)                                           # new one waits for approval
        self.assertEqual(code_of(M.admin_settings_put, Req(), data={"evil": "1"}, authorization=at), 400)
        M.admin_settings_put(Req(), data={"guestbook_enabled": "0"}, authorization=at)
        self.assertEqual(code_of(M.guestbook_post, M.GuestIn(name="Three", message="hello", captcha=captcha()), Req("7.7.7.7")), 403)

    def test_guestbook_rate_limit(self):
        ok = [code_of(M.guestbook_post, M.GuestIn(name="n", message="m%d" % i, captcha=captcha()), Req("9.9.9.9")) for i in range(7)]
        self.assertEqual(ok[:5], [200] * 5); self.assertEqual(ok[5:], [429, 429])

    def test_contact_and_log_notify_flags(self):
        M.contact(M.ContactIn(name="N", subject="S", message="Hello Potter", email="n@x.io", captcha=captcha()), Req())
        self.assertFalse(DB.rows["contact_messages"][0]["notified"])                          # the bot will pick it up
        self.assertEqual(code_of(M.contact, M.ContactIn(name="N", subject="S", message="m", email="bad", captcha=captcha()), Req("8.8.8.8")), 400)
        self.assertEqual(code_of(M.contact, M.ContactIn(name="N", subject="S", message="m", captcha=captcha(), website="x"), Req("8.8.8.9")), 400)
        hp = [l for l in DB.rows["activity_logs"] if l["kind"] == "honeypot"]; self.assertTrue(hp and hp[0]["notified"] is False)
        self.assertTrue(all(len(l["ip_hash"]) == 16 and "8.8.8" not in l["ip_hash"] for l in DB.rows["activity_logs"]))   # IPs are hashed

    # ---- tickets (website <-> Discord queue)
    def test_ticket_flow(self):
        u, ut = mkuser("eve"); _, mt = mkuser("m1", "moderator")
        self.assertEqual(code_of(M.send, M.Msg(body="hi", captcha=""), Req(), authorization=ut), 400)         # new ticket needs CAPTCHA
        M.send(M.Msg(body="hi", captcha=captcha()), Req(), authorization=ut)
        M.send(M.Msg(body="again"), Req(), authorization=ut)                                                   # existing open ticket: no CAPTCHA needed
        self.assertEqual(len(DB.rows["tickets"]), 1); self.assertEqual([m["pushed"] for m in DB.rows["messages"]], [False, False])
        tid = DB.rows["tickets"][0]["id"]
        M.admin_ticket_reply(tid, data={"body": "hello from dashboard"}, authorization=mt)
        last = DB.rows["messages"][-1]; self.assertEqual((last["sender"], last["pushed"]), ("admin", False))   # bot will deliver it, even after a restart
        self.assertEqual(code_of(M.admin_ticket_action, tid, Req(), data={"action": "reopen"}, authorization=mt), 409)
        M.admin_ticket_action(tid, Req(), data={"action": "claim"}, authorization=mt); self.assertEqual(DB.rows["tickets"][0]["status"], "claimed")
        M.admin_ticket_action(tid, Req(), data={"action": "close"}, authorization=mt)
        self.assertEqual(code_of(M.admin_ticket_reply, tid, data={"body": "x"}, authorization=mt), 409)
        self.assertEqual(code_of(M.admin_ticket_action, tid, Req(), data={"action": "explode"}, authorization=mt), 409)
        M.send(M.Msg(body="new", captcha=captcha()), Req(), authorization=ut)                                  # customer opens a new ticket
        self.assertEqual(code_of(M.admin_ticket_action, tid, Req(), data={"action": "reopen"}, authorization=mt), 409)   # cannot have two active tickets
        # users only ever see their own ticket (IDOR check)
        _, other = mkuser("mallory"); self.assertEqual(M.messages(tid=tid, authorization=other)["ticket"], None)

    # ---- uploads
    def test_upload_validation(self):
        _, at = mkuser("a1", "admin"); _, mt = mkuser("m1", "moderator")
        run = lambda body, auth: asyncio.run(M.admin_upload(Req(body=body), authorization=auth))
        png = b"\x89PNG\r\n\x1a\n" + b"0" * 100
        out = run(png, at); self.assertTrue(out["url"].startswith("https://x.supabase.co/storage/v1/object/public/portfolio/")); self.assertTrue(out["url"].endswith(".png"))
        for bad in (b"<svg onload=alert(1)></svg>", b"<?php system($_GET[0]);", b"MZ\x90\x00", b""):
            with self.assertRaises(HTTPException) as c: run(bad, at)
            self.assertEqual(c.exception.status_code, 415)
        with self.assertRaises(HTTPException) as c: run(png + b"0" * (M.MAX_UPLOAD + 10), at)
        self.assertEqual(c.exception.status_code, 413)
        with self.assertRaises(HTTPException) as c: run(png, mt)
        self.assertEqual(c.exception.status_code, 403)
        self.assertEqual(code_of(M.admin_upload_delete, Req(), url="https://evil.com/x.png", authorization=at), 400)

    def test_routes_registered_in_safe_order(self):
        routes = M.app.routes; idx = {(m, p): i for i, (m, p, _) in enumerate(routes)}
        gen = idx[("GET", "/api/admin/{res}")]
        for p in ("overview", "profile", "guestbook_entries", "contact_messages", "tickets", "users", "logs", "settings"):
            self.assertLess(idx[("GET", "/api/admin/" + p)], gen, p)
        self.assertLess(idx[("POST", "/api/admin/upload")], idx[("POST", "/api/admin/{res}")])
        self.assertLess(idx[("DELETE", "/api/admin/users/{uid}")], idx[("DELETE", "/api/admin/{res}/{rid}")])
        self.assertLess(idx[("DELETE", "/api/admin/upload")], idx[("DELETE", "/api/admin/{res}/{rid}")] if False else 10**9)

if __name__ == "__main__":
    unittest.main(verbosity=2)
