# Tài nguyên

Trong 0.4 không thêm ảnh, model, bản ghi âm hay tài nguyên tải từ bên ngoài.

| Tài nguyên | Nguồn / file | Cách tạo |
|---|---|---|
| Tám mặt tiền, mái hiên, biển hiệu, ban công, chậu cây, quầy hàng, bảng hướng dẫn | `lib/scene3d.ts` | Hình học và canvas texture procedural trong source |
| Lá, tải xẻng, ping, tên nhân vật | `lib/scene3d.ts` | Geometry/instancing và chữ canvas dùng font hệ thống; không đóng gói font |
| Phản hồi hốt/đổ/bàn giao/cống | `app/game-client.tsx` | Oscillator/noise Web Audio tạo trong runtime, không dùng file âm thanh |

Source 0.3 và các dependency vẫn giữ nguồn/giấy phép ban đầu. Không thay đổi giấy phép vendored trong `build/` và `vendor/`. Đây là cảnh 3D đi lại được bằng geometry procedural; không dùng ảnh concept làm ảnh nền giả môi trường.

## Thử nghiệm hình ảnh phố đêm

`lib/street-materials.ts` tự tạo bảy bộ vật liệu: nhựa đường có đá dăm và mảng ẩm, gạch lát bê tông đỏ có rãnh quạt, vữa trát loang cũ, gạch nung/mạch vữa, thớ gỗ, cửa cuốn và kim loại xước. Mỗi bộ có bản đồ màu, độ nhám và độ cao riêng; texture tối đa 512 × 512, dùng chung trong cảnh, không tạo mới cho từng mặt tiền. Thuật toán cố định seed tạo bản đồ bằng Canvas khi khởi tạo.

Các bản đồ procedural là tài nguyên mỹ thuật gốc tạo bằng source của dự án. Bản đồ màu dùng sRGB; bản đồ độ nhám/độ cao dùng dữ liệu tuyến tính.

`public/textures/hanoi-surfaces.webp` là atlas màu **1254 × 1254**, tạo mới bằng công cụ OpenAI image generation ngày 2026-10-18: bốn ô tường vữa vàng cũ, tường trắng ngà cũ, thớ gỗ, và gạch đỏ rãnh quạt. Brief yêu cầu bề mặt trực diện, ánh sáng đều, không người/chữ/logo; không đưa khung hình clip vào công cụ. PNG gốc được chuyển codec sang WebP quality 86 bằng FFmpeg, không sửa nội dung bố cục. File khoảng 515 KiB, tải từ cùng origin; mỗi ô được lấy vào bản đồ màu tối đa 512². Đây là asset do AI tạo riêng cho dự án, không gắn nhãn CC0 hay ảnh chụp thực địa. Bản đồ độ cao/nhám vẫn do thuật toán tạo; các vết nứt lớn trong ảnh màu chưa có displacement tương ứng. Nếu ảnh tải lỗi, vật liệu procedural vẫn hiển thị.

`lib/street-detail.ts` dựng hình học gốc cho xe máy đỗ, quầy đồ ăn, kệ hàng, bảng menu, giàn nóng điều hòa, lan can và đèn đường. Dụng cụ, găng tay và nhân vật đồng đội dùng geometry gốc trong `lib/scene3d.ts`. Không lấy model, texture hay hình ảnh từ Long Quân Trở Lại; video người dùng gửi chỉ là tham chiếu về tỷ lệ, bối cảnh và mật độ chi tiết.

Ánh sáng có đèn chiếu xuống đường, môi trường phản xạ đêm tổng hợp và mảng sáng mềm dựng sẵn. Vũng ẩm dùng vật liệu có độ nhám thấp; không có screen-space reflection hay ray tracing. Bầu trời và bề mặt này không thay cho geometry 3D có thể đi lại.
