#!/bin/sh
# Sinh chứng chỉ TLS tự ký (self-signed) vào volume /certs, chỉ khi chưa có.
# Chạy một lần trước khi Nginx khởi động (docker compose: depends_on service_completed_successfully).
set -eu

CN="${CERT_CN:-localhost}"

if [ -s /certs/server.crt ] && [ -s /certs/server.key ]; then
  echo "[certgen] Chứng chỉ đã tồn tại, bỏ qua."
  exit 0
fi

SAN="DNS:localhost,IP:127.0.0.1"
case "$CN" in
  localhost) ;;
  *[!0-9.]*) SAN="DNS:${CN},${SAN}" ;;   # có ký tự khác số/dấu chấm -> là tên miền
  *)         SAN="IP:${CN},${SAN}" ;;    # chỉ gồm số và dấu chấm -> là địa chỉ IP
esac

echo "[certgen] Tạo chứng chỉ tự ký cho CN=${CN} (SAN: ${SAN})"
openssl req -x509 -nodes -newkey rsa:2048 -sha256 -days 365 \
  -keyout /certs/server.key -out /certs/server.crt \
  -subj "/C=VN/O=Library Management/CN=${CN}" \
  -addext "subjectAltName=${SAN}"

# Nginx (nginx-unprivileged) chạy với UID 101: chỉ user này đọc được khóa riêng.
chown 101:101 /certs/server.key /certs/server.crt
chmod 600 /certs/server.key
chmod 644 /certs/server.crt
echo "[certgen] Xong."
