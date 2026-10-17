# Hà Nội · Ca đêm — Codex web handoff

Mã nguồn đầy đủ bản **0.3**, game 3D góc nhìn thứ nhất dọn phố Hà Nội, được xuất từ commit `23c89fcaf37bc662eb572d97b4b06493110b82ea` của Site hiện tại. Bản chuyển này bổ sung cấu hình chạy và tài liệu; chưa triển khai tính năng 0.4.

Demo đang có: https://ha-noi-ca-dem.namxuan05.chatgpt.site

## Chạy trong môi trường Codex

Yêu cầu Linux, Node.js >=22.13.0 (khuyên dùng Node 24 LTS), npm/Corepack và truy cập registry gói. Dự án dùng pnpm **11.25.0** theo lockfile.

```bash
bash scripts/codex-setup.sh
npm run dev
```

Setup cài dependencies theo lockfile, áp dụng migration D1 cục bộ, chạy test và kiểm tra TypeScript. Dev mặc định ở `http://localhost:5173`. Nếu môi trường cloud cần cổng chuyển tiếp, dùng cơ chế preview được cung cấp trong môi trường đó. Môi trường mới dùng profile portable mặc định; không sao chép `.sites-runtime` từ máy khác.

```bash
npm test
npm run typecheck
npm run build
```

**Backend dùng Cloudflare Workers/D1 qua Vinext/Vite**, không chạy bằng cách đổi thẳng sang `next dev`. Không cần Cloudflare token hay OpenAI API key để phát triển và test cục bộ. Chơi mạng cục bộ dùng DB được giả lập bởi Wrangler; dữ liệu phòng và quyền truy cập của demo không được sao chép sang đây.

## Đưa vào Codex web

1. Tạo repository GitHub **Private**, ví dụ `ha-noi-ca-dem`. Đưa nội dung thư mục dự án này vào gốc repo, gồm `.openai`, `.gitignore`, `.npmrc`, `AGENTS.md` và lockfile. Không chỉ tải tệp ZIP lên GitHub: Codex cần các tệp đã giải nén.
2. Mở Codex web/ChatGPT → **Work in → Cloud → Create environment**. Chọn đúng repo GitHub; cấp quyền cho repo này nếu danh sách chưa hiện.
3. Chọn **Get started**. Yêu cầu Codex dùng Node 24, chạy `bash scripts/codex-setup.sh`, rồi `npm run build`. Bật truy cập package registries nếu cài gói bị chặn.
4. Khi setup và các kiểm tra thành công, chọn **Publish**, chờ **Environment published**, rồi **Start a new task**.
5. Dán nội dung `docs/FIRST-TASK-0.4.md` để phát triển tiếp.

Nếu đã có môi trường cho game khác như `cell-rush`, hãy tạo môi trường riêng cho dự án này. Publish môi trường chỉ lưu cấu hình làm việc của Codex, không xuất bản một bản game mới.

## Điều khiển

WASD/chuột: đi/nhìn; C: cúi; 1: chổi; 2: xẻng; giữ E/chuột trái: làm việc; Q: nắm/buông xe; Shift: chạy; F: khẩu trang; M: bản đồ; H: trợ giúp; Esc: nghỉ/thả chuột. Khi không khóa chuột được, dùng chế độ giữ chuột phải để nhìn.

Vòng chơi: **quét thành đống → hốt vào túi → đổ xe → đẩy tới điểm tập kết → bàn giao**. Khi mưa, dùng xẻng thông cống để nước rút. Chơi một mình hoặc phòng tối đa tám người; ca 8 phút hoặc thư thả.

## Tài liệu

- `AGENTS.md`: hướng dẫn cho Codex.
- `docs/HANDOFF.md`: kiến trúc, dữ liệu và giới hạn đã biết.
- `docs/ROADMAP-0.4.md`: phạm vi và tiêu chí nghiệm thu bản tiếp theo.
- `docs/FIRST-TASK-0.4.md`: câu lệnh giao việc sẵn.
- `README-v03-original.md`: ghi chú của bản gốc trước chuyển giao.

Các kiểm tra tự động không xác nhận được chất lượng hình ảnh trên trình duyệt, cảm giác chuột, FPS thiết bị thật hoặc chơi mạng tám máy. Xem `docs/VALIDATION.md` để biết kiểm tra thực tế của gói chuyển giao.
