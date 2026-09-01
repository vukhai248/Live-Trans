# Yêu cầu (bản nháp)

> Bản nháp ban đầu để làm đầu vào cho buổi thảo luận kiến trúc. Sẽ được chốt lại sau khi quyết định hình thức sản phẩm.

## Phạm vi 1 — Dịch live video/audio (MVP)

### Chức năng

| # | Yêu cầu | Ghi chú |
|---|---------|---------|
| F1 | Bắt được luồng âm thanh của video/audio đang phát | Mục tiêu: hoạt động trên YouTube + các nền tảng video học trực tuyến (Coursera, Udemy...); ưu tiên cách bắt "mọi trang" thay vì tích hợp từng trang |
| F2 | Chuyển âm thanh thành text (ASR) | Hỗ trợ tiếng Anh trước, mở rộng ngôn ngữ sau; có thể dùng model local hoặc API free-tier |
| F3 | Dịch text sang ngôn ngữ người dùng | Mặc định hỗ trợ Anh → Việt; kiến trúc phải cho phép thêm cặp ngôn ngữ |
| F4 | Hiển thị kết quả dạng phụ đề live | Bám theo nội dung đang phát; độ trễ chấp nhận được (~vài giây); hiển thị cả bản gốc nếu người dùng muốn |
| F5 | Bảo toàn thuật ngữ học thuật & code | `npm run start`, `useEffect`, "transformer"... phải giữ nguyên văn; có glossary người dùng có thể chỉnh |
| F6 | Bật/tắt nhanh từ UI | Bắt đầu/dừng dịch ngay trên trang đang xem |
| F7 | Cấu hình: cặp ngôn ngữ, địa chỉ backend, bật/tắt giữ thuật ngữ | Lưu cục bộ trên máy người dùng |

### Phi chức năng

| # | Yêu cầu | Ghi chú |
|---|---------|---------|
| NF1 | Chi phí người dùng cuối ≈ 0 | Ưu tiên local model / free-tier / self-host |
| NF2 | Riêng tư: âm thanh không rời máy khi dùng chế độ local | Gửi đi đâu, gửi gì phải rõ ràng trong settings |
| NF3 | Hoạt động với audio có chất lượng đa dạng | Lecture, podcast, nói nhanh/nói địa phương |
| NF4 | Code dễ mở rộng sang phạm vi 2 | Tách bạch pipeline: capture / ASR / translate / display |

## Phạm vi 2 — Dịch PDF/paper (hậu kỳ)

| # | Yêu cầu | Ghi chú |
|---|---------|---------|
| F8 | Dịch file PDF/paper sang ngôn ngữ người dùng | Upload hoặc chỉ đường dẫn |
| F9 | Giữ hình ảnh, biểu đồ, bảng gốc | Chỉ dịch text, giữ nguyên media |
| F10 | Giữ template/layout tối đa | Bố cục hai cột, heading, chú thích... |
| F11 | Giữ thuật ngữ nhất quán trong suốt tài liệu | Glossary dùng chung với phạm vi 1 |
| F12 | Xuất kết quả đọc được | PDF song ngữ hoặc dạng đọc (HTML) |

## Mở (chưa chốt)

- Ngôn ngữ ASR tự động detect hay người dùng chọn sẵn?
- Có cần dịch ngược (Việt → Anh) không?
- Có hỗ trợ dịch text trên trang web (không phải audio) không?
- Phân phối: Chrome Web Store hay side-load nội bộ trước?
