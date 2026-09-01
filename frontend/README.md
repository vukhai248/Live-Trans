# frontend (→ sẽ rename thành `extension/` ở M0)

Code Chrome Extension (MV3) của Live-Trans.

> Kiến trúc chi tiết & bằng chứng research: [`docs/plan.md`](../docs/plan.md). Stack đã chốt: **WXT + TypeScript strict + Preact/nanostores**.

## Thành phần (theo plan §2, §8)

```
extension/
├── entrypoints/
│   ├── background/    # Service worker: điều phối, token/quota queue (không giữ DOM API)
│   ├── offscreen/     # getUserMedia(tab) + <audio> loopback + AudioWorklet PCM 16kHz
│   │                  # + ASR/Translate client + segmenter + validator + subtitle queue
│   ├── content/       # Overlay phụ đề song ngữ
│   ├── popup/         # Bật/tắt, ngôn ngữ, trạng thái + metric (TSR, lag)
│   └── options/       # API key/mode, chunk size, glossary editor, export
├── lib/
│   ├── providers/     # Provider interface: DirectGemini | LocalGateway
│   ├── asr/           # gemini-3.5-transcribe client + parser (tách module)
│   ├── translate/     # batcher + prompt builder + JSON parser (gemini-3.5-flash)
│   ├── glossary/      # store + selector ≤25 term + TSR validator
│   ├── masker/        # placeholder ⟦n⟧ + restorer
│   ├── subtitles/     # segmenter 2×42 ký tự + CPS 17 + srt export
│   └── protocol/      # message types giữa các entrypoint
└── tests/             # Vitest
```

## Quy tắc kỹ thuật bắt buộc (plan §5)

- fetch thuần + **native endpoints** (không JS SDK — 403 trong browser; không OpenAI-compat — CORS)
- Model ID tập trung trong config (API đang public preview)
- API key chỉ từ `chrome.storage.local` (user nhập), không bao giờ nhúng trong code
- MediaRecorder/webm bị cấm cho live pipeline — capture bằng AudioWorklet PCM
