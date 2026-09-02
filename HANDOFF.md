# HANDOFF — Tình trạng dự án Live-Trans

> **Cập nhật: 2026-09-02.** File này dành cho agent/kỹ sư tiếp theo để nắm tiến độ trong 2 phút. Nguồn sự thật kỹ thuật đầy đủ: [`docs/plan.md`](docs/plan.md) (có bằng chứng research kèm link). Câu hỏi mở: [`docs/open-questions.md`](docs/open-questions.md).

## Bối cảnh làm việc với chủ project

- Chủ project **vibecode, không đọc code** — agent phải tự kiểm chứng mọi thứ, không được assumed.
- Docs + commit message: **tiếng Việt**, thuật ngữ kỹ thuật giữ tiếng Anh.
- Benchmark chất lượng cốt lõi: **giữ thuật ngữ học thuật & code nguyên văn** (`npm run start`, `useEffect`...), đo bằng **TSR ≥ 95%**.
- Repo: `github.com/vukhai248/Live-Trans` (private, nhánh `main`). Quy trình: mọi thay đổi commit + push thẳng main.
- Ý tưởng mới → ghi vào `docs/open-questions.md`, **không tự ý mở rộng scope** (plan §9 R7).

## Trạng thái hiện tại (sau merge code từ cloud agent, 2026-09-02)

Kiến trúc đã chốt trong `docs/plan.md`: Chrome Extension MV3 (WXT + TypeScript strict + Preact), KHÔNG backend bắt buộc — 2 mode gọi Gemini (Direct / Local Gateway), ASR chunked 45s, pipeline dịch 5 bước giữ thuật ngữ.

### Đã implement (code có trong repo)

| Phần | Chi tiết | File chính |
|---|---|---|
| M0 scaffold | WXT + TS + ESLint/Prettier + Vitest + CI (GitHub Actions: `npm run check`) + icons + package-lock | `extension/`, `.github/workflows/ci.yml` |
| Capture | tabCapture → offscreen: getUserMedia + loopback `<audio>` (vẫn nghe tab), PCM 16kHz mono qua **ScriptProcessorNode**, chunker 45s (clamp 30–180), RMS detect im lặng/DRM | `extension/lib/capture/` |
| ASR | Files API upload (WAV wrapper) → `/v1beta/interactions`, verbatim + word timestamps; parser chịu nhiều shape response (API preview); fallback synth timestamps | `extension/lib/asr/` |
| Pipeline dịch 5 bước | mask `⟦n⟧` → batch 4 (`gemini-3.5-flash`, JSON out) → validate (placeholder roundtrip + TSR) → retry 1× với phê bình → splice + badge ⚠ | `extension/lib/translate/batcher.ts`, `extension/lib/masker/`, `extension/lib/glossary/` |
| UI | Popup (bật/tắt, pause, export .srt/.txt, metrics TSR/units/calls/splices, 8 ngôn ngữ); Options (mode demo/direct/gateway, key, chunk slider, glossary editor + starter glossary); Content overlay Shadow DOM (tiêu đề dịch, định vị theo video, CPS 17) | `extension/entrypoints/` |
| Gateway | `gateway.mjs` Node thuần không dependency: key từ `.env`, `/health` + `/transcribe` + `/translate` + `/translate-title` | `gateway/` |
| Docs mới | INSTALL.md (side-load tiếng Việt cho người không kỹ thuật), TESTING.md (inventory test), 3 script verify API (không in key) | `docs/`, `scripts/` |
| Bonus | Mode **demo/offline** (MockProvider — chạy nguyên pipeline không cần key), demo page tĩnh, 10 file unit test (~50 case) | `extension/lib/providers/mock.ts`, `demo/` |

### ⚠️ CHƯA verify — làm đầu tiên khi quay lại

1. **`npm run check` chưa chạy lần nào** (lần chạy bị hủy giữa chừng): `cd extension && npm ci && npm run check`. README của agent claim pass nhưng chưa kiểm chứng độc lập.
2. **Chưa build/chưa load vào Chrome**: `npm run build` → load `.output/chrome-mv3` qua `chrome://extensions`.
3. Parser ASR tự ghi "Verified live 2026-09-02" — là claim của agent, **chưa kiểm chứng độc lập**. Đường verify có key thật: `node scripts/verify-gemini.mjs` rồi `node scripts/test-transcribe.mjs`.

### Issue mở (theo độ ưu tiên)

1. **P1 — `custom_vocabulary` KHÔNG được gửi ở tầng ASR.** `direct-gemini.ts` comment rằng Gemini không hỗ trợ custom vocabulary cùng word timestamps — **claim chưa verify** với [docs chính thức](https://ai.google.dev/gemini-api/docs/transcribe). Nếu docs cho phép dùng chung: thêm lại vào `transcription_config` để kích hoạt glossary tier-1 (lưu ý `AsrClient.customVocabulary()` hiện là dead code). Nếu đúng là không tương thích: cập nhật plan §3.
2. **P1 — backpressure "2+2 in-flight" trong `offscreen/main.ts` là GIẢ**: `pending.splice(...)` chỉ cắt mảng promise đã chạy, không giới hạn; token queue ở service worker (plan §6) chưa có. Fix = semaphore/queue thật.
3. **P2 — `stopSession()` xóa `subtitleStore`** → không export .srt được sau khi dừng (nút export cũng chỉ hiện khi đang chạy). Nên giữ store tới phiên kế tiếp.
4. **P2 — capture dùng ScriptProcessorNode** thay vì AudioWorklet làm chính (ngược plan, có lý do ổn định được ghi chú; hợp đồng `CaptureHandle` giữ nguyên → nâng cấp drop-in).
5. **P3** — `host_permissions: <all_urls>` (cần biện minh khi lên Chrome Web Store); logic prompt bị nhân bản trong `gateway.mjs` (DRY); mode mặc định `demo`.

## Cách chạy

```bash
# Extension
cd extension
npm ci
npm run dev      # dev + HMR → load .output/chrome-mv3 qua chrome://extensions (Developer Mode)
npm run check    # typecheck + lint + unit tests
npm run build && npm run zip   # đóng gói side-load

# Gateway (mode Gateway, tuỳ chọn)
cd gateway && cp .env.example .env   # điền GEMINI_API_KEY
node gateway.mjs                      # localhost:8787

# Verify API thật (cần key trong .env ở repo root)
node scripts/verify-gemini.mjs
node scripts/test-transcribe.mjs
```

Mặc định extension ở **chế độ Demo** (không cần key) để chạy thử pipeline + overlay.

## Quy tắc kỹ thuật bắt buộc (plan §5 — vi phạm là sai kiến trúc)

- **fetch thuần + native endpoints**; KHÔNG JS SDK `@google/genai` (bị 403 trong browser); KHÔNG endpoint OpenAI-compat (CORS).
- **KHÔNG MediaRecorder/webm** cho live pipeline — capture PCM thô (AudioWorklet/ScriptProcessorNode).
- **Model ID tập trung trong config** (`direct-gemini.ts`: `TRANSCRIBE_MODEL`, `FLASH_MODEL`) — API đang public preview, dễ đổi.
- **API key**: chỉ từ user nhập (lưu `chrome.storage.local`) hoặc `.env` gateway. KHÔNG BAO GIỜ hardcode/commit key.
- Mọi unit dịch phải đi qua mask → translate → validate → retry → splice (xem `batcher.ts`) — không gọi model "trần".

## An ninh (đã scan toàn repo 2026-09-02)

Sạch: không key hardcode, không eval/obfuscation, mọi domain hợp lệ (googleapis/aistudio/docs/papers/npm/localhost), `.env.example` chỉ placeholder, `gateway` mở CORS `*` trên localhost (chấp nhận cho preview — hardening ở M3).

## Milestones còn lại

- **M1/M2 acceptance test thực tế**: video YouTube 30' → không trôi mốc, tab vẫn có tiếng; TSR ≥ 95% trên fixture video kỹ thuật (fixtures chưa có — cần thu thập: 3 video 2–5' + golden transcript, xem `tests/README.md`).
- **M3**: token queue thật, export sau khi dừng (issue #3), dọn offscreen, DRM UX.
- **M4** (tuỳ chọn): Live API `gemini-3.5-transcribe-live` — sessionResumption, PCM 100ms, trễ <5s.
- **M5**: build-zip script, privacy note hoàn chỉnh.
- Chi tiết acceptance từng milestone: `docs/roadmap.md` + `docs/plan.md` §9.
