# Hướng dẫn nộp bài

## 1. Đặt thông tin Git theo MSSV

```bash
git config user.name  "<Họ tên>"
git config user.email "<email đăng ký GitHub>"
# Repo trong gói này có 4 commit tạo sẵn với tác giả tạm. Đổi tác giả cho tất cả commit:
git rebase -r --root --exec 'git commit --amend --reset-author --no-edit'
git log --format='%h %an <%ae> %s'
```

## 2. Tạo repo trên GitHub và đẩy mã

1. Tạo tài khoản GitHub đặt tên theo MSSV (ví dụ `sv2312345`) và repo (ví dụ `library-management`), **không** tích "Add README".
2. Đẩy mã:
   ```bash
   git remote add origin https://github.com/<tai-khoan>/library-management.git
   git branch -M main
   git push -u origin main
   ```
3. Kiểm tra trên GitHub: có 4 commit, README hiển thị, **không** có file `.env`.

## 3. Điền thông tin cá nhân

- README.md: dòng `Sinh viên: ...`.
- Báo cáo: bìa ngoài (họ tên, MSSV, lớp, giảng viên, đề tài).

## 4. Chuẩn bị demo

```bash
docker compose down -v          # dọn sạch
./scripts/setup.sh              # sinh .env mới
docker compose up -d --build
./scripts/check.sh              # tất cả [OK]
```
Thứ tự demo gợi ý (khớp thang điểm): GitHub -> website + pgAdmin -> Nginx (headers, HTTPS) -> Prometheus/Grafana -> Loki/LogQL -> hardening -> `docker compose ps`.
