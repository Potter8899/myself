import os, sys, unittest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from core import *

S = b"s" * 32

class T(unittest.TestCase):
    def test_password(self):
        h = hash_pw("correct horse")
        self.assertTrue(check_pw("correct horse", h)); self.assertFalse(check_pw("wrong", h))
        self.assertNotEqual(h, hash_pw("correct horse"))      # salted
        self.assertFalse(check_pw("x", "garbage")); self.assertNotIn("correct", h)

    def test_token(self):
        t = make_token(S, 7, 2, now=1000)
        self.assertEqual(parse_token(S, t, now=1001), (7, 2))
        self.assertEqual(parse_token(S, "Bearer " + t, now=1001), (7, 2))
        self.assertIsNone(parse_token(S, t, now=1000 + 7 * 86400 + 1))     # expired
        self.assertIsNone(parse_token(b"o" * 32, t, now=1001))             # other secret
        p, sig = t.split("."); self.assertIsNone(parse_token(S, p + "." + "0" * 64, now=1001))
        self.assertIsNone(parse_token(S, "", 1)); self.assertIsNone(parse_token(S, "a.b.c", 1))

    def test_rate(self):
        r = RateLimiter()
        self.assertTrue(all(r.allow("k", 3, 10, now=i) for i in range(3)))
        self.assertFalse(r.allow("k", 3, 10, now=5))
        self.assertTrue(r.allow("k", 3, 10, now=11))      # window slid
        self.assertTrue(r.allow("other", 3, 10, now=5))

    def test_roles(self):
        self.assertTrue(role_at_least("owner", "admin")); self.assertTrue(role_at_least("moderator", "moderator"))
        self.assertFalse(role_at_least("user", "moderator")); self.assertFalse(role_at_least("weird", "moderator"))

    def test_sniff(self):
        self.assertEqual(sniff_image(b"\xff\xd8\xff\xe0abc")[0], "image/jpeg")
        self.assertEqual(sniff_image(b"\x89PNG\r\n\x1a\nxx")[0], "image/png")
        self.assertEqual(sniff_image(b"RIFF\x00\x00\x00\x00WEBPVP8 ")[0], "image/webp")
        self.assertEqual(sniff_image(b"GIF89a...")[0], "image/gif")
        self.assertIsNone(sniff_image(b"<svg onload=alert(1)>")); self.assertIsNone(sniff_image(b"<?php ?>")); self.assertIsNone(sniff_image(b""))

    def test_url(self):
        self.assertEqual(safe_url("https://github.com/x"), "https://github.com/x")
        self.assertEqual(safe_url(""), "")
        for bad in ["javascript:alert(1)", "http://x.com", "data:text/html,x", "//evil.com", "https://a b", "https://x/\"onload=", "ftp://x"]:
            with self.assertRaises(Invalid, msg=bad): safe_url(bad)

    def test_validate_project(self):
        ok = validate(SPECS["projects"], {"slug": "my-bot", "category": "discord_bot", "status": "live", "title": {"th": "บอท", "en": ""},
                      "tags": ["a", " ", "b"], "evil_field": 1, "featured": True})
        self.assertEqual(ok["tags"], ["a", "b"]); self.assertNotIn("evil_field", ok)
        with self.assertRaises(Invalid): validate(SPECS["projects"], {"slug": "Bad Slug", "category": "ai", "status": "live", "title": {"th": "x", "en": ""}})
        with self.assertRaises(Invalid): validate(SPECS["projects"], {"slug": "ok", "category": "nope", "status": "live", "title": {"th": "x", "en": ""}})
        with self.assertRaises(Invalid): validate(SPECS["projects"], {"slug": "ok", "category": "ai", "status": "live", "title": {"th": "", "en": ""}})
        with self.assertRaises(Invalid): validate(SPECS["projects"], {"category": "ai", "status": "live", "title": {"th": "x", "en": ""}})
        self.assertEqual(validate(SPECS["projects"], {"featured": False}, partial=True), {"featured": False})
        with self.assertRaises(Invalid): validate(SPECS["projects"], {"featured": "true"}, partial=True)
        with self.assertRaises(Invalid): validate(SPECS["skills"], {"name": "x", "category": "tools", "sort": True})

    def test_validate_limits(self):
        with self.assertRaises(Invalid): validate(SPECS["profiles"], {"name": "x" * 61})
        with self.assertRaises(Invalid): validate(SPECS["profiles"], {"name": "ok", "socials": [{"label": "x", "url": "javascript:1"}]})
        with self.assertRaises(Invalid): validate(SPECS["profiles"], {"name": "ok", "contact_email": "not-an-email"})
        p = validate(SPECS["profiles"], {"name": "P", "socials": [{"label": "GitHub", "url": "https://github.com/Potter8899"}]})
        self.assertEqual(p["socials"][0]["label"], "GitHub")

    def test_text(self):
        self.assertEqual(slugify("Hello, World!! ไทย"), "hello-world")
        self.assertEqual(reading_minutes(""), 1); self.assertGreaterEqual(reading_minutes("word " * 1000), 5)
        self.assertGreaterEqual(reading_minutes("ก" * 4500), 5)

    def test_spam(self):
        self.assertFalse(looks_spammy("สวัสดีครับ เว็บสวยมาก see https://github.com/x"))
        self.assertTrue(looks_spammy("http://a.com http://b.com https://c.com"))
        self.assertTrue(looks_spammy("a" * 25)); self.assertFalse(looks_spammy("hahaha 555555"))

    def test_resource_roles_cover_specs(self):
        for k in SPECS:
            if k != "profiles": self.assertIn(k, RESOURCE_ROLE)

if __name__ == "__main__":
    unittest.main(verbosity=2)
