Tiếp tục game “Hà Nội · Ca đêm” từ source bản 0.3 trong repository này và hoàn thiện bản 0.4.

Đọc AGENTS.md, README.md, docs/HANDOFF.md, docs/VALIDATION.md và docs/ROADMAP-0.4.md. Trước tiên chạy baseline test, TypeScript và build; sửa vấn đề môi trường nếu có. Đây là game 3D góc nhìn thứ nhất; giữ chổi/xẻng trước mặt, cúi quét lá, đẩy xe, lội nước tìm cống, solo và co-op tối đa 8 người.

Thực hiện các hạng mục 0.4 theo thứ tự trong roadmap: quét tác động trên vùng và lá dịch chuyển, phản hồi hốt–đổ, hoàn thành khu vực, ping/tên đồng đội, một đoạn phố Hà Nội 6–8 mặt tiền đẹp hơn, ổn định đồng bộ và hướng dẫn ngắn trong cảnh. Ưu tiên vòng chơi thỏa mãn, trạng thái nhất quán và hiệu năng. Tiếp tục sửa source hiện có cho đến khi các hành vi trong phạm vi hoàn chỉnh và kiểm tra phù hợp đều qua.

Giữ luật client/server thống nhất; thêm test cho thay đổi thật, kiểm tra không nhân đôi rác và ca chơi hoàn chỉnh. Nếu có browser, chạy playtest solo và hai phiên cùng phòng, kiểm tra lỗi console và tương tác. Báo rõ phần nào chưa thể kiểm chứng; không dùng số lượng unit test để khẳng định game đẹp/mượt/vui hay tám máy ổn định.

Kết thúc bằng báo cáo thay đổi, các lệnh kiểm tra và kết quả thực tế, các giới hạn còn lại, hướng dẫn mở preview để tôi chơi thử, và commit/PR nếu môi trường hỗ trợ. Giữ việc triển khai production cho một yêu cầu riêng.
