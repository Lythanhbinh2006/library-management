#!/usr/bin/env bash
# Kiểm tra nhanh các thành phần sau khi `docker compose up -d --build`.
# Dùng khi demo: mỗi dòng [OK]/[FAIL] tương ứng một yêu cầu của đề.
cd "$(dirname "$0")/.."
set -a; [ -f .env ] && . ./.env; set +a

HTTP="${CHECK_HTTP:-http://localhost}"
HTTPS="${CHECK_HTTPS:-https://localhost}"
FAILED=0
ok()   { printf '  [OK]   %s\n' "$1"; }
fail() { printf '  [FAIL] %s\n' "$1"; FAILED=1; }
expect() { # expect "mô tả" "giá trị thật" "giá trị mong đợi"
  if [ "$2" = "$3" ]; then ok "$1 ($2)"; else fail "$1 (nhận $2, cần $3)"; fi
}

echo "== Container =="
docker compose ps --format 'table {{.Name}}\t{{.Status}}'

echo "== Website qua Nginx =="
expect "HTTP -> HTTPS redirect" "$(curl -s -o /dev/null -w '%{http_code}' "$HTTP/")" "301"
expect "HTTPS /login" "$(curl -sk -o /dev/null -w '%{http_code}' "$HTTPS/login")" "200"
HEADERS="$(curl -skI "$HTTPS/login")"
for h in Strict-Transport-Security X-Frame-Options X-Content-Type-Options Content-Security-Policy Referrer-Policy; do
  echo "$HEADERS" | grep -qi "^$h:" && ok "Header $h" || fail "Thiếu header $h"
done
echo "$HEADERS" | grep -qi "^server: nginx/" && fail "Server header lộ phiên bản" || ok "Server header không lộ phiên bản"

echo "== pgAdmin =="
expect "pgAdmin ping (127.0.0.1:5050)" "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:5050/misc/ping)" "200"

echo "== PostgreSQL =="
docker compose exec -T postgres pg_isready -U library_admin -d library >/dev/null 2>&1 && ok "pg_isready" || fail "pg_isready"
expect "Số sách trong CSDL" "$(docker compose exec -T postgres psql -U library_admin -d library -tAc 'SELECT count(*) FROM books' 2>/dev/null | tr -d '\r')" "12"

echo
[ "$FAILED" = "0" ] && echo "TẤT CẢ KIỂM TRA ĐẠT" || echo "CÓ KIỂM TRA KHÔNG ĐẠT - xem các dòng [FAIL]"
exit "$FAILED"
