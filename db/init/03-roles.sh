#!/bin/sh
# Tạo role ứng dụng với QUYỀN TỐI THIỂU (least privilege).
# Script chạy 1 lần khi khởi tạo volume. Mật khẩu lấy từ biến môi trường, truyền vào psql bằng -v
# và được quote an toàn bằng :'biến' (không nối chuỗi trực tiếp vào SQL).
set -eu
: "${APP_DB_PASSWORD:?APP_DB_PASSWORD chưa được đặt}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -v app_pw="$APP_DB_PASSWORD" <<'EOSQL'
-- Role dùng cho ứng dụng: không phải superuser, không tạo DB/role, giới hạn kết nối & thời gian truy vấn
CREATE ROLE library_app LOGIN PASSWORD :'app_pw'
    NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION CONNECTION LIMIT 20;
ALTER ROLE library_app SET statement_timeout = '15s';

-- Chỉ role được cấp quyền mới kết nối được CSDL; không ai được tạo object trong schema public
REVOKE ALL ON DATABASE library FROM PUBLIC;
GRANT CONNECT ON DATABASE library TO library_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO library_app;

-- Quyền theo từng bảng (không cấp DROP/ALTER/TRUNCATE, không cho xóa phiếu mượn)
GRANT SELECT, INSERT, UPDATE, DELETE ON books, members TO library_app;
GRANT SELECT, INSERT, UPDATE         ON loans, users   TO library_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON session        TO library_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO library_app;
EOSQL

# Role chỉ-đọc cho postgres-exporter (pg_monitor: xem thống kê, không đọc được dữ liệu bảng)
: "${EXPORTER_DB_PASSWORD:?EXPORTER_DB_PASSWORD chưa được đặt}"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -v exp_pw="$EXPORTER_DB_PASSWORD" <<'EOSQL'
CREATE ROLE exporter LOGIN PASSWORD :'exp_pw'
    NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION CONNECTION LIMIT 5;
GRANT pg_monitor TO exporter;
GRANT CONNECT ON DATABASE library TO exporter;
EOSQL
