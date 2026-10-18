# Hà Nội · Ca đêm — Codex web handoff

Source hiện tại là **0.5 visual preview**, tiếp tục game 3D góc nhìn thứ nhất dọn phố Hà Nội từ bản 0.3 (source gốc `23c89fcaf37bc662eb572d97b4b06493110b82ea`). Chơi solo hoặc phòng 1–8 người qua HTTP/D1.

Đợt hình ảnh hiện tại: **0.5 visual preview**, giữ gameplay/định dạng phòng 0.4. Phố đêm có vật liệu bề mặt riêng, cửa hàng có chiều sâu, chi tiết đô thị, đèn đường, dụng cụ và nhân vật được dựng lại. Xem `docs/VISUAL-PREVIEW-0.5.md` và `docs/ASSETS.md`; đây là bản để đánh giá bằng chơi thử, chưa xác nhận độ hoàn thiện ngang video tham chiếu hay FPS trên GPU thật.

Demo production **0.3 giữ nguyên**: https://ha-noi-ca-dem.namxuan05.chatgpt.site

**Preview chơi thử riêng:** https://ha-noi-ca-dem-preview.namxuan05.chatgpt.site — chỉ cần trình duyệt, đăng nhập tài khoản ChatGPT sở hữu Site khi được yêu cầu. Các bản sửa đã kiểm tra sẽ được cập nhật tại cùng địa chỉ này. Quy trình và phân biệt với production: `docs/PREVIEW.md`.

## Có gì trong 0.4

- Chổi gom cả vùng phía trước; lá trượt và nhập đống, kiểm tra tầm tay/vật cản dùng chung client/server.
- Xẻng hiện tải lá; phản hồi hốt, đổ xe, bàn giao và thông cống bằng hoạt ảnh/âm thanh/HUD. Đổ xe dùng được với cả hai dụng cụ.
- Ba khu dọn: hốt ít nhất 8 đơn vị và còn tối đa 2 trên đất để hoàn thành; nghỉ sinh lá 75 giây. Solo/đội 1–3 cần 1 khu, đội 4–6 cần 2, đội 7–8 cần 3, cùng mục tiêu bàn giao và cống như trước. Mục tiêu khóa theo đội lúc bắt đầu ca; vào thêm giữa ca không tăng yêu cầu.
- Tên đồng đội và **G** ping vị trí cần giúp; nhìn gần xe đầy/cống tắc để ping đúng loại. Ping tồn tại 8 giây, hồi 2 giây.
- Dãy tám mặt tiền chủ đạo với biển hiệu, mái hiên, cửa, ban công và đồ dùng riêng; bảng hướng dẫn trong cảnh và hướng dẫn chuyến bàn giao đầu tiên.
- Phòng định dạng 4, mã ca ngăn input cũ; giữ sequence và ghi D1 nguyên tử. Mất input 3 giây thì nhả xe khi có request kế tiếp; người rời/hết phiên trả rác trong túi thành đống.

Xem `docs/VALIDATION.md` để phân biệt kết quả tự động, browser và giới hạn chưa kiểm chứng. Dùng phòng mới cho bản 0.4; phòng 0.3 được báo lỗi rõ.

## Chạy trong môi trường Codex

Yêu cầu Linux, Node.js >=22.13.0 (khuyên dùng Node 24 LTS), npm/Corepack và truy cập registry gói. Dự án dùng pnpm **11.25.0** theo lockfile.

```bash
bash scripts/codex-setup.sh
npm run dev
```

Setup giữ cache trong `.sites-runtime`, cài dependencies theo lockfile, áp dụng migration D1 cục bộ, chạy test và kiểm tra TypeScript. Dev mặc định ở `http://localhost:5173`. Nếu môi trường cloud cần cổng chuyển tiếp, dùng cơ chế preview được cung cấp trong môi trường đó. Trong cloud có chuyển tiếp cổng, có thể dùng `npm run dev -- --hostname 0.0.0.0` rồi mở cổng 5173. Môi trường mới dùng profile portable mặc định; không sao chép `.sites-runtime` từ máy khác.

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

WASD/chuột: đi/nhìn; C: cúi; 1: chổi; 2: xẻng; giữ E/chuột trái: làm việc; Q: nắm/buông xe; Shift: chạy; F: khẩu trang; M: bản đồ; G: ping gọi giúp; H: trợ giúp; Esc: nghỉ/thả chuột. Khi không khóa chuột được, dùng chế độ giữ chuột phải để nhìn.

Vòng chơi: **quét thành đống → hốt vào túi → đổ xe → đẩy tới điểm tập kết → bàn giao**. Khi mưa, dùng xẻng thông cống để nước rút. Chơi một mình hoặc phòng tối đa tám người; ca 8 phút hoặc thư thả.

## Tài liệu

- `AGENTS.md`: hướng dẫn cho Codex.
- `docs/HANDOFF.md`: kiến trúc, dữ liệu và giới hạn đã biết.
- `docs/ROADMAP-0.4.md`: phạm vi và tiêu chí nghiệm thu 0.4.
- `docs/ASSETS.md`: nguồn tài nguyên hình ảnh/âm thanh.
- `tests/browser/`: playtest tùy chọn với Playwright/Chromium, dùng preview local.
- `docs/FIRST-TASK-0.4.md`: câu lệnh giao việc sẵn.
- `README-v03-original.md`: ghi chú của bản gốc trước chuyển giao.

Các kiểm tra tự động không xác nhận được chất lượng hình ảnh trên trình duyệt, cảm giác chuột, FPS thiết bị thật hoặc chơi mạng tám máy. Xem `docs/VALIDATION.md` để biết kiểm tra thực tế của gói chuyển giao.
