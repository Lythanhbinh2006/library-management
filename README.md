# Hệ thống Quản lý Thư viện - Triển khai bằng Docker Compose

Bài thực hành môn **Triển khai và Quản trị Hệ thống Phần mềm** - Đề 1.
Ứng dụng web quản lý thư viện (sách, độc giả, mượn/trả) chạy trên **PostgreSQL + pgAdmin**, đặt sau **Nginx reverse proxy (HTTPS)**,
giám sát bằng **Prometheus + Grafana**, log tập trung bằng **Loki + Promtail (LogQL)** và đã được **hardening**.

> Sinh viên: `<Họ và tên>` - MSSV: `<MSSV>` - Lớp: `<Lớp>`

## 1. Chức năng ứng dụng

- Đăng nhập thủ thư (mật khẩu băm bcrypt, session lưu trong PostgreSQL, chống CSRF).
- **Sách**: thêm / sửa / xóa / tìm kiếm / phân trang, theo dõi số bản còn trong kho.
- **Độc giả**: thêm / sửa / xóa / tìm kiếm, khóa tạm thời.
- **Mượn / trả**: lập phiếu (kiểm tra còn sách, độc giả hợp lệ, tối đa 5 cuốn, không mượn trùng), nhận trả, lọc phiếu quá hạn.
- **Tổng quan**: số liệu thư viện, danh sách phiếu quá hạn, phiếu mượn gần đây.

## 2. Kiến trúc

```
                      Internet / Trình duyệt
                               |  80 (->301)  /  443 (TLS tự ký)
                     +---------v---------+
   edge_net          |       Nginx       |   security headers, rate limit, JSON access log
                     +---------+---------+
   app_net (internal)          | http://app:3000
                     +---------v---------+
                     |  App Node.js 22   |   user "node", /health, /metrics
                     +---------+---------+
   db_net (internal)           | 5432 (role library_app - quyền tối thiểu)
        +----------------+-----+-----------+
        |                |                 |
 +------v------+  +------v------+   +------v-------+
 | PostgreSQL  |  |   pgAdmin   |   |  postgres-   |
 |     16      |  | 127.0.0.1:  |   |  exporter    |
 +-------------+  |    5050     |   +------+-------+
                  +-------------+          |
 monitor_net (internal)                    |
 +-----------+  +--------+  +---------+  +--v---+  +------------+
 | cAdvisor  |->|Prometheus|->| Grafana |  |Nginx |  | Loki <-    |
 +-----------+  | :9090   |  | :3000   |  |export|  | Promtail   |
                +---------+  +---------+  +------+  +------------+
```

| Thành phần | Image | Vai trò |
|---|---|---|
| Nginx | `nginxinc/nginx-unprivileged:1.27-alpine` | Reverse proxy, HTTPS tự ký, security headers, rate limit |
| App | Build từ `app/` (`node:22-alpine`) | Ứng dụng Express, log JSON, endpoint `/metrics` |
| PostgreSQL | `postgres:16-alpine` | CSDL, role tối thiểu, log truy vấn chậm |
| pgAdmin | `dpage/pgadmin4:8.12` | Quản trị CSDL bằng giao diện web |

## 3. Yêu cầu

- Docker Engine 24+ và Docker Compose v2 (`docker compose version`).
- Cổng **80 và 443** trên máy chưa bị chiếm (Windows: tắt IIS/World Wide Web Publishing nếu cần).
- Git. Hệ điều hành Linux / macOS / Windows (Docker Desktop, WSL2).

## 4. Chạy hệ thống

```bash
git clone https://github.com/<tai-khoan-MSSV>/<ten-repo>.git
cd <ten-repo>

# Bước 1 - tạo .env với mật khẩu ngẫu nhiên mạnh (in ra tài khoản đăng nhập)
./scripts/setup.sh                                  # Linux / macOS / WSL / Git Bash
# Windows PowerShell:  powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
# Hoặc làm tay:        cp .env.example .env   rồi sửa mật khẩu

# Bước 2 - build và chạy toàn bộ dịch vụ
docker compose up -d --build

# Bước 3 - kiểm tra
docker compose ps
./scripts/check.sh
```

Lần chạy đầu cần 1-3 phút (tải image, build app, khởi tạo CSDL). Chứng chỉ TLS tự ký được container `certgen` tạo tự động.
Trình duyệt sẽ cảnh báo "không an toàn" do chứng chỉ tự ký: chọn **Advanced -> Proceed**.

## 5. Địa chỉ truy cập

| Dịch vụ | URL | Tài khoản |
|---|---|---|
| Website thư viện | https://localhost | `ADMIN_USERNAME` / `ADMIN_PASSWORD` trong `.env` |
| pgAdmin | http://127.0.0.1:5050 | `PGADMIN_EMAIL` / `PGADMIN_PASSWORD` |

Các giao diện quản trị chỉ lắng nghe trên `127.0.0.1` (xem biến `ADMIN_BIND`). Nếu chạy Docker trong máy ảo, dùng SSH tunnel
(`ssh -L 5050:127.0.0.1:5050 -L 3000:127.0.0.1:3000 user@vm`) hoặc đặt `ADMIN_BIND=0.0.0.0` trong `.env` rồi `docker compose up -d`.

**Kết nối pgAdmin tới PostgreSQL**: server "Library DB" đã được đăng ký sẵn. Khi được hỏi mật khẩu, nhập `POSTGRES_PASSWORD` trong `.env`
(user `library_admin`, host `postgres`, cổng 5432, database `library`).

## 6. Cấu trúc thư mục

```
.
├── docker-compose.yml          # toàn bộ dịch vụ, network, volume
├── .env.example                # mẫu biến môi trường (.env thật không commit)
├── app/                        # mã nguồn ứng dụng Node.js (Dockerfile, src/, public/)
├── db/
│   ├── init/                   # 01-schema.sql, 02-seed.sql, 03-roles.sh (tự chạy lần đầu)
│   └── pgadmin/servers.json    # đăng ký sẵn server trong pgAdmin
├── nginx/
│   ├── nginx.conf              # reverse proxy, TLS, log JSON
│   ├── snippets/               # security-headers.conf, proxy.conf
│   └── certgen/                # container sinh chứng chỉ tự ký
├── scripts/                    # setup.sh, setup.ps1, check.sh
```

## 7. Nginx reverse proxy (Yêu cầu 3)

- Mọi truy cập website đi qua Nginx; container `app` **không** publish cổng ra host.
- HTTP (80) tự chuyển hướng 301 sang HTTPS (443). TLS 1.2/1.3, chứng chỉ tự ký, HSTS.
- Security headers: `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`,
  `Content-Security-Policy`, `Cross-Origin-*`. Ẩn phiên bản Nginx (`server_tokens off`).
- Kiểm tra: `curl -skI https://localhost/login` và `curl -sI http://localhost/`.

## 11. Lịch sử commit

| Commit | Nội dung |
|---|---|
| 1 | Ứng dụng + PostgreSQL + pgAdmin + Nginx reverse proxy (HTTPS, security headers) |

## 12. Xử lý sự cố

| Hiện tượng | Cách xử lý |
|---|---|
| `variable is not set` khi `docker compose up` | Chưa có `.env` - chạy `./scripts/setup.sh` |
| Cổng 80/443 đã bị chiếm | Tắt dịch vụ đang dùng cổng, hoặc đổi `HTTP_PORT`/`HTTPS_PORT` (xem ghi chú trong `.env.example`) |
| Đổi mật khẩu trong `.env` nhưng DB vẫn dùng mật khẩu cũ | Script khởi tạo chỉ chạy lần đầu: `docker compose down -v` (xóa dữ liệu) rồi `up` lại |
| Đổi `SERVER_NAME` mà chứng chỉ không đổi | `docker compose down`, `docker volume rm library_nginx_certs`, `up` lại |
| Không vào được pgAdmin/Grafana từ máy thật (Docker trong VM) | Dùng SSH tunnel hoặc đặt `ADMIN_BIND=0.0.0.0` |
| Bảng cAdvisor trống / thiếu tên container trên Docker Desktop | Kiểm tra `docker compose logs cadvisor`; trên Docker Desktop cần bật WSL2 backend |
| Xem log một dịch vụ | `docker compose logs -f app` (hoặc `nginx`, `postgres`...) |

## 13. Dừng và dọn dẹp

```bash
docker compose down        # dừng, giữ dữ liệu
docker compose down -v     # dừng và XÓA toàn bộ dữ liệu (DB, Grafana, Loki...)
```
