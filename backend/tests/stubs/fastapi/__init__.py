"""Minimal stand-in for FastAPI so main.py can be imported and its handler functions called directly in tests.
NOT a web server: it only records routes. Real HTTP behaviour must be tested with the real packages."""
class HTTPException(Exception):
    def __init__(self, status_code, detail=None):
        super().__init__(detail); self.status_code = status_code; self.detail = detail
class Request: pass
def Body(*a, **k): return None
def Header(default="", **k): return default
def Query(default=None, **k): return default
class FastAPI:
    def __init__(self, **k): self.routes = []; self.handlers = {}
    def _reg(self, m):
        def deco(path, **k):
            def w(fn): self.routes.append((m, path, fn)); return fn
            return w
        return deco
    def __getattr__(self, n):
        if n in ("get", "post", "put", "patch", "delete"): return self._reg(n.upper())
        raise AttributeError(n)
    def exception_handler(self, cls): return lambda fn: fn
    def middleware(self, kind): return lambda fn: fn
    def add_middleware(self, *a, **k): pass
    def mount(self, *a, **k): pass
