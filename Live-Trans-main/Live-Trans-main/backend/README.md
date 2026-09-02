# backend

Backend của Live-Trans: nhận chunk audio từ frontend, chạy ASR, dịch (qua lớp glossary giữ thuật ngữ), trả kết quả về hiển thị.

> ⚠️ **Chưa scaffold** — đang chờ chốt stack, xem `docs/open-questions.md` (mục 2–6).

## Ứng viên kỹ thuật (đánh giá ban đầu)

**Python + FastAPI** là ứng viên chính:

- Hệ sinh thái AI/ASR mạnh nhất: faster-whisper, WhisperX, Argos Translate, NLLB đều là Python.
- WebSocket streaming để nhận chunk audio và trả transcript/dịch theo thời gian thực.
- Chạy local trên máy người dùng (`localhost`) — đúng mục tiêu chi phí ~0 và riêng tư.

## Vai trò các phần (dự kiến khi scaffold)

```
backend/
├── app/
│   ├── api/          # REST + WebSocket routes
│   ├── core/         # Config, settings
│   ├── services/
│   │   ├── asr/        # Interface + các provider (local, API)
│   │   ├── translate/  # Interface + các provider (LLM, truyền thống)
│   │   └── glossary/   # Từ điển thuật ngữ, quy tắc giữ nguyên văn
│   └── models/       # Schema message frontend ↔ backend
└── tests/            # Unit test
```

## Nguyên tắc

- ASR và Translate là **interface với nhiều provider** — đổi model không ảnh hưởng phần còn lại.
- Glossary là **tầng độc lập**, dùng chung cho dịch live và dịch PDF/paper (Giai đoạn 3).
- Schema message giữa frontend ↔ backend được định nghĩa rõ ngay từ đầu để test contract.
