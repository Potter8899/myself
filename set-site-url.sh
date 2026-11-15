#!/bin/sh
# ใช้ครั้งเดียวหลังรู้ URL จริงของเว็บ:  sh set-site-url.sh https://ชื่อเว็บของคุณ.example
# แทนที่ __SITE_URL__ ใน index.html (canonical, Open Graph) และสร้าง sitemap.xml + robots.txt
set -eu
U="${1:-}"; case "$U" in https://*) ;; *) echo "ใส่ URL แบบ https://... เช่น sh set-site-url.sh https://potter.example.com" >&2; exit 1;; esac
U="${U%/}"; sed -i "s|__SITE_URL__|$U|g" index.html
printf '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>%s/</loc></url></urlset>\n' "$U" > sitemap.xml
printf 'User-agent: *\nAllow: /\nSitemap: %s/sitemap.xml\n' "$U" > robots.txt
echo "done: $U"
