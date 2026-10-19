#!/usr/bin/env bash
# Sinh file .env với mật khẩu ngẫu nhiên mạnh (Linux / macOS / WSL / Git Bash).
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f .env ]; then
  echo "[setup] .env đã tồn tại - giữ nguyên. Xóa file này nếu muốn sinh lại."
  exit 0
fi

hex() { openssl rand -hex "$1" 2>/dev/null || head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'; }
# Mật khẩu cho người dùng gõ: có chữ hoa, chữ thường, số, ký tự đặc biệt, ~80 bit ngẫu nhiên
pw() { printf 'Lib-%s-Q7x' "$(hex 10)"; }

ADMIN_PW="$(pw)"
PGADMIN_PW="$(pw)"
GRAFANA_PW="$(pw)"

cat > .env <<ENVEOF
POSTGRES_PASSWORD=$(hex 24)
APP_DB_PASSWORD=$(hex 24)
SESSION_SECRET=$(hex 32)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=${ADMIN_PW}
PGADMIN_EMAIL=admin@example.com
PGADMIN_PASSWORD=${PGADMIN_PW}
SERVER_NAME=localhost
HTTP_PORT=80
HTTPS_PORT=443
ADMIN_BIND=127.0.0.1
EXPORTER_DB_PASSWORD=$(hex 24)
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=${GRAFANA_PW}
ENVEOF
chmod 600 .env

echo "[setup] Đã tạo .env (quyền 600). Tài khoản đăng nhập:"
echo "  Website  : admin / ${ADMIN_PW}"
echo "  pgAdmin  : admin@example.com / ${PGADMIN_PW}"
echo "  Grafana  : admin / ${GRAFANA_PW}"
echo "Tiếp theo: docker compose up -d --build"
