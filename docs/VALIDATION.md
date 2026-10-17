# Kiểm tra gói chuyển giao — 17/10/2026

Môi trường kiểm tra: Linux, Node v24.19.0. Kiểm tra trên thư mục xuất riêng, sử dụng dependencies đã cài của dự án nguồn, không ghi vào Site live.

| Kiểm tra | Kết quả |
|---|---|
| `bash -n scripts/codex-setup.sh` | Qua kiểm tra cú pháp |
| `npm test` | 24/24 qua, không bỏ qua bài nào |
| `npm run typecheck` | Qua, exit 0 |
| `npm run build` | Qua, đủ client/RSC/SSR; có cảnh báo chunk >500 kB |
| `npm run db:local` | Migration bảng rooms thành công trên D1 local |

Test có concurrency API tám người dùng SQLite/D1 adapter, quyền chủ phòng, token phiên, chống lặp sequence, sức chứa túi/xe, sở hữu xe, hình học 3D và ba ca hoàn chỉnh bằng bộ điều khiển tự động. Bộ test không chạy trên tám máy thật.

Không thực hiện cài dependencies từ đầu qua mạng, browser visual QA, đo FPS hoặc playtest con người trong lần chuyển giao này. Môi trường Codex mới cần chạy setup và build lại sau khi chọn repository. Không suy ra cảm giác chơi hay độ ổn định thiết bị thật từ kết quả tự động.

Chưa tạo repository GitHub hoặc publish môi trường Codex trong bước đóng gói. Chưa phát triển tính năng 0.4. Link demo và quyền truy cập hiện tại không thay đổi.
