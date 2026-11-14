class ValidationError(Exception): pass
def Field(default=None, **k): return default
class BaseModel:
    def __init__(self, **kw):
        for name in getattr(type(self), "__annotations__", {}):
            setattr(self, name, kw.get(name, getattr(type(self), name, None)))
