"""Pure logic shared by the API: hashing, tokens, validation, rate limiting, image sniffing.

No FastAPI / Supabase imports here on purpose, so everything in this file is unit-testable
(see backend/tests/test_core.py).
"""
import base64
import hashlib
import hmac
import json
import os
import re
import time
from collections import defaultdict, deque

USER_RE = re.compile(r"^[A-Za-z0-9_]{3,20}$")
MAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,189}\.[^@\s]{2,}$")
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
RESERVED = {"admin", "administrator", "potter", "root", "system", "mod", "moderator", "owner", "support", "bot"}

ROLE_LEVEL = {"user": 0, "moderator": 1, "admin": 2, "owner": 3}


def role_at_least(role, need):
    return ROLE_LEVEL.get(role, -1) >= ROLE_LEVEL[need]


# ---------------------------------------------------------------- passwords / tokens
def hash_pw(pw):
    salt = os.urandom(16)
    h = hashlib.scrypt(pw.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)
    return salt.hex() + ":" + h.hex()


def check_pw(pw, stored):
    try:
        s, h = stored.split(":")
        n = hashlib.scrypt(pw.encode(), salt=bytes.fromhex(s), n=2**14, r=8, p=1, dklen=32)
        return hmac.compare_digest(n.hex(), h)
    except Exception:
        return False


def make_token(secret, uid, ver=0, ttl=7 * 86400, now=None):
    now = int(now if now is not None else time.time())
    p = base64.urlsafe_b64encode(json.dumps({"u": uid, "v": ver, "e": now + ttl}).encode()).decode()
    return p + "." + hmac.new(secret, p.encode(), hashlib.sha256).hexdigest()


def parse_token(secret, token, now=None):
    """Return (uid, ver) for a valid, unexpired token, else None."""
    try:
        p, sig = (token or "").removeprefix("Bearer ").split(".")
        if not hmac.compare_digest(sig, hmac.new(secret, p.encode(), hashlib.sha256).hexdigest()):
            return None
        d = json.loads(base64.urlsafe_b64decode(p))
        if d["e"] < (now if now is not None else time.time()):
            return None
        return int(d["u"]), int(d.get("v", 0))
    except Exception:
        return None


def hash_code(secret, code):
    return hmac.new(secret, code.encode(), hashlib.sha256).hexdigest()


# ---------------------------------------------------------------- rate limiting (single process)
class RateLimiter:
    def __init__(self):
        self._hits = defaultdict(deque)

    def allow(self, key, n, per, now=None):
        now = now if now is not None else time.time()
        q = self._hits[key]
        while q and q[0] < now - per:
            q.popleft()
        if len(q) >= n:
            return False
        q.append(now)
        if len(self._hits) > 20000:  # crude memory guard
            for k in [k for k, v in self._hits.items() if not v][:5000]:
                self._hits.pop(k, None)
        return True


# ---------------------------------------------------------------- text helpers
def slugify(s):
    s = re.sub(r"[^a-z0-9]+", "-", (s or "").lower()).strip("-")
    return s[:60]


def reading_minutes(text):
    """Thai has no spaces, so count Thai characters (~900/min) and other words (~200/min)."""
    text = text or ""
    thai = len(re.findall(r"[\u0E00-\u0E7F]", text))
    words = len(re.findall(r"[A-Za-z0-9_]+", text))
    return max(1, round(thai / 900 + words / 200))


def sniff_image(data):
    """Identify an image by magic bytes (never trust the client's Content-Type)."""
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg", "jpg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png", "png"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif", "gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp", "webp"
    return None


# ---------------------------------------------------------------- field validation
class Invalid(ValueError):
    def __init__(self, field):
        super().__init__(field)
        self.field = field


def _s(v, mx, field, req=False):
    if v is None:
        v = ""
    if not isinstance(v, str):
        raise Invalid(field)
    v = v.replace("\x00", "").strip()
    if len(v) > mx:
        raise Invalid(field)
    if req and not v:
        raise Invalid(field)
    return v


def safe_url(u, field="url", allow_empty=True):
    """https:// only (or a relative path under /img/). Blocks javascript:, data:, http: etc."""
    u = _s(u, 600, field)
    if not u:
        if allow_empty:
            return ""
        raise Invalid(field)
    if re.match(r"^https://[^\s<>\"']+$", u) or re.match(r"^img/[A-Za-z0-9_./-]+$", u):
        return u
    raise Invalid(field)


def validate(spec, data, partial=False):
    """spec: {field: (kind, opts)}.  Returns a cleaned dict containing only whitelisted fields.

    kinds: str, text, bi, bool, int, url, tags, enum, slug, links, email
    """
    if not isinstance(data, dict):
        raise Invalid("body")
    out = {}
    for f, (kind, o) in spec.items():
        if f not in data:
            if o.get("req") and not partial:
                raise Invalid(f)
            continue
        v, req = data[f], o.get("req", False)
        if kind in ("str", "text"):
            out[f] = _s(v, o.get("max", 200), f, req)
        elif kind == "bi":
            if not isinstance(v, dict):
                raise Invalid(f)
            mx = o.get("max", 200)
            out[f] = {"th": _s(v.get("th"), mx, f), "en": _s(v.get("en"), mx, f)}
            if req and not (out[f]["th"] or out[f]["en"]):
                raise Invalid(f)
        elif kind == "bool":
            if not isinstance(v, bool):
                raise Invalid(f)
            out[f] = v
        elif kind == "int":
            if isinstance(v, bool) or not isinstance(v, int) or not (o.get("min", -10**6) <= v <= o.get("max", 10**6)):
                raise Invalid(f)
            out[f] = v
        elif kind == "url":
            out[f] = safe_url(v, f, allow_empty=not req)
        elif kind == "email":
            v = _s(v, 254, f, req)
            if v and not MAIL_RE.match(v):
                raise Invalid(f)
            out[f] = v
        elif kind == "tags":
            if not isinstance(v, list) or len(v) > o.get("items", 20):
                raise Invalid(f)
            out[f] = [t for t in (_s(x, o.get("max", 30), f) for x in v) if t]
        elif kind == "enum":
            if v not in o["choices"]:
                raise Invalid(f)
            out[f] = v
        elif kind == "slug":
            v = _s(v, 60, f, req)
            if v and not SLUG_RE.match(v):
                raise Invalid(f)
            out[f] = v
        elif kind == "links":
            if not isinstance(v, list) or len(v) > 12:
                raise Invalid(f)
            out[f] = [{"label": _s(x.get("label") if isinstance(x, dict) else None, 40, f, True),
                       "url": safe_url(x.get("url"), f, allow_empty=False)} for x in v]
        else:  # pragma: no cover
            raise Invalid(f)
    return out


CATS_PROJECT = ["website", "application", "discord_bot", "minecraft", "ai", "experiment"]
CATS_SKILL = ["programming", "development", "tools", "other"]
CATS_GALLERY = ["personal", "projects", "screenshots", "workspace", "models", "creative"]
KINDS_TIMELINE = ["milestone", "project", "learning", "tech", "future"]

SPECS = {
    "profiles": {
        "name": ("str", {"max": 60, "req": True}),
        "tagline": ("bi", {"max": 140}),
        "intro": ("bi", {"max": 500}),
        "who": ("bi", {"max": 4000}),
        "story": ("bi", {"max": 6000}),
        "journey": ("bi", {"max": 6000}),
        "goals": ("bi", {"max": 3000}),
        "building": ("bi", {"max": 3000}),
        "learning": ("tags", {"items": 20, "max": 40}),
        "interests": ("tags", {"items": 30, "max": 40}),
        "photo_url": ("url", {}),
        "contact_email": ("email", {}),
        "socials": ("links", {}),
    },
    "skills": {
        "name": ("str", {"max": 60, "req": True}),
        "category": ("enum", {"choices": CATS_SKILL, "req": True}),
        "icon": ("str", {"max": 8}),
        "note": ("bi", {"max": 200}),
        "sort": ("int", {"min": 0, "max": 9999}),
    },
    "projects": {
        "slug": ("slug", {"req": True}),
        "category": ("enum", {"choices": CATS_PROJECT, "req": True}),
        "status": ("enum", {"choices": ["live", "wip", "planned", "archived"], "req": True}),
        "featured": ("bool", {}),
        "visible": ("bool", {}),
        "sort": ("int", {"min": 0, "max": 9999}),
        "cover_url": ("url", {}),
        "github_url": ("url", {}),
        "demo_url": ("url", {}),
        "tags": ("tags", {"items": 15, "max": 30}),
        "title": ("bi", {"max": 120, "req": True}),
        "summary": ("bi", {"max": 400}),
        "body": ("bi", {"max": 20000}),
    },
    "project_images": {
        "project_id": ("int", {"min": 1, "max": 10**9, "req": True}),
        "image_url": ("url", {"req": True}),
        "caption": ("bi", {"max": 200}),
        "sort": ("int", {"min": 0, "max": 9999}),
    },
    "gallery_items": {
        "image_url": ("url", {"req": True}),
        "category": ("enum", {"choices": CATS_GALLERY, "req": True}),
        "caption": ("bi", {"max": 300}),
        "visible": ("bool", {}),
        "sort": ("int", {"min": 0, "max": 9999}),
    },
    "blog_posts": {
        "slug": ("slug", {"req": True}),
        "status": ("enum", {"choices": ["draft", "published"], "req": True}),
        "category": ("str", {"max": 40}),
        "tags": ("tags", {"items": 12, "max": 30}),
        "cover_url": ("url", {}),
        "title": ("bi", {"max": 140, "req": True}),
        "excerpt": ("bi", {"max": 400}),
        "body": ("bi", {"max": 50000}),
    },
    "timeline_events": {
        "when_label": ("str", {"max": 30, "req": True}),
        "kind": ("enum", {"choices": KINDS_TIMELINE, "req": True}),
        "title": ("bi", {"max": 140, "req": True}),
        "body": ("bi", {"max": 800}),
        "visible": ("bool", {}),
        "sort": ("int", {"min": 0, "max": 9999}),
    },
}

# Which minimum role may edit each admin resource
RESOURCE_ROLE = {
    "skills": "admin", "projects": "admin", "project_images": "admin", "gallery_items": "admin",
    "blog_posts": "admin", "timeline_events": "admin",
    "guestbook_entries": "moderator", "contact_messages": "moderator", "tickets": "moderator",
    "logs": "moderator", "users": "admin", "settings": "admin", "profile": "admin", "upload": "admin",
}

# Settings that the dashboard may change (key -> allowed values)
SETTING_KEYS = {
    "guestbook_require_approval": ("0", "1"),
    "contact_enabled": ("0", "1"),
    "guestbook_enabled": ("0", "1"),
}


def looks_spammy(text):
    """Cheap heuristics for guestbook/contact spam: link flood or long repeated-character runs."""
    t = text or ""
    if len(re.findall(r"(?:https?://|www\.)", t, re.I)) > 2:
        return True
    return bool(re.search(r"(.)\1{19,}", t))


def mirror_text(bi):
    """Concatenate both language variants (used for reading-time)."""
    return " ".join((bi or {}).get(k, "") for k in ("th", "en"))
