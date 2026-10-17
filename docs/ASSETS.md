# Tài nguyên 0.4

Không thêm ảnh, model, bản ghi âm hay tài nguyên tải từ bên ngoài trong 0.4.

| Tài nguyên | Nguồn / file | Cách tạo |
|---|---|---|
| Tám mặt tiền, mái hiên, biển hiệu, ban công, chậu cây, quầy hàng, bảng hướng dẫn | `lib/scene3d.ts` | Hình học và canvas texture procedural trong source |
| Lá, tải xẻng, ping, tên nhân vật | `lib/scene3d.ts` | Geometry/instancing và chữ canvas dùng font hệ thống; không đóng gói font |
| Phản hồi hốt/đổ/bàn giao/cống | `app/game-client.tsx` | Oscillator/noise Web Audio tạo trong runtime, không dùng file âm thanh |

Source 0.3 và các dependency vẫn giữ nguồn/giấy phép ban đầu. Không thay đổi giấy phép vendored trong `build/` và `vendor/`. Đây là cảnh 3D đi lại được bằng geometry procedural; không dùng ảnh concept làm ảnh nền giả môi trường.
