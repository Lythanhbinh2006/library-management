# Hệ thống Quản lý Thư viện - Triển khai bằng Docker Compose

Bài thực hành môn **Triển khai và Quản trị Hệ thống Phần mềm** - Đề 1.
Ứng dụng web quản lý thư viện (sách, độc giả, mượn/trả) chạy trên **PostgreSQL + pgAdmin**, đặt sau **Nginx reverse proxy (HTTPS)**,
giám sát bằng **Prometheus + Grafana**, log tập trung bằng **Loki + Promtail (LogQL)** và đã được **hardening**.

> Sinh viên: `Lý Thanh Bình` - MSSV: `DTC245200725` - Lớp: `CNTT K23I`

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
| Prometheus | `prom/prometheus:v2.55.1` | Thu thập số liệu, quy tắc cảnh báo |
| Grafana | `grafana/grafana:11.3.0` | Dashboard (provision sẵn) |
| cAdvisor | `gcr.io/cadvisor/cadvisor:v0.49.1` | Số liệu container |
| nginx-exporter / postgres-exporter | `nginx/nginx-prometheus-exporter:1.3.0` / `prometheuscommunity/postgres-exporter:v0.15.0` | Số liệu web server / database |
| Loki + Promtail | `grafana/loki:3.2.1` / `grafana/promtail:3.2.1` | Log tập trung, truy vấn bằng LogQL |

## 3. Yêu cầu

- Docker Engine 24+ và Docker Compose v2 (`docker compose version`).
- Cổng **80 và 443** trên máy chưa bị chiếm (Windows: tắt IIS/World Wide Web Publishing nếu cần).
- Git. Hệ điều hành Linux / macOS / Windows (Docker Desktop, WSL2).

## 4. Chạy hệ thống

```bash
git clone https://github.com/Lythanhbinh2006/library-management.git
cd <library-management>

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
| Grafana | http://127.0.0.1:3000 | `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD` |
| Prometheus | http://127.0.0.1:9090 | không cần đăng nhập (chỉ loopback) |

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
├── monitoring/
│   ├── prometheus/             # prometheus.yml, alerts.yml
│   └── grafana/                # provisioning/ + dashboards/*.json
├── logging/
│   ├── loki/loki-config.yml
│   └── promtail/promtail-config.yml
├── scripts/                    # setup.sh, setup.ps1, check.sh
└── docs/                       # HARDENING.md, LOGQL.md, SCREENSHOTS.md, NOP_BAI.md
```

## 7. Nginx reverse proxy (Yêu cầu 3)

- Mọi truy cập website đi qua Nginx; container `app` **không** publish cổng ra host.
- HTTP (80) tự chuyển hướng 301 sang HTTPS (443). TLS 1.2/1.3, chứng chỉ tự ký, HSTS.
- Security headers: `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`,
  `Content-Security-Policy`, `Cross-Origin-*`. Ẩn phiên bản Nginx (`server_tokens off`).
- Kiểm tra: `curl -skI https://localhost/login` và `curl -sI http://localhost/`.

## 8. Giám sát: Prometheus + Grafana (Yêu cầu 4)

Prometheus thu thập (mỗi 15 giây) từ 5 nhóm target: `app`, `nginx` (qua exporter), `postgres` (qua exporter), `cadvisor` (container) và chính nó.
Kiểm tra tại http://127.0.0.1:9090/targets - tất cả phải **UP**.

Grafana tự nạp datasource và 3 dashboard trong thư mục **Library**:

| Dashboard | Nội dung |
|---|---|
| Library - Containers (cAdvisor) | CPU, RAM, mạng, đĩa, uptime của từng container |
| Library - Web (Nginx + App) | Request/s, kết nối, mã HTTP, độ trễ p50/p95/p99, số liệu nghiệp vụ (sách, độc giả, phiếu mượn) |
| Library - PostgreSQL | Kết nối, transaction/s, cache hit ratio, khóa, dung lượng DB, số dòng theo bảng |

Quy tắc cảnh báo mẫu xem tại Prometheus -> Alerts (`monitoring/prometheus/alerts.yml`).
Để thấy biểu đồ chuyển động: đăng nhập website, thêm sách, lập/nhận trả phiếu, hoặc chạy vòng lặp `curl -sk https://localhost/login`.

## 9. Log tập trung: Loki + Promtail + LogQL (Yêu cầu 5)

- Mọi container (nhãn project `library`) ghi log ra stdout. **Promtail** phát hiện container qua Docker API, gắn nhãn `service`, `container`, `project`
  (riêng app có thêm `level`) rồi đẩy sang **Loki** (lưu 7 ngày).
- Nginx và app đều ghi log **JSON**, nên dùng `| json` trong LogQL để lọc theo trường.
- Truy vấn: Grafana -> **Explore** -> chọn datasource **Loki** (hoặc dashboard *Library - Logs (Loki)*).

| # | Mục đích | LogQL |
|---|---|---|
| 1 | Toàn bộ log của app | `{service="app"}` |
| 2 | Đăng nhập thất bại | `{service="app"} \| json \| event="login_failed"` |
| 3 | Request lỗi tại Nginx | `{service="nginx"} \| json \| status >= 400` |
| 4 | Số request theo mã HTTP mỗi phút | `sum by (status) (count_over_time({service="nginx"} \| json [1m]))` |
| 5 | Truy vấn chậm / kết nối DB | `{service="postgres"} \|~ "duration:\|connection authorized"` |
| 6 | Mọi dòng chứa lỗi | `{project="library"} \|~ "(?i)(error\|fatal\|panic)"` |

Giải thích chi tiết và cách tạo dữ liệu mẫu cho từng truy vấn: [`docs/LOGQL.md`](docs/LOGQL.md).

## 10. Hardening (Yêu cầu 6)

| Nhóm | Biện pháp |
|---|---|
| Non-root | app (`node`, UID 1000), Nginx (`nginx-unprivileged`, UID 101), PostgreSQL (`postgres`), pgAdmin, Grafana, Prometheus, Loki đều không chạy bằng root |
| Network isolation | 5 mạng riêng; `app_net`, `db_net`, `monitor_net` là `internal` (không ra Internet); PostgreSQL/Loki/exporter không publish cổng |
| Mật khẩu mạnh | `setup.sh` sinh mật khẩu ngẫu nhiên; app **từ chối khởi động** nếu `ADMIN_PASSWORD` < 12 ký tự hoặc `SESSION_SECRET` < 32 ký tự; PostgreSQL dùng `scram-sha-256` |
| Hạn chế quyền DB | Role `library_app` không phải superuser, không `DROP/ALTER`, không `DELETE` bảng `loans`; role `exporter` chỉ có `pg_monitor`; `statement_timeout`, giới hạn kết nối |
| Security headers Nginx | HSTS, CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy; chỉ cho phép GET/HEAD/POST; chặn `/metrics` ra ngoài |
| Chống tấn công ứng dụng | CSRF token, cookie `HttpOnly; Secure; SameSite=Lax`, tái tạo session khi đăng nhập, escape HTML mặc định, truy vấn tham số hóa |
| Giới hạn tốc độ | `limit_req` trên `/login` (10 lần/phút) và toàn site (20 req/s), `limit_conn` |
| Container | `read_only` rootfs (app, Nginx, exporter), `cap_drop: ALL` (app, Nginx, exporter, Prometheus, Loki), `no-new-privileges`, giới hạn RAM/PID cho mọi dịch vụ, xoay vòng log Docker |
| Bí mật | `.env` nằm trong `.gitignore`; không có mật khẩu trong mã nguồn hay SQL |
| Giao diện quản trị | pgAdmin/Grafana/Prometheus chỉ mở trên `127.0.0.1` |

Cách kiểm chứng từng biện pháp bằng lệnh: [`docs/HARDENING.md`](docs/HARDENING.md).

## 11. Lịch sử commit

| Commit | Nội dung |
|---|---|
| 1 | Ứng dụng + PostgreSQL + pgAdmin + Nginx reverse proxy (HTTPS, security headers) |
| 2 | Prometheus + Grafana + exporter + dashboard |
| 3 | Loki + Promtail + dashboard log + truy vấn LogQL |
| 4 | Hardening (read-only, cap_drop, giới hạn tài nguyên, rate limit) + tài liệu |

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

## 14. Lưu ý về Promtail

Đề bài yêu cầu Loki + **Promtail**, và image `grafana/promtail:3.2.1` vẫn chạy bình thường. Tuy nhiên Grafana đã công bố Promtail **hết vòng đời (EOL) từ 02/03/2026**;
agent kế nhiệm là **Grafana Alloy**. Hệ thống thật nên chuyển sang Alloy (có công cụ `alloy convert --source-format=promtail`). Luồng log giữ nguyên: container -> agent -> Loki -> Grafana.
