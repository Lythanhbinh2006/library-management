# Truy vấn LogQL

Mở Grafana (http://127.0.0.1:3000) -> **Explore** -> datasource **Loki** -> chuyển sang chế độ **Code**, dán truy vấn, chọn khoảng thời gian *Last 15 minutes*.

## Nhãn có sẵn (do Promtail gắn)

| Nhãn | Ví dụ giá trị |
|---|---|
| `service` | `app`, `nginx`, `postgres`, `pgadmin`, `grafana`, `prometheus`, `loki`... |
| `container` | `library-app`, `library-nginx`... |
| `project` | `library` |
| `level` (chỉ app) | `info`, `warn`, `error` |

## Tạo dữ liệu mẫu trước khi truy vấn

```bash
# 1) Đăng nhập sai vài lần: lấy CSRF token rồi POST sai mật khẩu
for i in 1 2 3; do
  rm -f /tmp/cj; TOKEN=$(curl -sk -c /tmp/cj https://localhost/login | grep -o 'name="_csrf" value="[a-f0-9]*"' | cut -d'"' -f4)
  curl -sk -b /tmp/cj -o /dev/null -w "%{http_code} " -d "_csrf=$TOKEN&username=hacker&password=sai-mat-khau" https://localhost/login
  sleep 7        # giãn cách để không chạm giới hạn 10 lần/phút của Nginx
done; echo
# 2) Tạo request 404 và 405
curl -sk -o /dev/null https://localhost/khong-ton-tai ; curl -sk -o /dev/null -X DELETE https://localhost/
# 3) Dùng web: lập phiếu mượn, nhận trả phiếu, thêm sách (sinh sự kiện nghiệp vụ)
```

## Các truy vấn

### 1. Toàn bộ log của ứng dụng (truy vấn chọn luồng - stream selector)
```logql
{service="app"}
```
Chọn mọi dòng log của container `app`. Mỗi dòng là một JSON: `time`, `level`, `type` (`access`/`audit`/`app`), và các trường tùy loại.

### 2. Đăng nhập thất bại (phân tích JSON + lọc nhãn)
```logql
{service="app"} | json | event="login_failed"
```
`| json` tách các trường JSON thành nhãn tạm; `event="login_failed"` giữ lại dòng khớp. Mỗi dòng có `username` và `ip` - dùng để phát hiện dò mật khẩu.

### 3. Request lỗi tại Nginx
```logql
{service="nginx"} | json | status >= 400
```
So sánh số trên trường `status` (404, 405, 429...). Thêm `| line_format "{{.status}} {{.method}} {{.uri}} từ {{.remote_addr}}"` để rút gọn hiển thị.

### 4. Số request theo mã HTTP mỗi phút (truy vấn số liệu - metric query)
```logql
sum by (status) (count_over_time({service="nginx"} | json [1m]))
```
Đếm số dòng log trong cửa sổ 1 phút, gom theo `status`; hiển thị dạng biểu đồ (Explore: chọn *Graph*).

### 5. Tỷ lệ lỗi 5xx / 4xx
```logql
sum(rate({service="nginx"} | json | status >= 500 [5m])) / sum(rate({service="nginx"} [5m]))
```

### 6. Top 5 đường dẫn được gọi nhiều nhất
```logql
topk(5, sum by (uri) (count_over_time({service="nginx"} | json [10m])))
```

### 7. Truy vấn chậm và kết nối của PostgreSQL (lọc chuỗi)
```logql
{service="postgres"} |~ "duration:|connection authorized"
```
`|~` lọc bằng biểu thức chính quy. PostgreSQL được cấu hình `log_min_duration_statement=500` nên truy vấn > 500 ms sẽ có dòng `duration: ... ms  statement: ...`.

### 8. Mọi dòng lỗi trong toàn hệ thống
```logql
{project="library"} |~ "(?i)(error|fatal|panic)"
```

### 9. Sự kiện nghiệp vụ (audit)
```logql
{service="app"} | json | type="audit" | event=~"loan_.*|book_.*|member_.*" | line_format "{{.event}} bởi {{.by}}"
```

## Gợi ý đưa vào báo cáo

Chụp mỗi truy vấn 1 ảnh gồm: ô truy vấn, khoảng thời gian, kết quả (dòng log hoặc biểu đồ). Truy vấn 2, 3, 4 là bộ tối thiểu (yêu cầu 2-3 truy vấn); các truy vấn còn lại là điểm cộng.
