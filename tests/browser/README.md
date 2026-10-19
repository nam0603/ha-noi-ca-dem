# Playtest local tùy chọn

Khởi động `npm run dev`, hoặc `npm run build` rồi `npm start -- --port 5173` để thử artifact hoàn chỉnh ở một terminal, chạy `npm test` trước để tạo module simulation dùng cho bộ điều khiển full-shift. Cần môi trường có module `playwright` và Chromium (hoặc đặt `CHROMIUM_PATH`). Chúng là công cụ kiểm tra của executor, không thêm vào dependency game/lockfile. Có thể dùng `NODE_PATH` trỏ tới bộ công cụ của executor nếu cần.

```bash
node tests/browser/smoke.cjs
node tests/browser/solo-trip.cjs
node tests/browser/co-op.cjs
node tests/browser/full-shift.cjs
node tests/browser/visual.cjs
node tests/browser/third-person.cjs
```

Mặc định các script gọi `http://127.0.0.1:5173` (`third-person.cjs` có thể nhận GAME_URL cho server thử riêng), không chạy trên demo production. Kết quả/log/ảnh nằm trong `work/`, không vào Git.

`third-person.cjs` kiểm tra mặc định từ settings cũ, V/giữ V, giữ C/dụng cụ khi đổi góc, trạng thái vật lý không đổi, Cài đặt và lưu qua tải lại. Ảnh tư thế/cảnh mưa ở cả hai mức chất lượng được lưu để xem bằng mắt. Co-op kiểm tra một phiên thứ nhất và một phiên thứ ba cùng phòng.

Solo-trip dùng bàn phím và chuột, chờ theo trạng thái để không phụ thuộc FPS. Full-shift đọc ref React để quan sát, điều khiển qua keyboard/mouse handlers của game; không sửa trực tiếp tọa độ, túi, mục tiêu hay kết quả. Co-op dùng hai BrowserContext tách phiên, đi qua API/D1 local; có kiểm tra tổng rác (cộng lá sinh theo nhịp), ping, xe được nhả khi offline và kết nối lại.

Các test dùng WebGL phần mềm ở cloud. Co-op/full-shift dùng viewport CSS 640×480, DPR 0,25 (canvas 160×120) để kiểm tra logic/tương tác trong giới hạn executor. Smoke dùng ảnh 1440×900. Kết quả không đại diện FPS, cảm giác chuột, âm thanh nghe thực tế hay chơi mạng tám thiết bị. Xem `docs/VALIDATION.md`.

`visual.cjs` kiểm tra asset WebP trả 200, cảnh phố/cửa hàng, chổi/xẻng, chuyển chất lượng cao → thấp và vào cảnh mưa qua UI thực; lưu ảnh 960×600 và console errors. Dùng ảnh để đánh giá, không dùng unit test hoặc một con số FPS software renderer để kết luận đẹp/mượt.

`polish.cjs` kiểm tra hồi quy 0.7: đảo pitch ở hai giới hạn, V, đi tới bảng với collider chung, thay nội dung ping3D trước khi hết hạn; hai phiên kiểm tra leave thất bại/vào lại, request có delay/jitter chủ động, offline trên25giây/chuyển host/vào lại thủ công. Chạy `POLISH_SCENARIO=visual node tests/browser/polish.cjs` hoặc `POLISH_SCENARIO=network node tests/browser/polish.cjs` để tách lượt; `GAME_URL` mặc định local5173. Các hook chỉ đọc state/matrix/canvas text, thao tác qua UI/input thật; delay/offline là fault injection, không phải benchmark Internet.

Khi dựng lại `dist` thì dừng và khởi động lại Worker local trước lượt kiểm tra kế tiếp để HTML/asset manifest cùng một bản.

## Kiểm tra HTTP không cần GPU

Từ gốc repository, chạy `npm test` trước để tạo module helper, áp dụng D1 local bằng `npm run db:local` nếu chưa có, rồi giữ Worker local ở cổng 5173 (`npm run dev` hoặc build/start như trên). Sau đó:

```bash
node tests/http/input-history.mjs
```

Script chỉ gọi `http://127.0.0.1:5173`, không có tùy chọn URL ngoài. Hai client kiểm tra lịch sử input 20 Hz dưới delay chủ động, ACK/sequence khi leave thất bại rồi vào lại, khối lượng rác/sức chứa, và host im lặng trên 25 giây trong khi guest poll rồi vào lại thủ công. Kết quả lưu ở `work/http-input-history-result.json`; cần khoảng 35 giây, không dùng browser hoặc sửa trực tiếp DB/state.

Đây là kiểm tra HTTP/Worker/D1 theo **thời gian input được giữ lại**, không xác nhận UI, GPU hay công bằng tốc độ theo thời gian thực dưới jitter. Lượt tham chiếu 0.7 có delay thay đổi 120/440/180/600 ms đã trim khoảng 21% lịch sử; con số này là kết quả một lượt fault injection, không phải mức cố định hoặc benchmark Internet.
