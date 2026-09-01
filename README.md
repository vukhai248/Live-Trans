# Live-Trans

Dịch live âm thanh/video sang ngôn ngữ của người dùng, với tiêu chí đầu tiên là **miễn phí cho học sinh/sinh viên** và **bảo toàn thuật ngữ học thuật**.

## Vấn đề giải quyết

- Video học thuật trên YouTube, Coursera, Udemy... thường không có phụ đề/ngôn ngữ người dùng cần, trong khi người xem vẫn muốn học dù tiếng Anh hạn chế.
- Các công cụ dịch video hiện tại đều yêu cầu phí thuê bao — rào cản thật sự với sinh viên, học sinh.
- Công cụ dịch tài liệu (paper, PDF) hay làm "vỡ" thuật ngữ và code (ví dụ `npm run start` bị dịch/bóp méo), mất hình ảnh và layout gốc.

## Định hướng sản phẩm

Chrome extension bắt luồng âm thanh tab video bất kỳ (YouTube, Coursera, Udemy...), nhận diện giọng nói bằng **Gemini 3.5 Transcribe**, dịch bằng **Gemini 3.5 Flash** kèm **glossary bảo toàn thuật ngữ học thuật** (`npm run start`, `useEffect`... không bị bóp méo), hiển thị phụ đề song ngữ live. Chi phí người dùng cuối ≈ 0 (free tier Gemini + key cá nhân). Về sau mở rộng sang PDF/paper (hiện đã hoãn).

> Kiến trúc & kế hoạch chi tiết đã chốt: [`docs/plan.md`](docs/plan.md) — được tinh chỉnh từ research papers học thuật + docs chính thức của Google + khảo sát các extension thực tế.

## Cấu trúc repo

```
Live-Trans/
├── docs/          # plan.md (nguồn sự thật), open-questions, architecture, roadmap...
├── frontend/      # → sẽ rename thành extension/ ở M0 (WXT + TypeScript + Preact)
├── backend/       # Placeholder — chỉ mở khi làm PDF (đã hoãn)
├── tests/         # e2e + fixtures (video mẫu, golden transcript, golden glossary)
├── scripts/       # dev, build-zip (side-load), check
└── README.md
```

## Trạng thái

- ✅ Giai đoạn 0: init repo + docs
- ✅ Chốt kiến trúc sau research (xem `docs/plan.md` §1 — bằng chứng kèm link papers/docs)
- ⏳ Tiếp theo: **M0 scaffold extension** (WXT + TS + CI) → M1 capture → transcript
- 📅 Lộ trình: `docs/roadmap.md`
