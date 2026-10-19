# Hardening - biện pháp và cách kiểm chứng

Mỗi mục gồm: **biện pháp**, **nằm ở đâu**, **lệnh kiểm chứng** và **kết quả mong đợi**. Chạy từ thư mục gốc của repo, sau khi `docker compose up -d`.
Với các lệnh cần mật khẩu: `set -a; . ./.env; set +a` để nạp biến từ `.env`.

## 1. Non-root container

| Container | User | Lệnh | Kết quả |
|---|---|---|---|
| app | `node` (1000) | `docker compose exec app id` | `uid=1000(node)` |
| nginx | `nginx` (101) | `docker compose exec nginx id` | `uid=101(nginx)` |
| postgres | `postgres` | `docker compose exec postgres id` | `uid=70(postgres)` |
| grafana | 472 | `docker compose exec grafana id` | `uid=472(grafana)` |
| prometheus | `nobody` | `docker compose exec prometheus id` | `uid=65534(nobody)` |
| loki | 10001 | `docker compose exec loki id` | `uid=10001(loki)` |

Ngoại lệ có chủ đích: **cAdvisor** (cần đọc cgroup của host) và **Promtail** (cần đọc Docker socket) chạy root; cả hai chỉ nằm trong `monitor_net` (internal)
và mount tài nguyên host ở chế độ chỉ đọc. Đây là rủi ro đã chấp nhận, nêu trong báo cáo.

## 2. Network isolation

Định nghĩa trong `docker-compose.yml` (mục `networks`).

```bash
docker network inspect library_db_net library_app_net library_monitor_net --format '{{.Name}} internal={{.Internal}}'
# -> cả 3 mạng: internal=true

docker compose port postgres 5432           # không in gì: PostgreSQL không publish ra host
docker compose exec app wget -T 3 -qO- http://example.com || echo "app không ra được Internet"
docker compose ps --format 'table {{.Name}}\t{{.Ports}}'   # chỉ nginx mở 80/443; công cụ quản trị chỉ 127.0.0.1
```

## 3. Mật khẩu mạnh và bí mật

- `./scripts/setup.sh` sinh mật khẩu ngẫu nhiên (DB 192 bit, session 256 bit, tài khoản người dùng ~80 bit + đủ loại ký tự).
- `.env` có quyền `600` và nằm trong `.gitignore`: `git check-ignore -v .env`.
- App từ chối khởi động nếu mật khẩu yếu:
  ```bash
  docker compose run --rm -e ADMIN_PASSWORD=ngan app     # log: "ADMIN_PASSWORD phải dài tối thiểu 12 ký tự", thoát mã 1
  ```
- PostgreSQL dùng `scram-sha-256`: `docker compose exec postgres psql -U library_admin -d library -tAc "SHOW password_encryption"`.
- Mật khẩu người dùng ứng dụng lưu bằng bcrypt: `... psql -U library_admin -d library -c "SELECT username, left(password_hash, 7) FROM users"` -> `$2a$12$`.

## 4. Hạn chế quyền trong CSDL (least privilege)

Định nghĩa trong `db/init/03-roles.sh`. Ứng dụng kết nối bằng role `library_app`, không phải `library_admin` (superuser).

```bash
set -a; . ./.env; set +a
PSQL="docker compose exec -T -e PGPASSWORD=$APP_DB_PASSWORD postgres psql -h postgres -U library_app -d library"
$PSQL -c "SELECT count(*) FROM books"        # được phép
$PSQL -c "DELETE FROM loans"                 # ERROR: permission denied for table loans
$PSQL -c "DROP TABLE books"                  # ERROR: must be owner of table books
$PSQL -c "CREATE TABLE x(id int)"            # ERROR: permission denied for schema public
$PSQL -c "SELECT rolsuper, rolcreatedb FROM pg_roles WHERE rolname='library_app'"   # f | f
```
Role `exporter` chỉ thuộc `pg_monitor`: `... psql -U library_admin -d library -c "\du exporter"`.

## 5. Security headers và cấu hình TLS ở Nginx

Định nghĩa: `nginx/snippets/security-headers.conf`, `nginx/nginx.conf`.

```bash
curl -skI https://localhost/login | grep -iE "strict-transport|x-frame|x-content-type|content-security|referrer|permissions|cross-origin|^server"
curl -sI  http://localhost/ | head -3                                  # 301 -> https
curl -sk -o /dev/null -w "%{http_code}\n" https://localhost/metrics    # 404 (số liệu không lộ ra ngoài)
curl -sk -o /dev/null -w "%{http_code}\n" -X DELETE https://localhost/ # 405 (method không được phép)
echo | openssl s_client -connect localhost:443 -tls1_3 2>/dev/null | grep "New,"    # giao thức/cipher thương lượng được (TLS 1.3)
```

## 6. Giới hạn tốc độ (chống dò mật khẩu / flood)

```bash
for i in $(seq 1 12); do curl -sk -o /dev/null -w "%{http_code} " https://localhost/login; done; echo
# -> 200 200 200 200 200 200 429 429 ...   (10 lần/phút, burst 5: khoảng 6 request đầu qua, sau đó bị chặn)
```
Mỗi lần bị chặn, Nginx ghi một dòng JSON với `"status":429` (xem truy vấn LogQL số 3).

## 7. Bảo vệ ở tầng ứng dụng

| Biện pháp | Kiểm chứng |
|---|---|
| CSRF token cho mọi POST | `curl -sk -o /dev/null -w "%{http_code}\n" -X POST https://localhost/login -d "username=a&password=b"` -> `403` |
| Cookie `HttpOnly; Secure; SameSite=Lax` | `curl -skI https://localhost/login \| grep -i set-cookie` |
| Escape HTML mặc định (chống XSS) | Thêm sách có tên `<script>alert(1)</script>`: trang hiển thị nguyên văn, không chạy script |
| Truy vấn tham số hóa (chống SQL injection) | Tìm sách với `' OR 1=1 --`: không có kết quả bất thường |
| Session mới sau đăng nhập, hủy khi đăng xuất | Mã trong `app/src/routes/auth.js` |
| Không lộ thông tin lỗi | Lỗi 500 chỉ hiện thông báo chung; chi tiết nằm trong log (`{service="app"} \| json \| level="error"`) |

## 8. Hạn chế đặc quyền của container

```bash
docker inspect library-app library-nginx --format '{{.Name}} readonly={{.HostConfig.ReadonlyRootfs}} cap_drop={{.HostConfig.CapDrop}} sec={{.HostConfig.SecurityOpt}}'
# -> readonly=true cap_drop=[ALL] sec=[no-new-privileges:true]

docker compose exec nginx sh -c "touch /etc/nginx/test" || echo "rootfs chỉ đọc"
docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}\t{{.PIDs}}'     # RAM/PID bị giới hạn (cột LIMIT)
```
Docker `json-file` được cấu hình `max-size: 10m`, `max-file: 3` để log không làm đầy đĩa.

## 9. Giảm bề mặt tấn công

- Chỉ **Nginx** nhận kết nối từ Internet; app, DB, Loki, exporter không publish cổng.
- pgAdmin, Grafana, Prometheus chỉ lắng nghe `127.0.0.1` (biến `ADMIN_BIND`); Grafana tắt đăng ký và truy cập ẩn danh.
- Image dùng bản `alpine`/chỉ định phiên bản cụ thể (không dùng `latest`); app build nhiều giai đoạn nên image cuối không chứa công cụ build.
- Ẩn phiên bản Nginx (`server_tokens off`) và header `X-Powered-By`.

## 10. Rủi ro còn lại (nêu trong báo cáo)

1. Chứng chỉ tự ký: trình duyệt cảnh báo; môi trường thật dùng Let's Encrypt/CA nội bộ.
2. Promtail và cAdvisor chạy root / mount Docker socket (chỉ đọc) - cần thiết cho chức năng, nhưng nếu bị chiếm quyền thì ảnh hưởng tới host.
3. Chưa có Alertmanager, chưa có sao lưu tự động CSDL (`pg_dump`), chưa có WAF/Fail2ban.
4. Promtail đã EOL (03/2026) - nên chuyển sang Grafana Alloy.
