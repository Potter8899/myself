#!/bin/sh
# Runs every automated test that works without network access / real services.
set -e
cd "$(dirname "$0")/.."
echo "== backend (core + handlers on stub FastAPI / fake Supabase)"; (cd backend && python3 -m unittest discover -s tests)
echo "== frontend markdown/XSS"; node tests/frontend/md.test.js
for f in frontend/js/*.js; do node --check "$f"; done; echo "js syntax ok"
python3 -m py_compile backend/main.py backend/core.py bot/bot.py && echo "python compile ok"
echo "== browser (needs playwright)"; python3 tests/e2e/e2e.py && python3 tests/e2e/admin_e2e.py
