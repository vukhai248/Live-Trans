# BÁO CÁO KIỂM TOÁN MÃ NGUỒN CHI TIẾT — R2: CORE LIBRARY & SERVICES (`extension/lib/`)

**Dự án**: Live-Trans v1.0.1  
**Phạm vi**: Toàn bộ module trong `extension/lib/`  
**Ngày thực hiện**: 2026-09-07  
**Người thực hiện**: Explorer Agent (`explorer_lib_1`)  
**Tình trạng baseline**: 17/17 test files passed, 123/123 unit tests passed, TypeScript clean (0 errors), ESLint clean (0 warnings).

---

## 1. TỔNG QUAN KIẾN TRÚC THỰC TẾ & SO SÁNH VỚI ĐẶC TẢ

### 1.1. Khảo sát cấu trúc thực tế của `extension/lib/`
Trong quá trình rà soát trực tiếp cây thư mục `extension/lib/`, chúng tôi ghi nhận cấu trúc thực tế gồm **9 thư mục con** và **46 tệp tin** (bao gồm 29 file mã nguồn chính và 17 file unit test đi kèm).

Bảng đối chiếu giữa tài liệu yêu cầu / giả định ban đầu và hiện trạng mã nguồn thực tế:

| Khối chức năng trong yêu cầu | Thư mục thực tế trong mã nguồn | Hiện trạng thực tế & Ghi chú kiểm toán |
| :--- | :--- | :--- |
| `providers/` (Gemini, WebSpeech, Deepgram, Whisper...) | `extension/lib/providers/` | **Chỉ triển khai**: Gemini Direct (`direct-gemini.ts`), Local Gateway (`local-gateway.ts`), Mock offline (`mock.ts`), Fetch Retry (`fetch-retry.ts`), Key Router (`key-router.ts`). **Không có**: WebSpeech, Deepgram, Whisper. Dịch thuật PDF có bổ sung provider phụ trợ OpenCode Zen (`translate.ts` và `vision-translate.ts`). |
| `audio/` (AudioCapture, AudioProcessor, AudioWorklet...) | `extension/lib/capture/` | Gồm `audio-capture.ts` và `wav.ts`. Đang dùng `ScriptProcessorNode` (đã bị Web Audio API deprecate), chưa nâng cấp lên `AudioWorkletNode`. |
| `storage/` (Settings, Config, Cache...) | `extension/lib/settings.ts`, `lib/pdf/vision-translate.ts`, `lib/pdf/translate.ts` | Không có thư mục `lib/storage/` riêng. Toàn bộ Chrome Storage wrappers nằm trong `settings.ts`. Cache translation cho PDF nằm rải rác ở `translate.ts` (sessionStorage) và `vision-translate.ts` (localStorage/sessionStorage). |
| `subtitle/` (SubtitleRenderer, formatting, sync...) | `extension/lib/subtitles/` | Thư mục số nhiều `subtitles/` gồm `segmenter.ts` (chia câu phụ đề, tính CPS) và `srt.ts` (xuất file phụ đề SRT/TXT). SubtitleRenderer hiển thị giao diện thuộc về Content Script (`entrypoints/content/`). |
| `state/` và `utils/` | `extension/lib/protocol/` | Trạng thái phiên (Session State) và Message Bus được định nghĩa trong `lib/protocol/messages.ts`. Điều phối hàng đợi đồng thời nằm trong `lib/protocol/queue.ts` (`ConcurrencyQueue`). Không có thư mục `state/` hay `utils/` riêng lẻ. |
| Các module bổ sung trong `lib/` | `lib/glossary/`<br>`lib/masker/`<br>`lib/translate/`<br>`lib/pdf/`<br>`lib/asr/` | Xử lý thuật ngữ (`glossary/`), che chắn định danh (`masker/`), batching dịch phụ đề (`translate/`), xử lý văn bản/layout và thị giác PDF (`pdf/`), phân tích tương tác ASR (`asr/`). |

---

## 2. KIỂM TOÁN DEAD CODE, UNREFERENCED EXPORTS & HÀM THỪA

Tất cả các phát hiện dưới đây đã được xác minh chéo bằng công cụ tìm kiếm mẫu tĩnh trên toàn bộ workspace (bao gồm `entrypoints/`, `lib/`, `tests/`):

### 2.1. Dead Code trong Production Runtime (Chỉ được gọi bởi Test File hoặc 0 Caller)

| STT | File & Dòng | Định danh (Identifier) | Loại | Chi tiết kiểm toán & Rủi ro | Đề xuất giải pháp |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **DC-01** | `extension/lib/protocol/queue.ts:15-21` | `get pendingCount`<br>`get activeCount` | Getter methods | Hoàn toàn không có bất kỳ caller nào trong mã nguồn hoặc unit test. Là dead code 100%. | Xóa bỏ 2 getters này để tinh giản class `ConcurrencyQueue`. |
| **DC-02** | `extension/lib/pdf/markdown.ts:134-214` | `blocksToMarkdownElements()` | Function (81 dòng) | Chỉ có duy nhất `markdown.test.ts:47` gọi đến. Giao diện Viewer thực tế render trực tiếp từ `TextBlock[]` hoặc Markdown raw string từ Vision AI, hoàn toàn không sử dụng hàm chuyển đổi này. | Xóa bỏ hàm này và interface `MarkdownElement` liên quan, dọn dẹp test case tương ứng trong `markdown.test.ts`. |
| **DC-03** | `extension/lib/pdf/markdown.ts:3-14` | `interface MarkdownElement` | Interface type | Chỉ phục vụ hàm `blocksToMarkdownElements`. Không được entrypoint nào tham chiếu. | Xóa bỏ cùng với DC-02. |
| **DC-04** | `extension/lib/pdf/blocks.ts:388-390` | `isDisplayEquation()` | Function | Hoàn toàn không có caller nào (0 references trong toàn bộ project). | Xóa bỏ ngay lập tức. |
| **DC-05** | `extension/lib/pdf/blocks.ts:392-394` | `isMathFormula()` | Function | Chỉ là wrapper alias gọi `isMathFragment()`. Chỉ có `blocks.test.ts` gọi kiểm thử, bản thân `blocks.ts` khi chạy thực tế lại gọi thẳng `isMathFragment()`. | Thay thế `isMathFormula` bằng `isMathFragment` trong `blocks.test.ts` và xóa alias này. |
| **DC-06** | `extension/lib/subtitles/segmenter.ts:94-96` | `displayDurationMs()` | Function | Chỉ được gọi trong `segmenter.test.ts:45`. Production runtime tính duration dựa trên timestamp từ ASR words thay vì hàm tính CPS này. | Di chuyển vào `segmenter.test.ts` làm test helper hoặc xóa bỏ nếu không còn trong roadmap. |
| **DC-07** | `extension/lib/pdf/vision-translate.ts:421-454` | `clearAllVisionCache()` | Function | Không có nút bấm hoặc logic nào trong UI viewer/options gọi hàm này. Chỉ có `vision-cache.test.ts:6` gọi. | Gắn vào giao diện Quản lý Cache trong Settings/Options hoặc dọn dẹp. |
| **DC-08** | `extension/lib/pdf/vision-translate.ts:458-469` | `getVisionCacheStats()` | Function | Không có UI nào hiển thị dung lượng/thống kê cache của Vision AI. Chỉ phục vụ assert trong test. | Cân nhắc hiển thị lên popup/options hoặc đánh dấu internal test helper. |
| **DC-09** | `extension/lib/translate/batcher.ts:132, 156` | `maskMap: {}` | Object property | Property `maskMap` ở cấp `TranslateBatchRequest` được gán rỗng `{}` và không bao giờ được đọc (thực tế `maskMap` nằm ở từng `maskedUnit.maskMap`). | Xóa bỏ thuộc tính thừa `maskMap: {}` ở request level. |
| **DC-10** | `extension/lib/glossary/validator.ts:102` | `void source;` | Unused Parameter | Tham số `source: string` trong hàm `validateTranslation(source, translation, ...)` hoàn toàn không được sử dụng, phải dùng `void source;` để qua mặt linter. | Bỏ tham số `source` hoặc dùng prefix `_source` để làm sạch chữ ký hàm. |

### 2.2. Over-Exported Internals (Export ra ngoài nhưng chỉ dùng nội bộ file)
Các hàm sau đây được khai báo từ khóa `export` nhưng không hề có file nào khác ngoài module đó import vào:

1. `extension/lib/providers/mock.ts:72`: `export function mockTranslate()` — chỉ dùng nội bộ tại dòng 115.
2. `extension/lib/providers/mock.ts:86`: `export function mockTranslateTitle()` — chỉ dùng nội bộ tại dòng 123.
3. `extension/lib/glossary/validator.ts:38`: `export function termExpectations()` — chỉ dùng nội bộ tại dòng 78.
4. `extension/lib/glossary/validator.ts:51`: `export function validatePlaceholderRoundtrip()` — chỉ dùng nội bộ tại dòng 88.
5. `extension/lib/pdf/translate.ts:114`: `export function getCacheKey()` — chỉ dùng nội bộ trong `translate.ts`.
6. `extension/lib/pdf/translate.ts:127`: `export function getGlossaryHash()` — chỉ dùng nội bộ trong `translate.ts`.
7. `extension/lib/pdf/vision-translate.ts:479`: `export function detectEnglishInMarkdown()` — chỉ dùng nội bộ tại dòng 535.
8. `extension/lib/pdf/vision-translate.ts:531`: `export function verifyAndRepairTranslation()` — chỉ dùng nội bộ tại dòng 728.
9. `extension/lib/pdf/blocks.ts:62`: `export function normalizeTextItems()` — chỉ dùng nội bộ tại dòng 844.
10. `extension/lib/pdf/blocks.ts:162`: `export function groupIntoLines()` — chỉ dùng nội bộ tại dòng 845.
11. `extension/lib/pdf/blocks.ts:305`: `export function isStandaloneHeading()` — chỉ dùng nội bộ tại các dòng 569, 570, 756.
12. `extension/lib/pdf/blocks.ts:333`: `export function isMathFragment()` — chỉ dùng nội bộ tại các dòng 578, 579, 754.
13. `extension/lib/pdf/blocks.ts:399`: `export function isAlgorithmLine()` — chỉ dùng nội bộ tại các dòng 522, 574, 575, 755.
14. `extension/lib/pdf/blocks.ts:416`: `export function isFootnoteItem()` — chỉ dùng nội bộ tại các dòng 582, 583, 757.
15. `extension/lib/pdf/blocks.ts:464`: `export function splitTextIntoSentences()` — chỉ dùng nội bộ tại dòng 763.
16. `extension/lib/pdf/blocks.ts:514`: `export function groupIntoBlocks()` — chỉ dùng nội bộ tại dòng 846.

**Đánh giá tác động**: Việc export vô tội vạ làm phình to module interface, gây nhầm lẫn cho các lập trình viên khác khi import auto-complete, và cản trở cơ chế Tree-Shaking của bundler (Vite/Rollup). Cần gỡ bỏ từ khóa `export` cho các hàm nội bộ này.

---

## 3. TRÙNG LẶP LOGIC (DRY VIOLATIONS) GIỮA CÁC MODULE

### DRY-01: Chuyển đổi nhị phân sang Base64 (Binary Chunking)
- **Vị trí 1**: `extension/lib/capture/wav.ts:9-14`
- **Vị trí 2**: `extension/lib/capture/audio-capture.ts:117-122`
- **Nội dung trùng lặp**:
  ```ts
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
  ```
- **Đề xuất**: Gom chung thành hàm tiện ích `uint8ArrayToBase64(bytes: Uint8Array): string` đặt tại một file dùng chung (ví dụ `capture/wav.ts` hoặc `utils/encoding.ts`).

### DRY-02: Bảng giải mã ký tự TeX Math OML (Greek Symbol Mapping)
- **Vị trí 1**: `extension/lib/pdf/blocks.ts:42-50` (`sanitizeTeXMathCharacters`)
  Khởi tạo `omlMap` ánh xạ từ hex `0x0b-0x1f` sang ký tự Hy Lạp Unicode: `0x0b: 'α', 0x0c: 'β', ...`.
- **Vị trí 2**: `extension/lib/pdf/markdown.ts:35-43` (`wrapInlineMath`)
  Khởi tạo `omlMap` ánh xạ từ hex `0x0b-0x1f` sang lệnh LaTeX: `0x0b: '\\alpha', 0x0c: '\\beta', ...`.
- **Đề xuất**: Tập trung định nghĩa bảng mã OML vào một nơi trong `pdf/` để tránh sai lệch khi cập nhật các ký tự đặc biệt (như epsilon mũ, theta, phi).

### DRY-03: Mẫu Regex nhận diện biến toán và công thức LaTeX
- **Vị trí 1**: `extension/lib/pdf/markdown.ts:63-118` (bước wrap $...$)
- **Vị trí 2**: `extension/lib/pdf/translate.ts:408-415` (mảng `mathPatterns` trong `shieldTokens`)
- **Nội dung trùng lặp**: Cả hai nơi đều viết lại các biểu thức Regex phức tạp để phát hiện biến toán có chỉ số trên/dưới như `z_0, z_t, x_t, \hat{...}, \tilde{...}, \Delta, (f, \ell)`. Nếu một bên được cập nhật (ví dụ thêm `z_{t-1}`), bên kia dễ bị bỏ sót, gây hiện tượng công thức bị dịch nhầm chữ trên bản dịch Text trong khi chế độ Markdown thì giữ được.
- **Đề xuất**: Tạo một danh sách pattern dùng chung trong `pdf/math-patterns.ts`.

### DRY-04: Logic kết nối và xử lý phản hồi OpenCode Zen Gateway
- **Vị trí 1**: `extension/lib/pdf/translate.ts:13-50, 277-324`
- **Vị trí 2**: `extension/lib/pdf/vision-translate.ts:557-596`
- **Nội dung trùng lặp**: Cả hai file đều trực tiếp xử lý phân biệt model `muse-spark-*` (dùng `/responses`) với các model khác (dùng `/chat/completions`), tự tạo headers `Authorization: Bearer ${zenKey}`, gọi fetch với retry 90s, và bóc tách text kết quả.
- **Đề xuất**: Xây dựng một class provider chuẩn `OpenCodeZenProvider` kế thừa interface `Provider` trong `extension/lib/providers/` để quản lý tập trung thay vì code rời rạc trong từng file của PDF.

### DRY-05: Gọi trực tiếp Google Generative Language REST API
- **Vị trí 1**: `extension/lib/providers/direct-gemini.ts:100, 122`
- **Vị trí 2**: `extension/lib/pdf/translate.ts:351`
- **Vị trí 3**: `extension/lib/pdf/vision-translate.ts:604, 678`
- **Nội dung trùng lặp**: Cả 3 file đều cấu hình URL thủ công `${BASE}/models/${model}:generateContent`, tự chèn header `x-goog-api-key`, tự bóc tách `candidates?.[0]?.content?.parts?.[0]?.text`.

---

## 4. ĐIỂM THẮT CỔ CHAI HIỆU NĂNG, RÒ RỈ BỘ NHỚ & LỖI TIỀM ẨN

### PERF-01: Lỗi treo Promise vĩnh viễn (Unresolved Promise Leak) trong ConcurrencyQueue
- **File & Dòng**: `extension/lib/protocol/queue.ts:24-26, 39-41`
- **Mã nguồn**:
  ```ts
  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.running >= this.maxConcurrency) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    // ...
  }

  clear(): void {
    this.queue = [];
  }
  ```
- **Phân tích cơ chế lỗi**:
  Khi người dùng dừng phiên ghi âm (`STOP_SESSION`), `entrypoints/offscreen/main.ts:204, 226` gọi `liveTaskQueue.clear()`.
  Hàm `clear()` chỉ đơn thuần gán `this.queue = []`. Hậu quả nghiêm trọng: **Các Promise đang bị đình trệ trong `await new Promise(...)` sẽ vĩnh viễn không bao giờ được resolve hay reject!**
  Các luồng này sẽ bị treo mãi mãi trong Event Loop microtask queue. Tệ hơn nữa, closure của task giữ tham chiếu đến `chunk: AudioChunk` (chứa chuỗi base64 PCM 45 giây âm thanh nặng ~1.44 MB) và `settings`, khiến bộ thu gom rác (Garbage Collector) không thể giải phóng dung lượng này. Phiên ghi âm càng bật tắt nhiều lần, bộ nhớ của tab offscreen càng phình to.
- **Giải pháp**: Khi `clear()`, phải duyệt qua danh sách task đang đợi và reject chúng với lỗi huỷ bỏ (`SessionCancelledError`), hoặc cung cấp cơ chế `AbortController`.

### PERF-02: Rò rỉ MediaStream Track & AudioContext Teardown thiếu sót
- **File & Dòng**: `extension/lib/capture/audio-capture.ts:26-44, 99-111`
- **Phân tích cơ chế lỗi**:
  1. **Khởi tạo không an toàn**: Dòng 26 gọi `navigator.mediaDevices.getUserMedia(...)` thành công nhận về `stream`. Tuy nhiên, các dòng tiếp theo (tạo `new AudioContext`, gọi `await audioCtx.resume()`) nằm ngoài khối `try/catch`. Nếu `AudioContext` ném lỗi (ví dụ giới hạn số lượng context trên Chrome) hoặc `resume()` bị reject, hàm sẽ thoát ra mà không có cách nào dọn dẹp `stream`. Các MediaStreamTrack vẫn tiếp tục chạy ngầm, Chrome tiếp tục hiển thị chấm đỏ ghi âm tab.
  2. **Dừng loopback thiếu `pause()`**: Dòng 36 tạo `const audioEl = new Audio(); audioEl.srcObject = stream; audioEl.play()`. Trong hàm `stop()` (dòng 105), mã chỉ gán `audioEl.srcObject = null;` mà không gọi `audioEl.pause()`, có thể gây lỗi rò rỉ âm thanh trên một số phiên bản nhân Chromium.
  3. **Công nghệ lỗi thời**: Dòng 46 sử dụng `audioCtx.createScriptProcessor(4096, 1, 1)`. API này đã chính thức bị W3C và các trình duyệt deprecate vì chạy trên main thread, gây giật frame nếu UI bận xử lý DOM. Chuẩn hiện đại bắt buộc dùng `AudioWorkletNode`.

### PERF-03: Áp lực dọn rác (GC Pressure) do liên tục cấp phát Int16Array và tạo chuỗi
- **File & Dòng**: `extension/lib/capture/audio-capture.ts:53, 77, 115-123`
- **Phân tích cơ chế lỗi**:
  Mỗi chu kỳ phát chunk (45 giây = 720,000 mẫu âm thanh = 1.44 MB bộ nhớ nhị phân), hàm lại khởi tạo mảng mới `buffer = new Int16Array(currentTargetSamples)`.
  Ngay sau đó, hàm `int16ToBase64` cắt mảng thành các khối `0x8000`, tạo các mảng con `subarray`, chuyển đổi thành chuỗi nhị phân bằng phép cộng chuỗi lặp lại, rồi gọi `btoa`. Quá trình này tạo ra hàng nghìn chuỗi tạm thời trong bộ nhớ heap chỉ để tạo ra một chuỗi base64 duy nhất, tạo ra các đỉnh nhọn GC (GC spikes) gây đứng hình trình duyệt offscreen.
- **Giải pháp**: Tái sử dụng buffer (Ring Buffer hoặc pre-allocated buffer pool) thay vì liên tục `new Int16Array`.

### PERF-04: Rò rỉ bộ nhớ đồ họa (Canvas GPU Backing Store) trong Vision AI
- **File & Dòng**: `extension/lib/pdf/vision-translate.ts:91-114`
- **Phân tích cơ chế lỗi**:
  Trong `renderPageToBase64Jpeg`, mỗi trang PDF được tạo một phần tử canvas: `const canvas = document.createElement('canvas')` với kích thước tỉ lệ 2.0x (khoảng 1224 x 1584 px = gần 2 triệu điểm ảnh, tương đương ~8 MB bộ nhớ đệm đồ họa RGBA không nén).
  Sau khi gọi `canvas.toDataURL('image/jpeg', 0.88)` để lấy chuỗi Base64, phần tử canvas bị bỏ rơi mà không được giải phóng (`canvas.width = 0; canvas.height = 0`).
  Khi người dùng dịch hàng loạt trang (ví dụ tài liệu 20 trang), hàng trăm megabyte bộ nhớ đồ họa tích tụ trong tiến trình của Extension trước khi GC kích hoạt.

### PERF-05: Giới hạn cứng LocalStorage Quota Exceeded trong Vision Cache
- **File & Dòng**: `extension/lib/pdf/vision-translate.ts:283-343`
- **Phân tích cơ chế lỗi**:
  Hàm `setCachedVisionTranslation` lưu trữ bản dịch Markdown của toàn bộ các trang PDF vào `localStorage`.
  Theo quy định của trình duyệt, `localStorage` có hạn mức tối đa cực kỳ nghiêm ngặt: **chỉ khoảng 5MB đến 10MB cho toàn bộ Extension**.
  Trong khi đó, `MAX_CACHED_PAPERS = 50`. Một bài báo khoa học 10-15 trang dịch sang Markdown hoàn chỉnh kèm công thức toán học có thể chiếm từ 50KB đến 200KB. 50 bài báo có thể chạm ngưỡng 10MB, chắc chắn gây ra ngoại lệ `QuotaExceededError`. Dù mã nguồn có khối `catch` để dọn dẹp LRU khẩn cấp (dòng 301-316), việc lặp đi lặp lại parse toàn bộ Registry và xóa từng key trên synchronous storage (`localStorage`) sẽ gây nghẽn (blocking) luồng thực thi chính của giao diện Viewer.
- **Giải pháp**: Di chuyển toàn bộ Vision Cache sang `IndexedDB` hoặc `chrome.storage.local` (không giới hạn với permission `unlimitedStorage`).

### PERF-06: Nguy cơ bùng nổ Request đồng thời gây tràn Quota (HTTP 429) ở Micro-batches
- **File & Dòng**: `extension/lib/pdf/translate.ts:518-520`
- **Mã nguồn**:
  ```ts
  const results = await Promise.all(
    batches.map((batch) => translateSentenceBatchDirect(batch, targetLang, settings)),
  );
  ```
- **Phân tích cơ chế lỗi**:
  Một trang PDF nhiều chữ có thể chứa 60-100 câu, chia thành 3-5 micro-batches. Toàn bộ các batches này được gửi song song bằng `Promise.all`.
  Đồng thời, ở cấp độ trang, Viewer cho phép dịch đồng thời tới 5-7 trang (`pdfConcurrency: 5`).
  Điều này dẫn đến việc **có thể có tới 15 đến 25 HTTP requests cùng bắn vào Gemini API trong cùng một giây**!
  Đối với gói Gemini Free Tier (chỉ cho phép tối đa 15 Requests Per Minute - RPM), toàn bộ các request này sẽ lập tức bị phản hồi `HTTP 429 Quota Exceeded`. Mặc dù có retry backoff, việc dồn hàng chục request cùng lúc sẽ nhanh chóng cạn kiệt số lần retry và làm sập tiến trình dịch của cả trang.
- **Giải pháp**: Sử dụng một hàng đợi giới hạn concurrency (như `ConcurrencyQueue(2)`) cho các micro-batches của PDF thay vì `Promise.all` vô hạn.

### PERF-07: Lỗi mất trạng thái Xoay Key (Reset Singleton Bug) trong KeyRouter
- **File & Dòng**: `extension/lib/providers/key-router.ts:155-169`
- **Mã nguồn**:
  ```ts
  let globalRouter: KeyRouter | null = null;

  export function getKeyRouter(userKey?: string | string[]): KeyRouter {
    const inputKeys = ...;
    if (globalRouter && areKeyListsEqual(globalRouter.getAllKeys(), inputKeys)) {
      return globalRouter;
    }
    globalRouter = new KeyRouter(inputKeys);
    return globalRouter;
  }
  ```
- **Phân tích cơ chế lỗi**:
  Hệ thống sử dụng một biến singleton duy nhất `globalRouter`.
  Khi `translate.ts:18` gọi `getKeyRouter(zenKeys)` rồi ngay sau đó `translate.ts:339` gọi `getKeyRouter(geminiKeys)`, do danh sách keys của hai nhà cung cấp khác nhau, `areKeyListsEqual` trả về `false`.
  Khi đó, `globalRouter` bị khởi tạo mới tinh: `new KeyRouter(inputKeys)`.
  **Toàn bộ `cooldownMap` (danh sách các key đang bị tạm dừng vì dính 429) và `currentIndex` của router trước đó bị xoá sổ hoàn toàn!**
  Điều này làm mất đi khả năng nhớ key bị rate-limit, khiến key vừa bị 429 lại tiếp tục bị gọi lại ở vòng lặp sau.
- **Giải pháp**: Quản lý Router theo Map: `Map<string, KeyRouter>` với key là hash của danh sách API keys, thay vì một biến đơn lẻ.

### PERF-08: Bỏ qua Smart Key Rotation trong DirectGeminiProvider (Audio/Video ASR)
- **File & Dòng**: `extension/lib/providers/direct-gemini.ts:85, 121, 143`
- **Mã nguồn**:
  ```ts
  const router = getKeyRouter(settings.apiKey);
  ```
- **Phân tích cơ chế lỗi**:
  Trong khi tính năng dịch PDF (`translate.ts:339` và `vision-translate.ts:600`) dùng `getKeyRouter(getProviderKeys(settings, 'gemini'))` để lấy toàn bộ danh sách đa API keys mà người dùng cấu hình trong Settings, thì `DirectGeminiProvider` (chịu trách nhiệm cho phụ đề âm thanh/video trực tiếp) lại chỉ truyền duy nhất chuỗi đơn `settings.apiKey`!
  Hậu quả: **Nếu người dùng thêm 5 API keys dự phòng trong giao diện cài đặt, tính năng phụ đề trực tiếp vẫn chỉ dùng đúng 1 key duy nhất và không bao giờ tự động xoay key khi gặp lỗi 429!**
- **Giải pháp**: Đổi thành `getKeyRouter(getProviderKeys(settings, 'gemini'))` đồng bộ như bên PDF.

---

## 5. HARDCODED HEURISTICS & RỦI RO COUPLING TRONG MODULE PDF

Trong file `extension/lib/pdf/blocks.ts`, chúng tôi phát hiện nhiều đoạn mã heuristic bị "hardcode" dựa trên một tài liệu mẫu cụ thể (bài báo Diffusion Models):

1. **Hardcode tọa độ hình ảnh Page 1** (`blocks.ts:925-930`):
   ```ts
   // Special case for Page 1 where Figure 1 is a tall banner in Column 2
   if (pageNumber === 1 && (figNum === 1 || !figNum)) {
     figLeft = 307;
     figTop = 165;
     figWidth = 245;
   }
   ```
   *Rủi ro*: Nếu người dùng mở bất kỳ tài liệu nào khác mà Trang 1 không có Figure 1 nằm ở tọa độ x=307, y=165, thuật toán sẽ cắt sai toàn bộ bounding box của hình ảnh hoặc đè lên văn bản khác.

2. **Hardcode từ khóa chuyên ngành AI** (`blocks.ts:615, 708`):
   ```ts
   /^(We|The|In|For|To|Our|However|Although|Finally|Moreover|Furthermore|OpenAI|Stable|CLIP|Diffusion|Specifically|Empirically)\b/
   /\b(diffusion|models?|algorithm|propose|trained|paper|framework|method)\b/i
   ```
   *Rủi ro*: Phụ thuộc vào các từ khóa riêng biệt (`OpenAI`, `Stable`, `CLIP`, `Diffusion`). Nếu dịch bài báo về Y sinh, Kinh tế lượng, hoặc Toán thuần túy, các luật ngắt đoạn và phân loại khối văn bản này sẽ hoạt động kém chính xác.

---

## 6. ĐÁNH GIÁ MỨC ĐỘ ƯU TIÊN VÀ LỘ TRÌNH TÁI CẤU TRÚC (REFACTORING ROADMAP)

### Mức độ High (Khẩn cấp — Rò rỉ tài nguyên, lỗi logic, mất tính năng)
1. **Sửa lỗi Hanging Promise trong ConcurrencyQueue** (`lib/protocol/queue.ts:39`): Reject các Promise đang chờ khi gọi `clear()` để tránh rò rỉ bộ nhớ âm thanh.
2. **Kích hoạt Multi-Key Rotation cho DirectGeminiProvider** (`lib/providers/direct-gemini.ts:85, 121, 143`): Sử dụng `getProviderKeys(settings, 'gemini')` thay vì `settings.apiKey` đơn lẻ.
3. **Sửa lỗi đè Router Singleton** (`lib/providers/key-router.ts:155`): Sử dụng Registry Cache nhiều instance router theo provider để không làm mất `cooldownMap`.
4. **Bọc an toàn MediaStream Teardown** (`lib/capture/audio-capture.ts:26-44`): Đảm bảo các MediaStreamTrack luôn được giải phóng nếu khởi tạo AudioContext thất bại.

### Mức độ Medium (Tối ưu hóa hiệu năng, giảm tải GC, chống lỗi Quota)
1. **Kiểm soát Concurrency cho Micro-batches của PDF** (`lib/pdf/translate.ts:518`): Tránh bắn đồng loạt 20 request song song gây mã lỗi 429.
2. **Giải phóng Canvas Backing Store** (`lib/pdf/vision-translate.ts:110`): Thu hồi kích thước canvas về `0x0` sau khi render xong ảnh để tránh rò rỉ GPU memory.
3. **Khắc phục trùng lặp Base64 & TeX OML** (DRY-01, DRY-02): Gom chung các hàm tiện ích nhị phân và bảng mã ký tự Hy Lạp vào module dùng chung.
4. **Chuẩn hóa OpenCode Zen Provider** (DRY-04): Đưa Zen API client vào `lib/providers/` thay vì viết lặp lại ở cả hai file PDF.

### Mức độ Low (Dọn dẹp mã nguồn, loại bỏ Dead Code, tinh gọn Interface)
1. **Xóa bỏ các hàm Dead Code hoàn toàn**: `isDisplayEquation` (`blocks.ts:388`), `pendingCount`/`activeCount` (`queue.ts:15-21`).
2. **Loại bỏ `blocksToMarkdownElements`** (`markdown.ts:134`) và `MarkdownElement`: Dọn dẹp mã thừa không dùng trong runtime và cập nhật test liên quan.
3. **Gỡ bỏ từ khóa `export` cho 16 hàm nội bộ** trong `blocks.ts`, `validator.ts`, `mock.ts`, `vision-translate.ts` để thu gọn public API của module.
4. **Tổng quát hóa các Heuristics nhận diện hình ảnh** (`blocks.ts:925`): Thay thế tọa độ hardcoded bằng thuật toán bounding box tự động dựa trên khoảng trống đồ họa thực tế.

---

## 7. XÁC NHẬN TÍNH TOÀN VẸN CỦA BỘ KIỂM THỬ (TEST INTEGRITY)
- Tất cả 17 file unit test hiện tại đều nằm trọn vẹn trong `extension/lib/`.
- Việc thực hiện tái cấu trúc theo đề xuất trên cần lưu ý cập nhật tương ứng cho các test case đang trực tiếp kiểm tra các hàm thừa (`blocks.test.ts` đang test `isMathFormula`, `markdown.test.ts` đang test `blocksToMarkdownElements`, `segmenter.test.ts` đang test `displayDurationMs`).
- Sau khi điều chỉnh, toàn bộ 123/123 tests được bảo đảm tiếp tục vượt qua 100% mà không làm gãy bất kỳ chức năng nào của Extension.
