# Lộ trình

> ⚠️ **Cập nhật 2026-09-03**: video path (M1–M4) **tạm hoãn** — pipeline đã chạy được end-to-end thật nhưng dính quota `gemini-3.5-transcribe` free tier (25 RPM) + còn 2 vấn đề mở. **Ưu tiên mới: dịch PDF/paper giữ layout** (Giai đoạn 3 được kéo lên), dịch bằng `gemini-3.5-flash-lite`. Chi tiết đầy đủ: `HANDOFF.md`.
>
> Đồng bộ với `plan.md` §9 — mỗi milestone có tiêu chí nghiệm thu.

## M0 — Scaffold ✅ (đang làm)
Cấu trúc repo + docs (đã xong) → WXT + TS + lint + CI; rename `frontend/` → `extension/`.

## M1 — Capture → transcript tiếng gốc (1–2 tuần)
PCM capture + loopback, chunk 45s, ASR word timestamps, overlay phụ đề tiếng gốc tiến triển, RMS silence detect.
✅ 30 phút video: phụ đề đúng, không trôi mốc, tab vẫn có tiếng, tab DRM bị phát hiện.

## M2 — Dịch + glossary v1 (1–2 tuần)
Pipeline dịch 5 bước (mask → dịch → validate TSR → retry → splice/restore), overlay song ngữ, Options + glossary editor.
✅ Fixture video kỹ thuật: TSR ≥ 95%, placeholder roundtrip 100%.

## M3 — Độ bền (1 tuần)
Gateway mode + auto-detect, token queue, retry/backoff, export .srt/.txt, pause/resume, chặn đa tab.
✅ 1 giờ liên tục không lỗi; mất mạng tự phục hồi.

## M4 — Live mode (spike, tuỳ chọn)
`gemini-3.5-transcribe-live`, PCM 100ms, xoay session (resumption 2h, GoAway), interim text.
✅ Trễ < 5s (90% dòng); xoay session không mất câu.

## M5 — Đóng gói & phát hành nội bộ (0.5–1 ngày)
Zip side-load, README cài đặt tiếng Việt, privacy note, hướng dẫn góp glossary.
✅ Người không kỹ thuật cài được chỉ theo README.

---

## Đã dịch chuyển ra ngoài lộ trình

- **PDF/paper** (trước đây là Giai đoạn 3): **hoãn** — xem triển vọng `plan.md` §10 (BabelDOC là ứng viên khi mở lại).
- **Chrome Web Store**: quyết định sau M5.
- **Captions fast-path**: đánh giá sau M3 (xem `open-questions.md`).
