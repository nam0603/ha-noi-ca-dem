# Phố đêm — visual preview 0.5

Đợt thử hình ảnh theo video người dùng gửi của Project Long Quân / Long Quân Trở Lại. Mục tiêu là một phố Hà Nội chi tiết hơn có thể chơi thật trong trình duyệt. Không tuyên bố đã đạt chất lượng tương đương clip hoặc hiệu năng trên thiết bị thật.

## Đã dựng

- Giữ Three.js, góc nhìn thứ nhất, map/collision, gameplay và định dạng phòng **4**. Không thay luật quét–hốt–đổ–bàn giao, vận chuyển, cống, solo hay phòng tối đa tám người.
- Tám loại mặt tiền có tầng trệt lõm, kính/cửa cuốn, trần/quầy/kệ hàng có chiều sâu, biển hiệu và menu riêng. Bổ sung lan can, giàn nóng điều hòa có lồng quạt, đường ống, đồng hồ điện, cột trang trí, rèm và đồ phơi. Cửa hàng là geometry trang trí trong footprint bị chặn, không mở thêm nội thất có thể đi vào.
- Xe máy có lốp/vành, thân bo, yên, đèn, gương, biển và chân chống. Tăng chiều cao tán cây, dây điện võng, lớp mái nhà phía xa. Hình học chỉ phục vụ hiển thị, chưa thêm collider riêng cho từng đồ vật nhỏ.
- Bộ map màu/nhám/height dùng chung cho bảy vật liệu; thêm atlas màu gốc tạo bằng AI cho tường, gỗ và vỉa hè. Xem `ASSETS.md`. Không dùng ảnh/video tham chiếu làm bối cảnh hoặc texture.
- Ánh sáng đêm lạnh/ấm, tám vị trí đèn đường, cấu hình cao chọn tối đa bốn spotlight gần camera. Chỉ directional light đổ bóng. Cấu hình thấp tắt bóng và bốn đèn động, giữ lớp sáng mềm có sẵn, giới hạn pixel ratio 0,75 (hoặc DPR thiết bị nếu thấp hơn). Môi trường phản xạ đêm được tổng hợp, vũng ẩm có độ nhám thấp; không có ray tracing hoặc phản chiếu chính xác các căn nhà.
- Găng tay có ngón, lá có gân, cán gỗ và mặt xẻng kim loại, thùng xe có thành và gân, đồng đội có thân/đầu/mũ tròn hơn và chuyển động bước đi theo nội suy vị trí. Các chuyển động này không ghi vào simulation.
- Nhãn menu/HUD: `PHỐ ĐÊM · VISUAL PREVIEW 0.5`, giờ mỹ thuật 22:40. Đây là thời điểm cố định của cảnh, không phải hệ thống ngày/đêm mới.

## Hiệu năng và lỗi đã sửa

Mapped meshes cũng được batch, thay vì mỗi tấm tường thành một draw call. Geometry indexed/non-indexed được chuẩn hóa trước khi ghép; lỗi merge không còn làm mất props một cách im lặng. Đồ vật rất nhỏ dùng box thường thay vì bevel nhiều đỉnh. Chổi/xẻng/găng tay được batch theo nhóm chuyển động. Texture surface tối đa 512² và dùng lại cho nhiều mặt tiền; atlas nguồn khoảng 515 KiB cùng origin.

Hot reload từng làm canvas mất WebGL context vì cleanup gọi forceContextLoss rồi lập tức dùng lại canvas. Cleanup hiện dispose tài nguyên mà không ép mất context; khởi tạo thành công xóa thông báo lỗi cũ, lỗi thật được ghi vào console. Bản dựng public không dùng hot reload.

## Kiểm chứng

Baseline trước sửa: `npm test`, `npm run typecheck`, `npm run build` đều qua. Bài test scene được tăng kiểm tra lỗi batch, geometry hữu hạn, ngân sách geometry và số đèn động; các bài bảo toàn rác, concurrency và ca hoàn chỉnh giữ nguyên.

Browser scripts dùng Chromium/SwiftShader của executor, không thêm dependencies vào game. Browser kiểm tra cuối dùng artifact của `npm run build`, chạy bằng `npm start -- --port 5173` với D1 local; không ghi phòng thử vào Site production. Test quan sát ref game theo shape thay vì tên component để chạy được trên bundle minified, không sửa state chơi trực tiếp.

Kết quả trên source cuối ngày 2026-10-18:

| Kiểm tra | Kết quả thực tế |
|---|---|
| `npm test` | 33/33 qua; có các bài bảo toàn rác, tám client giả lập và ca autumn/rain/mixed hoàn chỉnh |
| `npm run typecheck` | Exit 0 |
| `npm run build` | Exit 0, client/RSC/SSR; vẫn có cảnh báo chunk >500 kB và phân loại route Vinext |
| `git diff --check` / cú pháp browser scripts | Qua |
| `node tests/browser/visual.cjs` | Qua: menu, phố, mặt tiền, chổi/xẻng, đổi cao → thấp, cảnh mưa; texture trả 200, errors[] |
| `node tests/browser/solo-trip.cjs` | Qua: quét → hốt → đổ → nắm/đẩy → bàn giao 2 đơn vị, ping, bản đồ, nghỉ/tiếp tục/menu; errors[] |
| `node tests/browser/co-op.cjs` | Qua: hai BrowserContext, quét/hốt chung, ping, bảo toàn rác, offline/nhả xe/reconnect; 57 phản hồi API đều 200, runtimeErrors[] |
| `node tests/browser/full-shift.cjs` | Qua: thắng qua input UI; score 51, 1 khu sạch; 184.460 giây simulation / 189.852 giây thực; màn kết quả, nhận ca mới và menu đều qua; errors[] |

Scene dựng trong Node (không DOM/texture) có 156 mesh batches và 214923 vertices, dưới giới hạn geometry của bài test. Đây không phải số draw call đo trên GPU/browser.

Browser render: CSS 960×600, DPR 1; cấu hình cao canvas 960×600, thấp canvas 720×450. Hai mẫu HUD FPS trong lượt visual đều 1 FPS trên renderer phần mềm. Đây là mẫu tức thời, không phải FPS trung bình hoặc benchmark GPU thật. Solo-trip dùng CSS 640×480, thấp, DPR 1 (canvas 480×360). Co-op dùng hai phiên CSS 640×480, DPR0,25 (canvas 160×120) trong cùng Chromium; không phải hai thiết bị độc lập. Độ trễ HTTP loopback của 57 phản hồi: p50 **24,962 ms**, p95 **57,166 ms**; không đại diện mạng Internet. Có 4 console network errors do chủ động đặt một context offline; không có lỗi runtime còn lại. Snapshot bên còn lại quan sát xe được nhả sau **5301 ms** tính từ lúc đặt offline, gồm thời gian chờ poll/response/render.

Full-shift dùng cấu hình thấp, CSS 640×480, DPR 0,25 (canvas 160×120). Các mẫu HUD FPS: 3, 8, 5, 5, 5, 9, 7, 7, 6, 6, 5, 8, 6, 4, 5, 9. Không dùng các mẫu này để suy ra hiệu năng GPU thật. Ca mưa/hỗn hợp hoàn chỉnh được kiểm tra ở simulation; chưa chạy cả hai ca đó trọn vẹn trong browser. Chưa nghe thử audio, kiểm tra cảm ứng hoặc chơi tám thiết bị.

Lượt co-op đầu thất bại vì test ngủ cố định 4,1 giây rồi đọc snapshot trước đó. Đọc DB local của chính phòng thử cho thấy xe đã có owner=null ở bản ghi khi input chủ xe cũ 4488 ms. Test được sửa để chờ snapshot thật trong deadline 15 giây; không đổi luật server nhả xe sau input cũ hơn 3000 ms ở request kế tiếp. Không sửa state hoặc gọi thẳng simulation để làm browser test qua.

Một lượt dựng lại artifact trong lúc Wrangler còn chạy cũng làm tiến trình local trả manifest HTML cũ và JS/CSS 404. Đã dừng/khởi động lại từ artifact cuối; xác nhận HTML cùng các asset được tham chiếu đều 200 trước browser test cuối. Không quy lỗi này cho bản hosted hoặc âm thầm bỏ qua lỗi console.

Ảnh/JSON/log của lượt cuối nằm trong `work/visual-*.png`, `work/visual-browser-result.json`, `work/browser-*-result.json`, `work/visual-*.log`. Chỉ các file có timestamp của lượt 2026-10-18 được dùng cho báo cáo này. Thông tin deployment được ghi trong `PREVIEW.md`.

## Giới hạn mỹ thuật

Đây vẫn là cảnh dựng mô-đun, chưa có bộ asset nhân vật/quét photogrammetry, motion capture hoặc giàn dựng ánh sáng ở quy mô studio như clip. Mật độ dân cư/xe chạy chưa được thêm vào ca dọn đêm. Texture màu có vết nứt/chip không đồng nghĩa bề mặt đã có displacement tương ứng. Chất lượng ảnh, độ rõ rác trong tối và độ mượt cần người dùng đánh giá trên máy thật; bài test không quyết định các nhận xét đó.
