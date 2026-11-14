#!/bin/sh
# Render static-site build: writes js/config.js from API_URL and fills the canonical URL, sitemap.xml and robots.txt from SITE_URL.
set -eu
API_URL="${API_URL:-}"; SITE_URL="${SITE_URL:-}"
case "$API_URL" in ""|https://*|http://localhost*) ;; *) echo "API_URL must start with https://" >&2; exit 1;; esac
case "$SITE_URL" in ""|https://*|http://localhost*) ;; *) echo "SITE_URL must start with https://" >&2; exit 1;; esac
[ -n "$API_URL" ] || echo "WARNING: API_URL is empty - the site will call /api on its own origin" >&2
API_URL="${API_URL%/}"; SITE_URL="${SITE_URL%/}"
printf 'window.PS_CONFIG = { API_URL: "%s" };\n' "$API_URL" > js/config.js
if [ -n "$SITE_URL" ]; then
  sed -i "s|__SITE_URL__|$SITE_URL|g" index.html
  printf '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>%s/</loc><changefreq>weekly</changefreq></url></urlset>\n' "$SITE_URL" > sitemap.xml
  printf 'User-agent: *\nAllow: /\nDisallow: /admin.html\nSitemap: %s/sitemap.xml\n' "$SITE_URL" > robots.txt
else
  sed -i 's|<link rel="canonical" href="__SITE_URL__/">||; s|__SITE_URL__||g' index.html
  printf 'User-agent: *\nAllow: /\nDisallow: /admin.html\n' > robots.txt
fi
echo "build.sh done"
