# Theo bước — preview 0.6

Yêu cầu: camera thứ ba sau vai làm mặc định, V đổi góc thứ nhất/thứ ba, nhân vật/dụng cụ/động tác tương ứng, giữ vòng chơi và cập nhật cùng Site preview riêng.

## Hành vi

- Camera sau vai phải, cách nhân vật khoảng 3 m. Chuột quay hướng nhân vật; WASD di chuyển theo hướng này. C cúi để dọn, không ép camera thứ ba chúc xuống. V chỉ đổi hiển thị; giữ C/E/Q hoặc dụng cụ không bị xóa khi đổi góc.
- Camera lấy thể tích vật cản tĩnh từ scene trước khi batch, dùng lưới không gian để kiểm tra khoảng đệm 0,22 m. Thu ngay trước tường/mái hiên/đồ vật, trở lại khoảng cách bình thường dần. Điểm theo hạ dần khi cúi. Khi sát tường không đủ chỗ, thân local được ẩn để giữ tầm nhìn. Không dò mọi tam giác của phố ở mỗi frame.
- Nhân vật toàn thân có áo phản quang trước/sau, mũ, găng, ủng, khẩu trang, túi; chân/gối/khuỷu và hai tay bám cán chổi/xẻng. Có tư thế đi, cúi, quét, hốt, đổ và đẩy xe. Tải xẻng là biểu diễn túi, không sinh thêm rác. Cả đồng đội và người chơi local dùng cùng rig. Chỉ diễn động tác dọn khi có việc hợp lệ trong tầm.
- Góc thứ nhất giữ chổi/xẻng/tay phía trước, ẩn thân local. Camera có trong Cài đặt và nút cảm ứng; tùy chọn được lưu trên máy. Settings cũ thiếu `view` dùng thứ ba, lựa chọn thứ nhất đã lưu được giữ sau tải lại.
- Vòng sáng trên mục tiêu và HUD chỉ việc mà nhân vật thực sự với tới; tâm ngắm màn hình chỉ hiện ở góc thứ nhất. Bảng trong cảnh nhắc phím V.

`lib/game.ts`, API, định dạng phòng **4**, tầm tay/hướng/cúi, sức chứa và bảo toàn rác giữ nguyên. Không gửi camera lên server. Hai người cùng phòng có thể dùng hai camera khác nhau.

## Kiểm chứng

Baseline trước sửa: `npm test` 33/33, `npm run typecheck`, `npm run build` qua. Kiểm tra mới kiểm tra camera trước tường/mái hiên, điểm đặt trong scene thật, hướng nhìn khi sát vật cản, phục hồi khoảng cách, tư thế/giới hạn tải/tay bám cán và không trôi tọa độ nhân vật. Kết quả trên source cuối (18/10/2026):

| Lệnh | Kết quả thực tế |
|---|---|
| `npm test` | 35/35 qua; gồm camera/rig, bảo toàn rác, tám client giả lập và ca autumn/rain/mixed hoàn chỉnh |
| `npm run typecheck` | Exit 0 |
| `npm run build` | Exit 0 client/RSC/SSR; còn cảnh báo chunk >500 kB và phân loại route Vinext |
| `git diff --check`, cú pháp browser scripts | Qua |
| `node tests/browser/third-person.cjs` | Qua: settings cũ mặc định thứ ba, V/giữ V, giữ C và dụng cụ khi đổi góc, vị trí/túi/xe không đổi, Cài đặt/lưu cả hai camera qua reload, ảnh cao/thấp và cảnh mưa; errors[] |
| `node tests/browser/solo-trip.cjs` | Qua: quét–hốt–đổ–nắm/đẩy–bàn giao 3 đơn vị, ping, bản đồ, nghỉ/tiếp tục/menu; errors[] |
| `node tests/browser/full-shift.cjs` | Thắng ca mùa thu qua input UI; score24.132, một khu sạch; 91.596 giây simulation / 99.236 giây thực; kết quả, nhận ca mới, menu qua; errors[] |
| `node tests/browser/co-op.cjs` | Hai context cùng phòng, một thứ nhất/một thứ ba; quét/hốt/ping chung, bảo toàn rác, offline/nhả xe/reconnect qua; 70 response HTTP200, runtimeErrors[] |

Third-person dùng CSS960×600, DPR0,75; cả cấu hình cao/thấp có canvas720×450 do DPR của context. Ảnh đứng/cúi/quét/hốt/đẩy xe, góc thứ nhất và mưa đã được mở xem; các mẫu HUD trong ảnh là 1 FPS trên renderer phần mềm. Solo-trip dùng CSS640×480, DPR1, cấu hình thấp (canvas480×360).

Full-shift/co-op dùng Chromium/SwiftShader, CSS640×480, DPR0,25 (canvas160×120), cấu hình thấp. Full-shift có các mẫu HUD FPS4,7,5,5,8,5,7,9. Đây không phải benchmark GPU hoặc playtest người thật. Co-op là hai BrowserContext trong một Chromium; p50 **20,189 ms**, p95 **54,35 ms** ở loopback; ba lỗi mạng do đặt offline chủ động, quan sát xe nhả sau **4419 ms** (gồm chờ poll/response/render). Không dùng kết quả này suy ra Internet/tám thiết bị.

Scene Node giữ 156 static mesh batches/214923 geometry vertices như đợt 0.5; rig có 28 meshes/15314 geometry vertices mỗi người (không phải đo draw calls hay GPU cost). Vật liệu được batch theo phần chuyển động, dùng lại trong mỗi rig và dispose khi người rời.

Log/JSON: `work/third-person-unit.log`, `work/third-person-typecheck.log`, `work/third-person-build.log`, `work/third-person-full-shift.log`, `work/third-person-coop.log`, `work/browser-full-shift-result.json`, `work/browser-coop-result.json`, `work/third-person-browser-final.log`, `work/third-person-solo-trip.log`, `work/browser-third-person-result.json`, `work/browser-solo-result.json`, ảnh `work/third-person-*.png`. Browser kiểm tra ref chỉ để đọc, điều khiển qua handler thật; không sửa trực tiếp state chơi.

Sau thời gian gián đoạn, lượt browser đầu gặp ERR_CONNECTION_REFUSED vì Worker local đã dừng. Đã khởi động lại từ artifact cuối; mọi asset được tải trả200 và chạy lại third-person/solo-trip đều qua. Không sửa gameplay để làm test qua.

## Giới hạn

Rig/hoạt ảnh hiện là procedural, chưa có motion capture hay bộ nhân vật mỹ thuật ngang clip tham chiếu. Cúi/đổi tư thế và nội suy HTTP còn cần đánh giá cảm giác trên máy thật. Camera dùng bounds bảo thủ nên có thể thu sớm ở góc đồ vật; không tránh tán lá instanced, xe/đồng đội động, và không thay collider gameplay cho đồ trang trí nhỏ. Góc ngẩng camera thứ ba giới hạn để không đi dưới đất; V vẫn cho phép nhìn theo góc thứ nhất.

Ca mưa/hỗn hợp hoàn chỉnh chỉ được kiểm tra bằng simulation; browser thử cảnh mưa, chưa chạy trọn hai ca đó. Nút camera cảm ứng có trong DOM, chưa kiểm tra cảm ứng trên thiết bị thật. Chưa kiểm tra browser đã đăng nhập trên URL hosted.

Browser cloud là Chromium/SwiftShader. Ảnh và thao tác tự động không chứng minh FPS GPU thật, cảm giác chơi, tám máy qua Internet hoặc chất lượng đồ họa ngang clip. Không đổi quyền xem Site, không cập nhật production cũ.
