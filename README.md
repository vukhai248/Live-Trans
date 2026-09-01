# Live-Trans

Dịch live âm thanh/video sang ngôn ngữ của người dùng, với tiêu chí đầu tiên là **miễn phí cho học sinh/sinh viên** và **bảo toàn thuật ngữ học thuật**.

## Vấn đề giải quyết

- Video học thuật trên YouTube, Coursera, Udemy... thường không có phụ đề/ngôn ngữ người dùng cần, trong khi người xem vẫn muốn học dù tiếng Anh hạn chế.
- Các công cụ dịch video hiện tại đều yêu cầu phí thuê bao — rào cản thật sự với sinh viên, học sinh.
- Công cụ dịch tài liệu (paper, PDF) hay làm "vỡ" thuật ngữ và code (ví dụ `npm run start` bị dịch/bóp méo), mất hình ảnh và layout gốc.

## Định hướng sản phẩm

Bắt được luồng âm thanh của video/audio đang phát (trên bất kỳ nền tảng nào), chuyển thành text (ASR), dịch sang ngôn ngữ người dùng, hiển thị như phụ đề live. Về sau mở rộng sang dịch PDF/paper: giữ luồng đọc, hình ảnh gốc, template, và các thuật ngữ học thuật để thuận tiện cho nghiên cứu.

> Kiến trúc và lựa chọn công nghệ đang trong quá trình thảo luận — xem `docs/open-questions.md`.

## Cấu trúc repo

```
Live-Trans/
├── docs/          # Tài liệu: tầm nhìn, yêu cầu, kiến trúc, roadmap, các câu hỏi mở
├── frontend/      # Phía người dùng (extension/app) — chưa scaffold, chờ quyết định kiến trúc
├── backend/       # Backend riêng (ASR, dịch, glossary) — chưa scaffold, chờ quyết định kiến trúc
├── tests/         # Bài test tích hợp + fixtures (sample audio/video/pdf)
├── scripts/       # Script hỗ trợ dev: setup, dev, build, check
└── README.md
```

## Trạng thái hiện tại

- ✅ Giai đoạn 0: init cấu trúc dự án + tài liệu nền
- ⏳ Tiếp theo: thảo luận chốt kiến trúc (extension/app, backend stack, mô hình ASR/dịch) → xem `docs/open-questions.md`
- 📅 Lộ trình đầy đủ: `docs/roadmap.md`
