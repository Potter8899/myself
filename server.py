"""Potter Personal Space — Backend API (FastAPI). รัน: uvicorn server:app --port 8000"""
import os, re, time, json, hmac, hashlib, base64, secrets, logging
from collections import defaultdict, deque
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Request, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, ValidationError
from supabase import create_client

load_dotenv()
log = logging.getLogger("potter")
SB = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
SECRET = os.environ["SESSION_SECRET"].encode()
TS_SECRET = os.getenv("TURNSTILE_SECRET", "")
SITEKEY = os.getenv("TURNSTILE_SITEKEY", "")
TRUST_PROXY = os.getenv("TRUST_PROXY", "0") == "1"
RESERVED = {"admin", "administrator", "potter", "root", "system", "mod", "support", "bot"}
USER_RE = re.compile(r"^[A-Za-z0-9_]{3,20}$")
MAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,189}\.[^@\s]{2,}$")

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
origin = os.getenv("ALLOWED_ORIGIN", "")
if origin:
    app.add_middleware(CORSMiddleware, allow_origins=[origin], allow_methods=["GET", "POST"], allow_headers=["Content-Type", "Authorization"])

@app.exception_handler(HTTPException)
async def _http(_, e): return JSONResponse({"error": e.detail}, status_code=e.status_code)
@app.exception_handler(ValidationError)
async def _val(_, e): return JSONResponse({"error": "bad_input"}, status_code=400)
@app.exception_handler(Exception)
async def _any(req, e):
    log.exception("unhandled")
    audit("error", f"{req.url.path}: {type(e).__name__}", "", notify=True)   # ไม่ใส่ข้อมูลผู้ใช้/secret ใน log
    return JSONResponse({"error": "server_error"}, status_code=500)

@app.middleware("http")
async def sec_headers(req, nxt):
    r = await nxt(req)
    r.headers.update({"X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "same-origin",
        "Content-Security-Policy": "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; "
                                   "connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'"})
    return r

def ip_of(req: Request) -> str:
    if TRUST_PROXY:   # เปิดเฉพาะเมื่ออยู่หลัง Cloudflare/Nginx ที่เชื่อถือได้
        return req.headers.get("cf-connecting-ip") or req.headers.get("x-forwarded-for", "").split(",")[0].strip() or "0"
    return req.client.host if req.client else "0"

def audit(kind, detail, ip, notify=False):
    try:
        SB.table("activity_logs").insert({"kind": kind, "detail": detail[:300], "notified": not notify,
            "ip_hash": hashlib.sha256(SECRET + ip.encode()).hexdigest()[:16]}).execute()
    except Exception: log.warning("audit failed")

_hits = defaultdict(deque)
def limit(key, n, per):
    q, now = _hits[key], time.time()
    while q and q[0] < now - per: q.popleft()
    if len(q) >= n: raise HTTPException(429, "rate_limited")
    q.append(now)

def hash_pw(pw):
    salt = os.urandom(16); h = hashlib.scrypt(pw.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)
    return salt.hex() + ":" + h.hex()
def check_pw(pw, stored):
    try:
        s, h = stored.split(":"); n = hashlib.scrypt(pw.encode(), salt=bytes.fromhex(s), n=2**14, r=8, p=1, dklen=32)
        return hmac.compare_digest(n.hex(), h)
    except Exception: return False

def make_token(uid):
    p = base64.urlsafe_b64encode(json.dumps({"u": uid, "e": int(time.time()) + 7 * 86400}).encode()).decode()
    return p + "." + hmac.new(SECRET, p.encode(), hashlib.sha256).hexdigest()
def user_from(auth):
    try:
        p, sig = (auth or "").removeprefix("Bearer ").split(".")
        if not hmac.compare_digest(sig, hmac.new(SECRET, p.encode(), hashlib.sha256).hexdigest()): raise ValueError
        d = json.loads(base64.urlsafe_b64decode(p))
        if d["e"] < time.time(): raise ValueError
        r = SB.table("users").select("id,username,role").eq("id", d["u"]).limit(1).execute().data
        if r: return r[0]
    except Exception: pass
    raise HTTPException(401, "unauthorized")

async def verify_captcha(token, ip):
    if not TS_SECRET: raise HTTPException(503, "captcha_unavailable")      # ไม่ข้ามการตรวจสอบเด็ดขาด
    if not token or len(token) > 2048: raise HTTPException(400, "captcha_required")
    th = hashlib.sha256(token.encode()).hexdigest()
    try: SB.table("used_captcha").insert({"token_hash": th}).execute()      # PK ซ้ำ = โทเคนถูกใช้ซ้ำ
    except Exception:
        audit("captcha_reuse", "", ip); raise HTTPException(400, "captcha_reused")
    try:
        async with httpx.AsyncClient(timeout=8) as c:
            r = await c.post("https://challenges.cloudflare.com/turnstile/v0/siteverify", data={"secret": TS_SECRET, "response": token, "remoteip": ip})
        d = r.json()
    except Exception:
        audit("captcha_down", "", ip, notify=True); raise HTTPException(503, "captcha_unavailable")
    if not d.get("success"):
        codes = d.get("error-codes", [])
        audit("captcha_fail", ",".join(codes), ip)
        raise HTTPException(400, "captcha_expired" if "timeout-or-duplicate" in codes else "captcha_failed")

class Reg(BaseModel):
    username: str = Field(max_length=20); email: str = Field(max_length=254); password: str = Field(min_length=8, max_length=72)
    captcha: str = ""; website: str = ""
class Login(BaseModel):
    username: str = Field(max_length=20); password: str = Field(max_length=72); captcha: str = ""; website: str = ""
class Msg(BaseModel):
    body: str = Field(min_length=1, max_length=1500); captcha: str = ""

def trap(honey, ip):
    if honey:
        audit("honeypot", "", ip); raise HTTPException(400, "rejected")

@app.get("/api/config")
def config(): return {"sitekey": SITEKEY}

@app.post("/api/register")
async def register(b: Reg, req: Request):
    ip = ip_of(req); limit("reg" + ip, 5, 3600); trap(b.website, ip)
    u = b.username.strip()
    if not USER_RE.match(u) or u.lower() in RESERVED or not MAIL_RE.match(b.email.strip()): raise HTTPException(400, "bad_input")
    await verify_captcha(b.captcha, ip)
    if SB.table("users").select("id").ilike("username", u).limit(1).execute().data: raise HTTPException(409, "username_taken")
    row = SB.table("users").insert({"username": u, "email": b.email.strip(), "pass_hash": hash_pw(b.password)}).execute().data[0]
    audit("register", u, ip)
    return {"token": make_token(row["id"]), "username": u}

@app.post("/api/login")
async def login(b: Login, req: Request):
    ip = ip_of(req); limit("login" + ip, 10, 600); trap(b.website, ip)
    await verify_captcha(b.captcha, ip)
    r = SB.table("users").select("id,username,pass_hash").ilike("username", b.username.strip()).limit(1).execute().data
    if r and r[0]["pass_hash"].startswith("legacy:"):   # บัญชีที่ย้ายมาจากระบบเดิม: ตรวจแบบ plaintext หรือ sha256 แล้วเปลี่ยนเป็น scrypt ทันที
        old = r[0]["pass_hash"][7:]
        if hmac.compare_digest(old, b.password) or hmac.compare_digest(old.lower(), hashlib.sha256(b.password.encode()).hexdigest()):
            r[0]["pass_hash"] = hash_pw(b.password)
            SB.table("users").update({"pass_hash": r[0]["pass_hash"]}).eq("id", r[0]["id"]).execute()
    if not r or not check_pw(b.password, r[0]["pass_hash"]):
        audit("login_fail", b.username[:20], ip); raise HTTPException(401, "bad_credentials")
    return {"token": make_token(r[0]["id"]), "username": r[0]["username"]}

@app.get("/api/me")
def me(authorization: str = Header("")): u = user_from(authorization); return {"username": u["username"]}

def latest_ticket(uid):
    r = SB.table("tickets").select("id,status").eq("user_id", uid).order("id", desc=True).limit(1).execute().data
    return r[0] if r else None

@app.get("/api/messages")
def messages(tid: int = 0, after: int = 0, authorization: str = Header("")):
    u = user_from(authorization); limit("poll%d" % u["id"], 60, 60)
    t = latest_ticket(u["id"])
    if not t: return {"ticket": None, "messages": []}
    if t["id"] != tid: after = 0
    m = SB.table("messages").select("id,sender,author,body").eq("ticket_id", t["id"]).gt("id", after).order("id").limit(100).execute().data
    return {"ticket": t, "messages": m}

@app.post("/api/messages")
async def send(b: Msg, req: Request, authorization: str = Header("")):
    ip = ip_of(req); u = user_from(authorization); limit("msg%d" % u["id"], 20, 60)
    body = b.body.strip()
    if not body: raise HTTPException(400, "bad_input")
    t = latest_ticket(u["id"])
    if not t or t["status"] == "closed":
        await verify_captcha(b.captcha, ip)            # เปิดตั๋วใหม่ต้องผ่าน CAPTCHA เสมอ
        try: t = SB.table("tickets").insert({"user_id": u["id"]}).execute().data[0]
        except Exception: t = latest_ticket(u["id"])    # unique index กันตั๋วซ้ำ
        audit("ticket_open", u["username"], ip)
    SB.table("messages").insert({"ticket_id": t["id"], "sender": "web", "author": u["username"], "body": body}).execute()
    return {"ok": True}

@app.get("/api/stats")
def stats():
    c = lambda t: SB.table(t).select("id", count="exact").limit(1).execute().count or 0
    hb = SB.table("settings").select("value").eq("key", "bot_heartbeat").limit(1).execute().data
    online = bool(hb) and time.time() - float(hb[0]["value"]) < 30
    return {"bot_online": online, "tickets": c("tickets"), "users": c("users"), "messages": c("messages")}

app.mount("/", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "web"), html=True), name="web")
