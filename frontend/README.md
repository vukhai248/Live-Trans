# frontend

Phía người dùng của Live-Trans: bắt luồng âm thanh video/audio đang phát, gửi backend, hiển thị phụ đề dịch.

> ⚠️ **Chưa scaffold** — đang chờ chốt kiến trúc, xem `docs/open-questions.md` (mục 1).

## Ứng viên kỹ thuật (đánh giá ban đầu)

**Chrome/Edge extension (Manifest V3)** là ứng viên chính cho MVP:

- `chrome.tabCapture` + offscreen document: bắt được luồng âm thanh của tab video đang phát (YouTube, Coursera, Udemy...) mà không phụ thuộc từng trang web.
- Content script: overlay phụ đề bám theo video ngay trên trang.
- Popup: bật/tắt dịch, chọn cặp ngôn ngữ; Options: cấu hình backend, glossary.
- Framework dựng extension (chưa chọn): WXT (Vite-based) hoặc @crxjs — quyết định khi scaffold.

## Vai trò các phần (dự kiến khi scaffold)

```
frontend/
├── background/    # Service worker: điều phối capture ↔ backend
├── offscreen/     # Bắt audio (tabCapture/MediaRecorder) + kết nối backend
├── content/       # Overlay phụ đề trên trang
├── popup/         # UI bật/tắt, chọn ngôn ngữ
├── options/       # Cấu hình: địa chỉ backend, cặp ngôn ngữ, glossary
└── shared/        # Kiểu dữ liệu giao thức frontend ↔ backend
```
