# Hà Nội · Ca đêm — UE5 scene bootstrap 0.1.1

Gói này tự dựng một **blockout phố đêm để đi thử bằng nhân vật Third Person** trong project UE5 hiện có. Bản UE người dùng báo là **5.8.4**; tác giả chưa có Unreal Editor để chạy xác nhận API hoặc hình ảnh trên bản này. Script kiểm tra những API/asset thiết yếu trước khi tạo map và ghi phiên bản engine thực tế vào report.

Nếu tải nhánh repository bằng **Code → Download ZIP**, file cần chạy nằm trong **`tools/ue5-bootstrap/dung_pho_hanoi.py`** sau khi giải nén.

## Sửa lỗi `Cannot assign tint parameter: road` (0.1.1)

Lỗi được ghi nhận trên máy người dùng khi bản 0.1.0 gán `Tint` cho material instance đầu tiên. Chưa xác nhận nguyên nhân bên trong Unreal. Bản 0.1.1 bỏ phụ thuộc vào việc tìm parameter của material cha vừa tạo: tạo 22 material có đầu vào constant cho màu, roughness, metallic và emissive. Tất cả kết nối vẫn được kiểm tra; không bỏ qua lỗi để báo hoàn thành. Cách này phù hợp cảnh tĩnh, nhưng tạo nhiều material cha hơn và có thể tăng thời gian compile shader so với dùng instance chung.

Sau lỗi ở bản cũ: đóng thông báo bằng **OK**, chọn **File → Save All**, tải/giải nén ZIP mới rồi chạy đúng file `dung_pho_hanoi.py` mới. Log bắt đầu phải có **`Starting bootstrap 0.1.1`**. Script tạo thư mục số kế tiếp, không yêu cầu xóa bản dựng dở. Không cần cài lại Unreal hoặc plugin. Bản sửa chưa được chạy trong Unreal tại môi trường tác giả; cần xác nhận lại trên PC.

## Cách chạy trên PC của bạn

Không cần Python hệ thống, pip, Node.js hoặc C++. Unreal Editor cung cấp Python.

1. Tải/giải nén thư mục này vào đường dẫn dễ tìm, ví dụ `D:\HanoiNightBootstrap`.
2. Mở project **HanoiNightShift** đã tạo bằng template **Third Person / None / Blueprint**. Giữ các Blueprint mẫu trong Content/ThirdPerson.
3. Mở **Edit → Plugins**. Bật **Python Editor Script Plugin** và **Editor Scripting Utilities**, rồi restart Editor nếu được yêu cầu.
4. Dừng Play/Simulate, mở một map làm việc bình thường, chọn **File → Save All**. Script sẽ dừng nếu còn package chưa lưu, để không bỏ mất chỉnh sửa khi chuyển map.
5. Chọn **Tools → Execute Python Script…** → chọn **`dung_pho_hanoi.py`**. Không chọn file kiểm tra offline.
6. Chờ tạo asset và shader. Khi có thông báo hoàn thành, đóng thông báo và nhấn **Play**. WASD/chuột/nhảy dùng nhân vật Third Person của template.

Nếu không thấy Execute Python Script: kiểm tra hai plugin đã bật và Editor đã restart. Dùng ô Cmd dưới cùng, đổi dropdown từ Cmd sang Python rồi nhập (thay đúng đường dẫn bạn đã giải nén):

```python
exec(compile(open(r"D:\HanoiNightBootstrap\dung_pho_hanoi.py", encoding="utf-8").read(), "dung_pho_hanoi.py", "exec"))
```

## Script tạo gì

- Đường dài 60 m, vỉa hè, nền và giới hạn quanh khu vực; vị trí PlayerStart ở đầu phố.
- Tám mặt tiền, ban công, cửa sổ, mái hiên, biển tên; một góc cà phê nhỏ.
- Bốn đèn đường, hai đèn đường có shadow, ánh trăng, sky/fog/exposure khi API hỗ trợ.
- Xe rác trang trí, ô tập kết và 72 chiếc lá trang trí trong tám nhóm.
- 22 vật liệu màu/roughness/metallic/emissive với đầu vào constant, không dùng parameter override hoặc tải asset ngoài.
- GameMode trỏ tới Third Person GameMode sẵn có có Character pawn. Không sửa Blueprint template.

Các actor được phân nhóm trong Outliner dưới `HanoiBootstrap`. Biển 3D dùng chữ ASCII để không phụ thuộc bộ glyph tiếng Việt của font distance-field mặc định. Đây là cảnh hình khối/vật liệu cơ bản; chưa phải bộ art chi tiết hoặc chất lượng ngang clip tham chiếu.

## Map và an toàn khi chạy lại

Lần đầu tạo:

```text
Content/HanoiNightShiftAuto_001/Maps/LV_HanoiNight
Content/HanoiNightShiftAuto_001/Materials/
```

Nếu thư mục này đã tồn tại, lần chạy tiếp chọn `_002`, `_003`… Script không ghi đè map/asset cũ và không sửa file cấu hình startup map. Map mới mở ngay sau khi chạy; lần mở project sau vẫn theo cài đặt trước đó. Chỉ các asset trong thư mục mới và map mới được lưu bởi script.

Nếu chạy bị lỗi/hủy giữa chừng, thư mục mới có thể còn asset chưa đủ. Không xem đó là thành công; đọc Output Log/report rồi sửa lỗi hoặc chạy lại. Không có rollback tự động cho toàn bộ thao tác Editor. Không cần xóa hoặc chạy đè lên map bạn đã sửa bằng tay.

## Nếu lỗi hoặc cảnh chưa đúng

Mở **Window → Output Log** (hoặc tab Output Log), tìm `[HanoiBootstrap]`. File report nằm tại:

```text
<thu_muc_project>/Saved/HanoiNightBootstrap/<ten_thu_muc>_report.json
```

Gửi dòng lỗi đầu tiên và report để điều chỉnh đúng API của Editor trên máy bạn. Trạng thái `generated_unverified_in_play` chỉ cho biết script tạo/lưu xong; chính bạn vẫn cần nhấn Play và kiểm tra di chuyển, ánh sáng, va chạm. Trạng thái `failed` không phải cảnh hoàn chỉnh.

Nếu có warning về Exposure, thử chọn actor `HN_Exposure` trong Outliner, tìm Exposure và điều chỉnh theo UI của phiên bản đang dùng; tên field Python có thể thay đổi giữa phiên bản. Nếu cảnh tối, trước tiên chờ shader hoàn tất, kiểm tra viewport đang ở **Lit**, rồi xem warning. Không có số FPS hoặc preset bảo đảm cho RTX 4060 từ các kiểm tra offline.

## Phạm vi còn thiếu

**Xe và lá hiện là vật thể tĩnh. Chưa có công nhân/chổi/xẻng mới, cúi quét, hốt, túi 18, xe 36, bàn giao, HUD, co-op hoặc savegame của game web 0.7.** Không có nút E/Q giả để tạo cảm giác gameplay đã làm. Nhân vật hiện vẫn là nhân vật Third Person mẫu.

Python Editor chỉ dựng nội dung. Vòng quét–hốt–đổ cần bước tiếp theo bằng Blueprint/C++ chạy trong game. Gói này không thay thế bản web, không cập nhật preview Sites và không tạo bản `.exe` đã đóng gói.

## Kiểm chứng đã làm

- `python -m py_compile tools/ue5-bootstrap/dung_pho_hanoi.py tools/ue5-bootstrap/kiem_tra_bo_tri.py tools/ue5-bootstrap/test_materials.py`: qua, chạy từ thư mục repository.
- `python -m unittest discover -s tools/ue5-bootstrap -p 'test_*.py' -v`: kiểm tra adapter vật liệu với editor giả lập: đủ đầu vào cho palette, giá trị đường/cửa sổ phát sáng, lỗi tạo asset/node/kết nối phải dừng. **Không xác minh API, compiler shader hoặc rendering trong UE.**
- `python kiem_tra_bo_tri.py`: kiểm tra dữ liệu cảnh, kích thước hữu hạn/dương, material hợp lệ, nhãn duy nhất, bố trí lặp lại ổn định, vị trí bắt đầu và đường đi giữa phố không bị khối collidable che.
- Kết quả thực tế ở `KIEM_CHUNG.json`: 506 node, tám thân mặt tiền, 72 lá, bốn spot light/hai có shadow và 281 điểm kiểm tra dọc đường.
- **Chưa chạy Unreal Editor, chưa xác minh API 5.8.4, rendering, Play, packaging hoặc FPS.** Không dùng số kiểm tra hình học để kết luận cảnh đẹp/mượt hoặc gameplay đã hoạt động.

Mã và bố trí được viết riêng cho tác vụ này. Các mesh primitive được tham chiếu từ engine cài trên PC và chịu điều khoản Unreal Engine; không kèm model/texture thương mại hoặc nội dung lấy từ clip.
