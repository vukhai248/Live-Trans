# Kế hoạch & hướng dẫn kiểm thử — Live-Trans

> Tài liệu này liệt kê tất cả module đã có unit/integration test, các kịch bản kiểm thử, phần nào vẫn cần thực hiện thủ công, và cách chạy toàn bộ.

## Chạy tất cả

```bash
cd extension
npm run check
```

Lệnh trên chạy `prepare:wxt` + `tsc --noEmit` + `eslint` + `vitest run`.

## Kiểm thử API ASR thật (tốn quota)

```bash
node scripts/test-transcribe.mjs
```

Script này đọc `GEMINI_API_KEY` từ `.env` ở repo root (file đã gitignore), upload file WAV lên Gemini Files API, gọi `gemini-3.5-transcribe` qua `/v1beta/interactions`, parse kết quả và assert:

- Response HTTP 200.
- `output_text` không rỗng.
- Parser chuyển đổi được thành `Transcript` có `words` (word timestamps).

**Lưu ý quan trọng:**

- Script tạo ra file WAV là tiếng tone (sine wave) 1.5 giây. Tone không phải lời nói nên API thường trả về `output_text` rỗng. Điều này chứng tỏ đường truyền API hoạt động, nhưng assertion `output_text` non-empty chỉ pass khi dùng **audio lời nói thật** (thay thế `makeToneWav` bằng fixture WAV có lời nói).
- Assertion về `words` cũng pending với tone/silence; cần audio lời nói thật có bật `word timestamps`.
- Không bao giờ in toàn bộ API key. Script chỉ hiển thị 4 ký tự đầu và 4 ký tự cuối.

## Module đã có unit test

### `lib/asr/parser.ts`

File: `extension/lib/asr/parser.test.ts` (12 test)

- Trích xuất `output_text` từ các trường: `output_text`, `result.output_text`, `transcript`, `text`.
- Parse word timestamps từ `start_offset`/`end_offset` dạng `"0.100s"`.
- Hỗ trợ nhiều đường dẫn danh sách từ: `words`, `audio_transcription.words`, `result.words`, `result.audio_transcription.words`, `annotations`, `result.annotations`.
- Mở `annotations` chứa `words` lồng nhau.
- Fallback tổng hợp word timestamps đều khi API chỉ trả text.
- Trích xuất `language_code` / `languageCode`.

### `lib/capture/wav.ts`

File: `extension/lib/capture/wav.test.ts` (5 test)

- Kiểm tra header WAV đúng 44 byte (`RIFF`, `WAVE`, `fmt `, `data`).
- Kiểm tra các trường: PCM format, mono, 16-bit, sample rate 16000 Hz, byte rate, block align.
- Kiểm tra kích thước `data` chunk và tổng kích thước file.
- Dữ liệu PCM gốc được giữ nguyên sau header.

### `lib/glossary/selector.ts`

File: `extension/lib/glossary/selector.test.ts` (8 test)

- Chỉ chọn term có xuất hiện trong source.
- Giới hạn tối đa `MAX_PROMPT_TERMS` (mặc định 25) và custom limit.
- Ưu tiên theo thứ tự glossary.
- So khớp không phân biệt hoa thường (case-insensitive).
- Loại trùng lặp trong glossary.
- Trả về rỗng khi glossary/source rỗng.
- Không coi substring là match (vd. `npm` trong `npm run start` vẫn match `npm`).

### `lib/subtitles/srt.ts`

File: `extension/lib/subtitles/srt.test.ts` (10 test)

- Định dạng `toSrt`: dòng dịch trước, dòng gốc sau.
- Timestamp SRT đúng `HH:MM:SS,mmm`.
- Các unit cách nhau bằng dòng trống.
- Xử lý translation thiếu (chỉ gốc).
- Input rỗng trả về chuỗi rỗng.
- Timestamp quá 1 giờ và milliseconds đệm đủ 3 chữ số.
- `toText`: ưu tiên dịch, fallback gốc, nối bằng `\n`.

### `lib/subtitles/segmenter.ts`

File: `extension/lib/subtitles/segmenter.test.ts` (7 test) — đã có từ trước.

### `lib/masker/masker.ts`

File: `extension/lib/masker/masker.test.ts` (5 test) — đã có từ trước.

### `lib/glossary/validator.ts`

File: `extension/lib/glossary/validator.test.ts` (4 test) — đã có từ trước.

### `lib/translate/prompt.ts`

File: `extension/lib/translate/prompt.test.ts` (3 test) — đã có từ trước.

## Integration test pipeline dịch

File: `extension/lib/translate/batcher.test.ts` (8 test)

Provider giả (`FakeProvider`) implement interface `Provider` từ `lib/providers/provider.ts`, trả về bản dịch xác định. Các kịch bản:

- Dịch đơn vị đơn giản không glossary.
- Giữ placeholder command/code và restore nguyên văn (`npm run start`).
- TSR = 1 khi provider tuân thủ glossary (jargon `gradient descent` → `hạ gradient`).
- Retry(1) khi lần đầu làm mất term/placeholder; lần retry thành công; stats chính xác (`retries=1`, `calls=2`, `splices=0`, `tsr=1`).
- Trường hợp retry vẫn thất bại: splice chèn term gốc, restore placeholder, badge cảnh báo, stats đúng (`splices=1`).
- Trường hợp mất term kích hoạt retry với request chỉ chứa 1 unit.
- Context pairs được tích lũy qua các batch và giới hạn 5 cặp.

## Các phần cần kiểm thử thủ công

Các phần này phụ thuộc vào Chrome thật, audio từ tab, và key của người dùng, không thể tự động hoàn toàn trong CI:

1. **Capture tab audio thật**: `tabCapture` + AudioWorklet PCM 16 kHz mono trong offscreen document. Cần mở tab phát âm thanh, bật extension, và kiểm tra PCM không toàn số 0 / không bị cắt đoạn đầu.
2. **Transcribe trực tiếp từ tab**: gửi chunk PCM thật lên `gemini-3.5-transcribe`, kiểm tra `output_text` và `words` khớp với lời nói trong tab.
3. **Overlay phụ đề trên trang web**: content script hiển thị phụ đề, đúng vị trí, không chồng chéo, đồng bộ thời gian khi seek/pause.
4. **One-hour soak test**: chạy extension liên tục 1 giờ, kiểm tra không rò rỉ bộ nhớ, không lỗi quota, tab vẫn có tiếng.
5. **DRM/silence detection**: mở tab DRM (Widevine), kiểm tra RMS detect silence và báo user.
6. **Export `.srt` / `.txt`**: sau phiên dịch, tải file và kiểm tra định dạng trong subtitle player.

## Tóm tắt số lượng test

- Unit test files: 9
- Tổng test cases: 62 (trước đây 19, thêm 43 mới)
- Tất cả đều pass qua `cd extension && npm run check` (trừ phần live script cần audio thật để pass hoàn toàn).

## Lưu ý bảo mật

- Không bao giờ commit `GEMINI_API_KEY`. `.env` đã nằm trong `.gitignore`.
- Các test không đọc key; chỉ script `scripts/test-transcribe.mjs` đọc key khi chạy thủ công.
