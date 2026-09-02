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
├── docs/            # plan.md (nguồn sự thật), open-questions, architecture, roadmap...
├── extension/       # Code Chrome Extension (WXT + TypeScript strict + Preact) — M0
│   ├── entrypoints/ # background, offscreen, content, popup, options
│   └── lib/         # providers, asr, translate, glossary, masker, subtitles, protocol
├── gateway.mjs      # gateway/gateway.mjs — proxy local không dependency (preview, M3)
├── backend/         # Placeholder — chỉ mở khi làm PDF (đã hoãn)
├── tests/           # e2e + fixtures (video mẫu, golden transcript, golden glossary)
├── scripts/         # dev, build-zip (side-load), check
└── README.md
```

## Trạng thái

- ✅ Giai đoạn 0: init repo + docs
- ✅ Chốt kiến trúc sau research (xem `docs/plan.md` §1 — bằng chứng kèm link papers/docs)
- ✅ **M0 scaffold extension**: WXT + TS strict + Preact + ESLint/Prettier/Vitest + CI; `npm run check`/`build`/`zip` đều pass (19 unit test)
- ⏳ Tiếp theo: **M1 capture → transcript** (xác minh đường bắt âm thanh + ASR với key thật)
- 📅 Lộ trình: `docs/roadmap.md`

## Chạy thử (side-load)

```bash
cd extension
npm install
npm run dev      # dev + HMR
npm run build    # build production
npm run zip      # đóng gói .zip để side-load qua Developer Mode
```

Mặc định extension ở chế độ **Demo** (không cần key) — chạy thử pipeline + overlay ngay. Vào
**Cài đặt** để nhập Gemini API key (mode Direct/Gateway) và chỉnh glossary.
