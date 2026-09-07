# HANDOFF REPORT — R2: Core Library & Services (`extension/lib/`)

**Agent ID**: `explorer_lib_1`  
**Working Directory**: `d:\create\Live-Trans\.agents\explorer_lib_1`  
**Parent Conversation ID**: `bfdd02db-0f6a-42e9-b729-ebf2c6353e1b`  
**Target Milestone**: R2 Audit (Code Quality, Dead Code & Bottleneck Inspection)  
**Date**: 2026-09-07

---

## 1. OBSERVATION

1. **Thư mục & Tệp tin**:
   - `extension/lib/` có 9 thư mục (`asr`, `capture`, `glossary`, `masker`, `pdf`, `protocol`, `providers`, `subtitles`, `translate`) và 1 file gốc `settings.ts`.
   - Tổng cộng 46 file `.ts` (29 file implementation, 17 file unit tests).
   - Không tồn tại các thư mục: `audio/`, `storage/`, `subtitle/` (số ít), `state/`, `utils/`.
   - Không tồn tại mã nguồn cho WebSpeech, Deepgram, Whisper trong `providers/` (chỉ có Gemini, OpenCode Zen gateway và Mock).

2. **Dead Code & Unreferenced Exports**:
   - `extension/lib/protocol/queue.ts:15-21`: `get pendingCount()` và `get activeCount()` hoàn toàn không có bất kỳ caller nào trong mã nguồn lẫn test.
   - `extension/lib/pdf/markdown.ts:134-214`: `blocksToMarkdownElements` (81 dòng) và `interface MarkdownElement` (dòng 3-14) chỉ có `markdown.test.ts:47` gọi, không có component runtime nào sử dụng.
   - `extension/lib/pdf/blocks.ts:388-390`: `isDisplayEquation` có 0 caller trong toàn bộ project.
   - `extension/lib/pdf/blocks.ts:392-394`: `isMathFormula` là wrapper gọi `isMathFragment()`, chỉ có `blocks.test.ts` gọi.
   - `extension/lib/subtitles/segmenter.ts:94-96`: `displayDurationMs` chỉ có `segmenter.test.ts` gọi.
   - `extension/lib/glossary/validator.ts:102`: `void source;` tham số `source` không được dùng.
   - 16 hàm nội bộ bị export không cần thiết: `blocks.ts` (8 hàm: `normalizeTextItems`, `groupIntoLines`, `isStandaloneHeading`, `isMathFragment`, `isAlgorithmLine`, `isFootnoteItem`, `splitTextIntoSentences`, `groupIntoBlocks`), `validator.ts` (`termExpectations`, `validatePlaceholderRoundtrip`), `mock.ts` (`mockTranslate`, `mockTranslateTitle`), `translate.ts` (`getCacheKey`, `getGlossaryHash`), `vision-translate.ts` (`detectEnglishInMarkdown`, `verifyAndRepairTranslation`).

3. **DRY Violations**:
   - Vòng lặp chunk `0x8000` nhị phân sang Base64 giống hệt nhau tại `extension/lib/capture/wav.ts:9-14` và `extension/lib/capture/audio-capture.ts:117-122`.
   - Bảng mã `omlMap` hex `0x0b-0x1f` bị lặp tại `extension/lib/pdf/blocks.ts:42-50` và `extension/lib/pdf/markdown.ts:35-43`.
   - Mẫu Regex nhận diện biến toán bị lặp giữa `extension/lib/pdf/markdown.ts:63-118` và `extension/lib/pdf/translate.ts:408-415`.
   - Kết nối và phân giải model OpenCode Zen (`/responses` vs `/chat/completions`) bị lặp giữa `extension/lib/pdf/translate.ts:277-324` và `extension/lib/pdf/vision-translate.ts:557-596`.

4. **Bottlenecks & Rò rỉ tài nguyên**:
   - `extension/lib/protocol/queue.ts:39-41`: `clear()` gán `this.queue = []`. Các Promise đang đợi tại `await new Promise(...)` (dòng 25) không bao giờ được resolve/reject -> rò rỉ Promise và AudioChunk closure.
   - `extension/lib/capture/audio-capture.ts:26-44`: không có try/catch giải phóng `stream.getTracks()` nếu AudioContext lỗi; `stop()` thiếu `audioEl.pause()`; sử dụng `ScriptProcessorNode` (deprecated).
   - `extension/lib/pdf/vision-translate.ts:91-114`: `renderPageToBase64Jpeg` không giải phóng backing store (`canvas.width = 0; canvas.height = 0`).
   - `extension/lib/pdf/vision-translate.ts:283-343`: lưu cache 50 bài báo vào `localStorage` có giới hạn 5-10MB synchronous storage, nguy cơ `QuotaExceededError`.
   - `extension/lib/pdf/translate.ts:518-520`: `Promise.all` bắn toàn bộ micro-batches song song kết hợp `pdfConcurrency = 5` có thể phát sinh 15-25 request/giây -> kích hoạt HTTP 429 của Gemini API.
   - `extension/lib/providers/key-router.ts:155-169`: `globalRouter` singleton bị tạo mới đè khi gọi xen kẽ key Gemini và Zen, xóa sạch `cooldownMap`.
   - `extension/lib/providers/direct-gemini.ts:85, 121, 143`: gọi `getKeyRouter(settings.apiKey)` bỏ qua `settings.apiKeys`, làm mất tính năng xoay key đa tài khoản cho live subtitle.

5. **Test Baseline**:
   - `npm run test` -> 17 test files passed, 123 tests passed.
   - `npm run typecheck` -> 0 errors.
   - `npm run lint` -> 0 warnings/errors.

---

## 2. LOGIC CHAIN

1. **Từ Quan sát 1 & 2 -> Kết luận Dead Code**:
   - Việc grep trên toàn bộ thư mục `extension/` cho thấy các getter `pendingCount`, `activeCount` (`queue.ts`) và hàm `isDisplayEquation` (`blocks.ts`) có đúng 0 reference bên ngoài định nghĩa của chúng. Do đó, đây là dead code 100%, xóa an toàn mà không ảnh hưởng bất kỳ module hay test nào.
   - `blocksToMarkdownElements` (`markdown.ts`) chỉ xuất hiện trong `markdown.test.ts`. Các component giao diện Viewer (`VisionPageRenderer.tsx`, `WhiteboardPageRenderer.tsx`, `main.tsx`) không hề dùng cấu trúc `MarkdownElement` này. Việc giữ lại 81 dòng code này chỉ để phục vụ một unit test không còn phản ánh runtime thực tế.

2. **Từ Quan sát 3 -> Kết luận DRY Violations**:
   - So sánh trực tiếp từng dòng code giữa `wav.ts` và `audio-capture.ts` cho thấy cùng một thuật toán chuyển Int16/Uint8 sang Base64 được sao chép nguyên văn.
   - Cùng một bảng mã TeX OML hex 0x0b-0x1f xuất hiện ở 2 nơi với mục đích ánh xạ ký hiệu toán Hy Lạp, gây nguy cơ lệch chuẩn hiển thị giữa chế độ văn bản gốc và chế độ dịch Markdown.
   - Giao thức OpenCode Zen được viết phân tán trong 2 file của `pdf/` thay vì được đóng gói thành một Provider độc lập trong `providers/`, vi phạm tính module hóa và nguyên tắc mở rộng (OCP).

3. **Từ Quan sát 4 -> Kết luận Rủi ro Rò rỉ & Treo Hệ thống**:
   - Trong `ConcurrencyQueue`, một Promise chờ chỉ được đánh thức khi hàm callback `resolve` được gọi trong `finally`. Khi `clear()` làm rỗng mảng callback, Promise bị treo vĩnh viễn (hung state). Trong ngữ cảnh Live Audio, mỗi task giữ AudioChunk chứa base64 PCM 45s (~1.44MB), gây rò rỉ bộ nhớ nghiêm trọng qua nhiều phiên ghi âm.
   - Trong `KeyRouter`, việc dùng 1 biến singleton duy nhất `globalRouter` khiến việc nạp key khác nhau giữa các tác vụ dịch PDF (Zen vs Gemini) làm xóa sạch `cooldownMap`, biến cơ chế chống 429 trở nên vô hiệu.

---

## 3. CAVEATS

1. **Phạm vi kiểm tra**: Khảo sát chỉ bao gồm mã nguồn trong `extension/lib/` và mối liên kết với `extension/entrypoints/`. Không can thiệp hoặc sửa đổi mã nguồn thực tế theo đúng nguyên tắc Read-Only.
2. **Unit Test Dependencies**: Một số hàm dead code trong runtime (như `isMathFormula`, `displayDurationMs`, `blocksToMarkdownElements`) đang có test case trực tiếp trong 17 file test. Nếu xóa các hàm này mà không cập nhật test suite tương ứng, test run sẽ báo fail. Do đó, kế hoạch refactoring phải đi kèm cập nhật test case.
3. **Mô hình AI bên ngoài**: Các rủi ro về rate limit 429 phụ thuộc vào quota gói tài khoản Gemini của người dùng (Free Tier 15 RPM vs Pay-as-you-go).

---

## 4. CONCLUSION

Module Core Library (`extension/lib/`) của Live-Trans v1.0.1 có nền tảng kiểm thử tốt (123 unit tests pass), kiến trúc phân lớp cơ bản rõ ràng, tuy nhiên còn tồn đọng:
- **4 điểm rò rỉ/lỗi nghiêm trọng (High Priority)**: Hanging Promise leak trong `ConcurrencyQueue`, mất multi-key rotation trong `DirectGeminiProvider`, reset state singleton trong `KeyRouter`, và thiếu MediaStream cleanup an toàn trong `audio-capture.ts`.
- **4 điểm nghẽn hiệu năng (Medium Priority)**: Bùng nổ request đồng thời (thiếu queue ở micro-batch PDF), rò rỉ GPU memory ở canvas, nguy cơ tràn bộ nhớ `localStorage` ở Vision Cache, và 4 trường hợp DRY lặp code.
- **Hơn 100 dòng Dead Code & 16 Over-exported Internals (Low Priority)**: Cần tinh gọn để tối ưu hóa bundle và tree-shaking.

Báo cáo chi tiết đầy đủ bằng tiếng Việt đã được lưu tại:  
`d:\create\Live-Trans\.agents\explorer_lib_1\report.md`.

---

## 5. VERIFICATION METHOD

Người kế nhiệm hoặc Orchestrator có thể xác minh độc lập các phát hiện bằng các bước sau:

1. **Kiểm tra Baseline hiện tại**:
   ```powershell
   cd d:\create\Live-Trans\extension
   npm run test
   npm run typecheck
   npm run lint
   ```
   *Kết quả mong đợi*: 17/17 test files passed, 123 tests passed, 0 error, 0 warning.

2. **Xác minh Dead Code**:
   - Chạy lệnh tìm kiếm references cho `isDisplayEquation`:
     ```powershell
     rg "isDisplayEquation" d:\create\Live-Trans\extension
     ```
     *Kết quả*: Chỉ xuất hiện 1 lần duy nhất tại dòng định nghĩa `blocks.ts:388`.
   - Chạy lệnh tìm kiếm references cho `blocksToMarkdownElements`:
     ```powershell
     rg "blocksToMarkdownElements" d:\create\Live-Trans\extension
     ```
     *Kết quả*: Chỉ xuất hiện tại `markdown.ts:134` và `markdown.test.ts:2, 47` (không có file UI nào gọi).

3. **Xác minh Lỗi Singleton Reset trong KeyRouter**:
   - Kiểm tra `extension/lib/providers/key-router.ts:155-169`. Quan sát biến `let globalRouter: KeyRouter | null = null`.

4. **Xác minh Lỗi Hanging Promise trong ConcurrencyQueue**:
   - Kiểm tra `extension/lib/protocol/queue.ts:25, 39-41`. Quan sát lệnh `this.queue = []` không gọi resolve/reject cho các phần tử bị loại bỏ.
