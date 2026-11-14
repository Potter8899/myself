"""In-memory fake of the supabase-py query builder (only what main.py uses)."""
import itertools
DEFAULTS = {
 "users": {"role": "user", "token_ver": 0, "notified": False}, "tickets": {"status": "open", "claimed_by": None, "assigned_to": None},
 "messages": {"pushed": False}, "projects": {"visible": True, "featured": False, "sort": 100, "status": "wip", "tags": [], "cover_url": "", "github_url": "", "demo_url": "", "summary": {"th": "", "en": ""}, "body": {"th": "", "en": ""}},
 "blog_posts": {"status": "draft", "category": "", "tags": [], "published_at": None, "cover_url": "", "excerpt": {"th": "", "en": ""}},
 "guestbook_entries": {"status": "approved", "reports": 0}, "contact_messages": {"status": "new", "notified": False},
 "gallery_items": {"visible": True, "sort": 100}, "password_resets": {"used": False}, "skills": {"sort": 100, "icon": "", "note": {"th": "", "en": ""}},
}
UNIQUE = {"users": ["username"], "projects": ["slug"], "blog_posts": ["slug"], "used_captcha": ["token_hash"], "skills": ["name"]}
class Res:
    def __init__(self, data, count=None): self.data = data; self.count = count
class Q:
    def __init__(self, db, t): self.db, self.t, self.op, self.f, self.ord, self.rng, self.cnt, self.lim, self.payload = db, t, "select", [], [], None, False, None, None
    def select(self, cols="*", count=None): self.cnt = bool(count); return self
    def insert(self, p): self.op, self.payload = "insert", p; return self
    def update(self, p): self.op, self.payload = "update", p; return self
    def upsert(self, p): self.op, self.payload = "upsert", p; return self
    def delete(self): self.op = "delete"; return self
    def eq(self, k, v): self.f.append(lambda r: r.get(k) == v); return self
    def gt(self, k, v): self.f.append(lambda r: r.get(k, 0) > v); return self
    def ilike(self, k, v): self.f.append(lambda r: str(r.get(k, "")).lower() == v.lower()); return self
    def like(self, k, v): self.f.append(lambda r: str(r.get(k, "")).startswith(v.rstrip("%"))); return self
    def in_(self, k, vs): self.f.append(lambda r: r.get(k) in vs); return self
    def order(self, c, desc=False): self.ord.append((c, desc)); return self
    def limit(self, n): self.lim = n; return self
    def range(self, a, b): self.rng = (a, b); return self
    def _match(self): return [r for r in self.db.rows[self.t] if all(f(r) for f in self.f)]
    def execute(self):
        rows = self.db.rows[self.t]
        if self.op == "insert":
            p = dict(DEFAULTS.get(self.t, {})); p.update(self.payload)
            for col in UNIQUE.get(self.t, []):
                if any(r.get(col) == p.get(col) for r in rows): raise Exception("duplicate key value violates unique constraint")
            if self.t == "tickets" and any(r["user_id"] == p["user_id"] and r["status"] != "closed" for r in rows): raise Exception("duplicate key one_active_ticket")
            if "id" not in p and self.t not in ("used_captcha", "settings"): p["id"] = next(self.db.seq[self.t])
            rows.append(p); return Res([dict(p)])
        if self.op == "upsert":
            for p in (self.payload if isinstance(self.payload, list) else [self.payload]):
                key = "key" if self.t == "settings" else "id"
                ex = next((r for r in rows if r.get(key) == p.get(key)), None)
                (ex.update(p) if ex else rows.append(dict(p)))
            return Res([])
        m = self._match()
        if self.op == "update":
            for r in m:
                if self.t == "tickets" and self.payload.get("status") == "open" and any(o["user_id"] == r["user_id"] and o is not r and o["status"] != "closed" for o in rows): raise Exception("duplicate key one_active_ticket")
                r.update(self.payload)
            return Res([dict(r) for r in m])
        if self.op == "delete":
            for r in m: rows.remove(r)
            return Res([])
        for c, desc in reversed(self.ord): m.sort(key=lambda r: (r.get(c) is None, r.get(c) if r.get(c) is not None else 0), reverse=desc)
        total = len(m)
        if self.rng: m = m[self.rng[0]:self.rng[1] + 1]
        if self.lim is not None: m = m[:self.lim]
        return Res([dict(r) for r in m], total if self.cnt else None)
class Bucket:
    def __init__(self, s): self.s = s
    def upload(self, path, data, opts): self.s.files[path] = (data, opts)
    def get_public_url(self, path): return f"https://x.supabase.co/storage/v1/object/public/portfolio/{path}?"
    def remove(self, paths): [self.s.files.pop(p, None) for p in paths]
class Storage:
    def __init__(self): self.files = {}
    def from_(self, b): return Bucket(self)
class Client:
    def __init__(self):
        names = ["users", "tickets", "messages", "used_captcha", "activity_logs", "settings", "profiles", "skills", "projects", "project_images", "gallery_items", "blog_posts", "timeline_events", "guestbook_entries", "contact_messages", "password_resets"]
        self.rows = {n: [] for n in names}; self.seq = {n: itertools.count(1) for n in names}; self.storage = Storage()
    def table(self, t): return Q(self, t)
CLIENT = Client()
def create_client(url, key): return CLIENT
