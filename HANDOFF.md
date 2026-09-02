# HANDOFF — Live-Trans (cập nhật 2026-09-03, lần 2)

> 📌 **VIỆC LÀM TIẾP: PHẦN PDF/PAPER — LÀM TRƯỚC LUÔN (xem §1 P). Video path HOÃN TẠM (§3).**
> File này để buổi làm việc kế tiếp (hoặc agent khác) nắm toàn bộ bối cảnh trong vài phút. Nguồn sự thật kiến trúc: [`docs/plan.md`](docs/plan.md). Quyết định mới nhất: [`docs/open-questions.md`](docs/open-questions.md).

## 0. Bối cảnh làm việc với chủ project (ĐỌC TRƯỚC KHI LÀM)

- Chủ project **vibecode, không đọc code** — agent phải tự kiểm chứng mọi thứ bằng thực nghiệm, không assumed.
- **Chỉ được thao tác/edit/đọc trong folder dự án** (`D:\create\Live-Trans`). Mọi thao tác đụng máy ngoài dự án (cài app, kill process lạ...) phải hỏi trước.
- Docs + commit message: **tiếng Việt**, thuật ngữ kỹ thuật giữ tiếng Anh.
- Repo: `github.com/vukhai248/Live-Trans` (private, branch `main`), commit + push thẳng.
- API key test nằm trong `.env` ở gốc repo (đã gitignore, KHÔNG commit, KHÔNG in ra log). Khi app ổn sẽ bỏ và chuyển sang key người dùng tự nhập.
- Benchmark cốt lõi: **giữ thuật ngữ học thuật & code nguyên văn** (`npm run start`, `useEffect`...), đo bằng TSR ≥ 95%.

## 1. P. ⭐ PHẦN PDF/PAPER — LÀM TRƯỚC (spec đầy đủ, chốt với chủ project 2026-09-03)

### 1.P.1. Định hướng sản phẩm (đã chốt, KHÔNG phải tải PDF về)

Dịch paper **ngay trong extension, trên web**:

1. User mở paper PDF trên web (arxiv, mọi URL .pdf). **Nút nổi (FAB) góc trên** trang — bấm vào.
2. Mở **tab mới = viewer dịch của extension**: render trang PDF + **thay chữ gốc bằng chữ đã dịch** ngay trên layout gốc (giữ hình vẽ, bảng, công thức ở dạng ảnh/vector không đụng vào).
3. **3 chế độ xem** (toggle trong viewer): **Chỉ bản dịch** (mặc định) · **Song song** (2 cột: gốc | dịch) · **Chỉ bản gốc** (PDF gốc nguyên vẹn).
4. Dịch theo trang khi cuốn tới (lazy, page-by-page), cache theo URL+page để lật lại không tốn quota.

### 1.P.2. Model & quota (chốt)

- Dịch bằng **`gemini-3.5-flash-lite`** — ý kiến chủ project: **limit cao hơn** `gemini-3.5-flash` (flash thường đã dính 429 ở video path). KHÔNG dùng flash thường cho PDF.
- Reference code chủ project cung cấp (python `google-genai`): `model="gemini-3.5-flash-lite"`, config `thinking_config=thinking_level="MINIMAL"`. Bản TS tương đương: `thinkingConfig: { thinkingLevel: 'MINIMAL' }` trong GenerateContentConfig.
- Đã xác minh ở CLI prototype: flash-lite + `response_mime_type: 'application/json'` hoạt động; batch 12 block/call; 429 → đã có `fetch-retry.ts` chờ theo `Retry-After` (dùng lại nguyên văn).

### 1.P.3. Trạng thái chuẩn bị (đã có sẵn trong repo)

| Tài sản | Vị trí | Ghi chú |
|---|---|---|
| CLI prototype PyMuPDF (Python, chạy được sau khi fix syntax) | `backend/translate_paper.py` | Chứng minh thuật toán: extract block + bbox → batch JSON → redact text giữ ảnh → chèn lại. **Tham khảo thuật toán**, không dùng trực tiếp trong extension |
| Paper mẫu (Universal Guidance for Diffusion Models, 15 trang, 612×792pt, ~250 text block) | `backend/samples/2302.07121.pdf` (53MB, gitignored) — URL gốc: `https://arxiv.org/pdf/2302.07121` | Đã inspect: text block = `page.get_text('dict')`, block ảnh type=1 giữ nguyên |
| Font Noto Sans có dấu tiếng Việt (Regular + Bold) | `backend/fonts/` | Extension dùng font riêng hoặc web font khi chèn |
| Glossary mẫu | `tests/fixtures/golden-glossary.json` | Format `{term, type: command|code|jargon|acronym, vi}` |
| **Pipeline dịch TS tái sử dụng NGUYÊN VĂN** | `extension/lib/masker/`, `extension/lib/glossary/` (selector ≤25 term, validator TSR), `extension/lib/translate/` (batcher + prompt + JSON parse), `lib/providers/fetch-retry.ts` (429 Retry-After) | Chỉ cần thay nguồn text: thay chunk audio bằng các block PDF |
| Provider abstraction | `extension/lib/providers/` | Thêm method `translateBlocks()` vào interface hoặc gọi direct prompt builder |

### 1.P.4. Kiến trúc kỹ thuật đề xuất (agent thực hiện theo hướng này)

```
[Trang web PDF (arxiv...)] --FAB click--> [mở tab chrome-extension://<id>/viewer/viewer.html?url=<pdf-url>]

VIEWER (extension page — có mọi quyền extension):
├─ pdfjs-dist: fetch PDF (host_permissions <all_urls> đã có) → render canvas từng trang
│   + page.getTextContent() → text items (mỗi item: str + transform matrix + width)
├─ lib/pdf/blocks.ts (MỚI): nhóm text items → block/đoạn
│   thuật toán (tham khảo backend/translate_paper.py extract_blocks):
│   sort theo y rồi x; gộp item cùng dòng (|Δy| < fontsize*0.5), gộp dòng liền kề
│   thành đoạn (khoảng cách dòng < 1.6×line-height VÀ cùng cột — PDF 2 cột academic
│   phải tách theo cột: chia page theo x-midpoint hoặc gap ngang lớn giữa các item)
├─ lib/pdf/translate.ts (MỚI): batch BLOCK_SIZE=10-12 block → DirectGeminiProvider
│   với FLASH_LITE model + prompt giữ thuật ngữ + response_mime_type JSON
│   (masker ⟦n⟧ cho code/URL/công thức $...$; selector glossary ≤25 term/batch;
│   validate + retry 1 lần — y hệt video path)
├─ Overlay dịch: absolute-positioned divs ĐÈ LÊN canvas, mỗi div 1 block đã dịch,
│   vị trí = bbox của block gốc (scale theo viewport), tự co chữ nếu tràn (scale_low)
└─ 3 chế độ: translated (che canvas text — pdf.js render KHÔNG textLayer → chỉ ảnh
   + vector còn, text thay bằng overlay) | side-by-side (2 canvas) | original (canvas thuần)
```

**Lưu ý kỹ thuật pdfjs-dist (bẫy đã biết):**
- Cài `pdfjs-dist` vào `extension/`; worker: `import * as pdfjsLib from 'pdfjs-dist'` + `pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('/pdf.worker.min.mjs')` — copy worker vào output (WXT: đặt trong `public/` hoặc config Vite).
- Bật `isEvalSupported: false` tuỳ chọn (CSP); với CJK cần cMaps (`cMapUrl` trỏ vào bundle) — MVP bỏ qua CJK, chỉ Anh→Việt.
- Text item transform: `[a,b,c,d,e,f]` — fontsize ≈ `Math.hypot(b, d)` (bzw `scale`), vị trí `e, f` là baseline.
- Trang PDF arxiv mẫu: 612×792pt (2 cột academic).
- **arxiv URL `/pdf/xxxx` trả HTML viewer mới của arxiv, KHÔNG phải PDF thuần** → viewer fetch URL đó có thể nhận HTML; xử lý: nếu content-type ≠ application/pdf → thử URL gốc `.pdf` (arxiv cho phép `/pdf/2302.07121v1.pdf`) hoặc tìm `<iframe>/<embed>` src. Đã test: fetch trực tiếp với UA thường trả PDF ✓ (curl được, 53MB).
- Cache: `chrome.storage.session` key `pdf:<hash-url>:p<page>` lưu blocks+translations (session storage tự xoá khi đóng browser — an toàn nội dung bản quyền).
- Quota: flash-lite limit cao hơn; vẫn batch 10–12 block/call + fetch-retry 429 có sẵn. 15 trang ≈ 21 calls — thoải mái.

### 1.P.5. Việc cần làm cụ thể (checklist cho agent)

- [ ] `npm i pdfjs-dist` trong `extension/` + cấu hình worker vào build (WXT)
- [ ] `extension/lib/pdf/blocks.ts` — extract + group block (kèm unit test với fixture text items giả)
- [ ] `extension/lib/pdf/translate.ts` — batch dịch qua provider (flash-lite) + cache `chrome.storage.session`
- [ ] `extension/entrypoints/viewer/` — trang viewer (html + main.ts): url param, render, 3 chế độ, progress "đang dịch trang N"
- [ ] `entrypoints/content/index.ts` — thêm FAB khi URL kết thúc `.pdf` HOẶC host arxiv.org/pdf/* (và trang chứa `<embed type="application/pdf">`) → `chrome.tabs.create({url: viewer?url=...})`
- [ ] `lib/protocol/messages.ts` + settings: thêm `pdfTargetLang` (mặc định vi) nếu cần
- [ ] Đổi model dịch PDF: hằng số `FLASH_LITE_MODEL = 'gemini-3.5-flash-lite'` trong lib/pdf (KHÔNG đụng FLASH_MODEL của video path)
- [ ] Test thật (kịch bản §6, thay bước 3-4 bằng: mở arxiv → FAB → viewer) + CDP screenshot từng trạng thái
- [ ] Acceptance: paper 15 trang — hình vẽ/bảng KHÔNG bị đụng; thuật ngữ + citation [1] nguyên văn; 3 chế độ chuyển được; lật lại trang đã dịch không tốn call

### 1.P.6. Backend CLI (side tool, không bắt buộc cho sản phẩm)

`backend/translate_paper.py` — prototype Python PyMuPDF đã viết (đã fix syntax `global`), chứng minh thuật toán redact+chèn. Cài: `pip install pymupdf google-genai` vào conda **DL** (đã cài). Chạy: `python backend/translate_paper.py backend/samples/2302.07121.pdf --pages 1-3`. Chưa chạy end-to-end (đứng lại khi pivot sang web viewer) — lỗi tiềm ẩn có thể còn; dùng để đối chiếu thuật toán khi làm `lib/pdf/`.

## 2. Trạng thái video path — ĐÃ CHẠY ĐƯỢC THẬT (bằng chứng)

Pipeline end-to-end **đã hoạt động thật 1 lần đầy đủ** trước khi dính quota:

- ✅ Extension cài vào Chromium for Testing, popup/options/content/offscreen chạy.
- ✅ Bắt audio tab (`tabCapture` → offscreen → PCM 16kHz mono) hoạt động.
- ✅ ASR `gemini-3.5-transcribe` (Interactions API, **inline base64**, verbatim + word timestamps) trả transcript + timestamps thật.
- ✅ Dịch `gemini-3.5-flash` batch → **29 units** xuất bản, chất lượng dịch tốt:
  - "doing, how would you build something like this if you are building a cloud agent?" → *"đang làm, bạn sẽ xây dựng một hệ thống tương tự như thế nào nếu bạn đang xây dựng một tác nhân đám mây (cloud agent)?"*
  - "So if you're doing this from scratch, it will probably take you 15 days to a month." → *"Vì vậy, nếu bạn tự xây dựng từ đầu, việc này có thể sẽ mất khoảng từ 15 ngày đến một tháng."*
- ✅ Đường SW → content script → overlay: **đã verify** (gửi test unit từ SW, overlay nhận + render đúng text).
- ✅ 72/72 unit tests, typecheck + lint sạch, `npm run build` OK (98 kB).
- ✅ API key test hoạt động (popup có nút "🧪 Kiểm tra kết nối API Key" → ✅ model gemini-3.5-flash).

## 3. 2 vấn đề mở của video path (khi quay lại phải giải quyết)

### 3.1. Quota `gemini-3.5-transcribe` free tier = **25 request/phút** (KHÔNG phải unlimited)

- AI Studio hiển thị "0 / Unlimited" RPM **gây hiểu nhầm** — thực tế lỗi 429 trả về: `Quota exceeded for metric: generate_content_free_tier_requests, limit: 25, model: gemini-3.5-transcribe, Please retry in 57.3s`.
- Steady-state của pipeline: 1 ASR call / 45s chunk ≈ **1.3 RPM** — dư sức. **Vấn đề là burst**: nhiều chunk dồn hàng + retry + nhiều session test chạy song song (xem §4) → chạm trần.
- Đã fix: `fetch-retry.ts` đọc `Retry-After` / "retry in Xs" từ response, chờ đúng (tối đa 65s), tổng 5 lần retry. Chưa test vì quota đã cạn trong buổi test.
- **Ý tưởng cải thiện khi quay lại**: tăng `chunkSeconds` lên 60–120 để giảm RPM; cân nhắc ném chunk lỗi vào hàng đợi "thử lại sau" thay vì bỏ; cân nhắc Live API (`gemini-3.5-transcribe-live`, cũng 20K TPM) cho chế độ realtime.

### 3.2. Bí ẩn chưa giải: session "tự chạy"

Quan sát: sau khi launch browser + mở popup bằng `Ctrl+Shift+U`, popup hiển thị "Đang dịch" với progress đếm — **mặc dù không ai bấm "Bắt đầu"**. Giả thuyết mạnh nhất: các lần "launch" trước thực chất **attach vào browser cũ còn sống** (xem §4) nên thấy session cũ của offscreen cũ; sau khi dọn zombie + restart thật, cần xác nhận lại hiện tượng còn tồn tại không. Nếu còn: tìm ai gọi `startSession`/`START_SESSION` (chỉ popup toggle và background handleStart là 2 đường).

### 3.3. Chưa verify cuối

Overlay hiển thị với **units thật** chưa được nhìn thấy trực tiếp (chỉ verify bằng unit test injection). Sau khi quota hồi + fix §4, quay lại: start → play → poll `scripts/cdp.mjs check` → `subtitleVisible: true` + chụp màn hình.

## 4. ⚠️ BÀI HỌC LỚN NHẤT — zombie Chromium processes (bẫy khi test)

**Hiện tượng:** mọi triệu chứng "không giải thích được" (units không tới overlay, crash loop, popup báo session cũ, stale frame...) đều do: khi launch `chrome.exe` với **cùng `--user-data-dir`** trong khi browser cũ còn sống → process mới chỉ **mở thêm cửa sổ trong browser cũ rồi thoát** → extension vẫn là **bản cũ**, offscreen cũ vẫn chạy (13 process zombie tích lũy!).

**Quy tắc bắt buộc khi test:**
1. Trước khi launch: chạy `powershell -ExecutionPolicy Bypass -File scripts/kill-cft.ps1` (kill mọi process chrome.exe có path `*ms-playwright*`, KHÔNG đụng Chrome thường).
2. Sau khi launch: kiểm tra `curl -s http://localhost:9222/json` trả về đúng 1 browser.
3. Nếu nghi ngờ trạng thái lạ → kill-cft.ps1 trước, launch lại, rồi mới debug.

## 5. Bug đã fix trong buổi này (đã commit)

| Bug | Fix | File |
|---|---|---|
| ASR dùng flash-LLM inline (không timestamps) | Về **1 đường duy nhất**: Interactions API + inline base64 + verbatim + word timestamps | `lib/providers/direct-gemini.ts` |
| Parser không đọc được shape response thật | Thêm nhánh `steps[].content[].text` + `steps[].content[].annotations[]` (word_info, "0.100s") | `lib/asr/parser.ts` + 3 tests |
| Gateway dùng `gemini-3.7-flash` + upload Files | Về `gemini-3.5-flash` + inline base64 + shape steps | `gateway/gateway.mjs` |
| **Offscreen crash** `browser.tabs.sendMessage` (offscreen không có `chrome.tabs`) → mọi unit không publish được | `sendToTab` forward qua `runtime` → background case `FORWARD_TO_TAB` → `tabs.sendMessage` | `entrypoints/offscreen/main.ts`, `entrypoints/background.ts`, `lib/protocol/messages.ts` |
| 429 retry 3× trong 4s (quá nhanh, phá quota) | Đọc `Retry-After`/"retry in Xs", chờ đúng (≤65s), 5 retries | `lib/providers/fetch-retry.ts` + tests |
| Export .srt sau khi dừng hỏng | Không đóng offscreen khi stop (giữ subtitle store) | `entrypoints/background.ts` |
| Response shape ASR đã xác minh thật (quan trọng): | text ở `steps[].content[].text`; timestamps ở `steps[].content[].annotations[]` dạng `{"text":"Welcome","start_offset":"0.100s","end_offset":"0.600s","type":"word_info"}` | — |

## 6. Công cụ debug có sẵn (tất cả trong `scripts/`, chạy bằng Node của conda DL)

| Script | Công dụng |
|---|---|
| `kill-cft.ps1` | **Chạy TRƯỚC MỌI lần test** — dọn Chromium for Testing zombie |
| `api-probe.mjs` | Verify key + models list + Files upload + Interactions (file URI + inline) — dùng audio speech thật `tests/fixtures/speech.wav` |
| `make-speech-fixture.ps1` | Tạo WAV lời nói thật bằng Windows SAPI (chứa `npm run start`, `useEffect`, `gradient descent`) |
| `cdp.mjs` | Điều khiển tab YouTube qua CDP (port 9222): `play`, `pause`, `seek <s>`, `check` (đọc overlay Shadow DOM: `subtitleVisible`, text dịch/gốc, notice), `eval <js>` |
| `cdp-ext.mjs` | Attach service worker extension: `status` (settings + key prefix), `start` (xin streamId + START_CAPTURE — có thể lỗi gesture), `stop`, `state` (snapshot phụ đề) |
| `cdp-debug-offscreen.mjs` | Nghe console + network của offscreen N giây — **công cụ tìm bug chính của buổi này** (thấy crash + 429) |
| `verify-gemini.mjs`, `test-transcribe.mjs` | Verify key/endpoints cũ (LƯU Ý: verify-gemini có URL upload SAI — double `v1beta`; URL đúng là `/upload/v1beta/files`) |

**Kịch bản test chuẩn (khi quay lại video path):**
```bash
powershell -ExecutionPolicy Bypass -File scripts/kill-cft.ps1
"C:\Users\Admin\AppData\Local\ms-playwright\chromium-1228\chrome-win64\chrome.exe" --user-data-dir="D:\create\Live-Trans\.tools\profile" --no-first-run --no-default-browser-check --load-extension="D:\create\Live-Trans\extension\.output\chrome-mv3" --remote-debugging-port=9222 --window-size=1400,900 "https://www.youtube.com/watch?v=Ak_edo5Z9YM"
# Ctrl+Shift+U → popup → "Bắt đầu dịch video này" → đóng popup
node scripts/cdp.mjs play
# đợi ~60s (chunk 45s + ASR + dịch) rồi poll:
node scripts/cdp.mjs check    # subtitleVisible + text
node scripts/cdp-ext.mjs state  # snapshot units
```

## 7. Môi trường đã setup

- **Node**: trong conda env **DL** (`nodejs` 26.8.0 qua conda-forge). PATH: `C:\Users\Admin\anaconda3\envs\DL`. Lưu ý npm warning về Node alpha — hoạt động bình thường.
- **Browser test**: Chromium for Testing v149 (`C:\Users\Admin\AppData\Local\ms-playwright\chromium-1228\chrome-win64\chrome.exe`) — **Chrome stable 2026 đã chặn `--load-extension`** kể cả với feature flag, bắt buộc dùng CfT.
- Profile test: `D:\create\Live-Trans\.tools\profile` (chứa chrome.storage của extension — settings + key; đã gitignore `.tools/`).
- Phím tắt extension: **Ctrl+Shift+U** (đã thêm `_execute_action` vào manifest) — mở popup không cần click.
- `npm ci` đã chạy trong `extension/` → `npm run check` = prepare + typecheck + lint + **72 tests**.

## 8. Cấu trúc knowledge đã xác minh về Gemini (đừng bỏ thời gian verify lại)

- Model tồn tại: `gemini-3.5-transcribe`, `gemini-3.5-transcribe-live`, `gemini-3.5-flash`, `gemini-3.5-flash-lite`, `gemini-3.7-flash`, `gemini-3.5-live-translate-preview`, `gemini-3.1-flash-live-preview` (đã list từ API).
- Auth key mới dạng `AQ.xxx` dùng được với header `x-goog-api-key`.
- Interactions API nhận **audio inline base64** (không cần Files upload) → không vướng CORS upload.
- Audio token: 25 token/giây. Free tier transcribe: **25 RPM** (KHÔNG unlimited); data free tier được Google dùng cải thiện sản phẩm.
- Chrome stable mới chặn `--load-extension`; CfT vẫn cho phép.
- Popup.html KHÔNG mở được như tab thường (`ERR_BLOCKED_BY_CLIENT`) — chỉ qua action click/shortcut.
- MV3 offscreen document: KHÔNG có `chrome.tabs` — chỉ `chrome.runtime` + một số API hạn chế.

## 9. Việc tiếp theo (thứ tự ưu tiên — cập nhật 2026-09-03 lần 2)

1. **⭐ PDF/paper web viewer — LÀM TRƯỚC LUÔN** theo spec §1.P (checklist §1.P.5). Bắt đầu bằng `npm i pdfjs-dist` + `lib/pdf/blocks.ts`.
2. Video path (khi quay lại): verify overlay với units thật sau khi quota hồi → giải §3.2 → Live API mode (M4).
3. Đổi model dịch video sang flash-lite (đồng bộ với quyết định PDF) — 1 dòng ở `direct-gemini.ts`, nhưng phải test lại vì video path nhạy latency hơn.
4. UI overhaul (dark đen/xanh, light sáng/xanh, icon Lucide/Tabler): làm khi PDF viewer ổn.
5. Backend CLI `translate_paper.py`: chạy lại end-to-end để đối chiếu thuật toán (side tool, không chặn sản phẩm).
