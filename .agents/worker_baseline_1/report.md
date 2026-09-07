# BÁO CÁO KIỂM TRA BASELINE VÀ TÍNH TOÀN VẸN CỦA TEST (LIVE-TRANS V1.0.1)

**Thời gian thực hiện**: 2026-09-07T21:50:00+07:00  
**Người thực hiện**: Worker Baseline Verification & Test Integrity Inspector (`worker_baseline_1`)  
**Thư mục làm việc**: `d:\create\Live-Trans\.agents\worker_baseline_1`  
**Dự án**: Live-Trans (Extension v1.0.1)

---

## 1. TỔNG QUAN KẾT QUẢ (EXECUTIVE SUMMARY)

| Hạng mục kiểm tra | Lệnh thực thi | Kết quả | Ghi chú |
|---|---|---|---|
| **Unit Tests** | `npm.cmd test` | **PASS 100%** (123/123 tests, 17 suites) | 0 failure, 0 skipped, thời gian ~1.7s - 2.4s |
| **Typecheck** | `npm.cmd run typecheck` (`tsc --noEmit`) | **PASS 100%** (0 lỗi) | Không có lỗi kiểu dữ liệu TypeScript |
| **Linter** | `npm.cmd run lint` (`eslint .`) | **PASS 100%** (0 lỗi) | Chuẩn linting hoàn toàn sạch |
| **CI Check tổng thể** | `npm.cmd run check` | **PASS 100%** | Bao gồm prepare:wxt + typecheck + lint + test |
| **Build Bundle** | `npm.cmd run build` (`wxt build`) | **PASS 100%** | Output: `extension/.output/chrome-mv3/` (3.31 MB) |
| **Test Independence** | Rà soát AST & import paths | **CẢNH BÁO CAO** | Phát hiện `lib/pdf/blocks.test.ts:372` tham chiếu `backend/samples/2302.07121.pdf` |

---

## 2. KẾT QUẢ KIỂM TRA UNIT TESTS CHI TIẾT (`npm.cmd test`)

Toàn bộ 123 tests được quản lý bởi **Vitest v4.1.11**, cấu hình trong `extension/vitest.config.ts`. Toàn bộ test suite được phân bổ trên 17 file nằm tại `extension/lib/**/*.test.ts`.

### 2.1. Bảng tổng hợp 17 Test Suites

| STT | File Test Suite | Số lượng tests | Trạng thái | Thời gian thực thi |
|:---:|---|:---:|:---:|:---:|
| 1 | `lib/asr/parser.test.ts` | 15 | PASSED | 0.02s |
| 2 | `lib/capture/wav.test.ts` | 5 | PASSED | 0.01s |
| 3 | `lib/protocol/queue.test.ts` | 2 | PASSED | 0.07s |
| 4 | `lib/pdf/blocks.test.ts` | 18 | PASSED | 1.58s |
| 5 | `lib/pdf/markdown.test.ts` | 5 | PASSED | 0.02s |
| 6 | `lib/pdf/reflow.test.ts` | 5 | PASSED | 0.01s |
| 7 | `lib/pdf/translate.test.ts` | 9 | PASSED | 0.02s |
| 8 | `lib/pdf/vision-cache.test.ts` | 8 | PASSED | 0.02s |
| 9 | `lib/masker/masker.test.ts` | 5 | PASSED | 0.01s |
| 10 | `lib/providers/fetch-retry.test.ts` | 5 | PASSED | 0.08s |
| 11 | `lib/providers/key-router.test.ts` | 6 | PASSED | 0.01s |
| 12 | `lib/glossary/selector.test.ts` | 8 | PASSED | 0.01s |
| 13 | `lib/glossary/validator.test.ts` | 4 | PASSED | 0.01s |
| 14 | `lib/subtitles/segmenter.test.ts` | 7 | PASSED | 0.01s |
| 15 | `lib/subtitles/srt.test.ts` | 10 | PASSED | 0.01s |
| 16 | `lib/translate/batcher.test.ts` | 8 | PASSED | 0.02s |
| 17 | `lib/translate/prompt.test.ts` | 3 | PASSED | 0.01s |
| **Tổng cộng** | **17 test suites** | **123 tests** | **123 PASSED / 0 FAILED** | **~2.43s (run đơn) / 1.70s (warm)** |

### 2.2. Danh sách chi tiết 123 bài kiểm thử (Test Cases)

#### Suite 1: `lib/asr/parser.test.ts` (15 tests)
1. `extracts output_text from the top-level field`
2. `extracts output_text from result.output_text fallback`
3. `extracts text from legacy text fields`
4. `returns empty text and words for empty input`
5. `parses word timestamps from duration strings like 0.100s`
6. `parses word timestamps from alternative field names`
7. `walks nested word-list paths`
8. `unwraps annotations entries with nested words arrays`
9. `falls back to evenly-spaced word synthesis when no word list is present`
10. `prefers real word timestamps over synthesized fallback`
11. `extracts language_code when present`
12. `extracts languageCode camelCase variant`
13. `extracts transcript text from steps[].content[].text`
14. `extracts word timestamps from steps[].content[].annotations[]`
15. `falls back to steps text synthesis when annotations are absent`

#### Suite 2: `lib/capture/wav.test.ts` (5 tests)
1. `produces a 44-byte RIFF header followed by PCM data`
2. `writes the canonical RIFF/WAVE/fmt/data markers`
3. `sets PCM format and mono 16-bit fields`
4. `sets the data chunk size and RIFF file size correctly`
5. `preserves the original PCM samples after the header`

#### Suite 3: `lib/protocol/queue.test.ts` (2 tests)
1. `limits concurrent tasks to the configured maximum`
2. `rejects non-positive concurrency`

#### Suite 4: `lib/pdf/blocks.test.ts` (18 tests)
1. `combines text spans on the same line`
2. `filters out rotated vertical margin watermark like arXiv stamp`
3. `handles de-hyphenation for split URLs and words`
4. `isolates running header at top of page`
5. `separates two academic columns with interleaved y coordinates`
6. `detects standalone math equations and labels`
7. `P1: does not mark prose ending with a year citation as formula`
8. `P1: does not mark hyphenated compounds as math fractions`
9. `P1: does not mark prose with a single inline equals as formula`
10. `isolates standalone headings like Abstract and 1. Introduction into separate blocks`
11. `isolates display equations from surrounding prose paragraphs`
12. `detects footnotes at page bottom and sets isFootnote`
13. `clusters multi-line fractions into a single unified formula block`
14. `isolates algorithm pseudocode boxes into an algorithm block`
15. `extracts Page 2 blocks and identifies equations` *(thời gian chạy ~1.55s do đọc PDF 53MB từ backend/samples)*
16. `does not treat inline subordinate clause starting with where/with as standalone formula`
17. `splits distinct paragraphs with first-line indent into separate blocks`
18. `extractPageFigures detects figure captions and calculates graphic bounding boxes`

#### Suite 5: `lib/pdf/markdown.test.ts` (5 tests)
1. `wraps inline math like {\alpha_t}_{t=1}^T and z_0 with $`
2. `P1: wraps \hat{z}_0 as one unit instead of splitting {z}`
3. `converts TextBlocks to structured Markdown elements`
4. `normalizes (f, 1) and (f, l) loss function pairs to $(f, \ell)$`
5. `normalizes S(·, ·, ·) math notation into LaTeX cdot`

#### Suite 6: `lib/pdf/reflow.test.ts` (5 tests)
1. `không đẩy gì khi bản dịch vừa khung`
2. `đẩy block cùng cột phía dưới, không đụng cột bên`
3. `block dưới cùng cột bị đẩy đúng bằng overflow phía trên`
4. `block full-width đồng bộ lại các cột`
5. `bỏ qua khi thiếu số đo (dùng chiều cao gốc)`

#### Suite 7: `lib/pdf/translate.test.ts` (9 tests)
1. `shields inline math like {\alpha_t}_{t=1}^T and z_0 without altering context`
2. `shields URLs like github.com repositories`
3. `shields LaTeX commands like \hat and \Delta (P1 trailing-\b fix)`
4. `restores tokens even when LLM inserts spaces inside them (P1 fuzzy unshield)`
5. `keeps trailing punctuation outside URL token (P1 mất dấu câu)`
6. `routes muse-spark to Responses API, others to chat/completions`
7. `extracts text from Responses API output (reasoning + message)`
8. `returns {} when Responses output has no message`
9. `extracts text from chat/completions choices`

#### Suite 8: `lib/pdf/vision-cache.test.ts` (8 tests)
1. `stores and retrieves translation from persistent cache`
2. `evicts paper when TTL (14 days) expires`
3. `enforces LRU eviction when paper count exceeds MAX_CACHED_PAPERS (50)`
4. `refreshes LRU timestamp when reading cache so active papers are not evicted`
5. `clears specific page cache without affecting other pages`
6. `clears entire paper cache when pageNumber is omitted`
7. `clears all vision cache via clearAllVisionCache`
8. `evicts oldest paper to free space when localStorage throws QuotaExceededError`

#### Suite 9: `lib/masker/masker.test.ts` (5 tests)
1. `masks command/code terms behind placeholders`
2. `restore reconstructs the original exactly`
3. `does not mask jargon (it is translated, not verbatim)`
4. `masks URLs regardless of glossary`
5. `placeholderIds lists ids`

#### Suite 10: `lib/providers/fetch-retry.test.ts` (5 tests)
1. `retries on 429 then succeeds`
2. `waits the Retry-After delay Google returns with 429`
3. `does not retry 4xx other than 429`
4. `retries 5xx up to 5 times then returns the last response`
5. `retries on a network error then succeeds`

#### Suite 11: `lib/providers/key-router.test.ts` (6 tests)
1. `parses comma and newline separated keys`
2. `rotates to next key on demand`
3. `automatically rotates and succeeds on 429 quota error`
4. `throws non-quota errors immediately without rotating`
5. `accepts array of keys`
6. `immediately throws rate limit error without rotating when only 1 key is present`

#### Suite 12: `lib/glossary/selector.test.ts` (8 tests)
1. `returns only terms that actually appear in the source`
2. `caps the result at the provided limit`
3. `respects a custom limit smaller than the default`
4. `prioritizes terms in glossary order when the source contains all of them`
5. `matches case-insensitively`
6. `deduplicates terms that appear multiple times in the glossary`
7. `returns an empty list for an empty glossary or empty source`
8. `does not treat a substring as a match`

#### Suite 13: `lib/glossary/validator.test.ts` (4 tests)
1. `selects only terms present in source`
2. `passes when authoritative forms are present`
3. `fails and complains when a jargon translation is missing`
4. `placeholder roundtrip must have each placeholder exactly once`

#### Suite 14: `lib/subtitles/segmenter.test.ts` (7 tests)
1. `breaks at sentence punctuation`
2. `caps length at maxChars`
3. `merges very short units`
4. `returns empty for no words`
5. `respects CPS and minimum 1s`
6. `formats timestamps and bilingual lines`
7. `plain text prefers translation`

#### Suite 15: `lib/subtitles/srt.test.ts` (10 tests)
1. `formats a single bilingual entry with translation first`
2. `separates multiple entries with a blank line`
3. `falls back to the original line when no translation exists`
4. `returns an empty string for no units`
5. `formats timestamps past one hour correctly`
6. `pads milliseconds to three digits`
7. `prefers the translation when available`
8. `falls back to the original when no translation exists`
9. `joins multiple units with newlines`
10. `returns an empty string for no units`

#### Suite 16: `lib/translate/batcher.test.ts` (8 tests)
1. `translates a single unit without a glossary`
2. `keeps command placeholders and restores them after translation`
3. `terms survive (TSR = 1) when the provider follows the glossary`
4. `retry(1) triggers on a first-fail then succeeds and updates stats`
5. `splice/restore appends lost terms and restores placeholders when retry also fails`
6. `a term-loss case triggers the retry path with a single-unit retry request`
7. `accumulates context pairs across batches`
8. `caps context pairs at 5`

#### Suite 17: `lib/translate/prompt.test.ts` (3 tests)
1. `builds a prompt with placeholders and glossary rules`
2. `parses a JSON object response`
3. `pads missing entries and strips markdown fences`

---

## 3. KẾT QUẢ KIỂM TRA LỖI TYPECHECK & LINTER (`npm.cmd run check`)

Lệnh `npm.cmd run check` thực thi chuỗi:
`npm run prepare:wxt && npm run typecheck && npm run lint && npm run test`

### 3.1. Chi tiết từng bước
1. **`prepare:wxt` (`wxt prepare`)**:
   - Sinh kiểu dữ liệu WXT định tuyến (`.wxt/types/`).
   - Thời gian thực thi: **1.572 s** (Không phát sinh cảnh báo).
2. **`typecheck` (`tsc --noEmit`)**:
   - Trình biên dịch TypeScript 6.0.3 quét toàn bộ codebase `extension/`.
   - Kết quả: **0 errors, 0 warnings**. Exit code 0.
3. **`lint` (`eslint .`)**:
   - ESLint 10.9.1 với cấu hình Flat Config `eslint.config.mjs` (sử dụng TypeScript-ESLint và Prettier).
   - Kết quả: **0 errors, 0 warnings**. Toàn bộ file mã nguồn tuân thủ 100% chuẩn style và typing.
4. **`test` (`vitest run`)**:
   - 17/17 file test pass, 123/123 tests pass.

**Kết luận**: Hệ thống CI hiện tại hoàn toàn sạch sẽ, không có bất kỳ "nợ kỹ thuật" (technical debt) nào về lint hoặc type error.

---

## 4. KẾT QUẢ XÁC MINH BUILD PRODUCTION (`npm.cmd run build`)

- **Công cụ**: WXT v0.21.4 (sử dụng Rolldown/Vite engine bên dưới).
- **Thời gian build**: **3.902 s**.
- **Thư mục đầu ra**: `d:\create\Live-Trans\extension\.output\chrome-mv3\` (Manifest V3 extension).
- **Tổng dung lượng**: **3.31 MB** (gồm 82 artifacts).

### 4.1. Phân bổ kích thước Bundle và các Artifact chính
1. **Tài nguyên Web Extension Core**:
   - `manifest.json`: 935 B
   - `background.js`: 5.64 kB (Service Worker)
   - `content-scripts/content.js`: 13.49 kB (Content script nhúng vào tab)
   - `pdf.worker.min.mjs`: 1.27 MB (Web Worker của PDF.js)
2. **Entrypoint HTML & Chunks giao diện**:
   - `viewer.html` (760 B) + `chunks/viewer-*.js` (**799.27 kB**) + `assets/viewer-*.css` (62.61 kB) -> *Giao diện đọc & dịch song ngữ PDF (chiếm tỉ trọng lớn nhất trong JS application)*.
   - `popup.html` (721 B) + `chunks/popup-*.js` (17.86 kB) + `assets/popup-*.css` (12.54 kB).
   - `options.html` (576 B) + `chunks/options-*.js` (7.30 kB) + `assets/options-*.css` (9.91 kB).
   - `offscreen.html` (626 B) + `chunks/offscreen-*.js` (13.27 kB) -> *Offscreen document dùng cho AudioContext/tabCapture*.
3. **Thư viện KaTeX Fonts**:
   - Gồm 58 file fonts (`.woff2`, `.woff`, `.ttf`) phục vụ render công thức toán học LaTeX với tổng dung lượng ~1.1 MB.
4. **Shared Chunks**:
   - `direct-gemini-*.js`: 7.07 kB
   - `jsxRuntime.module-*.js`: 13.38 kB
   - `key-router-*.js`: 3.36 kB
   - `settings-*.js`: 3.19 kB
   - `selector-*.js`: 239 B

### 4.2. Đánh giá về thư mục `dist/` ở Root dự án
- Thư mục `dist/` ở gốc repository chỉ chứa 1 file zip duy nhất: `dist/live-trans-extension.zip` (kích thước **38.2 kB**).
- Đây là artifact đóng gói thủ công của phiên bản cũ (POC v0.1 hoặc bản nén mã nguồn trước khi tích hợp KaTeX và PDF.js 6.3).
- Bản build thực tế của dự án v1.0.1 nằm tại `extension/.output/chrome-mv3/` và khi chạy `npm run zip` sẽ sinh ra zip tương ứng trong `extension/.output/`.

---

## 5. KIỂM TRA MÃ NGUỒN TESTS & PHÂN TÍCH ĐỘ PHỤ THUỘC (TEST INTEGRITY)

### 5.1. Các thành phần trong `extension/` được kiểm thử
Test suite 123 tests bao phủ chặt chẽ tầng **Core Logic (`extension/lib/`)**:
- **ASR & Audio Streaming**:
  - `lib/asr/parser.ts`: Kiểm tra mọi định dạng payload trả về từ Gemini Streaming / WebSocket ASR (chuẩn mới, chuẩn legacy, word timestamps, language detection).
  - `lib/capture/wav.ts`: Kiểm tra việc đóng gói PCM raw buffer sang chuẩn header WAV 44 bytes RIFF/WAVE 16kHz mono.
- **PDF Engine (Giai đoạn 3)**:
  - `lib/pdf/blocks.ts`: Thuật toán gom cụm TextBlock, lọc watermark arXiv, tách cột 2-column layout, nhận diện Display Equation, phát hiện block thuật toán (Algorithm), Footnote.
  - `lib/pdf/markdown.ts`: Chuyển đổi khối văn bản sang Markdown, bọc toán học inline `$`, chuẩn hóa ký hiệu toán học $(f, \ell)$.
  - `lib/pdf/reflow.ts`: Thuật toán tính toán độ tràn văn bản (overflow) và dồn cột (reflow offset) để bản dịch vừa khung trang PDF gốc.
  - `lib/pdf/translate.test.ts`: Che chắn công thức toán LaTeX & URLs trước khi gửi prompt cho LLM, phục hồi sau dịch (fuzzy unshielding).
  - `lib/pdf/vision-cache.ts`: Quản lý bộ nhớ đệm trang PDF dịch (LRU 50 papers, TTL 14 ngày, xử lý vượt dung lượng `QuotaExceededError`).
- **Translation Engine & Providers**:
  - `lib/translate/batcher.ts`: Batching cụm câu, đo lường Term Survival Rate (TSR), tự động retry khi mất thuật ngữ chuyên ngành.
  - `lib/translate/prompt.ts`: Tạo prompt định dạng JSON, cắt bỏ markdown fences.
  - `lib/providers/fetch-retry.ts`: Xử lý HTTP 429 Rate Limit, exponential backoff, đọc header `Retry-After` của Google Gemini.
  - `lib/providers/key-router.ts`: Xoay vòng mảng API Key (Key Pool) khi gặp lỗi hạn mức (Quota Exceeded).
  - `lib/masker/masker.ts`: Mặt nạ hóa các lệnh terminal / code term bằng placeholder chống dịch nhầm.
  - `lib/glossary/selector.ts` & `validator.ts`: Lọc thuật ngữ xuất hiện trong nguồn, xác thực tính toàn vẹn của glossary.
  - `lib/subtitles/segmenter.ts` & `srt.ts`: Phân đoạn phụ đề, giới hạn ký tự trên dòng (CPS), format xuất file `.srt`.
  - `lib/protocol/queue.ts`: Giới hạn concurrency của các tác vụ không đồng bộ.

### 5.2. Các thành phần trong `extension/` KHÔNG có Unit Test trực tiếp
- **Các UI Entrypoints**: `entrypoints/popup/App.tsx`, `entrypoints/options/App.tsx`, `entrypoints/viewer/App.tsx`.
- **Background Service Worker**: `entrypoints/background/index.ts`.
- **Content Script**: `entrypoints/content/index.ts`.
- **Offscreen Capture**: `entrypoints/offscreen/main.ts`, `lib/capture/audio-capture.ts`.
- **WebSocket Client trực tiếp**: `lib/asr/client.ts`.
*(Lý do: Các thành phần này phụ thuộc vào Chrome Extension Runtime API (`chrome.runtime`, `chrome.tabCapture`, `chrome.storage`) và Preact DOM Component — phù hợp cho E2E test hơn là Vitest Node environment).*

### 5.3. Test Runner có phụ thuộc vào `backend/`, `demo/`, `gateway/`, `scripts/`, `tests/` không?

#### ⚠️ Phát hiện Phụ thuộc Ẩn duy nhất (Hidden External File Dependency)
Trong file `extension/lib/pdf/blocks.test.ts` tại dòng 367 - 374:
```typescript
  it('extracts Page 2 blocks and identifies equations', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

    const pdfPath = path.resolve(__dirname, '../../../backend/samples/2302.07121.pdf');
    if (!fs.existsSync(pdfPath)) return;
    ...
```
- **Hiện trạng**: File `backend/samples/2302.07121.pdf` hiện đang tồn tại với dung lượng **53.1 MB**.
- Khi chạy `npm.cmd test`, bài test này thực sự mở file PDF 53MB và thực hiện toàn bộ các phép assertion (kiểm tra block counts > 5, kiểm tra phương trình (1), (2), (3)).
- **Cơ chế Silent Skip**: Mã nguồn có dòng kiểm tra `if (!fs.existsSync(pdfPath)) return;`.
  - **Hệ quả nếu xóa thư mục `backend/` ngay lập tức**: Lệnh `npm.cmd test` **vẫn sẽ báo 123/123 pass**, nhưng bài test số 15 của `blocks.test.ts` sẽ bị **Silent Skip** (không có bất kỳ assertion nào được thực thi, trở thành test rỗng / facade).
  - Điều này vi phạm nguyên tắc **Integrity Mandate** nếu không được giải quyết minh bạch!

#### Khảo sát các thư mục khác
1. **`demo/`**: Không có bất kỳ test nào hoặc code nào trong `extension/` import file từ `demo/`. Chỉ có chuỗi enum `mode: 'demo'` trong `settings.ts`.
2. **`gateway/`**: Không có test nào import mã nguồn `gateway/gateway.mjs`. `batcher.test.ts` chỉ dùng URL giả định `'http://localhost:8787'`.
3. **`scripts/`**: Không có test nào import mã nguồn từ `scripts/`.
4. **`tests/` (Root)**: Thư mục `tests/` ở root hiện chỉ có `README.md`, `fixtures/` (gồm 3 file sample: golden-glossary.json, sample-transcript.json, speech.wav) và `integration/.gitkeep`. Cấu hình Vitest chỉ quét `extension/lib/**/*.test.ts` và `extension/tests/**/*.test.ts`. Hoàn toàn không quét `d:\create\Live-Trans\tests/`.

---

## 6. ĐÁNH GIÁ TÍNH KHẢ THI KHI DỌN DẸP / DI DỜI THƯ MỤC NGOÀI `extension/`

| Thư mục | Mức độ phụ thuộc của Test | Đánh giá khi Xóa / Di dời | Khuyến nghị tái cấu trúc |
|---|---|---|---|
| `backend/` | **Phụ thuộc 1 file mẫu**: `backend/samples/2302.07121.pdf` (53 MB) | Nếu xóa `backend/`, test vẫn pass do có guard `!fs.existsSync(pdfPath) return;`, nhưng sẽ làm mất đi tính chân thực của kiểm thử equation extraction. | **KHÔNG XÓA TÙY TIỆN**. Đề xuất: Trích xuất 2 trang đầu của file PDF này (~500KB) hoặc di dời sang `tests/fixtures/2302.07121.pdf`, đồng thời cập nhật lại đường dẫn trong `blocks.test.ts:372` để test luôn chạy thật 100%. |
| `demo/` | **0% (Độc lập hoàn toàn)** | Xóa hoặc di dời an toàn 100%. Không ảnh hưởng tới `build`, `check`, hay `test`. | Có thể lưu trữ hoặc xóa nếu không còn dùng demo HTML tĩnh. |
| `gateway/` | **0% phụ thuộc lúc test** (chỉ là local proxy chạy độc lập khi người dùng chọn chế độ Gateway) | Xóa hoặc di dời không làm gãy test/build. | Giữ nguyên hoặc chuyển vào `tools/gateway/` nếu người dùng vẫn cần chế độ proxy local. |
| `scripts/` | **0% phụ thuộc lúc test** (chứa các script node/ps1 phụ trợ) | Không ảnh hưởng tới `extension/`. Riêng `scripts/check.ps1` chỉ gọi `npm.cmd run check` trong `extension/`. | Có thể tinh gọn, dọn dẹp các script probe cũ (`probe-dump.mjs`, `probe-dump2.mjs`). |
| `dist/` | **0% (File zip cũ 38KB)** | Xóa an toàn 100%. | Đưa vào danh sách dọn dẹp (rác build cũ). |
| `tests/` (Root) | **0% (Chưa dùng tới trong CI hiện tại)** | Không ảnh hưởng tới 123 tests hiện tại. | Thư mục định hướng cho Giai đoạn tiếp theo (chứa fixtures và integration test). Giữ lại cấu trúc. |

---

## 7. KẾT LUẬN & KIẾN NGHỊ CHO ORCHESTRATOR

1. **Hiện trạng Baseline**:
   - `npm.cmd test`: **123/123 tests pass 100%** (thời gian ~1.70s - 2.43s).
   - `npm.cmd run check`: **Sạch hoàn toàn** (0 lỗi TypeScript, 0 lỗi ESLint).
   - `npm.cmd run build`: **Thành công** (Bundle ra `extension/.output/chrome-mv3`, tổng size 3.31 MB).
2. **Cảnh báo cốt lõi**:
   - Để bảo toàn 100% tính toàn vẹn của test mà không gây "test ảo" (silent skip), nhóm tái cấu trúc cần lưu ý file `extension/lib/pdf/blocks.test.ts:372`. Khi dọn dẹp `backend/`, phải xử lý di dời file mẫu PDF này sang vị trí test fixtures phù hợp.
3. **Tính độc lập của Extension v1.0.1**:
   - Mã nguồn production và test của Extension v1.0.1 hầu như tự trị hoàn toàn bên trong thư mục `extension/`.
   - Các thư mục `demo/`, `dist/`, `scripts/` có thể được dọn dẹp/tinh gọn mà không gây ảnh hưởng tiêu cực đến Extension v1.0.1.
