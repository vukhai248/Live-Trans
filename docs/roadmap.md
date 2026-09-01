# Lộ trình

> Thứ tự giai đoạn là định hướng ban đầu, sẽ điều chỉnh sau buổi thảo luận kiến trúc.

## Giai đoạn 0 — Init dự án ✅

- Cấu trúc repo: `docs/`, `frontend/`, `backend/`, `tests/`, `scripts/`
- Tài liệu nền: overview, requirements, architecture (khung), roadmap, open-questions
- Git repo khởi tạo

## Giai đoạn 1 — MVP dịch live

Mục tiêu: xem một video YouTube tiếng Anh và thấy phụ đề tiếng Việt live, chấp nhận độ trễ vài giây.

- Chốt kiến trúc & stack (xem `open-questions.md`)
- Scaffold frontend + backend thật, chạy được end-to-end với provider "dummy" (echo)
- Thay provider dummy bằng ASR + dịch thật (ưu tiên local/free-tier)
- Test contract giữa frontend ↔ backend

## Giai đoạn 2 — Giữ thuật ngữ học thuật

Mục tiêu: dịch video kỹ thuật không bóp méo thuật ngữ/code — đây là "benchmark" chất lượng của dự án.

- Thiết kế glossary: định dạng, cách nạp, nguồn mặc định
- Cơ chế giữ nguyên văn code/lệnh trong kết quả dịch
- Bộ test so sánh chất lượng: sample video + transcript kỳ vọng
- UI cho người dùng chỉnh glossary

## Giai đoạn 3 — Dịch PDF/paper

Mục tiêu: dịch tài liệu nghiên cứu giữ hình ảnh, layout, thuật ngữ.

- Parse PDF (text, ảnh, bảng, layout)
- Dịch giữ template + xuất bản đọc được
- Dùng chung glossary với Giai đoạn 2

## Giai đoạn 4 — Hoàn thiện

- Đa ngôn ngữ ASR/dịch (mở rộng cặp ngôn ngữ)
- Tối ưu độ trễ, xử lý nói nhanh/chất lượng audio kém
- Đóng gói phân phối (store hoặc side-load), tài liệu cài đặt cho người dùng cuối
- Tùy chọn: dịch text trên trang web (không chỉ audio)
