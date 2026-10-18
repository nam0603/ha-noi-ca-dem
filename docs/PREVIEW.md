# Preview chơi thử cố định

Địa chỉ: https://ha-noi-ca-dem-preview.namxuan05.chatgpt.site

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
