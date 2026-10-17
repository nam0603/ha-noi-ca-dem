# Kiểm chứng 0.4 — 18/10/2026 (Asia/Saigon)

Môi trường Linux cloud, Node v24.19.0, pnpm 11.25.0, Chromium/Playwright và D1 local qua Wrangler. Không gọi ghi dữ liệu vào Site production.

## Baseline và setup

- Đã đọc AGENTS, README, HANDOFF, VALIDATION và ROADMAP-0.4 trước thay gameplay.
- Baseline: `npm test`, `npm run typecheck`, `npm run build` qua. Chạy trực tiếp entry test xác nhận đủ 24 bài baseline. Runner con `node --test` trong executor chỉ hiện tóm tắt một tệp; script hiện chạy trực tiếp `node:test` để hiển thị đầy đủ bài/exit status.
- `npm run db:local` ban đầu lỗi `listen EPERM 127.0.0.1`; chạy với quyền mở loopback đã thành công.
- Corepack mặc định tìm cache home không tồn tại. Sửa setup để dùng cache project. Đã chạy `bash scripts/codex-setup.sh` trên bản sao sạch ở `work/setup-probe`: tải 648 dependency packages bằng frozen lockfile, migrate D1 mới, test và TypeScript đều qua. Không sửa lockfile/đổi package manager.

## Kiểm tra source cuối

| Lệnh | Kết quả |
|---|---|
| `npm test` | 33/33 qua, không skip |
| `npm run typecheck` | Qua, exit 0 |
| `npm run build` | Qua client/RSC/SSR; còn cảnh báo chunk >500 kB và phân loại route của Vinext |
| `bash -n scripts/codex-setup.sh` | Qua |
| `git diff --check` | Qua |

Bài hành vi kiểm tra vùng quét/hướng nhìn/tầm tay/vật cản, cụm lá dịch chuyển/nhập đống, sức chứa, lượng rác qua hốt/đổ/bàn giao/rời phòng/hết phiên và các phần lẻ 0,001; không xuyên cây khi bước lớn; khu hoàn thành và nghỉ sinh lá 75 giây; ping và replay; format phòng/round/token/host/CAS.

Tám client giả lập cùng SQLite/D1 adapter thực hiện nhiều vòng quét/hốt/input lặp và hết phiên: tổng lượng rác giữ nguyên, túi/xe không vượt tải, xe được nhả và túi trả thành đống. Đây không phải tám máy hoặc tám browser thật.

Ba ca đầy đủ bằng bộ điều khiển đi bộ với va chạm thực qua simulation: thu 88 giây, mưa 156 giây, hỗn hợp 121 giây (thời gian mô phỏng, seed fixture cố định). Có bàn giao, khu sạch và cống. Không dùng thời gian này làm bằng chứng FPS/cảm giác chơi.

## Browser và HTTP/D1 thật cục bộ

Các script tại `tests/browser/` cần Playwright/Chromium của executor; chạy sau `npm run dev` và `npm test`. Script không sửa trực tiếp state game.

| Lệnh | Quan sát |
|---|---|
| `node tests/browser/smoke.cjs` | Menu 3D/tiếng Việt mở được; ảnh 1440×900 đã xem; không có pageerror/console error |
| `node tests/browser/solo-trip.cjs` | Pointer lock, bàn phím/chuột; quét → hốt → đổ xe → nắm/đẩy → bàn giao, ping/bản đồ/tạm nghỉ/tiếp tục/menu; Q đang chờ được xóa khi tạm nghỉ; bàn giao hết tải 2 đơn vị; không có lỗi runtime |
| `node tests/browser/co-op.cjs` | Hai BrowserContext tách phiên tạo/vào cùng phòng, bắt đầu, quét/hốt, nhận cùng ping; tổng rác đúng sau cộng lá sinh theo nhịp; xe được nhả khi chủ xe offline, reconnect thành công |
| `node tests/browser/full-shift.cjs` | Ca tự động qua keyboard/mouse handlers: 118.5 giây mô phỏng/122.1 giây thực của script, bàn giao 37, hoàn thành 1 khu; kết quả/nhận ca mới/menu đều qua, không lỗi runtime |

Lượt co-op cuối ghi 58 phản hồi HTTP đều 200; latency request p50 60,236 ms, p95 122,699 ms trên loopback. Có 4 lỗi mạng dự kiến do chủ động offline một context; không có lỗi runtime ngoài các lỗi mạng cố ý. Đây là mẫu ngắn trong executor, có tải build đồng thời ở một phần lượt chạy; không phải benchmark Internet.

Điều kiện browser: WebGL phần mềm SwiftShader, low; solo-trip CSS/canvas 640×480 DPR 1; co-op/full-shift CSS 640×480 DPR 0,25 (canvas 160×120) để không nghẽn executor. Lượt ban đầu 1280×720 chỉ khoảng 1 FPS, thời gian giữ phím ngắn không đủ khung; chuyển bài kiểm tra sang chờ theo trạng thái. Full-shift cuối lấy mẫu HUD 7–24 FPS ở canvas 160×120 nói trên; không suy ra hiệu năng ở độ phân giải chơi thật/GPU thật.

Browser phát hiện mã ca solo không tăng khi nhận ca mới; đã sửa để reset nội suy đúng. Bộ điều khiển browser cũng được thêm lùi ra khi lá nằm dưới chân, như thao tác người chơi cần thực hiện để đặt lá phía trước chổi. Không đổi luật quét sau lưng để làm test qua. Kiểm tra ảnh cuối phát hiện bounds rỗng khiến tải lá trên xẻng bị cull; đã tắt culling cho nhóm instancing động này, xem lại ảnh thấy tải lá và chạy lại chuyến bàn giao/test/TypeScript/build đều qua.

## Giới hạn

- Chưa có playtest con người, tám thiết bị, Internet có jitter dài hạn hoặc kiểm tra cảm giác chuột/GPU thật. Không khẳng định đẹp/mượt/vui từ số test hoặc số mesh.
- Chưa kiểm tra nghe âm thanh bằng tai, điều khiển cảm ứng trên máy thật hoặc toàn bộ ca mưa/hỗn hợp qua browser. Chúng có kiểm tra simulation; browser full shift là mùa thu.
- Người/xe kiểm tra footprint nhà, cây và biên; đồ trang trí nhỏ chưa có collider riêng.
- Lá là cụm đơn vị được đẩy/gom, không mô phỏng vật lý từng chiếc lá. Nước là vùng ngập và tốc độ lội, không phải thủy động lực.
- Vẫn HTTP polling; xe nhả sau 3 giây không có input khi request kế tiếp đến, hết hiện diện 25 giây thì trả túi thành đống. Khi cả phòng ngừng request, không có worker nền chạy tick.
- Phòng format 3 không di trú sang format 4: cần tạo phòng mới. Không đổi schema D1, identity hosting hoặc quyền demo.
- Vẫn có cảnh báo chunk lớn. Dev HMR của Vinext từng báo nhiều renderer cùng context; các lượt browser trên trang tải mới không có lỗi runtime.
- Không triển khai production. Mọi DB/room/browser nêu trên là cục bộ.

## Mở preview

```bash
cd /workspace/ha-noi-ca-dem
npm run dev -- --hostname 0.0.0.0
```

Chưa tạo URL hosted preview riêng trong tác vụ này. Mở `http://localhost:5173` nếu ở cùng máy; trong giao diện cloud có Ports/Preview, chuyển tiếp và mở cổng **5173**. Nếu khởi tạo môi trường mới, chạy `bash scripts/codex-setup.sh` trước. Không cần token Cloudflare hay OpenAI cho local. Chọn Mùa lá rụng/Thư thả để làm chuyến đầu; C + E quét, 2 + E hốt, nhìn xe + E đổ, Q nắm xe, tới ô vàng rồi E bàn giao. G ping, M bản đồ, Esc nghỉ. Hai cửa sổ dùng cùng URL preview và mã phòng.
