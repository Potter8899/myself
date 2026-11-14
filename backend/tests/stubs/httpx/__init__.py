RESULT = {"success": True, "hostname": "example.com"}
class _R:
    def json(self): return RESULT
def post(url, **k): return _R()
