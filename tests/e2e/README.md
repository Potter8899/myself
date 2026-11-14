Browser tests (Playwright + Chromium) for the public site and the admin dashboard.
The API is mocked with Playwright routes, so they test the frontend only (not the real backend, Supabase, Cloudflare or Discord).

    pip install playwright && playwright install chromium
    python tests/e2e/e2e.py          # public site: 42 checks
    python tests/e2e/admin_e2e.py    # admin dashboard: 21 checks
Screenshots are written to /tmp/.
