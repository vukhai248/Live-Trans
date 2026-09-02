# Các câu hỏi mở / đã chốt

> Cập nhật 2026-09-02 sau vòng research papers + docs chính thức. Kiến trúc chi tiết: `plan.md`.

## Đã chốt ✅

| Câu hỏi | Quyết định | Ghi chú |
|---|---|---|
| Hình thức sản phẩm | Chrome Extension MV3 | Chrome/Edge; side-load trước, CWS sau |
| Backend | Không bắt buộc — 2 mode Direct (gọi thẳng) / Local Gateway (script local giữ key) | plan.md §2 |
| Backend stack (nếu mở) | Node thuần không dependency cho gateway; Python chỉ dành cho phase PDF | |
| ASR | Chunked 45s, `gemini-3.5-transcribe` (Interactions API), verbatim + word timestamps + custom vocabulary | plan.md §3 |
| Live streaming | Là M4 (spike), `gemini-3.5-transcribe-live` + sessionResumption | |
| Dịch thuật | `gemini-3.5-flash`, batch 3–5 unit, placeholder mask + glossary chọn lọc + validate TSR + retry/splice | plan.md §4 |
| Chiến lược giữ thuật ngữ | Pipeline 5 bước dựa trên WMT'23/'25, ParseJargon, TEaR | plan.md §1.5, §4 |
| Tooling | npm (WXT/Vite), TypeScript strict | |
| Fallback quota | Không làm — token queue + batching đủ (audio 25 token/s) | |
| Phân phối | Side-load zip (Developer Mode) | |
| PDF/paper | **Hoãn** — chỉ mục triển vọng | plan.md §10 |
| Ngôn ngữ | ASR auto-detect (85+); dịch target mặc định Việt (config) | |

## Đang mở ⏳ (không chặn MVP)

1. **Captions fast-path**: video có sẵn phụ đề EN (YouTube/Coursera) → bỏ ASR chỉ dịch. Tiết kiệm quota lớn, nhưng cần đánh giá ToS từng nền tảng và độ bền DOM/track API. — Đánh giá sau M3.
2. **Gateway hay Direct làm mặc định khi phát hành rộng**: Direct tiện hơn cho sinh viên; Gateway an toàn hơn theo policy Google. Quyết lại ở M5.
3. **Chunk size mặc định**: 45s theo research độ trễ; cần số liệu thực tế (lag p50/p95 từ M1) để tinh chỉnh, có thể theo dõiadaptive.
4. **Overlap biên chunk**: mặc định không overlap (dựa word timestamps); chỉ bật overlap 2s + strip nếu benchmark M1 đo mất từ ở biên.
5. **Cấu trúc glossary mẫu**: bộ "kỹ thuật phần mềm" ~50–100 term sẽ biên soạn ở M2 — nguồn lấy đâu (tự viết vs thu thập từ cộng đồng).
6. **Chrome Web Store**: tiêu chí "đủ ổn" để lên store (số người dùng side-load? độ ổn định?) — quyết ở M5.

## Đã loại ❌ (có lý do)

- **Desktop app (Electron/Tauri)**: nặng, khó overlay, không đúng bài toán (user chốt extension).
- **Whisper fallback local khi hết quota**: user xác nhận quota đủ dùng; không tăng phạm vi MVP.
- **API key rotation "router"**: chỉ là phương án phòng bị, không làm.
- **Web app frontend riêng**: bỏ khi kiến trúc thuần extension được chốt.
