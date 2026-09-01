# Tổng quan dự án

## Bối cảnh

Người học hiện nay học từ rất nhiều nguồn video: YouTube, Coursera, Udemy, Khan Academy, các khóa học của trường... Rất nhiều video giá trị không có phụ đề — hoặc không có phụ đề bằng ngôn ngữ của người xem. Người xem vẫn "ham học" và xem tiếp dù chỉ hiểu một phần, hiệu quả tiếp thu thấp.

Các giải pháp dịch video hiện có trên thị trường:

- Yêu cầu **phí thuê bao** để dùng đầy đủ tính năng. Với học sinh, sinh viên — đối tượng cần nhất — đây là khoản phải cân nhắc kỹ.
- Chất lượng dịch với nội dung **học thuật/kỹ thuật** kém: thuật ngữ và code bị bóp méo (ví dụ `npm run start` bị dịch thành tiếng, tên hàm bị biến dạng), làm người học hiểu sai hoặc không thể tra cứu lại.
- Tương tự với tài liệu: các công cụ dịch PDF/paper thường mất hình ảnh, vỡ layout/template, không giữ được thuật ngữ gốc.

## Mục tiêu

Xây dựng công cụ **miễn phí** (chi phí vận hành gần bằng 0 cho người dùng cuối) giúp:

1. **Dịch live** âm thanh/video đang phát trên bất kỳ nền tảng nào → hiển thị phụ đề theo ngôn ngữ người dùng.
2. **Bảo toàn thuật ngữ học thuật**: giữ nguyên code, lệnh, tên hàm, thuật ngữ chuyên ngành — đúng nguyên văn (benchmark chất lượng chính là đây, chứ không chỉ "dịch trôi chảy").
3. Về sau, **mở rộng sang PDF/paper**: dịch giữ luồng đọc, hình ảnh gốc, template/layout, thuật ngữ — phục vụ nghiên cứu.

## Đối tượng người dùng

- Học sinh, sinh viên học qua video/khóa học trực tuyến bằng ngoại ngữ.
- Người nghiên cứu cần đọc paper/tài liệu kỹ thuật bằng ngoại ngữ.
- Bất kỳ ai muốn xem video bất kỳ ngôn ngữ nào với chi phí ~0.

## Ràng buộc cốt lõi

- **Chi phí người dùng cuối ≈ 0**: ưu tiên mô hình chạy cục bộ (local) hoặc API free-tier, có thể tự host backend riêng.
- **Chất lượng thuật ngữ**: mọi khâu dịch phải có cơ chế bảo toàn thuật ngữ (glossary), không bóp méo code/lệnh.
- **Đa nền tảng**: không bó buộc một trang web cụ thể.
