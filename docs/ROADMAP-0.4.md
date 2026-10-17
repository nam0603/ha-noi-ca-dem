# Mục tiêu bản 0.4

Một đoạn phố nhỏ chơi vui hơn, dễ hiểu hơn và có thể test phối hợp. Giữ góc nhìn thứ nhất và cơ chế cốt lõi. Không hứa đồ họa như ảnh chụp chỉ bằng thêm texture.

## Phạm vi theo thứ tự

1. **Quét đã tay:** một nhát quét tác động vùng hợp lý phía trước; lá dịch chuyển theo hướng quét, gom chung thành đống; không quét xuyên tường hoặc sau lưng. Client và server dùng cùng luật, rác không tự sinh thêm do đồng bộ.
2. **Hốt–đổ rõ ràng:** xẻng hiển thị lượng lá đang mang, hoạt ảnh/âm thanh hốt và đổ, gợi ý thao tác đúng mục tiêu; giảm việc đổi dụng cụ vụn vặt.
3. **Hoàn thành từng khu:** 3–4 vùng dọn; mục tiêu sạch đo được, thông báo hoàn thành và khoảng nghỉ phát sinh lá; tổng mục tiêu vẫn hợp lý ở solo và đội đông.
4. **Hỗ trợ đồng đội:** tên nhân vật, ping vị trí cần giúp, báo xe đầy/cống tắc. Đánh giá đóng góp gồm vận chuyển và thông cống.
5. **Một đoạn phố có chủ đích:** 6–8 mặt tiền khác nhau, tỷ lệ cửa/ban công/mái hiên tốt, vật liệu và ánh sáng thống nhất. Ưu tiên vật thể gần camera, giữ chất lượng thấp cho máy yếu.
6. **Ổn định:** đo latency, lỗi polling, FPS; nội suy vị trí nếu phù hợp; xử lý mất kết nối và nhả xe. Chỉ đổi sang WebSocket khi có căn cứ và kế hoạch hosting phù hợp.
7. **Onboarding:** hướng dẫn ngắn quét → hốt → đổ xe → bàn giao ngay trong cảnh.

## Tiêu chí nghiệm thu

- Người mới có thể thực hiện một chuyến bàn giao theo hướng dẫn trong game.
- Khu đã hoàn thành sạch lên rõ và có thời gian giữ thành quả.
- Các thao tác tôn trọng hướng nhìn, tầm tay và va chạm.
- Hai người cùng quét/hốt không nhân đôi hay làm mất rác; túi và xe không vượt sức chứa.
- Tám người giả lập vẫn qua bài kiểm tra đồng bộ; test hai trình duyệt nếu có công cụ. Ghi riêng trạng thái chưa test tám thiết bị.
- `npm test`, `npm run typecheck`, `npm run build` qua; test mới phải kiểm chứng hành vi đã đổi.
- Nếu có browser: kiểm tra menu, solo, tương tác, vào phòng, chuyển cảnh, kết quả và console; báo điều kiện đo FPS. Nếu không có browser, báo rõ giới hạn.
- Ghi asset license; không dùng ảnh concept để giả lập kết quả 3D đã có.

## Chưa nằm trong 0.4

Tiền tệ, cửa hàng nâng cấp, kiếm tiền, nhiều bản đồ, photogrammetry cả phố, Telegram và đổi engine. Để sau khi có phản hồi playtest.
