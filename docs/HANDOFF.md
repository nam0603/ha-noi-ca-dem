# Đợt hình ảnh 0.5

Gameplay và API vẫn ở định dạng 4. `lib/street-materials.ts` tạo bộ bản đồ PBR dùng chung; `public/textures/hanoi-surfaces.webp` là atlas màu mới, nguồn ở `ASSETS.md`. `lib/street-detail.ts` dựng thêm chi tiết mặt tiền và đèn đường. `lib/scene3d.ts` giữ camera/dụng cụ/giao tiếp render cũ, đổi ánh sáng đêm và mô hình hiển thị; cấu hình cao dùng tối đa bốn đèn chiếu gần camera cùng bóng directional, cấu hình thấp bỏ đèn động và bóng, giữ ánh sáng mềm có sẵn. Các light pool là xấp xỉ mỹ thuật, không phải phản xạ hình học thực. Batch có xử lý cả geometry indexed/non-indexed; props cực nhỏ không bo góc nhiều đỉnh. Giữ Site production, cập nhật Site preview riêng theo `PREVIEW.md`.

Xem `VISUAL-PREVIEW-0.5.md` cho bằng chứng kiểm tra và giới hạn.

# Bàn giao bản 0.4

Tiếp tục source 0.3 tại cuối tài liệu. Bản hiện tại giữ Three.js/Vinext/Cloudflare/D1 và các điều khiển gốc.

- `lib/game.ts`: vùng quét dùng `inSweep`/`clearPath`, bảo toàn lượng rác khi hốt/đổ/bàn giao/rời phòng; ba khu và thời gian nghỉ 75 giây; ping hữu hạn. Túi 18, xe 36, tối đa 8 người.
- `app/api/game/route.ts`: format **4**, `round` phải khớp khi input; trả snapshot đã lưu khi ca đổi. Không đổi migration D1, session token/sequence/CAS vẫn giữ. Phòng format 3 trả 409 kèm thông báo tạo phòng mới.
- `app/game-client.tsx`: hướng dẫn chuyến đầu, tiến độ khu, phản hồi hành động, ping, latency/lỗi polling/FPS; timeout 6 giây, backoff tới 1,5 giây. Lobby/kết quả chỉ poll để theo kịp ca mới. Snapshot của phiên/mã phòng cũ không cập nhật UI hiện tại. Solo chia bước tối đa 50 ms, tối đa 350 ms/khung để giữ hành vi khi FPS giảm.
- `lib/scene3d.ts`: tám mặt tiền chủ đạo, dụng cụ và tải xẻng, tên/ping trong 3D; nội suy camera/xe/đồng đội/lá là phần hiển thị, không tự sinh rác. Chế độ thấp tắt bóng và giảm mật độ pixel như trước.
- Ngắt input >3 giây nhả xe ở request kế tiếp; hết hiện diện 25 giây trả túi thành đống và chuyển host khi cần. Không có tác vụ nền chạy khi cả phòng không gửi request.
- Script setup dùng cache project, vẫn pnpm 11.25.0/frozen lockfile. `npm test` chạy trực tiếp entry `node:test` để hiện đầy đủ bài và exit status trong cloud; loại `work/` khỏi TypeScript để scratch không đi vào kiểm tra source.
- Tài liệu bằng chứng hiện tại: `VALIDATION.md`; tài nguyên: `ASSETS.md`; browser scripts tùy chọn: `tests/browser/` (cần Playwright/Chromium có sẵn).

Chưa triển khai production hoặc đổi quyền demo. Chưa có playtest con người/tám thiết bị, số FPS GPU thật hay độ trễ Internet. Browser cloud dùng SwiftShader; đọc điều kiện đo trước khi suy luận hiệu năng.

---

# Lịch sử: bàn giao bản 0.3

## Nguồn và phạm vi

- Game: Hà Nội · Ca đêm, 3D first-person, bản playtest 0.3.
- Source commit: `23c89fcaf37bc662eb572d97b4b06493110b82ea`.
- Site project: `appgprj_6ad033552ff881918de1dfc4ecf75670`.
- Gói xuất gồm source được Git theo dõi, lockfile, test và tài liệu. Không có Git history, token, runtime DB, người chơi, dependencies hay build cũ.
- Bổ sung của lần chuyển: npm scripts test/typecheck/db:local/codex:setup, cấu hình D1 local và tài liệu Codex. Các file gameplay giữ nguyên.

## Đã có

Góc nhìn thứ nhất; chuột/WASD; cúi; chổi/xẻng; gom–hốt–đổ–chở–bàn giao; túi 18 đơn vị, xe 36 đơn vị; xe đầy đi chậm; sở hữu xe và va chạm; mùa thu/mưa/hỗn hợp; ba hoặc sáu cống tùy quy mô đội; nước rút; hoa sữa/khẩu trang; solo local; phòng 1–8 người; thư thả/ca 8 phút; bản đồ, tùy chỉnh hình ảnh/âm thanh và bảng đóng góp.

## Bản đồ mã nguồn

| File | Trách nhiệm |
|---|---|
| `lib/game.ts` | Simulation dùng chung, chuyển trạng thái, nhiệm vụ, va chạm, tải trọng, thời tiết |
| `lib/scene3d.ts` | Cảnh Three.js, nhà/cây/vật liệu procedural, dụng cụ first-person, xe/nước/avatar |
| `app/game-client.tsx` | Menu, input, camera, HUD, âm thanh, solo tick và đồng bộ HTTP |
| `app/api/game/route.ts` | Tạo/vào phòng, token phiên, host, input, sequence, compare-and-swap |
| `db/schema.ts`, `drizzle/` | D1 schema và migration bảng rooms |
| `tests/game.test.mjs` | Simulation, API SQLite/D1 adapter, concurrency 8 người, dựng geometry, ca hoàn chỉnh |
| `vite.config.ts`, `build/`, `scripts/` | Vinext, Cloudflare local runtime và tích hợp Sites được giữ lại |

## Mạng và dữ liệu

Solo chạy simulation trên client. Phòng online dùng HTTP polling và snapshot authoritative trong D1, optimistic concurrency qua cột version. Không phải WebSocket server. Token riêng không được trả trong game state. Phòng quá cũ/hết hạn bị từ chối. Chuyển môi trường không chuyển các phòng đang hoạt động; không gọi vào demo production để test ghi dữ liệu.

Local D1 dùng binding `DB`, database ID giả `00000000-0000-4000-8000-000000000000` cùng tên `site-creator-d1` như Vite config. `wrangler.local.jsonc` chỉ phục vụ lệnh local; trạng thái ở `.wrangler/state`. Chạy `npm run db:local` trước test HTTP thật. Những test API sẵn có dùng SQLite in-memory, không truy cập database live.

Quyền xem/chơi của demo thuộc hệ thống hosting, không nằm trong mã phòng. Repo Private không tạo lại quyền hosting. Local runtime không có chính sách mời bạn của Site. Khi triển khai sang nền tảng khác phải tự cấu hình hosting, database, truy cập và secrets phù hợp; không giả định chỉ push GitHub là demo thay đổi.

## Giới hạn cần xác nhận bằng chơi thật

- Quét vẫn là chọn đám lá trong tầm rồi tích tiến độ; chưa có chổi đẩy từng lá theo tiếp xúc.
- Nước là biểu diễn vùng ngập và tốc độ lội, chưa mô phỏng thủy động lực.
- Đồ họa procedural lấy cảm hứng Hà Nội; không phải quét một con phố thật hay photorealistic.
- Chưa kiểm chứng browser visual QA, pointer lock, cảm giác điều khiển, FPS thật hoặc tám máy đồng thời.
- Polling HTTP cần đo độ trễ và nội suy trước khi quyết định thay transport.
- Chưa có dữ liệu playtest của người dùng/bạn bè được bàn giao; không tự bịa lỗi đã quan sát.

## Tài nguyên mỹ thuật

Giữ giấy phép của mã vendored trong `build/` và `vendor/`. Khi thêm texture/model/audio mới, ghi nguồn, giấy phép và các file trong `docs/ASSETS.md`. Ảnh AI có thể dùng làm concept hoặc xử lý thành texture; không mô tả một ảnh nền là môi trường 3D có thể đi lại. Đầu tư gần camera trước: chổi, găng tay, xẻng, lá, đường và xe.
