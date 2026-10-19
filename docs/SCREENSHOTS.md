# Danh sách ảnh chụp minh chứng cho báo cáo

Chụp sau khi `docker compose up -d --build` chạy ổn định và đã thao tác vài lần trên website (để Grafana/Loki có dữ liệu).
Đặt ảnh vào thư mục `docs/images/` (không bắt buộc commit) và chèn vào báo cáo đúng mục.

| # | Nội dung ảnh | Mục báo cáo |
|---|---|---|
| 1 | GitHub: trang repo (tên theo MSSV) có README | Quản lý mã nguồn |
| 2 | GitHub: lịch sử 4 commit (`git log --oneline` hoặc tab Commits) | Quản lý mã nguồn |
| 3 | Terminal: `docker compose ps` - tất cả container Up/healthy | Tổng quan triển khai |
| 4 | Website: trang đăng nhập (thanh địa chỉ thấy `https://`) | Ứng dụng |
| 5 | Website: Tổng quan, danh sách Sách, Độc giả | Ứng dụng |
| 6 | Website: lập phiếu mượn và nhận trả (trước/sau, số bản thay đổi) | Ứng dụng |
| 7 | pgAdmin: cây server -> bảng `books`, `members`, `loans` | Database |
| 8 | pgAdmin: Query Tool chạy `SELECT * FROM loans WHERE returned_at IS NULL` | Database |
| 9 | Terminal: `curl -skI https://localhost/login` (security headers) và `curl -sI http://localhost/` (301) | Nginx |
| 10 | Trình duyệt: cảnh báo chứng chỉ tự ký + thông tin chứng chỉ | Nginx |
| 11 | Prometheus: trang Status -> Targets, tất cả UP | Giám sát |
| 12 | Prometheus: một truy vấn PromQL (ví dụ `rate(library_http_requests_total[1m])`) | Giám sát |
| 13 | Grafana: 3 dashboard (Containers, Web, PostgreSQL) - mỗi dashboard 1 ảnh | Giám sát |
| 14 | Grafana: dashboard Web sau khi chạy vòng lặp `curl` (đồ thị có biến động) | Giám sát |
| 15 | Grafana Explore + Loki: truy vấn `{service="app"}` | Log |
| 16 | Grafana Explore: truy vấn đăng nhập thất bại (`event="login_failed"`) | Log |
| 17 | Grafana Explore: biểu đồ `sum by (status) (count_over_time(...))` | Log |
| 18 | Grafana: dashboard Library - Logs (Loki) | Log |
| 19 | Terminal: `docker compose exec app id` và `exec nginx id` (non-root) | Hardening |
| 20 | Terminal: `docker network inspect ... Internal` và `docker compose port postgres 5432` (rỗng) | Hardening |
| 21 | Terminal: thử `DELETE FROM loans`/`DROP TABLE` bằng role `library_app` -> permission denied | Hardening |
| 22 | Terminal: vòng lặp curl `/login` -> xuất hiện mã 429 | Hardening |
| 23 | Terminal: `./scripts/check.sh` toàn bộ [OK] | Tổng kết |
| 24 | Terminal: `docker inspect` -> ReadonlyRootfs=true, CapDrop=[ALL] | Hardening |

Mẹo: dùng `Win+Shift+S` (Windows) hoặc `Cmd+Shift+4` (macOS); chụp rộng đủ để thấy URL/lệnh và kết quả; che mật khẩu thật nếu hiển thị.
