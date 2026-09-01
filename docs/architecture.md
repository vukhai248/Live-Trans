# Kiến trúc (khung tổng quát)

> ⚠️ Bản khung — các quyết định cụ thể (hình thức sản phẩm, stack, model) đang chờ thảo luận, xem `open-questions.md`. File này sẽ được cập nhật sau khi chốt.

## Luồng dữ liệu tổng quát

```
┌─────────────────────────────────────────────────────────────────────┐
│                            PHÍA NGƯỜI DÙNG                          │
│                                                                     │
│  [Nền tảng video bất kỳ]                                            │
│        │                                                            │
│        ▼                                                            │
│  [Capture]  ── chunk audio ──►  [Display/Overlay phụ đề]            │
│                                   ▲                                 │
└───────────────────────────────────┼─────────────────────────────────┘
                                    │ WebSocket / HTTP
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                              BACKEND                                │
│                                                                     │
│  [ASR service]  ── transcript ──►  [Translate service]              │
│   (faster-whisper /                   │                             │
│    API free-tier...)                  ▼                             │
│                              [Glossary + thuật ngữ]                 │
│                               - giữ nguyên code/lệnh                │
│                               - dịch nhất quán thuật ngữ chuyên ngành│
└─────────────────────────────────────────────────────────────────────┘
```

## Các thành phần

| Thành phần | Trách nhiệm | Trạng thái |
|------------|-------------|------------|
| **Capture** | Bắt luồng âm thanh video/audio đang phát, cắt thành chunk nhỏ gửi backend | Chưa quyết định cách bắt (extension/app) |
| **ASR service** | Chunk audio → text (kèm timestamp) | Chưa chọn model: local (faster-whisper...) hay API free-tier |
| **Translate service** | Text → ngôn ngữ đích, qua lớp glossary | Chưa chọn: LLM (giữ thuật ngữ tốt) hay model dịch truyền thống hay hybrid |
| **Glossary** | Từ điển thuật ngữ + quy tắc giữ nguyên văn code/lệnh; người dùng chỉnh được | Ý tưởng cốt lõi của dự án, cần thiết kế kỹ |
| **Display** | Overlay phụ đề lên nội dung đang xem | Phụ thuộc hình thức sản phẩm |

## Nguyên tắc thiết kế

1. **Pipeline tách bạch**: Capture → ASR → Translate → Display nối với nhau qua interface rõ ràng, mỗi mắt xích có thể thay thế (đổi model ASR không phải sửa Display).
2. **Glossary là tầng riêng biệt** — glossary nằm độc lập với pipeline, dùng chung cho cả dịch live và dịch PDF/paper về sau.
3. **Provider-agnostic**: ASR và Translate là interface với nhiều provider (local/API), người dùng chọn theo cấu hình.
4. **Protocol rõ ràng giữa frontend ↔ backend**: định nghĩa schema message (chunk meta, transcript, translation) ngay từ đầu để test contract được.

## Việc cần quyết định trước khi scaffold code

Xem `open-questions.md`.
