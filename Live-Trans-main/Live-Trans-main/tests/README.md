# tests

Bài test tích hợp và fixtures dùng chung cho dự án. Unit test của từng phần nằm trong folder tương ứng (`backend/tests/`, frontend tự quản lý).

## Cấu trúc

```
tests/
├── fixtures/      # Sample dữ liệu test: audio/video ngắn, transcript kỳ vọng, PDF mẫu
└── integration/   # Test tích hợp: contract giao thức frontend ↔ backend, chạy pipeline end-to-end
```

## Định hướng

- **Contract test**: định nghĩa schema message (chunk meta, transcript, translation) giữa frontend và backend phải được test độc lập với framework — viết ngay khi chốt giao thức.
- **Fixture audio**: cần vài sample ngắn (30–60s) chất lượng đa dạng: lecture rõ ràng, nói nhanh, có thuật ngữ kỹ thuật — dùng để benchmark chất lượng giữ thuật ngữ.
- **Fixture PDF**: paper mẫu (2 cột, có hình/bảng) cho Giai đoạn 3.

> ⚠️ Fixtures chưa có — sẽ bổ sung khi vào Giai đoạn 1. Không commit file audio/video lớn (> 5MB); nếu cần, dùng link tải hoặc Git LFS.
