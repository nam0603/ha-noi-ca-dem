# Playtest local tùy chọn

Khởi động `npm run dev` ở một terminal, chạy `npm test` trước để tạo module simulation dùng cho bộ điều khiển full-shift. Cần môi trường có module `playwright` và Chromium (hoặc đặt `CHROMIUM_PATH`). Chúng là công cụ kiểm tra của executor, không thêm vào dependency game/lockfile. Có thể dùng `NODE_PATH` trỏ tới bộ công cụ của executor nếu cần.

```bash
node tests/browser/smoke.cjs
node tests/browser/solo-trip.cjs
node tests/browser/co-op.cjs
node tests/browser/full-shift.cjs
node tests/browser/visual.cjs
```

Tất cả script chỉ gọi `http://127.0.0.1:5173`, không chạy trên demo production. Kết quả/log/ảnh nằm trong `work/`, không vào Git.

Solo-trip dùng bàn phím và chuột, chờ theo trạng thái để không phụ thuộc FPS. Full-shift đọc ref React để quan sát, điều khiển qua keyboard/mouse handlers của game; không sửa trực tiếp tọa độ, túi, mục tiêu hay kết quả. Co-op dùng hai BrowserContext tách phiên, đi qua API/D1 local; có kiểm tra tổng rác (cộng lá sinh theo nhịp), ping, xe được nhả khi offline và kết nối lại.

Các test dùng WebGL phần mềm ở cloud. Co-op/full-shift dùng viewport CSS 640×480, DPR 0,25 (canvas 160×120) để kiểm tra logic/tương tác trong giới hạn executor. Smoke dùng ảnh 1440×900. Kết quả không đại diện FPS, cảm giác chuột, âm thanh nghe thực tế hay chơi mạng tám thiết bị. Xem `docs/VALIDATION.md`.

`visual.cjs` kiểm tra asset WebP trả 200, cảnh phố/cửa hàng, chổi/xẻng, chuyển chất lượng cao → thấp và vào cảnh mưa qua UI thực; lưu ảnh 960×600 và console errors. Dùng ảnh để đánh giá, không dùng unit test hoặc một con số FPS software renderer để kết luận đẹp/mượt.
