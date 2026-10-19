# Góc phố — preview 0.7

Tiếp tục bản 0.6 theo đánh giá dev/QA/art. Giữ góc thứ ba mặc định, V đổi thứ nhất, luật dọn phố, solo và phòng tối đa tám người. Game `0.7.0-preview.1`, phòng định dạng **4**, schema D1 không đổi. Chỉ cập nhật Site preview riêng; thông tin xuất bản thực tế ở `PREVIEW.md`. Production cũ giữ nguyên.

## Đồng bộ và tương tác

- Vào lại phòng lấy sequence tiếp theo từ ACK server, tránh đứng yên khi request rời phòng thất bại. Giữ replay protection, round và compare-and-swap.
- Client lấy mẫu input 20 Hz, giữ tối đa một giây/32 frames và một request đang xử lý. Server dùng ngân sách elapsed thật, simulation chia bước tối đa 50 ms. API vẫn nhận input legacy; payload lịch sử giới hạn 12.000 ký tự.
- G/Q/F mới được ghi ở cuối sample với `dt: 0`, tách khỏi khoảng giữ movement/work phía trước. Prefix bị cắt vì elapsed ngắn hơn history 1 ms không làm mất nút mới. Edge cũ ngoài cửa sổ vẫn bị loại, sequence lặp không chạy lại. Regression helper→API thất bại trước sửa và qua sau sửa.
- Nhịp gửi tính từ lúc bắt đầu request, không cộng thêm 90 ms sau response chậm. Pause, đổi ca/phiên và lỗi mạng xóa lịch sử; lịch sử rỗng cập nhật pose trung lập.
- Gap trên 1,5 giây bỏ movement/work/edge ở packet khôi phục đầu. Không chuyển thời gian mất mạng thành giữ nút. Snapshot authoritative có nội suy; chưa có client prediction.
- Bảng hướng dẫn, bàn/ghế và xe máy dùng footprint chung cho scene/simulation. Người nằm trong prop của snapshot cũ đi ra được mà không teleport; rác/xe cũ được chuyển tới mép hợp lệ, giữ khối lượng, ID và tiến độ. Xe được nhả quyền trước khi sửa vị trí.
- Nhãn ping 3D thay khi loại ping/tên đổi, dispose texture cũ.

## Camera, nhân vật và phố

- Chặn pitch ngay ở handler chuột/cảm ứng và khi đổi view, tránh vùng rê ngược không phản hồi. Khi cúi, camera chuyển khoảng cách dần; khi ép sát trong lúc đẩy xe, thân local được ẩn sớm hơn. Đây là hiển thị, không đổi tầm tay.
- Tỷ lệ nhân vật trưởng thành hơn, áo thuôn/PPE bớt dày; bước chân lấy quãng đường và hướng di chuyển được render. Cúi/làm việc/đẩy xe chuyển tư thế dần. Dụng cụ ở phía camera thấy được, hai tay bám cán; túi ở hông đối diện.
- Bóng tiếp xúc nhẹ giúp chân có điểm tựa khi tắt bóng thật; đây là xấp xỉ mỹ thuật. Rig vẫn 28 meshes, 15.770 geometry vertices so với 15.314 trước đó.
- Một góc quán gần tập kết có cửa kính lõm, quầy, mái xanh, biển vẫy hai mặt và cửa cuốn cạnh bên. Giữ footprint mặt tiền/vùng làm việc; hai emitter bổ sung dùng cùng pool tối đa bốn đèn.
- Lá có độ cong/biến thể nhẹ, giữ instancing và lượng rác simulation. Khung xe cố định được batch; tải lá trên xe dùng một instanced mesh.
- Biển tập kết không nhận đèn để spotlight không làm mất chữ. Cấu hình nhẹ bỏ IBL, giữ texture/ánh sáng tĩnh; cấu hình cao giữ phản xạ và bóng.
- HUD chính giữ bàn giao/khu sạch, chi tiết khu ở M; một hướng dẫn theo ngữ cảnh và chuỗi chuyến đầu kết thúc sau bàn giao. Chữ thiết yếu lớn hơn, trợ giúp gọn và pad cảm ứng không tràn ngang.
- Thiết bị coarse dùng điều khiển chạm trực tiếp, không thử khóa chuột rồi hiện cảnh báo che HUD; footer dùng “Vuốt để quan sát”. Một số câu hướng dẫn vẫn dùng tên phím bàn phím.

## Kiểm tra source

Baseline trên `fe760b2`: `npm test` **35/35**, TypeScript và build exit 0.

| Lệnh cuối | Kết quả |
|---|---|
| `npm test` | **46/46**, không skip |
| `npm run typecheck` | Exit 0 |
| `npm run build` | Exit 0; còn cảnh báo chunk >500 kB và phân loại route Vinext |
| `git diff --check` | Qua |
| `node --check` cho browser harness và HTTP probe đã đổi đường dẫn | Qua |

Test hành vi bao phủ sequence/rejoin, replay/round/CAS, cadence 110–1000 ms, nút nhấn ngắn, prefix quá hạn, khoảng dừng, sai số float của dt, payload không hợp lệ, pitch đổi view, prop footprints và sửa snapshot cũ không mất rác. Tám client giả lập dùng protocol lịch sử nhận/giao đúng 32 đơn vị, giữ sức chứa và lượng rác. Ba ca simulation mùa thu/mưa/hỗn hợp vẫn qua. Đây không phải tám máy hoặc playtest con người.

## Browser và Worker/D1 local

Node v24.19.0, Chromium/Playwright, renderer phần mềm SwiftShader. Các script dùng input/UI thật và chỉ đọc state để chờ/đánh giá; không đặt trực tiếp tọa độ, túi hoặc kết quả. Ảnh và log ở `work/`, không vào Git.

| Lệnh | Kết quả thực tế |
|---|---|
| `POLISH_SCENARIO=all node tests/browser/polish.cjs` (phần visual) | Đảo pitch hai giới hạn, V từ góc thứ nhất cực hạn, collider bảng/boom, nhãn ping đổi trước TTL qua. Network ở lượt này chưa kết luận do mọi packet giữ input đều stale. |
| `node tests/browser/solo-trip.cjs` | Quét → hốt → đổ → nắm/đẩy → bàn giao **4 đơn vị**, ping/bản đồ/tạm nghỉ/menu qua; errors rỗng. |
| `node tests/browser/full-shift.cjs` | UI xác nhận **autumn/shift**; thắng sau **225,074 giây simulation/234,365 giây chạy script**, score **42,665**, một khu sạch. Kết quả/nhận ca mới/menu qua; errors rỗng. |
| `node work/polish-07/final-third-person.cjs` | Settings cũ thiếu view, V/giữ V, C/dụng cụ, trạng thái vật lý, settings/reload và tám ảnh làm việc/cảnh mưa qua; errors rỗng. CSS 960×600/DPR 1, low canvas 720×450. |
| `node tests/browser/co-op.cjs` (sau sửa edge và chuyển ảnh xuống cuối) | Hai context dùng hai camera trong cùng phòng mùa thu; quét/hốt, ping chung, bảo toàn rác, nắm xe/offline/nhả xe/reconnect qua. **93 phản hồi đều 200**, ba lỗi offline cố ý, runtime errors rỗng. Quan sát xe được nhả sau 4.423 ms kể từ khi offline, không phải timer nền. |
| `POLISH_SCENARIO=network node tests/browser/polish.cjs` (sau sửa) | Failed leave/rejoin, delay 120/440/180/600 ms, hết phiên/chuyển host và manual rejoin qua. Runtime errors rỗng; 17 lỗi mạng/403 cố ý được phân loại riêng. |
| `node work/polish-07/mobile-after-fallback.cjs` | Qua đổi góc hai lần, giữ mũi tên di chuyển, 11 nút trong viewport; không toast khóa chuột, footer “Vuốt để quan sát”, errors rỗng. CSS 390×844/DPR 1, mới là emulation. |

Co-op/full-shift dùng CSS 640×480/DPR 0,25, canvas 160×120; visual pitch/ping dùng CSS 960×600/DPR 0,25. Ảnh third-person high/low cho thấy thân không còn che phần lớn xe, biển tập kết đọc được; không suy ra nhịp chổi/tiếp xúc hoặc độ nặng từ ảnh tĩnh. Nhánh ẩn thân ở boom ≤2,15 m có test camera riêng; ảnh xe ở khoảng cách thường không chứng minh nhánh này.

Lượt network cuối vẫn chịu nhiều stall cloud: rejoin ACK seq 10→11, chuyển động sau đó có một packet hợp lệ/12 packet stale; jitter giữ được 2 giây input, đi đúng 144 đơn vị với hai packet hợp lệ/sáu stale; manual recovery giữ được 1 giây và đi 72 đơn vị. Offline quan sát 53,704 giây rồi host chuyển, phiên cũ trả 403, vào lại cùng ID không mang input cũ. Các nhánh đã chạy thật, nhưng **không phải bằng chứng tốc độ phản hồi hoặc hiệu năng mạng tốt**.

Probe HTTP không GPU chạy bằng `node work/polish-07/http-network.mjs`; giữ cùng logic để tái chạy ở `tests/http/input-history.mjs` (bản chuyển đường dẫn đã kiểm tra cú pháp). **59 responses: 58×200 và một 403 hết phiên dự kiến**. Tám packet có delay đều áp dụng, di chuyển 133,6895 đơn vị theo 1,8568 giây history được giữ; failed-leave rejoin seq 14→15 di chuyển 7,2 đơn vị; im lặng 27,997 giây chuyển host, manual rejoin neutral rồi đi 10,8 đơn vị. Khối lượng/sức chứa đúng. Probe truyền 2,3491 giây history nhưng trim 0,4923 giây (~20,96%); **jitter vẫn có thể giảm tốc độ theo thời gian thực**.

## Lỗi phát hiện trong kiểm tra và thay đổi harness

- Lượt co-op đầu dừng ở ping. Điều tra tìm ra bug timestamp G/Q/F; thêm regression đỏ trước sửa, xanh sau sửa. Không gán lỗi này chỉ cho máy cloud.
- Lượt sau nhận được ping nhưng Q ở packet có gap 1.802 ms bị guard bỏ; screenshot readback ngay trước thao tác làm nghẽn software GPU. Chuyển ảnh xuống cuối bài, giữ toàn bộ assertions và luật server; lượt cuối qua cả offline/reconnect.
- Visual hook đọc upload `viewMatrix` cuối có thể lấy nhầm overlay khi low shader tối ưu uniform. Đổi sang matrix ở các draw world thật và chờ UI commit V, giữ assertions góc.
- Network không đọc GL/labels nên tắt các hook đồ họa thừa trong hai context, giữ renderer/counter frame. Wait theo đúng own ID sau rejoin, không lấy nhầm `players[0]`. Không hạ stale guard để làm test qua.
- Cảm ứng trước sửa có 11 nút trong viewport, đổi view/di chuyển qua nhưng toast khóa chuột che HUD. Đã sửa fallback coarse và chạy lại riêng.

## Chi phí render và giới hạn

Thử chia material batch theo ô 16 m làm draw API calls tại điểm đầu tăng từ khoảng 382 lên 747; đã bỏ. Phép đo sau batch/instancing: **327 calls, 170 static meshes/209.182 vertices**, baseline 382 calls, 156 meshes/214.923 vertices; cùng CSS 1280×800/DPR 0,5/low/canvas 640×400. Đây là đếm submit tại một điểm, **không phải FPS/GPU time**, không xác nhận toàn phố nhẹ hơn.

Chưa có GPU thật, playtest con người, tám thiết bị qua Internet, nghe âm thanh trực tiếp hoặc ca mưa/hỗn hợp đầy đủ qua browser. Mobile mới là emulation, chưa xác nhận onboarding hay độ trễ cảm ứng trên điện thoại thật. Chưa có client prediction/WebSocket; một giây history và guard 1,5 giây vẫn cắt input chậm/cũ. Đồ họa/rig procedural chưa được xác nhận ngang clip. Không dùng số unit test, mesh hoặc draw calls để khẳng định đẹp/mượt/vui hay tám máy ổn định.


## Xuất bản

Preview riêng đã lên **0.7**, saved version **4**, deployment `appgdep_6ad6590d4cbc8191a65b69ce28ab13ca` thành công lúc 00:53:34 ngày 20/10/2026 (Asia/Saigon). Source game `87458e9`, source Site `19d0c80`; thông tin đầy đủ ở `PREVIEW.md`. Production/version/quyền giữ nguyên.

HTTP smoke hosted bị session proxy chặn CONNECT 403 trước khi tới Site; chưa kiểm tra browser đã đăng nhập trên URL hosted. Không tính deployment success là xác nhận HTML/assets, chất lượng chơi hoặc FPS. Người chơi mở link preview bằng tài khoản chủ Site để thử thực tế.
