# Preview chơi thử cố định

Địa chỉ: https://ha-noi-ca-dem-preview.namxuan05.chatgpt.site

Bản đang xuất bản: **0.5 · Phố đêm** (2026-10-18). Nhấn Ctrl+Shift+R nếu tab cũ vẫn hiện 0.4; nhãn cuối màn hình mới là `PHỐ ĐÊM · VISUAL PREVIEW 0.5`. Chọn `Cao · Có bóng` để xem đủ ánh sáng/bề mặt; chọn `Nhẹ · Không bóng` nếu máy chạy nặng. Báo cáo của đợt này: `VISUAL-PREVIEW-0.5.md`.

Máy chơi chỉ cần Chrome/Edge và kết nối Internet. Preview bắt đầu ở chế độ riêng tư của chủ Site; đăng nhập bằng tài khoản ChatGPT sở hữu Site khi được yêu cầu. Quyền mời bạn của bản production không tự chuyển sang preview.

## Hai môi trường

- `.openai/hosting.json` giữ Site production `appgprj_6ad033552ff881918de1dfc4ecf75670` và địa chỉ production cũ.
- `.openai/preview.json` giữ Site chơi thử riêng `appgprj_6ad441f7c1108191b3bb10887f2bbebc`. Site này có D1 riêng; phòng/mã phòng không dùng chung với production.
- Sites gọi mọi địa chỉ đã xuất bản là live/production. Trong dự án này, Site thứ hai được dùng làm môi trường preview; không cập nhật Site production cũ.

## Cập nhật sau mỗi bản sửa

Đây là bước bàn giao của tác vụ sửa game, không phải GitHub Actions tự triển khai khi có push.

1. Sửa source game trong repository này. Chạy `npm test`, `npm run typecheck`, `npm run build` và các kiểm tra hành vi phù hợp. Commit source đã kiểm tra.
2. Dùng workflow của plugin Sites cho **Site preview đã có**: đọc trạng thái/quyền hiện tại, lấy credential ngắn hạn, mở source của đúng Site vào checkout riêng. Không tạo thêm Site.
3. Chuyển source đã commit sang checkout preview bằng `git archive`; chỉ lấy file Git theo dõi. Giữ danh tính Git của source Site và ghi đè `project_id` trong manifest của checkout bằng giá trị `.openai/preview.json`. Giữ các binding `d1`/`r2` hiện tại. Không chuyển `.git`, `.env*`, cache, dependencies hay dữ liệu local/production.
4. Dựng artifact **trong checkout preview**. Kiểm tra manifest nguồn và manifest trong artifact cùng trỏ tới Site preview, khác Site production. Không tái sử dụng `dist` được dựng với manifest production.
5. Theo workflow Sites, push đúng source, lưu phiên bản từ cùng commit/artifact rồi triển khai với quyền riêng tư hiện tại. Không lưu token vào file, Git hay log.
6. Chờ deployment thành công có URL; ghi lại phiên bản/commit và kết quả kiểm tra thực tế. Link cố định phía trên tiếp tục mở bản mới. Nếu phát hành thất bại, giữ bản đang chạy và báo lỗi.

Không thay quyền xem/chơi hoặc triển khai Site production trong quy trình này. Nếu đổi định dạng phòng, người chơi tạo phòng mới sau khi cập nhật. Mở lại trang hoặc dùng Ctrl+Shift+R nếu tab cũ vẫn đang chạy bản trước.

## Lần triển khai đầu tiên — 2026-10-18

- Bản game: 0.4; source GitHub `5babda9c9c7fa525f76d63fe8f129486211db9c4` (gameplay tiếp tục từ `e2169261257f904727bb115707f85ff2fc0fe172`).
- Source của Site preview: `a5b6e9052dc89968ac4d4987923f3cb08c51aa91`.
- Saved version: `appgprj_6ad441f7c1108191b3bb10887f2bbebc~appgver_91cd6035b2988191a67ac6ceeb670b1e`.
- Deployment: `appgdep_6ad442aae59c8191a453e5c47d9ceeae`; Sites trả `succeeded` cùng URL lúc `2026-10-18T03:53:34Z`.
- Chạy lại trong checkout preview: `npm test` **33/33**, `npm run typecheck` và `npm run build` đều exit 0. Build vẫn cảnh báo chunk >500 kB và phân loại route Vinext như đã ghi trong `VALIDATION.md`.
- Manifest trong artifact đã được so khớp với manifest source preview; artifact chứa `dist/server/index.js`, client assets và migration D1. Các helper đóng gói của plugin không có trên executor này nên dùng build integration sẵn có và đóng gói tar theo layout mà Sites chấp nhận. Lần upload đầu sai layout bị từ chối trước triển khai; gói đã sửa giữ đường dẫn `dist/server/` và được triển khai thành công.
- Site preview riêng tư, chỉ chủ Site có quyền ban đầu. Không thêm người xem hoặc đổi audience.
- Đọc lại Site production xác nhận vẫn version **3**, URL và revision quyền **2** không đổi. Không triển khai production.
- Chưa chạy lại browser trên URL hosted trong tác vụ cấu hình preview. Kết quả browser local của bản 0.4 nằm trong `VALIDATION.md`; trạng thái deployment thành công không chứng minh FPS/chất lượng chơi hay tám thiết bị ổn định.

## Cập nhật hình ảnh 0.5 — 2026-10-18

- Source GitHub: `6f3c7e9c9c6aa1e1cc04335b83b62f0a90a09ad2`.
- Source của Site preview: `2f215e611c8e7c12d8f8efe24c6b093a4239ac70`; cùng Site/URL, giữ quyền riêng tư của chủ Site và binding D1 `DB`.
- Saved version: `appgprj_6ad441f7c1108191b3bb10887f2bbebc~appgver_994c92969e348191b25b2c50faa90700`.
- Deployment: `appgdep_6ad450fd59bc819188accc19875b2895`; Sites trả **succeeded** cùng URL lúc `2026-10-18T04:54:36.955476Z`.
- Dựng lại trong checkout preview với manifest riêng: test **33/33**, TypeScript và build exit0. Kiểm tra manifest nguồn/artifact khớp Site preview, file texture trong artifact có SHA256 khớp source; archive 1270420 bytes chứa Worker, client và migrations, không chứa source secrets/dependencies/runtime DB.
- Các browser check chạy trên artifact local hoàn chỉnh đều qua: hình ảnh cao/thấp/mưa/dụng cụ, một chuyến bàn giao solo, hai phiên cùng phòng/offline/reconnect và một ca autumn thắng (score51, một khu sạch), kết quả/restart/menu. Điều kiện đo, kết quả lỗi trung gian đã sửa và các giới hạn nằm trong `VISUAL-PREVIEW-0.5.md`.
- Không chạy browser đã đăng nhập trên URL hosted trong tác vụ này. Native deployment thành công xác nhận bản đã xuất bản, không chứng minh chất lượng hình ảnh ngang clip hoặc FPS máy thật. Không thay audience hoặc cập nhật Site production cũ.
