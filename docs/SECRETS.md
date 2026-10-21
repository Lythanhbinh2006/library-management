# Quản lý secrets

Ứng dụng hỗ trợ các biến dạng `*_FILE` (ví dụ `DB_PASSWORD_FILE`, `SESSION_SECRET_FILE` và
`ADMIN_PASSWORD_FILE`) để đọc secret từ file được mount bởi Docker/Swarm/Kubernetes. Không commit
`.env`, file backup hoặc thư mục secret vào Git. Với triển khai production, dùng Docker secrets,
Vault hoặc secret store của nền tảng để mount các file này với quyền chỉ đọc; `.env` chỉ nên dùng
cho môi trường phát triển.

Các script `setup.sh`/`setup.ps1` chỉ sinh mật khẩu dùng thử. Sau khi triển khai cần thay toàn bộ
secret, giới hạn quyền file và xoay vòng định kỳ.
