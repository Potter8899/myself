"""Potter Personal Space — Backend API (FastAPI).

Run locally:  uvicorn main:app --port 8000      (from the backend/ folder)
Render:       uvicorn main:app --host 0.0.0.0 --port $PORT

All database access uses the Supabase *secret/service* key, which lives only in this process.
The browser never talks to Supabase directly (RLS is enabled with no policies).
"""
import datetime as dt
import hashlib
import hmac
import logging
import os
import secrets
import time

import httpx
from dotenv import load_dotenv
from fastapi import Body, FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, ValidationError
from starlette.concurrency import run_in_threadpool
from supabase import create_client

import core

load_dotenv()
log = logging.getLogger("potter")
logging.basicConfig(level=logging.INFO)

SB = create_client(os.environ["SUPABASE_URL"], os.getenv("SUPABASE_SECRET_KEY") or os.environ["SUPABASE_SERVICE_KEY"])
SECRET = os.environ["SESSION_SECRET"].encode()
if len(SECRET) < 32:
    raise SystemExit("SESSION_SECRET must be at least 32 characters")
TS_SECRET = os.getenv("TURNSTILE_SECRET_KEY") or os.getenv("TURNSTILE_SECRET", "")
SITEKEY = os.getenv("TURNSTILE_SITE_KEY") or os.getenv("TURNSTILE_SITEKEY", "")
TS_HOSTS = {h.strip().lower() for h in os.getenv("TURNSTILE_HOSTNAMES", "").split(",") if h.strip()}
TRUST_PROXY = os.getenv("TRUST_PROXY", "0") == "1"
CORS = [o.strip().rstrip("/") for o in os.getenv("CORS_ORIGINS", os.getenv("ALLOWED_ORIGIN", "")).split(",") if o.strip()]
SERVE_FRONTEND = os.getenv("SERVE_FRONTEND", "0") == "1"
BUCKET = "portfolio"
MAX_UPLOAD = 3 * 1024 * 1024
RL = core.RateLimiter()
DUMMY_HASH = core.hash_pw("dummy-password-for-timing")

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
if CORS:
    app.add_middleware(CORSMiddleware, allow_origins=CORS, allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
                       allow_headers=["Content-Type", "Authorization"], max_age=600)


# ------------------------------------------------------------------ errors / headers
@app.exception_handler(HTTPException)
async def _http(_, e):
    return JSONResponse({"error": e.detail}, status_code=e.status_code)


@app.exception_handler(ValidationError)
async def _val(_, e):
    return JSONResponse({"error": "bad_input"}, status_code=400)


@app.exception_handler(core.Invalid)
async def _inv(_, e):
    return JSONResponse({"error": "bad_input", "field": e.field}, status_code=400)


@app.exception_handler(Exception)
async def _any(req, e):
    log.exception("unhandled")
    audit("error", f"{req.url.path}: {type(e).__name__}", "", notify=True)  # no user data / secrets in logs
    return JSONResponse({"error": "server_error"}, status_code=500)


API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
WEB_CSP = ("default-src 'self'; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; "
           "connect-src 'self'; img-src 'self' data: https://*.supabase.co; style-src 'self' 'unsafe-inline'; object-src 'none'; "
           "base-uri 'none'; frame-ancestors 'none'")


@app.middleware("http")
async def sec_headers(req: Request, nxt):
    cl = req.headers.get("content-length")
    limit = MAX_UPLOAD + 4096 if req.url.path == "/api/admin/upload" else 1_000_000
    if cl and cl.isdigit() and int(cl) > limit:
        return JSONResponse({"error": "too_large"}, status_code=413)
    r = await nxt(req)
    r.headers.update({
        "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "same-origin",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
        "Content-Security-Policy": WEB_CSP if (SERVE_FRONTEND and not req.url.path.startswith("/api")) else API_CSP,
    })
    return r


# ------------------------------------------------------------------ helpers
def ip_of(req: Request) -> str:
    if TRUST_PROXY:  # enable only behind a trusted proxy (Render sets X-Forwarded-For)
        return req.headers.get("cf-connecting-ip") or req.headers.get("x-forwarded-for", "").split(",")[0].strip() or "0"
    return req.client.host if req.client else "0"


def ip_hash(ip):
    return hashlib.sha256(SECRET + ip.encode()).hexdigest()[:16]


def now_iso():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def audit(kind, detail, ip, notify=False):
    try:
        SB.table("activity_logs").insert({"kind": kind, "detail": (detail or "")[:300], "notified": not notify, "ip_hash": ip_hash(ip)}).execute()
    except Exception:
        log.warning("audit failed")


def limit(key, n, per):
    if not RL.allow(key, n, per):
        raise HTTPException(429, "rate_limited")


def page_args(page, size, maxsize=24):
    page, size = max(1, page), max(1, min(size, maxsize))
    return page, size, (page - 1) * size, (page - 1) * size + size - 1


_cache = {}


def cached(key, loader, ttl=30):
    hit = _cache.get(key)
    if hit and hit[0] > time.time():
        return hit[1]
    v = loader()
    _cache[key] = (time.time() + ttl, v)
    return v


def uncache():
    _cache.clear()


CFG_DEFAULT = {"guestbook_require_approval": "0", "contact_enabled": "1", "guestbook_enabled": "1"}


def get_cfg():
    def load():
        rows = SB.table("settings").select("key,value").like("key", "cfg:%").execute().data
        c = dict(CFG_DEFAULT)
        c.update({r["key"][4:]: r["value"] for r in rows if r["key"][4:] in core.SETTING_KEYS})
        return c
    return cached("cfg", load, 15)


# ------------------------------------------------------------------ auth
def user_from(auth):
    t = core.parse_token(SECRET, auth)
    if t:
        try:
            r = SB.table("users").select("id,username,role,token_ver").eq("id", t[0]).limit(1).execute().data
            if r and r[0]["token_ver"] == t[1]:
                return r[0]
        except Exception:
            log.warning("user lookup failed")
    raise HTTPException(401, "unauthorized")


def staff(auth, need):
    """Authorization is ALWAYS checked here on the server for every admin route."""
    u = user_from(auth)
    if not core.role_at_least(u["role"], need):
        raise HTTPException(403, "forbidden")
    return u


def token_for(u):
    return core.make_token(SECRET, u["id"], u.get("token_ver", 0))


def verify_captcha(token, ip):
    if not TS_SECRET:
        raise HTTPException(503, "captcha_unavailable")  # never skip verification
    if not token or len(token) > 2048:
        raise HTTPException(400, "captcha_required")
    th = hashlib.sha256(token.encode()).hexdigest()
    try:
        SB.table("used_captcha").insert({"token_hash": th}).execute()  # PK conflict = replayed token
    except Exception:
        audit("captcha_reuse", "", ip, notify=True)
        raise HTTPException(400, "captcha_reused")
    try:
        r = httpx.post("https://challenges.cloudflare.com/turnstile/v0/siteverify",
                       data={"secret": TS_SECRET, "response": token, "remoteip": ip}, timeout=8)
        d = r.json()
    except Exception:
        audit("captcha_down", "", ip, notify=True)
        raise HTTPException(503, "captcha_unavailable")
    if not d.get("success"):
        codes = d.get("error-codes", [])
        audit("captcha_fail", ",".join(codes), ip)
        raise HTTPException(400, "captcha_expired" if "timeout-or-duplicate" in codes else "captcha_failed")
    if TS_HOSTS and str(d.get("hostname", "")).lower() not in TS_HOSTS:
        audit("captcha_hostname", str(d.get("hostname", ""))[:80], ip)
        raise HTTPException(400, "captcha_failed")


def trap(honey, ip):
    if honey:
        audit("honeypot", "", ip, notify=True)
        raise HTTPException(400, "rejected")


# ------------------------------------------------------------------ models
class Reg(BaseModel):
    username: str = Field(max_length=20)
    email: str = Field(max_length=254)
    password: str = Field(min_length=8, max_length=72)
    captcha: str = ""
    website: str = ""


class Login(BaseModel):
    username: str = Field(max_length=20)
    password: str = Field(max_length=72)
    captcha: str = ""
    website: str = ""


class Msg(BaseModel):
    body: str = Field(min_length=1, max_length=1500)
    captcha: str = ""


class GuestIn(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    message: str = Field(min_length=1, max_length=500)
    captcha: str = ""
    website: str = ""


class ContactIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    subject: str = Field(min_length=1, max_length=120)
    message: str = Field(min_length=1, max_length=3000)
    email: str = Field("", max_length=254)
    captcha: str = ""
    website: str = ""


class ResetIn(BaseModel):
    username: str = Field(max_length=20)
    code: str = Field(min_length=6, max_length=64)
    password: str = Field(min_length=8, max_length=72)
    captcha: str = ""
    website: str = ""


class PwChange(BaseModel):
    current: str = Field(max_length=72)
    new: str = Field(min_length=8, max_length=72)


# ------------------------------------------------------------------ public
@app.get("/health")
def health(deep: int = 0):
    out = {"ok": True, "ts": int(time.time())}
    if deep:
        try:
            SB.table("settings").select("key").limit(1).execute()
            out["db"] = True
        except Exception:
            out["db"] = False
            out["ok"] = False
    return out


@app.get("/api/config")
def config():
    return {"sitekey": SITEKEY}


@app.get("/api/site")
def site():
    def load():
        prof = (SB.table("profiles").select("*").eq("id", 1).limit(1).execute().data or [{}])[0]
        prof.pop("id", None)
        skills = SB.table("skills").select("id,name,category,icon,note,sort").order("sort").order("id").execute().data
        tl = SB.table("timeline_events").select("id,when_label,kind,title,body,sort").eq("visible", True).order("sort").order("id").execute().data
        cfg = get_cfg()
        return {"profile": prof, "skills": skills, "timeline": tl,
                "flags": {"guestbook": cfg["guestbook_enabled"] == "1", "contact": cfg["contact_enabled"] == "1"}}
    return cached("site", load)


def _match(row, q, keys):
    hay = " ".join(str(row.get(k, "")) for k in keys).lower()
    return q in hay


@app.get("/api/projects")
def projects(cat: str = "", q: str = "", page: int = 1, size: int = 12):
    page, size, a, b = page_args(page, size)
    rows = cached("projects", lambda: SB.table("projects").select(
        "id,slug,category,status,featured,cover_url,github_url,demo_url,tags,title,summary,sort")
        .eq("visible", True).order("featured", desc=True).order("sort").order("id", desc=True).execute().data)
    q = q.strip().lower()[:60]
    rows = [r for r in rows if (not cat or r["category"] == cat) and (not q or _match(r, q, ("title", "summary", "tags")))]
    return {"items": rows[a:b + 1], "total": len(rows), "page": page, "size": size}


@app.get("/api/projects/{slug}")
def project(slug: str):
    r = SB.table("projects").select("*").eq("slug", slug[:60]).eq("visible", True).limit(1).execute().data
    if not r:
        raise HTTPException(404, "not_found")
    imgs = SB.table("project_images").select("id,image_url,caption,sort").eq("project_id", r[0]["id"]).order("sort").order("id").execute().data
    return {**r[0], "images": imgs}


@app.get("/api/gallery")
def gallery(cat: str = "", page: int = 1, size: int = 18):
    page, size, a, b = page_args(page, size, 36)
    q = SB.table("gallery_items").select("id,image_url,category,caption", count="exact").eq("visible", True)
    if cat:
        q = q.eq("category", cat)
    r = q.order("sort").order("id", desc=True).range(a, b).execute()
    return {"items": r.data, "total": r.count or 0, "page": page, "size": size}


@app.get("/api/blog")
def blog(q: str = "", cat: str = "", page: int = 1, size: int = 9):
    page, size, a, b = page_args(page, size, 24)
    rows = cached("blog", lambda: SB.table("blog_posts").select("id,slug,category,tags,cover_url,title,excerpt,read_min,published_at")
                  .eq("status", "published").order("published_at", desc=True).execute().data)
    q = q.strip().lower()[:60]
    cats = sorted({r["category"] for r in rows if r["category"]})
    rows = [r for r in rows if (not cat or r["category"] == cat) and (not q or _match(r, q, ("title", "excerpt", "tags")))]
    return {"items": rows[a:b + 1], "total": len(rows), "page": page, "size": size, "categories": cats}


@app.get("/api/blog/{slug}")
def blog_post(slug: str):
    r = SB.table("blog_posts").select("*").eq("slug", slug[:60]).eq("status", "published").limit(1).execute().data
    if not r:
        raise HTTPException(404, "not_found")
    return r[0]


@app.get("/api/guestbook")
def guestbook(page: int = 1, size: int = 10):
    page, size, a, b = page_args(page, size, 30)
    r = SB.table("guestbook_entries").select("id,display_name,message,created_at", count="exact").eq("status", "approved").order("id", desc=True).range(a, b).execute()
    return {"items": r.data, "total": r.count or 0, "page": page, "size": size}


@app.post("/api/guestbook")
def guestbook_post(b: GuestIn, req: Request):
    ip = ip_of(req)
    limit("gb" + ip, 5, 3600)
    trap(b.website, ip)
    cfg = get_cfg()
    if cfg["guestbook_enabled"] != "1":
        raise HTTPException(403, "disabled")
    name, msg = b.name.strip(), b.message.strip()
    if not name or not msg or core.looks_spammy(msg) or core.looks_spammy(name):
        audit("spam_blocked", "guestbook", ip)
        raise HTTPException(400, "bad_input")
    verify_captcha(b.captcha, ip)
    status = "pending" if cfg["guestbook_require_approval"] == "1" else "approved"
    SB.table("guestbook_entries").insert({"display_name": name, "message": msg, "status": status, "ip_hash": ip_hash(ip)}).execute()
    return {"ok": True, "status": status}


@app.post("/api/guestbook/{eid}/report")
def guestbook_report(eid: int, req: Request):
    ip = ip_of(req)
    limit("gbr" + ip, 10, 3600)
    r = SB.table("guestbook_entries").select("id,reports,status").eq("id", eid).limit(1).execute().data
    if not r or r[0]["status"] != "approved":
        raise HTTPException(404, "not_found")
    n = r[0]["reports"] + 1
    SB.table("guestbook_entries").update({"reports": n, **({"status": "pending"} if n >= 3 else {})}).eq("id", eid).execute()
    audit("guestbook_report", f"entry {eid} reports={n}", ip, notify=True)
    return {"ok": True}


@app.post("/api/contact")
def contact(b: ContactIn, req: Request):
    ip = ip_of(req)
    limit("ct" + ip, 3, 3600)
    trap(b.website, ip)
    if get_cfg()["contact_enabled"] != "1":
        raise HTTPException(403, "disabled")
    name, subj, msg, mail = b.name.strip(), b.subject.strip(), b.message.strip(), b.email.strip()
    if not (name and subj and msg) or (mail and not core.MAIL_RE.match(mail)) or core.looks_spammy(msg):
        raise HTTPException(400, "bad_input")
    verify_captcha(b.captcha, ip)
    SB.table("contact_messages").insert({"name": name, "subject": subj, "message": msg, "email": mail, "ip_hash": ip_hash(ip)}).execute()
    return {"ok": True}


# ------------------------------------------------------------------ auth endpoints
@app.post("/api/register")
def register(b: Reg, req: Request):
    ip = ip_of(req)
    limit("reg" + ip, 5, 3600)
    trap(b.website, ip)
    u = b.username.strip()
    if not core.USER_RE.match(u) or u.lower() in core.RESERVED or not core.MAIL_RE.match(b.email.strip()):
        raise HTTPException(400, "bad_input")
    verify_captcha(b.captcha, ip)
    if SB.table("users").select("id").ilike("username", u).limit(1).execute().data:
        raise HTTPException(409, "username_taken")
    row = SB.table("users").insert({"username": u, "email": b.email.strip(), "pass_hash": core.hash_pw(b.password)}).execute().data[0]
    audit("register", u, ip)
    return {"token": token_for({"id": row["id"], "token_ver": 0}), "username": u, "role": "user"}


@app.post("/api/login")
def login(b: Login, req: Request):
    ip = ip_of(req)
    limit("login" + ip, 10, 600)
    trap(b.website, ip)
    verify_captcha(b.captcha, ip)
    r = SB.table("users").select("id,username,pass_hash,role,token_ver").ilike("username", b.username.strip()).limit(1).execute().data
    if r and r[0]["pass_hash"].startswith("legacy:"):  # accounts migrated from the old system: verify once, then upgrade to scrypt
        old = r[0]["pass_hash"][7:]
        if hmac.compare_digest(old.encode(), b.password.encode()) or hmac.compare_digest(old.lower().encode(), hashlib.sha256(b.password.encode()).hexdigest().encode()):
            r[0]["pass_hash"] = core.hash_pw(b.password)
            SB.table("users").update({"pass_hash": r[0]["pass_hash"]}).eq("id", r[0]["id"]).execute()
    if not r:
        core.check_pw(b.password, DUMMY_HASH)  # same work for unknown users -> no timing-based username enumeration
    if not r or not core.check_pw(b.password, r[0]["pass_hash"]):
        audit("login_fail", b.username[:20], ip)
        raise HTTPException(401, "bad_credentials")
    return {"token": token_for(r[0]), "username": r[0]["username"], "role": r[0]["role"]}


@app.get("/api/me")
def me(authorization: str = Header("")):
    u = user_from(authorization)
    return {"username": u["username"], "role": u["role"]}


@app.post("/api/password/reset")
def password_reset(b: ResetIn, req: Request):
    """No e-mail service is configured, so an admin issues a one-time code from the dashboard (valid 30 min)."""
    ip = ip_of(req)
    limit("pwr" + ip, 5, 600)
    trap(b.website, ip)
    verify_captcha(b.captcha, ip)
    u = SB.table("users").select("id,username,token_ver").ilike("username", b.username.strip()).limit(1).execute().data
    ok = False
    if u:
        rows = SB.table("password_resets").select("id,code_hash,expires_at").eq("user_id", u[0]["id"]).eq("used", False).order("id", desc=True).limit(1).execute().data
        if rows and hmac.compare_digest(rows[0]["code_hash"], core.hash_code(SECRET, b.code.strip())):
            exp = dt.datetime.fromisoformat(rows[0]["expires_at"].replace("Z", "+00:00"))
            ok = exp > dt.datetime.now(dt.timezone.utc)
            SB.table("password_resets").update({"used": True}).eq("id", rows[0]["id"]).execute()
    if not ok:
        audit("reset_fail", b.username[:20], ip)
        raise HTTPException(400, "bad_code")
    SB.table("users").update({"pass_hash": core.hash_pw(b.password), "token_ver": u[0]["token_ver"] + 1}).eq("id", u[0]["id"]).execute()
    audit("password_reset", u[0]["username"], ip)
    return {"ok": True}


@app.post("/api/account/password")
def account_password(b: PwChange, req: Request, authorization: str = Header("")):
    ip = ip_of(req)
    u = user_from(authorization)
    limit("pwc%d" % u["id"], 5, 600)
    row = SB.table("users").select("pass_hash").eq("id", u["id"]).limit(1).execute().data[0]
    if not core.check_pw(b.current, row["pass_hash"]):
        audit("pwchange_fail", u["username"], ip)
        raise HTTPException(401, "bad_credentials")
    ver = u["token_ver"] + 1
    SB.table("users").update({"pass_hash": core.hash_pw(b.new), "token_ver": ver}).eq("id", u["id"]).execute()
    return {"token": token_for({"id": u["id"], "token_ver": ver})}


@app.post("/api/account/logout-all")
def logout_all(authorization: str = Header("")):
    u = user_from(authorization)
    ver = u["token_ver"] + 1
    SB.table("users").update({"token_ver": ver}).eq("id", u["id"]).execute()
    return {"token": token_for({"id": u["id"], "token_ver": ver})}


# ------------------------------------------------------------------ visitor chat -> Discord ticket (existing feature)
def latest_ticket(uid):
    r = SB.table("tickets").select("id,status").eq("user_id", uid).order("id", desc=True).limit(1).execute().data
    return r[0] if r else None


@app.get("/api/messages")
def messages(tid: int = 0, after: int = 0, authorization: str = Header("")):
    u = user_from(authorization)
    limit("poll%d" % u["id"], 60, 60)
    t = latest_ticket(u["id"])
    if not t:
        return {"ticket": None, "messages": []}
    if t["id"] != tid:
        after = 0
    m = SB.table("messages").select("id,sender,author,body").eq("ticket_id", t["id"]).gt("id", after).order("id").limit(100).execute().data
    return {"ticket": t, "messages": m}


@app.post("/api/messages")
def send(b: Msg, req: Request, authorization: str = Header("")):
    ip = ip_of(req)
    u = user_from(authorization)
    limit("msg%d" % u["id"], 20, 60)
    body = b.body.strip()
    if not body:
        raise HTTPException(400, "bad_input")
    t = latest_ticket(u["id"])
    if not t or t["status"] == "closed":
        verify_captcha(b.captcha, ip)  # opening a new ticket always needs a CAPTCHA
        try:
            t = SB.table("tickets").insert({"user_id": u["id"]}).execute().data[0]
        except Exception:
            t = latest_ticket(u["id"])  # unique index prevents duplicate active tickets
        audit("ticket_open", u["username"], ip)
    SB.table("messages").insert({"ticket_id": t["id"], "sender": "web", "author": u["username"], "body": body}).execute()
    return {"ok": True}


@app.get("/api/stats")
def stats():
    def load():
        c = lambda t: SB.table(t).select("id", count="exact").limit(1).execute().count or 0
        hb = SB.table("settings").select("value").eq("key", "bot_heartbeat").limit(1).execute().data
        online = bool(hb) and time.time() - float(hb[0]["value"]) < 30
        return {"bot_online": online, "tickets": c("tickets"), "users": c("users"), "messages": c("messages")}
    return cached("stats", load, 10)


# ------------------------------------------------------------------ admin: overview / profile
@app.get("/api/admin/overview")
def admin_overview(authorization: str = Header("")):
    staff(authorization, "moderator")
    c = lambda t, **eq: _count(t, **eq)
    hb = SB.table("settings").select("value").eq("key", "bot_heartbeat").limit(1).execute().data
    logs = SB.table("activity_logs").select("id,kind,detail,created_at").order("id", desc=True).limit(10).execute().data
    return {
        "users": c("users"), "projects": c("projects"), "tickets": c("tickets"),
        "tickets_open": c("tickets", status="open") + c("tickets", status="claimed"), "tickets_closed": c("tickets", status="closed"),
        "messages": c("messages"), "contact_new": c("contact_messages", status="new"),
        "guestbook_pending": c("guestbook_entries", status="pending"), "blog_published": c("blog_posts", status="published"),
        "blog_draft": c("blog_posts", status="draft"), "gallery": c("gallery_items"), "skills": c("skills"),
        "bot_online": bool(hb) and time.time() - float(hb[0]["value"]) < 30, "recent": logs}


def _count(t, **eq):
    q = SB.table(t).select("id", count="exact").limit(1)
    for k, v in eq.items():
        q = q.eq(k, v)
    return q.execute().count or 0


@app.get("/api/admin/profile")
def admin_profile_get(authorization: str = Header("")):
    staff(authorization, core.RESOURCE_ROLE["profile"])
    return (SB.table("profiles").select("*").eq("id", 1).limit(1).execute().data or [{}])[0]


@app.put("/api/admin/profile")
def admin_profile_put(req: Request, data: dict = Body(...), authorization: str = Header("")):
    u = staff(authorization, core.RESOURCE_ROLE["profile"])
    clean = core.validate(core.SPECS["profiles"], data, partial=True)
    SB.table("profiles").upsert({"id": 1, **clean, "updated_at": now_iso()}).execute()
    uncache()
    audit("admin_profile", f"by {u['username']}", ip_of(req))
    return {"ok": True}


# ------------------------------------------------------------------ admin: moderation (registered before the generic CRUD route)
@app.get("/api/admin/guestbook_entries")
def admin_guestbook(status: str = "", page: int = 1, size: int = 20, authorization: str = Header("")):
    staff(authorization, "moderator")
    page, size, a, b = page_args(page, size, 50)
    q = SB.table("guestbook_entries").select("id,display_name,message,status,reports,created_at", count="exact")
    if status in ("approved", "pending", "hidden"):
        q = q.eq("status", status)
    r = q.order("id", desc=True).range(a, b).execute()
    return {"items": r.data, "total": r.count or 0, "page": page, "size": size}


@app.patch("/api/admin/guestbook_entries/{eid}")
def admin_guestbook_set(eid: int, req: Request, data: dict = Body(...), authorization: str = Header("")):
    u = staff(authorization, "moderator")
    if data.get("status") not in ("approved", "pending", "hidden"):
        raise HTTPException(400, "bad_input")
    SB.table("guestbook_entries").update({"status": data["status"], **({"reports": 0} if data["status"] == "approved" else {})}).eq("id", eid).execute()
    audit("admin_guestbook", f"{eid} -> {data['status']} by {u['username']}", ip_of(req))
    return {"ok": True}


@app.delete("/api/admin/guestbook_entries/{eid}")
def admin_guestbook_del(eid: int, req: Request, authorization: str = Header("")):
    u = staff(authorization, "moderator")
    SB.table("guestbook_entries").delete().eq("id", eid).execute()
    audit("admin_guestbook_delete", f"{eid} by {u['username']}", ip_of(req))
    return {"ok": True}


@app.get("/api/admin/contact_messages")
def admin_contact(page: int = 1, size: int = 20, authorization: str = Header("")):
    staff(authorization, "moderator")
    page, size, a, b = page_args(page, size, 50)
    r = SB.table("contact_messages").select("id,name,subject,message,email,status,created_at", count="exact").order("id", desc=True).range(a, b).execute()
    return {"items": r.data, "total": r.count or 0, "page": page, "size": size}


@app.patch("/api/admin/contact_messages/{cid}")
def admin_contact_set(cid: int, data: dict = Body(...), authorization: str = Header("")):
    staff(authorization, "moderator")
    if data.get("status") not in ("new", "read"):
        raise HTTPException(400, "bad_input")
    SB.table("contact_messages").update({"status": data["status"]}).eq("id", cid).execute()
    return {"ok": True}


@app.delete("/api/admin/contact_messages/{cid}")
def admin_contact_del(cid: int, req: Request, authorization: str = Header("")):
    u = staff(authorization, "moderator")
    SB.table("contact_messages").delete().eq("id", cid).execute()
    audit("admin_contact_delete", f"{cid} by {u['username']}", ip_of(req))
    return {"ok": True}


# ---- tickets
@app.get("/api/admin/tickets")
def admin_tickets(status: str = "", page: int = 1, size: int = 20, authorization: str = Header("")):
    staff(authorization, "moderator")
    page, size, a, b = page_args(page, size, 50)
    q = SB.table("tickets").select("id,status,claimed_by,assigned_to,created_at,closed_at,users(username)", count="exact")
    if status in ("open", "claimed", "closed"):
        q = q.eq("status", status)
    r = q.order("id", desc=True).range(a, b).execute()
    return {"items": r.data, "total": r.count or 0, "page": page, "size": size}


@app.get("/api/admin/tickets/{tid}/messages")
def admin_ticket_messages(tid: int, authorization: str = Header("")):
    staff(authorization, "moderator")
    return {"items": SB.table("messages").select("id,sender,author,body,pushed,created_at").eq("ticket_id", tid).order("id").limit(500).execute().data}


@app.post("/api/admin/tickets/{tid}/reply")
def admin_ticket_reply(tid: int, data: dict = Body(...), authorization: str = Header("")):
    u = staff(authorization, "moderator")
    body = str(data.get("body", "")).strip()
    if not 1 <= len(body) <= 1500:
        raise HTTPException(400, "bad_input")
    t = SB.table("tickets").select("id,status").eq("id", tid).limit(1).execute().data
    if not t or t[0]["status"] == "closed":
        raise HTTPException(409, "ticket_closed")
    # pushed=False -> the Discord bot posts it into the ticket channel (survives bot restarts)
    SB.table("messages").insert({"ticket_id": tid, "sender": "admin", "author": u["username"], "body": body, "pushed": False}).execute()
    return {"ok": True}


@app.post("/api/admin/tickets/{tid}/action")
def admin_ticket_action(tid: int, req: Request, data: dict = Body(...), authorization: str = Header("")):
    u = staff(authorization, "moderator")
    act = data.get("action")
    t = SB.table("tickets").select("id,status").eq("id", tid).limit(1).execute().data
    if not t:
        raise HTTPException(404, "not_found")
    st = t[0]["status"]
    if act == "claim" and st == "open":
        upd, note = {"status": "claimed", "claimed_by": u["username"]}, f"{u['username']} รับเรื่องแล้ว (จาก Dashboard)"
    elif act == "close" and st != "closed":
        upd, note = {"status": "closed", "closed_at": now_iso()}, "ตั๋วถูกปิดแล้ว ขอบคุณที่ติดต่อ"
    elif act == "reopen" and st == "closed":
        upd, note = {"status": "open", "closed_at": None}, "ตั๋วถูกเปิดอีกครั้ง"
    else:
        raise HTTPException(409, "bad_state")
    try:
        SB.table("tickets").update(upd).eq("id", tid).execute()
    except Exception:
        raise HTTPException(409, "customer_has_active_ticket")
    SB.table("messages").insert({"ticket_id": tid, "sender": "system", "author": "system", "body": note, "pushed": False}).execute()
    audit("admin_ticket_" + act, f"#{tid} by {u['username']}", ip_of(req))
    return {"ok": True}


# ---- users
@app.get("/api/admin/users")
def admin_users(page: int = 1, size: int = 25, authorization: str = Header("")):
    staff(authorization, core.RESOURCE_ROLE["users"])
    page, size, a, b = page_args(page, size, 50)
    r = SB.table("users").select("id,username,email,role,created_at", count="exact").order("id", desc=True).range(a, b).execute()
    return {"items": r.data, "total": r.count or 0, "page": page, "size": size}


@app.patch("/api/admin/users/{uid}")
def admin_user_role(uid: int, req: Request, data: dict = Body(...), authorization: str = Header("")):
    u = staff(authorization, "owner")  # only the owner changes roles
    if data.get("role") not in core.ROLE_LEVEL or uid == u["id"]:
        raise HTTPException(400, "bad_input")
    SB.table("users").update({"role": data["role"]}).eq("id", uid).execute()
    audit("admin_role", f"user {uid} -> {data['role']} by {u['username']}", ip_of(req), notify=True)
    return {"ok": True}


@app.delete("/api/admin/users/{uid}")
def admin_user_del(uid: int, req: Request, authorization: str = Header("")):
    u = staff(authorization, "owner")
    t = SB.table("users").select("id,role,username").eq("id", uid).limit(1).execute().data
    if not t or uid == u["id"] or t[0]["role"] == "owner":
        raise HTTPException(400, "bad_input")
    SB.table("users").delete().eq("id", uid).execute()
    audit("admin_user_delete", f"{t[0]['username']} by {u['username']}", ip_of(req), notify=True)
    return {"ok": True}


@app.post("/api/admin/users/{uid}/reset-code")
def admin_reset_code(uid: int, req: Request, authorization: str = Header("")):
    u = staff(authorization, "admin")
    t = SB.table("users").select("id,role,username").eq("id", uid).limit(1).execute().data
    if not t:
        raise HTTPException(404, "not_found")
    if core.ROLE_LEVEL[t[0]["role"]] >= core.ROLE_LEVEL[u["role"]] and t[0]["id"] != u["id"]:
        raise HTTPException(403, "forbidden")  # you can only reset users ranked below you
    code = secrets.token_urlsafe(9)
    SB.table("password_resets").update({"used": True}).eq("user_id", uid).eq("used", False).execute()
    SB.table("password_resets").insert({"user_id": uid, "code_hash": core.hash_code(SECRET, code),
                                        "expires_at": (dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=30)).isoformat()}).execute()
    audit("admin_reset_code", f"for {t[0]['username']} by {u['username']}", ip_of(req), notify=True)
    return {"code": code, "expires_minutes": 30}


# ---- logs / settings
SECURITY_KINDS = ["captcha_fail", "captcha_reuse", "captcha_down", "captcha_hostname", "honeypot", "login_fail", "spam_blocked",
                  "reset_fail", "pwchange_fail", "guestbook_report", "error", "admin_role", "admin_user_delete", "admin_reset_code"]


@app.get("/api/admin/logs")
def admin_logs(security: int = 0, kind: str = "", page: int = 1, size: int = 30, authorization: str = Header("")):
    staff(authorization, "moderator")
    page, size, a, b = page_args(page, size, 100)
    q = SB.table("activity_logs").select("id,kind,detail,created_at", count="exact")
    if security:
        q = q.in_("kind", SECURITY_KINDS)
    if kind:
        q = q.eq("kind", kind[:40])
    r = q.order("id", desc=True).range(a, b).execute()
    return {"items": r.data, "total": r.count or 0, "page": page, "size": size}


@app.get("/api/admin/settings")
def admin_settings_get(authorization: str = Header("")):
    staff(authorization, core.RESOURCE_ROLE["settings"])
    uncache()
    disc = {r["key"]: r["value"] for r in SB.table("settings").select("key,value").in_("key", ["category", "log_channel", "snip_channel"]).execute().data}
    return {"settings": get_cfg(), "discord": disc}


@app.put("/api/admin/settings")
def admin_settings_put(req: Request, data: dict = Body(...), authorization: str = Header("")):
    u = staff(authorization, core.RESOURCE_ROLE["settings"])
    rows = []
    for k, v in data.items():
        if k not in core.SETTING_KEYS or str(v) not in core.SETTING_KEYS[k]:
            raise HTTPException(400, "bad_input")
        rows.append({"key": "cfg:" + k, "value": str(v)})
    if rows:
        SB.table("settings").upsert(rows).execute()
    uncache()
    audit("admin_settings", f"by {u['username']}", ip_of(req))
    return {"ok": True}


# ---- uploads (Supabase Storage)
@app.post("/api/admin/upload")
async def admin_upload(req: Request, authorization: str = Header("")):
    u = await run_in_threadpool(staff, authorization, core.RESOURCE_ROLE["upload"])
    limit("up%d" % u["id"], 30, 3600)
    buf = bytearray()
    async for chunk in req.stream():
        buf += chunk
        if len(buf) > MAX_UPLOAD:
            raise HTTPException(413, "too_large")
    kind = core.sniff_image(bytes(buf[:16]))
    if not kind:
        raise HTTPException(415, "bad_file_type")  # MIME is decided by the file's real bytes, never the client's header
    mime, ext = kind
    path = f"{dt.date.today():%Y%m}/{secrets.token_hex(12)}.{ext}"

    def go():
        SB.storage.from_(BUCKET).upload(path, bytes(buf), {"content-type": mime, "upsert": "false"})
        return str(SB.storage.from_(BUCKET).get_public_url(path)).rstrip("?")
    url = await run_in_threadpool(go)
    audit("admin_upload", f"{path} {len(buf)}B by {u['username']}", ip_of(req))
    return {"url": url}


@app.delete("/api/admin/upload")
def admin_upload_delete(req: Request, url: str = Query(..., max_length=600), authorization: str = Header("")):
    u = staff(authorization, core.RESOURCE_ROLE["upload"])
    marker = f"/storage/v1/object/public/{BUCKET}/"
    if marker not in url or ".." in url:
        raise HTTPException(400, "bad_input")
    SB.storage.from_(BUCKET).remove([url.split(marker, 1)[1].split("?")[0]])
    audit("admin_upload_delete", f"by {u['username']}", ip_of(req))
    return {"ok": True}


# ------------------------------------------------------------------ admin: generic CRUD for content tables
TABLE_UPDATED = {"projects", "blog_posts"}
ORDER = {"skills": ("sort", "id"), "timeline_events": ("sort", "id"), "project_images": ("project_id", "sort")}


def _res(res):
    if res not in core.SPECS or res == "profiles":
        raise HTTPException(404, "not_found")
    return res


def _blog_derived(clean, existing=None):
    if "body" in clean or existing is None:
        clean["read_min"] = core.reading_minutes(core.mirror_text(clean.get("body")))
    if clean.get("status") == "published" and not (existing or {}).get("published_at"):
        clean["published_at"] = now_iso()
    return clean


@app.get("/api/admin/{res}")
def crud_list(res: str, page: int = 1, size: int = 25, authorization: str = Header("")):
    res = _res(res)
    staff(authorization, core.RESOURCE_ROLE[res])
    page, size, a, b = page_args(page, size, 100)
    q = SB.table(res).select("*", count="exact")
    order = ORDER.get(res)
    if order:
        for o in order:
            q = q.order(o)
    else:
        q = q.order("id", desc=True)
    r = q.range(a, b).execute()
    return {"items": r.data, "total": r.count or 0, "page": page, "size": size}


@app.post("/api/admin/{res}")
def crud_create(res: str, req: Request, data: dict = Body(...), authorization: str = Header("")):
    res = _res(res)
    u = staff(authorization, core.RESOURCE_ROLE[res])
    clean = core.validate(core.SPECS[res], data)
    if res == "blog_posts":
        _blog_derived(clean)
    try:
        row = SB.table(res).insert(clean).execute().data[0]
    except Exception as e:
        raise HTTPException(409 if "duplicate" in str(e).lower() or "unique" in str(e).lower() else 400, "conflict_or_invalid")
    uncache()
    audit("admin_create", f"{res}#{row['id']} by {u['username']}", ip_of(req))
    return row


@app.put("/api/admin/{res}/{rid}")
def crud_update(res: str, rid: int, req: Request, data: dict = Body(...), authorization: str = Header("")):
    res = _res(res)
    u = staff(authorization, core.RESOURCE_ROLE[res])
    clean = core.validate(core.SPECS[res], data, partial=True)
    old = SB.table(res).select("*").eq("id", rid).limit(1).execute().data
    if not old:
        raise HTTPException(404, "not_found")
    if res == "blog_posts":
        _blog_derived(clean, old[0])
    if res in TABLE_UPDATED:
        clean["updated_at"] = now_iso()
    try:
        row = SB.table(res).update(clean).eq("id", rid).execute().data[0]
    except Exception as e:
        raise HTTPException(409 if "duplicate" in str(e).lower() or "unique" in str(e).lower() else 400, "conflict_or_invalid")
    uncache()
    audit("admin_update", f"{res}#{rid} by {u['username']}", ip_of(req))
    return row


@app.delete("/api/admin/{res}/{rid}")
def crud_delete(res: str, rid: int, req: Request, authorization: str = Header("")):
    res = _res(res)
    u = staff(authorization, core.RESOURCE_ROLE[res])
    SB.table(res).delete().eq("id", rid).execute()
    uncache()
    audit("admin_delete", f"{res}#{rid} by {u['username']}", ip_of(req))
    return {"ok": True}


# ------------------------------------------------------------------ optional: serve the frontend from this process (local dev / single-host)
if SERVE_FRONTEND:
    app.mount("/", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "..", "frontend"), html=True), name="web")
