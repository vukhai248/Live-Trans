# Plan chi tiết — Live-Trans

> Trạng thái: **đã chốt sau 2 vòng** — (1) thảo luận quyết định sản phẩm, (2) research papers học thuật + verify docs chính thức + khảo sát extension thực tế (09/2026). File này là nguồn sự thật cho việc triển khai.
> Mọi quyết định kỹ thuật đều ghi kèm bằng chứng (paper/docs) — xem [Phần 11](#11-nguồn-tham-khảo).

## 0. Tóm tắt quyết định

| Quyết định | Kết luận |
|---|---|
| Hình thức sản phẩm | **Chrome Extension (Manifest V3)** — TypeScript + WXT + Preact |
| Backend | **Không bắt buộc.** 2 mode gọi API qua interface `Provider`: `DirectGeminiProvider` (gọi thẳng, mặc định) và `LocalGatewayProvider` (script local giữ key, tuỳ chọn) |
| ASR | **Chunked 45 giây** (cấu hình 30–180s): AudioWorklet PCM → `gemini-3.5-transcribe` (Interactions API, verbatim + word timestamps + custom vocabulary) |
| Dịch | `gemini-3.5-flash`, batch 3–5 subtitle-unit/call, placeholder mask + glossary chọn lọc + context 3–5 câu |
| Giữ thuật ngữ | Pipeline 5 bước có paper chống lưng: mask → dịch → (refine) → validate TSR → retry/splice |
| Fallback quota | Không làm. Token queue + batching chống 429 là đủ (audio chỉ 25 token/s) |
| Phân phối | Side-load zip (Developer Mode); Chrome Web Store khi ổn |
| PDF/paper | **Hoãn** — chỉ mục triển vọng (Phần 10) |

## 1. Bằng chứng research làm nền cho thiết kế

### 1.1. Độ trễ phụ đề → phải chunk ngắn + hiển thị tiến triển

- Chuẩn nghề thông dịch: ear-voice span ~4 giây; hiển thị tiến triển (progressive) giảm cảm giác trễ ~0.6s so với hiển thị theo khối ([SimulST for Live Subtitling, MT Summit 2021](https://aclanthology.org/2021.mtsummit-1.4/)).
- Nghiên cứu có đối chứng (hội thảo VR): độ hiểu & co-presence giảm dần khi lag tăng từ 0→6s ([ACM 2025](https://dl.acm.org/doi/10.1145/3772318.3791389)).
- Thực tế giảng dạy: caption trễ 10–30s là vấn đề accessibility nghiêm trọng ([case study Univ. of Edinburgh](https://blogs.ed.ac.uk/ilts/2022/11/09/supporting-live-captioning-for-our-deaf-students-an-informatics-case-study/)).
- Hệ quả thiết kế: chunk ASR **45s** (không phải 3–5 phút), phụ đề hiện **ngay khi mỗi batch dịch xong**, không đợi hết chunk.

### 1.2. Ghép biên chunk

- Chunk ngắn + overlap gây trùng/m vỡ từ ở biên; các giải pháp: overlap 2–3s rồi strip khi merge ([thực hành cộng đồng](https://dev.to/nareshipme/audio-chunking-for-long-form-transcription-splitting-and-stitching-with-ffmpeg-typescript-4amk)), hoặc attention-guided chunking tránh cắt giữa từ ([Interspeech 2024](https://www.isca-archive.org/interspeech_2024/wang24ea_interspeech.pdf)).
- Hệ quả thiết kế: **không overlap mặc định** — dựa vào word timestamps của ASR để ghép; chỉ bật overlap 2s + strip nếu benchmark đo được mất từ ở biên (cơ chế DTW-lite).

### 1.3. Segmentation trước khi dịch

- Chất lượng MT chỉ hỏng khi segmentation cực đoan (quá dài/quá ngắn); tách phụ tại dấu phẩy giúp ([Wicks & Post, WMT 2022](https://aclanthology.org/2022.wmt-1.78/)); segment dài làm giảm chất lượng ([arXiv 2412.17592](https://arxiv.org/html/2412.17592v2)).
- Hệ quả thiết kế: dùng punctuation/sentence boundaries từ ASR, rồi chia nhỏ thành subtitle-unit ≤2 dòng × 42 ký tự, gộp unit < 1 giây.

### 1.4. Chuẩn hiển thị phụ đề

- Netflix Timed Text Style Guide: ≤20 CPS (người lớn), nhiều ngôn ngữ 17 CPS, 42 ký tự/dòng là phổ biến; BBC: 37 ký tự/dòng, tối đa 2 dòng ([Netflix](https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977), [BBC](https://www.bbc.co.uk/accessibility/forproducts/guides/subtitles/)).
- Eye-tracking: người xem chịu được tốc độ cao hơn chuẩn, nhưng trẻ em/em đang học cần chậm hơn ([Szarkowska et al. 2018](https://pmc.ncbi.nlm.nih.gov/articles/PMC6007935/)); caption giúp comprehension cho MỌI người xem, không chỉ người khiếm thính ([Gernsbacher 2015](https://pmc.ncbi.nlm.nih.gov/articles/PMC5214590/)).
- LLM làm phụ đề được đánh giá cao hơn MT truyền thống ([nghiên cứu đón nhận, Nature HSSC 2026](https://www.nature.com/articles/s41599-026-07414-6)).
- Hệ quả thiết kế: 2 dòng × 42 ký tự; thời lượng hiển thị = max(chars ÷ 17 CPS, 1s).

### 1.5. Giữ thuật ngữ (điểm cốt lõi của dự án)

- Translate→refine với glossary trong prompt cho trade-off tốt nhất ở WMT23; constrained decoding cứng làm giảm fluency ([Bogoychev & Chen, WMT 2023](https://arxiv.org/abs/2310.05824); [DuTerm, WMT 2025](https://arxiv.org/abs/2511.07461)).
- Glossary LỚN làm loãng: chuỗi dictionary dài làm giảm chất lượng ([Chain-of-Dictionary, arXiv 2305.06575](https://arxiv.org/abs/2305.06575)); giảm 57% kích thước glossary (22.6→9.7 term) tăng độ hữu ích 47%→77.5% trong dịch meeting realtime ([ParseJargon, CHI 2025](https://arxiv.org/abs/2508.10239)).
- Vòng lặp tự sửa (translate→estimate→refine) tăng chất lượng đáng kể so với one-shot ([TEaR, NAACL 2025 Findings](https://aclanthology.org/2025.findings-naacl.218/); [translation-agent (Andrew Ng)](https://github.com/andrewyng/translation-agent)).
- LLM thỉnh thoảng bỏ qua constraint (term dropping) — phải có validate ([Translate-and-Revise, arXiv 2407.13164](https://arxiv.org/abs/2407.13164)).
- Placeholder/masked markup cho span không-dịch (code, URL) bền hơn là "nhờ" model giữ nguyên ([WMT 2020](https://aclanthology.org/2020.wmt-1.138/), [WMT 2019](https://aclanthology.org/W19-6727/)).
- Đo lường: **Term Success Rate** là chuẩn WMT terminology task; BLEU/COMET không đo được term fidelity ([WMT25 terminology](https://www2.statmt.org/wmt25/terminology.html), [COMET pitfalls](https://arxiv.org/abs/2408.15366)).
- Nạp glossary vào tầng ASR (contextual biasing) cứu đúng thuật ngữ trước khi kịp tới MT ([TCPGen, arXiv 2410.18363](https://arxiv.org/abs/2410.18363); [ICASSP 2024](https://ieeexplore.ieee.org/document/10445918/)).
- Hệ quả thiết kế: pipeline 5 bước ở [Phần 4](#4-pipeline-dịch--glossary) + custom vocabulary cho ASR + metric TSR hiển thị trong UI.

### 1.6. Context giữa các batch dịch

- 1–3 câu liền trước là sweet spot; thêm context sâu lợi nhuận giảm nhanh, chi phí tăng ([Herold & Ney, CODI 2023](https://aclanthology.org/2023.codi-1.15/); tổng quan doc-MT).
- Cache cặp source→target (fuzzy-match/retrieval) cải thiện nhất quán thuật ngữ ([Adaptive MT, EAMT 2023](https://aclanthology.org/2023.eamt-1.22/); [RAT, arXiv 2210.05047](https://arxiv.org/abs/2210.05047)).
- Hệ quả thiết kế: prompt chứa 3–5 cặp dịch liền trước + entity glossary tăng dần theo phiên; KHÔNG nhét lịch sử dài.

### 1.7. Sự thật Gemini đã verify trên docs chính thức (không tin blog SEO)

| Sự thật | Giá trị | Nguồn |
|---|---|---|
| `gemini-3.5-transcribe` | Interactions API (`client.interactions.create`, config trong `generation_config.transcription_config`); verbatim (default) vs smart (không đi kèm timestamps/diarization); word timestamps qua `annotations[]` — **cảnh báo giảm accuracy, audio còn ≤30 phút khi bật**; diarization tối đa 8 speakers (3+ experimental); custom vocabulary ≤1000 terms (khuyến nghị ≤100) | [docs/transcribe](https://ai.google.dev/gemini-api/docs/transcribe) |
| Độ dài audio | 1 giờ/request (unary); 30 phút khi kèm annotations | [docs/transcribe](https://ai.google.dev/gemini-api/docs/transcribe) |
| `gemini-3.5-transcribe-live` | Live API WebSocket; input **raw PCM 16-bit 16kHz mono LE**, chunk 100ms; session 10 phút; `sessionResumption` handle sống 2 giờ; server gửi `GoAway` trước khi drop; compression = không giới hạn; **không có word timestamps/diarization ở live** | [live-transcribe](https://ai.google.dev/gemini-api/docs/live-api/live-transcribe), [session-management](https://ai.google.dev/gemini-api/docs/live-api/session-management) |
| Token audio | **25 token/giây** (≈1.500/phút) | [pricing](https://ai.google.dev/gemini-api/docs/pricing) |
| Giá (tham khảo) | transcribe: input $2/1M token (~$0.003/phút), output $12/1M; transcribe-live: $3.50/1M + $21/1M | [pricing](https://ai.google.dev/gemini-api/docs/pricing) |
| Free tier | Có cho cả 2 model; **free tier data dùng cải thiện sản phẩm Google** (paid thì không); rate limit theo-model xem tại aistudio.google.com/rate-limit | [pricing](https://ai.google.dev/gemini-api/docs/pricing), [rate-limits](https://ai.google.dev/gemini-api/docs/rate-limits) |
| API key | **Gemini API đã từ chối key chuẩn không-restrict; từ 9/2026 key chuẩn bị reject hoàn toàn** — key mới mặc định là auth key (bind service account, restrict Generative Language API). Khuyến cáo chính thức: không expose key client-side, nên dùng backend proxy; ephemeral token (`uses`=1, 30 phút) **chỉ cho Live API** | [api-key](https://ai.google.dev/gemini-api/docs/api-key), [ephemeral-tokens](https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens) |
| CORS | KHÔNG có cam kết chính thức nào cho browser → thiết kế phải có escape hatch (Gateway) | — |

### 1.8. Bài học từ các extension thực tế (survey GitHub)

| Dự án | Kiến trúc | Bài học |
|---|---|---|
| [begin0808/LiveCaption](https://github.com/begin0808/LiveCaption) (MIT) | MV3 offscreen + tabCapture → WebSocket về Python local (sherpa-onnx + VAD) | Reload extension làm **kẹt capture lock** (phải F5 tab); VAD client cắt mất âm đầu câu |
| [MohammdKopa/kami-subs](https://github.com/MohammdKopa/kami-subs) (MIT) | Offscreen = host bắt buộc của getUserMedia; **chunk raw PCM 16k mono qua WS → faster-whisper local**; Native Messaging tự spawn backend | **tabCapture trả silence trên tab DRM/Widevine**; "ScriptProcessorNode deprecated nhưng ổn định hơn AudioWorklet"; 1 capture/extension |
| [xignoe/videoTranslatorExtenstion](https://github.com/xignoe/videoTranslatorExtenstion) (MIT) | tabCapture → offscreen → **AudioWorklet chunk 16kHz ~5s**; Whisper on-device (transformers.js) | Whisper hallucination cần filter; Web Speech API chỉ nghe mic |
| [garywill/multi-subs-yt](https://github.com/garywill/multi-subs-yt) | Không ASR — dùng caption track sẵn của YouTube | Đường "no-audio" rẻ nhưng phụ thuộc DOM/track của từng trang (→ ý tưởng captions fast-path, Phần 10) |

Điểm hội tụ: **không dự án nào dùng MediaRecorder/webm cho live** — tất cả capture raw PCM trong offscreen. Thiết kế của ta theo hướng này.

## 2. Kiến trúc

```
┌──────────────────────────── Chrome Extension (MV3, WXT + TS + Preact) ────────────────────────────┐
│                                                                                                    │
│  [Popup]  bật/tắt phiên, chọn ngôn ngữ, trạng thái + metric (TSR, lag, số call)                    │
│     │ chrome.runtime message                                                                       │
│  [Service worker]  điều phối: tabCapture.getMediaStreamId → tạo offscreen; token/quota queue;      │
│     │              phiên (start/pause/stop); KHÔNG giữ DOM API                                     │
│  [Offscreen document]                                                                              │
│     ├─ getUserMedia(chromeMediaSource:'tab')                                                       │
│     ├─ Loopback: stream → <audio> (người dùng vẫn nghe tab bình thường)                            │
│     ├─ AudioWorklet → PCM 16kHz 16-bit mono (fallback: ScriptProcessorNode)                        │
│     ├─ Chunker 45s → base64 inline (≈1.4MB/chunk — thoải mái dưới hạn inline)                      │
│     ├─ ASR client ──────────┐                                                                      │
│     ├─ Translate client ────┤ Provider interface                                                   │
│     │                       ├─ DirectGeminiProvider (fetch native endpoints, key từ storage)        │
│     │                       └─ LocalGatewayProvider (http://localhost:PORT, auto-detect /health)    │
│     ├─ Segmenter → subtitle units (2 dòng × 42 ký tự)                                              │
│     ├─ Masker/Restorer (placeholder ⟦n⟧) + TSR Validator + Retry/Splice                            │
│     └─ Subtitle queue (mốc thời gian audio) ──► [Content script] overlay phụ đề                    │
│                                                                                                    │
│  [Options]  API key + mode (Direct/Gateway), cặp ngôn ngữ, chunk size, glossary editor, export     │
│  [chrome.storage.local]  settings + glossary + key (không dùng storage.sync)                        │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                         │ (Gateway mode, tuỳ chọn)
                                          ▼
                              [gateway.mjs — Node thuần, không dependency]
                               giữ key trong .env, proxy sang Gemini, CORS headers
```

**Vì sao 2 mode:** docs chính thức không cam kết CORS cho browser + khuyến cáo không expose key client-side + ephemeral token chỉ có ở Live API. Direct mode vẫn là mặc định vì (a) đúng tinh thần "cài là chạy" cho sinh viên, (b) key là của chính user nhập vào máy mình, không nhúng trong code (incident leak key $55k là nhúng key trong sản phẩm phân phối — [tham khảo](https://glaforge.dev/posts/2026/02/09/decoded-how-google-ai-studio-securely-proxies-gemini-api-requests/)). Gateway là escape hatch khi CORS đổi hoặc user muốn an toàn hơn.

## 3. Pipeline phiên dịch — từng bước

1. **Bắt đầu**: user bấm "Dịch tab này" → service worker `chrome.tabCapture.getMediaStreamId({targetTabId})` → gửi streamId + config cho offscreen.
2. **Capture**: offscreen `getUserMedia({audio: {mandatory: {chromeMediaSource: 'tab', chromeMediaSourceId}}})`; gắn stream vào `<audio>.play()` để loopback; AudioWorklet downmix/resample về PCM 16kHz mono; RMS theo dõi (để detect tab im lặng/DRM).
3. **Chunking**: buffer PCM cắt chunk **45s** mặc định (config 30–180s); mỗi chunk base64 inline gửi ASR ngay khi đầy (2 chunk in-flight tối đa).
4. **ASR** (`gemini-3.5-transcribe`, Interactions API): `verbatim` + `timestamp_granularities: ["word"]` + `custom_vocabulary` (≤100 term từ glossary, ưu tiên command/code/acronym). Chunk 45s << hạn 30 phút của annotations.
5. **Segmentation**: từ word stream → câu (punctuation) → **subtitle units** ≤2 dòng × 42 ký tự; gộp unit < 1s; cap ~15–20 từ/unit.
6. **Dịch batch 3–5 units/call** (`gemini-3.5-flash`) — chi tiết Phần 4.
7. **Hiển thị tiến triển**: batch nào xong hiện ngay; duration = max(chars/17, 1s); bản dịch dòng to + bản gốc dòng nhỏ (tuỳ chọn ẩn/hiện).
8. **Kết thúc**: dừng → flush chunk đang ghi → tổng hợp phiên → export `.srt` song ngữ + `.txt`; metric phiên (TSR, lag p50/p95, số call) hiển thị.

**Đồng bộ**: mốc thời gian = word timestamps quy về "giây từ lúc bắt đầu capture" (wall-clock anchor). Giới hạn đã biết: user seek trong video không dịch lại đoạn cũ (phụ đề theo dòng capture). Ghi rõ trong README sản phẩm.

**Độ trễ dự kiến**: 45–75s sau khi nói (phần còn lại của chunk + xử lý). Live mode (M4) hạ < 5s.

## 4. Pipeline dịch + glossary (5 bước, có bằng chứng)

```
Source unit ──► [1 Mask] ──► [2 Translate] ──► [3 Validate local] ──OK──► [5 Restore & hiển thị]
                code/cmd/URL     glossary chọn lọc      ^                  placeholder ⟦n⟧ → original
                → placeholder      ≤15–25 term           │
                ⟦n⟧                + context 3–5 câu     fail
                                                        │
                                                   [4 Retry 1 lần] (phê bình cụ thể) ── vẫn fail ──► splice
                                                                                              term gốc + badge ⚠
```

1. **Mask** (local, 0 chi phí): regex tách code/command/URL/identifier → thay bằng `⟦0⟧, ⟦1⟧...` giữ bảng map.
2. **Translate**: system prompt = vai trò + quy tắc giữ `⟦n⟧` nguyên văn + quy tắc theo `type` của glossary + 3–5 cặp dịch liền trước + entity glossary phiên; output JSON `{"translation", "terms_used"}`.
3. **Validate** (local, 0 chi phí): (a) roundtrip — mọi `⟦n⟧` xuất hiện đúng 1 lần; (b) TSR — mọi glossary term có mặt trong source phải xuất hiện nguyên văn (case-sensitive) trong output.
4. **Retry** 1 lần với phê bình cụ thể ("bạn đã biến 'npm run start' thành X — giữ nguyên văn"). Vẫn fail → **splice**确定性: chèn term gốc vào vị trí hợp lý + badge cảnh báo trên phụ đề.
5. **Restore + hiển thị**; ghi cặp (source, target đã duyệt) vào context cache; cập nhật entity glossary phiên.

Glossary JSON (người dùng chỉnh hoàn toàn — **không hardcode**, import/export ở Options):

```jsonc
{
  "version": 1,
  "terms": [
    { "term": "npm run start", "type": "command" },                    // giữ nguyên văn tuyệt đối
    { "term": "useEffect",     "type": "code" },                       // giữ nguyên văn
    { "term": "gradient descent", "type": "jargon", "vi": "hạ gradient" }, // dịch theo chuẩn này
    { "term": "GAN", "type": "acronym", "vi": "mạng đối sinh" }        // giữ + chú giải lần đầu
  ]
}
```

Metric trong UI: TSR phiên (mục tiêu ≥95%), placeholder roundtrip (mục tiêu 100%), số lần retry.

## 5. Công nghệ

| Thành phần | Lựa chọn | Ghi chú |
|---|---|---|
| Framework extension | **WXT** + TypeScript strict | Vite-based, HMR, template MV3 chuẩn |
| UI | **Preact** + nanostores | Nhẹ; đổi sang React dễ nếu cần |
| Capture | `tabCapture` + offscreen + **AudioWorklet PCM** | Fallback ScriptProcessorNode (bài học kami-subs) |
| ASR | `gemini-3.5-transcribe` (Interactions API) | Model ID + parser tách module (API đang preview) |
| Dịch | `gemini-3.5-flash` `generateContent` + structured output JSON | |
| HTTP | **fetch thuần + native endpoints** | KHÔNG JS SDK (report 403 trong browser); KHÔNG OpenAI-compat endpoint (CORS) |
| Gateway (tuỳ chọn) | `gateway.mjs` Node thuần không dependency | Chạy `node gateway.mjs`, key trong `.env` |
| Storage | `chrome.storage.local` | |
| Test | Vitest + Playwright + fixture giả | CI không tốn quota |
| Lint/format | ESLint + Prettier | |

Bài học vận hành nhúng vào code (từ §1.8): capture lock khi reload extension (dev note + auto-recover); DRM → silence (RMS detect + báo user); 1 capture/extension tại một thời điểm (chặn + báo khi bật tab thứ 2); không dùng VAD cắt audio (chỉ detect im lặng).

## 6. Ngân sách token/quota (đối chiếu giới hạn ~20k TPM)

Audio 25 token/s → chunk 45s ≈ **1.125 token**; output text ~nghìn token/giờ nói. Dịch: ~1–2k token/call (batch + context + glossary nhỏ).

| Kịch bản | Call ASR | Call dịch | Token đỉnh |
|---|---|---|---|
| 1 giờ video, chunk 45s | ~80 | ~50 | < 5k/phút (2+2 in-flight) |

Quy tắc: ≤2 ASR in-flight + ≤2 dịch in-flight; token queue trong service worker; 429 → backoff + hiện số call còn lại (ước tính). Nếu quota siết lại: tăng chunk size (180s → chỉ còn ~20 call ASR/giờ).

## 7. API key, riêng tư, phân phối

- User tự tạo key tại AI Studio — key mới **mặc định là auth key** (bắt buộc từ 9/2026), restrict "Gemini API only". Hướng dẫn từng bước trong README cài đặt.
- Mode Direct: key lưu `chrome.storage.local`; **không bao giờ** nhúng key trong code/repo (`.env` đã trong `.gitignore`).
- Mode Gateway: key trong `.env` của gateway local.
- Options hiển thị cảnh báo: **free tier — dữ liệu audio/text có thể được Google dùng cải thiện sản phẩm**; paid tier thì không. Người dùng tự quyết định.
- Phân phối: side-load zip qua Developer Mode. Chrome Web Store chỉ khi ổn định (khi đó bắt buộc Gateway mode hoặc ephemeral token cho Live).

## 8. Cấu trúc repo mục tiêu

```
Live-Trans/
├── extension/                    # (rename từ frontend/) toàn bộ code extension
│   ├── wxt.config.ts
│   ├── entrypoints/
│   │   ├── background/           # service worker: điều phối + queue
│   │   ├── offscreen/            # capture PCM + ASR/translate client + segmenter + validator
│   │   ├── content/              # overlay phụ đề
│   │   ├── popup/
│   │   └── options/              # key/mode, ngôn ngữ, chunk, glossary editor, export
│   ├── lib/
│   │   ├── providers/            # Provider interface + Direct/LocalGateway
│   │   ├── asr/                  # client + parser (tách module)
│   │   ├── translate/            # batcher + prompt builder + JSON parser
│   │   ├── glossary/             # store + selector (chọn lọc ≤25 term) + validator TSR
│   │   ├── masker/               # placeholder ⟦n⟧ + restorer
│   │   ├── subtitles/            # segmenter (2×42, CPS 17) + queue + srt export
│   │   └── protocol/             # message types background/offscreen/content/popup
│   └── tests/
├── gateway/gateway.mjs           # (M3) proxy local không dependency
├── tests/                        # e2e Playwright + fixtures (video + golden transcript + golden glossary)
├── scripts/                      # dev, build-zip (side-load), check
├── docs/
└── backend/                      # placeholder — chỉ mở khi làm PDF (đã hoãn)
```

## 9. Milestones

> Chưa đạt acceptance thì không sang bước sau.

### M0 — Scaffold (0.5–1 ngày)
WXT + TS + ESLint/Prettier; cấu trúc §8; rename `frontend/` → `extension/`; GitHub Actions chạy `npm run check` (lint + typecheck + unit).
✅ `npm run dev` load extension, popup mở được; `npm run build` ra zip.

### M1 — Capture → transcript tiếng gốc (1–2 tuần)
PCM capture + loopback (user vẫn nghe tab); chunker 45s; ASR + word timestamps; overlay phụ đề tiếng GỐC hiển thị tiến triển; RMS silence detect.
✅ Video YouTube tiếng Anh 30 phút: phụ đề đúng nội dung, không trôi mốc thời gian sau 30', tab vẫn có tiếng, tab im lặng không tạo call rác, tab DRM bị phát hiện và báo.

### M2 — Dịch + glossary v1 (1–2 tuần)
Toàn bộ pipeline dịch §4; overlay song ngữ; Options (key, ngôn ngữ, chunk size, glossary editor + import/export); metric TSR hiển thị.
✅ Trên fixture video kỹ thuật: **TSR ≥ 95%, placeholder roundtrip 100%**; `npm run start`, `useEffect`... nguyên văn trong phụ đề dịch.

### M3 — Độ bền (1 tuần)
Gateway mode + auto-detect `/health`; token queue; retry/backoff 429/5xx; export `.srt`/`.txt`; pause/resume; chặn đa tab; dọn offscreen đúng lúc; trạng thái lỗi rõ ràng.
✅ Chạy 1 giờ liên tục không lỗi; rớt mạng tự phục hồi; quota UI đúng.

### M4 — Live mode (spike, 1 tuần, tuỳ chọn)
`gemini-3.5-transcribe-live` WebSocket PCM 100ms-chunk; xoay session bằng `sessionResumption` (handle 2h, lắng nghe `GoAway`); interim text hiển thị ngay rồi thay bằng final; final text đẩy qua pipeline dịch §4.
✅ Trễ < 5s cho 90% dòng; xoay session không mất câu; live không có timestamps → hybrid: hậu kỳ chạy file-pass để export chính xác.

### M5 — Đóng gói & phát hành nội bộ (0.5–1 ngày)
`scripts/build-zip.ps1`; README cài đặt tiếng Việt từng bước (tạo restricted key → Developer Mode → dùng); privacy note (free tier data policy); hướng dẫn đóng góp glossary.
✅ Một bạn không kỹ thuật cài được chỉ theo README.

## 10. Triển vọng (ngoài phạm vi — không làm bây giờ)

- **PDF/paper (hoãn)**: hướng tốt nhất khi mở lại: BabelDOC (engine giữ layout, AGPL-3.0 — [repo](https://github.com/funstory-ai/BabelDOC), [paper arXiv 2605.10845](https://arxiv.org/abs/2605.10845)) bọc trong local service + Gemini translator; glossary dùng chung với video. AGPL → Live-Trans khi đó nên open-source tương thích.
- **Captions fast-path**: video có sẵn phụ đề EN (YouTube/Coursera) → bỏ ASR, chỉ dịch (tiết kiệm quota khổng lồ). Cần đánh giá ToS từng nền tảng; tham khảo [multi-subs-yt](https://github.com/garywill/multi-subs-yt).
- **Đa cặp ngôn ngữ**: kiến trúc đã neutral (ASR auto-detect 85+; target là config).

## 11. Nguồn tham khảo

### Docs chính thức Google (đã verify trực tiếp)
1. [Transcribe docs](https://ai.google.dev/gemini-api/docs/transcribe) — Interactions API, modes, timestamps, custom vocabulary, limits
2. [Model card gemini-3.5-transcribe](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-transcribe)
3. [Live transcribe](https://ai.google.dev/gemini-api/docs/live-api/live-transcribe) — PCM 16kHz, session, GoAway
4. [Session management](https://ai.google.dev/gemini-api/docs/live-api/session-management) — resumption handle 2h, compression
5. [Pricing](https://ai.google.dev/gemini-api/docs/pricing) — 25 token/s audio, giá, free tier data policy
6. [Rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) — xem tại aistudio.google.com/rate-limit
7. [API key policy](https://ai.google.dev/gemini-api/docs/api-key) — key chuẩn bị reject từ 9/2026, auth keys, restrictions
8. [Ephemeral tokens](https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens) — chỉ cho Live API
9. [Blog Google — Gemini 3.5 Transcribe](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-5-transcribe/)
10. [chrome.tabCapture](https://developer.chrome.com/docs/extensions/reference/api/tabCapture) · [chrome.offscreen](https://developer.chrome.com/docs/extensions/reference/api/offscreen) · [Tutorial Recall.ai](https://www.recall.ai/blog/how-to-build-a-chrome-recording-extension)

### Papers — độ trễ, streaming, chunking
11. [SimulST for Live Subtitling (MT Summit 2021)](https://aclanthology.org/2021.mtsummit-1.4/) — ear-voice span, progressive display
12. [ACM 2025 VR study](https://dl.acm.org/doi/10.1145/3772318.3791389) — delay hurts comprehension
13. [Edinburgh live captioning case study](https://blogs.ed.ac.uk/ilts/2022/11/09/supporting-live-captioning-for-our-deaf-students-an-informatics-case-study/)
14. [Attention-Guided Streaming Whisper (Interspeech 2024)](https://www.isca-archive.org/interspeech_2024/wang24ea_interspeech.pdf)
15. [Time-Restricted Attention (arXiv 2502.15158)](https://arxiv.org/html/2502.15158v1)
16. [EASiST (arXiv 2504.11809)](https://arxiv.org/html/2504.11809v1) · [SASST (AAAI 2026)](https://ojs.aaai.org/index.php/AAAI/article/view/40733/44694) · [TACL 2025 real-time SST eval](https://direct.mit.edu/tacl/article/doi/10.1162/tacl_a_00740/128861/) · [ictnlp survey](https://github.com/ictnlp/Simultaneous-Translation-Survey)
17. [CMU IWSLT 2025 streaming LLM ST](https://arxiv.org/html/2506.13143v1) · [InfiniSST (ACL Findings 2025)](https://aclanthology.org/2025.findings-acl.157.pdf) · [Cascaded alignment streaming (arXiv 2508.13358)](https://arxiv.org/html/2508.13358v1)

### Papers — segmentation, subtitling, context
18. [Wicks & Post, Does Sentence Segmentation Matter (WMT 2022)](https://aclanthology.org/2022.wmt-1.78/)
19. [Length issues in doc-MT (arXiv 2412.17592)](https://arxiv.org/html/2412.17592v2)
20. [Netflix Timed Text Style Guide](https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977) · [BBC Subtitle Guidelines](https://www.bbc.co.uk/accessibility/forproducts/guides/subtitles/)
21. [Szarkowska et al. 2018](https://pmc.ncbi.nlm.nih.gov/articles/PMC6007935/) · [Gernsbacher 2015](https://pmc.ncbi.nlm.nih.gov/articles/PMC5214590/) · [ChatGPT subtitles reception (Nature HSSC 2026)](https://www.nature.com/articles/s41599-026-07414-6)
22. [Herold & Ney, doc-MT context (CODI 2023)](https://aclanthology.org/2023.codi-1.15/) · [Adaptive MT fuzzy match (EAMT 2023)](https://aclanthology.org/2023.eamt-1.22/) · [RAT (arXiv 2210.05047)](https://arxiv.org/abs/2210.05047)

### Papers — thuật ngữ & glossary
23. [Bogoychev & Chen (WMT 2023)](https://arxiv.org/abs/2310.05824) · [DuTerm (WMT 2025)](https://arxiv.org/abs/2511.07461)
24. [Chain-of-Dictionary (arXiv 2305.06575)](https://arxiv.org/abs/2305.06575) · [Ghazvininejad dictionary prompting (arXiv 2302.07856)](https://arxiv.org/abs/2302.07856) · [Translate-and-Revise (arXiv 2407.13164)](https://arxiv.org/abs/2407.13164)
25. [ParseJargon (CHI 2025, arXiv 2508.10239)](https://arxiv.org/abs/2508.10239) — glossary nhỏ chọn lọc thắng glossary lớn
26. [TEaR (NAACL 2025 Findings)](https://aclanthology.org/2025.findings-naacl.218/) · [translation-agent](https://github.com/andrewyng/translation-agent) · [DragFT (arXiv 2402.15061)](https://arxiv.org/html/2402.15061v2)
27. [Markup tags MT (WMT 2020)](https://aclanthology.org/2020.wmt-1.138/) · [DNT placeholders (WMT 2019)](https://aclanthology.org/W19-6727/) · [DeepL XML](https://developers.deepl.com/docs/translate/translating-xml)
28. [WMT25 terminology task (TSR)](https://www2.statmt.org/wmt25/terminology.html) · [WMT25 findings](https://www2.statmt.org/wmt25/pdf/2025.wmt-1.30.pdf) · [COMET pitfalls (arXiv 2408.15366)](https://arxiv.org/abs/2408.15366) · [Doc-MT metrics (arXiv 2410.20941)](https://arxiv.org/abs/2410.20941)
29. [TCPGen biasing (arXiv 2410.18363)](https://arxiv.org/abs/2410.18363) · [Whisper biasing (arXiv 2306.01942)](https://arxiv.org/abs/2306.01942) · [LLM rescoring ASR (ICASSP 2024)](https://ieeexplore.ieee.org/document/10445918/) · [FST jargon biasing (SIGDIAL 2024)](https://aclanthology.org/2024.sigdial-1.42.pdf)

### Dự án mở rộng tham khảo
30. [BabelDOC](https://github.com/funstory-ai/BabelDOC) · [pdf2zh](https://github.com/PDFMathTranslate/PDFMathTranslate) — phase PDF tương lai
31. [LiveCaption](https://github.com/begin0808/LiveCaption) · [kami-subs](https://github.com/MohammdKopa/kami-subs) · [videoTranslatorExtenstion](https://github.com/xignoe/videoTranslatorExtenstion) · [multi-subs-yt](https://github.com/garywill/multi-subs-yt)
