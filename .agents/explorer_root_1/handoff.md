# HANDOFF REPORT — R1: FOLDER & ASSET REDUNDANCY AUDIT

**Agent:** explorer_root_1  
**Working Directory:** `d:\create\Live-Trans\.agents\explorer_root_1`  
**Date:** 2026-09-07  
**Type:** Hard (Task complete)

---

## 1. OBSERVATION (Quan sát trực tiếp)

1. **Root Directory Structure & File Counts**:
   - `d:\create\Live-Trans` chứa 13 thư mục và 7 file ở root.
   - Thư mục `.tools/profile/` chiếm dung lượng 291.70 MB (541 files), là profile của Chromium for Testing (`.gitignore:23`).
   - Thư mục `backend/` chiếm 52.65 MB (7 files), trong đó file `backend/samples/2302.07121.pdf` chiếm 50.70 MB (53,165,173 bytes, `.gitignore:26`).
   - Thư mục `demo/` chứa 3 files (`demo.js`, `index.html`, `style.css`), tổng dung lượng 52.72 KB (53,989 bytes).
   - Thư mục `dist/` chứa 1 file `dist/live-trans-extension.zip` (38,249 bytes, tạo ngày 9/2/2026 1:03 PM).
   - Thư mục `gateway/` chứa 2 files (`gateway.mjs` 10,665 bytes, `.env.example` 217 bytes).
   - Thư mục `scripts/` chứa 16 files, tổng dung lượng 56.65 KB (58,005 bytes).
   - Thư mục `tests/` chứa 6 files (`tests/fixtures/speech.wav` 699,996 bytes, `tests/fixtures/golden-glossary.json` 885 bytes, `sample-transcript.json` 1,720 bytes, `fixtures/.gitkeep`, `integration/.gitkeep`, `tests/README.md`).
   - Thư mục `docs/` chứa 10 files tài liệu, tổng dung lượng 98.43 KB.
   - Thư mục `extension/` chứa toàn bộ source code của Chrome Extension v1.0.1 (Preact, WXT, TypeScript), 17 file unit test (123 tests), thư mục `.output/` chứa bản build `chrome-mv3/` và 3 file zip (`0.1.0`, `1.0.0`, `1.0.1`).

2. **Root Configuration Absence & Tooling Isolation**:
   - Lệnh chạy thử tại root `d:\create\Live-Trans`:
     `npm.cmd test`
     Kết quả:
     `npm error enoent Could not read package.json: Error: ENOENT: no such file or directory, open 'D:\create\Live-Trans\package.json'`
   - File cấu hình dự án duy nhất nằm ở `d:\create\Live-Trans\extension\package.json`.
   - Toàn bộ `tsconfig.json`, `vitest.config.ts`, `wxt.config.ts`, `eslint.config.mjs`, `.prettierrc.json` đều nằm trong `extension/`.
   - GitHub Actions `.github/workflows/ci.yml:12` thiết lập: `working-directory: extension`.

3. **Runtime & Test Dependencies Verification**:
   - `gateway/gateway.mjs`: Được tham chiếu trong `extension/lib/providers/local-gateway.ts:12`, `extension/lib/providers/index.ts:11`, `extension/lib/settings.ts:4`, `extension/entrypoints/popup/App.tsx:689`, `extension/entrypoints/options/App.tsx:97`. Đây là tính năng "Gateway mode" cho phép chạy proxy local tại `http://localhost:8787`.
   - `backend/samples/2302.07121.pdf`: Được tham chiếu tại `extension/lib/pdf/blocks.test.ts:372`:
     ```typescript
     const pdfPath = path.resolve(__dirname, '../../../backend/samples/2302.07121.pdf');
     if (!fs.existsSync(pdfPath)) return;
     ```
     Nếu file này tồn tại, test thực hiện parse PDF và assert các công thức toán. Nếu file không tồn tại, test thực hiện `return;` và không fail.
   - `backend/fonts/` (`NotoSans-Regular.ttf`, `NotoSans-Bold.ttf`): Chỉ được gọi bởi `backend/translate_paper.py:282`. Extension không hề import font này.
   - `backend/output/`: Chứa 2 file ảnh debug `preview_before_p1.png` và `preview_before_p3.png`. Không có code nào tham chiếu tới 2 file này.
   - `dist/live-trans-extension.zip`: File zip kích thước 38,249 bytes, trùng khớp từng byte với `extension/.output/live-trans-extension-0.1.0-chrome.zip` (38,249 bytes). Trong khi đó, bản zip v1.0.1 mới nhất là `extension/.output/live-trans-extension-1.0.1-chrome.zip` (1,553,779 bytes).
   - `demo/`: Hoàn toàn không có liên kết import hoặc script tham chiếu nào từ `extension/`.
   - Scripts ad-hoc:
     - `scripts/probe-dump.mjs` & `scripts/probe-dump2.mjs`: Script scrap dump JSON Interactions API, đã được chuẩn hóa trong `scripts/api-probe.mjs`.
     - `scripts/verify-gemini.mjs`: Có bug double endpoint URL (`HANDOFF.md:196`).
     - `scripts/verify-transcribe.mjs`: Script thử nghiệm upload raw WAV.

4. **Build & Test Baseline Results**:
   - Thực thi `npm.cmd run test` trong `d:\create\Live-Trans\extension`:
     `Test Files: 17 passed (17) | Tests: 123 passed (123)` (Duration: 1.65s).
   - Thực thi `npm.cmd run build` trong `d:\create\Live-Trans\extension`:
     `Built extension in 1.242 s | Total size: 3.31 MB | 0 errors`.
   - Thực thi `npm.cmd run check` trong `d:\create\Live-Trans\extension`:
     `wxt prepare` + `tsc --noEmit` + `eslint .` + `vitest run` đều PASS 100%.

---

## 2. LOGIC CHAIN (Chuỗi suy luận logic)

1. **Từ Quan sát 1 & 2**: Vì toàn bộ cấu hình build và test nằm hoàn toàn trong `extension/`, các thư mục ngoài `extension/` (như `backend/`, `demo/`, `dist/`, `docs/`) không tham gia vào quá trình bundle của WXT hay module resolution của Vite/TypeScript.
2. **Từ Quan sát 3 đối với `gateway/`**: Vì `extension/lib/providers/local-gateway.ts` và các UI của extension cho phép người dùng kích hoạt `settings.mode = 'gateway'` để gửi request tới `gateway/gateway.mjs`, `gateway/` là một runtime service tuỳ chọn hợp lệ. Do đó, việc xóa `gateway/` sẽ làm gãy tính năng này của sản phẩm.
3. **Từ Quan sát 3 đối với `demo/` và `dist/`**:
   - `demo/` là trang HTML tĩnh độc lập (52.7 KB) không hề được liên kết hay đóng gói vào extension.
   - `dist/live-trans-extension.zip` là file nén từ bản build v0.1.0 cũ (38 KB), trong khi output thực sự của v1.0.1 nằm trong `extension/.output/` (1.55 MB).
   - Do đó, xóa hoặc di dời `demo/` và `dist/` hoàn toàn không làm ảnh hưởng đến runtime, build, hay test của v1.0.1.
4. **Từ Quan sát 3 đối với `backend/`**:
   - `backend/output/*` là các file ảnh debug sinh ra từ các lần chạy script python trước đây, không được code nào sử dụng -> Xóa an toàn 100%.
   - `backend/fonts/*` và `backend/translate_paper.py` là prototype cũ của giai đoạn khảo sát Python PyMuPDF, extension v1.0.1 đã chuyển hoàn toàn sang kiến trúc viewer chạy PDF.js trong browser -> Di dời an toàn sang thư mục lưu trữ (`archive/`).
   - `backend/samples/2302.07121.pdf` (50.7 MB) đang được `blocks.test.ts:372` tham chiếu. Mặc dù có lệnh guard `if (!fs.existsSync(pdfPath)) return;` giúp test không bị fail khi xóa file, nhưng việc xóa mất file sẽ làm giảm độ bao phủ kiểm thử thực tế trên file PDF thật. Do đó, logic tối ưu là di dời file này về đúng vị trí tài nguyên test: `tests/fixtures/sample-paper.pdf` và cập nhật lại đường dẫn trong `blocks.test.ts`.
5. **Từ Quan sát 3 đối với `scripts/`**:
   - Các script `build-zip.ps1`, `check.ps1`, `kill-cft.ps1`, `run-paper-test.ps1`, `cdp.mjs`, `cdp-ext.mjs`, `cdp-debug-offscreen.mjs`, `api-probe.mjs` là công cụ phát triển và tự động hóa có giá trị cao -> Cần giữ lại.
   - Các script `probe-dump.mjs`, `probe-dump2.mjs`, `verify-gemini.mjs`, `verify-transcribe.mjs` là các phế tích sau giai đoạn reverse-engineering API ban đầu -> An toàn để xóa hoặc di dời.
6. **Từ Quan sát 4**: Vì build và test suite đều độc lập hoàn toàn với các file/thư mục dư thừa kể trên, việc dọn dẹp các tài nguyên này sẽ giải phóng dung lượng đĩa (~346 MB) mà không làm suy giảm tính toàn vẹn của hệ thống.

---

## 3. CAVEATS (Vùng chưa khảo sát & Giả định)

1. **Test Guard trong `blocks.test.ts`**:
   - Dòng 373 `if (!fs.existsSync(pdfPath)) return;` cho phép test pass ngay cả khi thiếu file `backend/samples/2302.07121.pdf`. Nếu sau này người thực thi tái cấu trúc xóa file này mà không di chuyển sang `tests/fixtures/`, vitest vẫn báo 123 tests pass nhưng thực chất 1 test case đã bị bỏ qua phần assert sâu.
2. **Gateway Process Lifecycle**:
   - Gateway là tiến trình chạy độc lập qua Node CLI (`node gateway/gateway.mjs`). Extension không tự spawn gateway (vì hạn chế của Chrome Extension sandbox), người dùng phải tự khởi động thủ công khi dùng mode này.
3. **Phạm vi R1**:
   - Khảo sát này tập trung vào mức độ toàn bộ cây thư mục tại Root và các tài nguyên phụ trợ. Việc phân tích chi tiết dead code bên trong từng file của `extension/` thuộc phạm vi của nhiệm vụ R2 (được phân công cho các sub-agents chuyên trách).

---

## 4. CONCLUSION (Kết luận & Đánh giá cuối cùng)

1. **Phân loại rõ ràng**:
   - **Nhóm 1 (Runtime v1.0.1)**: `extension/` và `gateway/`.
   - **Nhóm 2 (Dev, Tooling & CI)**: `.github/`, `scripts/` (bộ công cụ CDP/check/build), `tests/fixtures/`, `docs/`, các file cấu hình root (`.editorconfig`, `.env.example`, `.gitattributes`, `.gitignore`, `HANDOFF.md`, `README.md`).
   - **Nhóm 3 (Rác, POC cũ & File build cũ)**: `demo/`, `dist/live-trans-extension.zip`, `extension/.output/live-trans-extension-0.1.0-chrome.zip`, `extension/.output/live-trans-extension-1.0.0-chrome.zip`, `backend/output/*`, `scripts/probe-dump*.mjs`, `scripts/verify-*.mjs`, `.tools/profile/` (cache browser).
2. **Khuyến nghị xử lý cụ thể**:
   - **Xóa ngay**: `dist/live-trans-extension.zip`, `backend/output/*`, các file zip build cũ trong `extension/.output/`, các script probe scrap cũ (`probe-dump.mjs`, `probe-dump2.mjs`, `verify-gemini.mjs`, `verify-transcribe.mjs`).
   - **Di dời**: `demo/` sang `archive/demo/`; `backend/translate_paper.py` và `backend/fonts/` sang `archive/python-prototype/`.
   - **Tái cấu trúc**: Di dời `backend/samples/2302.07121.pdf` sang `tests/fixtures/sample-paper.pdf` và cập nhật đường dẫn tại `extension/lib/pdf/blocks.test.ts:372`.
   - **Bổ sung**: Thêm file `package.json` tại root dự án với các script ủy quyền vào `extension/` để hỗ trợ lệnh chạy từ root.

---

## 5. VERIFICATION METHOD (Phương pháp kiểm chứng độc lập)

Để kiểm chứng độc lập kết quả khảo sát trên, thực hiện các lệnh sau:

1. **Xác nhận không có cấu hình tại root**:
   ```powershell
   # Chạy tại d:\create\Live-Trans
   npm.cmd test
   # Kỳ vọng: Báo lỗi ENOENT do không có package.json ở root
   ```

2. **Kiểm tra 123/123 Unit Tests pass 100%**:
   ```powershell
   cd d:\create\Live-Trans\extension
   npm.cmd run test
   # Kỳ vọng: 17 passed (17) file, 123 passed (123) tests
   ```

3. **Kiểm tra quy trình Build v1.0.1**:
   ```powershell
   cd d:\create\Live-Trans\extension
   npm.cmd run build
   # Kỳ vọng: WXT build thành công trong ~1.5s, tạo ra bundle trong .output/chrome-mv3/
   ```

4. **Kiểm tra toàn diện quy trình CI Check**:
   ```powershell
   cd d:\create\Live-Trans\extension
   npm.cmd run check
   # Kỳ vọng: wxt prepare + typecheck + lint + vitest đều thành công 100%
   ```

5. **Xác nhận vị trí file tham chiếu sample PDF**:
   ```powershell
   Select-String -Path "d:\create\Live-Trans\extension\lib\pdf\blocks.test.ts" -Pattern "2302.07121.pdf"
   # Kỳ vọng: Khớp chính xác dòng 372 trỏ tới backend/samples/2302.07121.pdf
   ```
