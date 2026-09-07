# BÁO CÁO KHẢO SÁT R1: PHÂN LOẠI & RÀ SOÁT THƯ MỤC / TÀI NGUYÊN DƯ THỪA (FOLDER & ASSET REDUNDANCY AUDIT)

**Dự án:** Live-Trans (Phiên bản v1.0.1)  
**Agent thực hiện:** Explorer Root 1 (`.agents/explorer_root_1`)  
**Ngày thực hiện:** 2026-09-07  
**Phạm vi:** Toàn bộ cây thư mục tại Root dự án `d:\create\Live-Trans`

---

## 1. TỔNG QUAN HIỆN TRẠNG TOÀN BỘ CÂY THƯ MỤC TẠI ROOT

Khảo sát thực tế toàn bộ file và thư mục tại thư mục gốc `d:\create\Live-Trans`:

| Tên Thư mục / File | Phân loại | Số lượng file | Dung lượng | Trạng thái Git | Mục đích & Vai trò |
|---|---|---|---|---|---|
| `extension/` | Directory | 8,830 | 194.12 MB | Tracked (trừ `node_modules`, `.output`, `.wxt`) | **Cốt lõi sản phẩm v1.0.1**: Chứa toàn bộ source Chrome Extension, WXT build, Preact UI, thư viện dịch thuật và 17 file unit test (123 tests). |
| `gateway/` | Directory | 2 | 10.62 KB | Tracked | **Runtime Service tùy chọn**: Local HTTP Proxy (`gateway.mjs`) chạy tại `localhost:8787` phục vụ chế độ "Gateway Mode" (giữ API key ngoài browser). |
| `backend/` | Directory | 7 | 52.65 MB | Một phần Tracked, một phần Gitignored | **POC cũ / Thử nghiệm**: Prototype Python dịch layout PDF bằng PyMuPDF; chứa font tiếng Việt và sample PDF 50.7 MB. |
| `demo/` | Directory | 3 | 52.72 KB | Tracked | **POC v0.1 cũ**: Giao diện mockup tĩnh (HTML/CSS/JS thuần) thời kỳ đầu, hoàn toàn tách biệt khỏi extension. |
| `dist/` | Directory | 1 | 37.35 KB | Gitignored (nhưng có file trên đĩa) | **File build cũ**: Chứa file zip đóng gói từ phiên bản v0.1.0 (`live-trans-extension.zip` 38 KB) đã lỗi thời. |
| `scripts/` | Directory | 16 | 56.65 KB | Tracked | **Dev Tools & Scripts**: Chứa scripts tự động hóa build, CI check, kiểm soát trình duyệt qua CDP và một số script probe dump ad-hoc. |
| `tests/` | Directory | 6 | 687.22 KB | Tracked | **Fixtures & Integration Test**: Chứa file audio mẫu (`speech.wav`), glossary mẫu (`golden-glossary.json`), transcript mẫu và placeholder integration. |
| `docs/` | Directory | 10 | 98.43 KB | Tracked | **Tài liệu dự án**: Kiến trúc, kế hoạch tổng thể (`plan.md`), roadmap, hướng dẫn cài đặt, nhật ký lỗi (`ISSUES_LOG.md`). |
| `.github/` | Directory | 1 | 0.38 KB | Tracked | **CI Pipeline**: Workflow GitHub Actions (`ci.yml`) chạy `npm ci` và `npm run check` trong thư mục `extension/`. |
| `.tools/` | Directory | 541 | 291.70 MB | Gitignored | **Môi trường Test**: Profile người dùng Chromium for Testing (`profile/`) tích lũy cache sau các phiên test thực tế. |
| `.zcode/` | Directory | 1 | 10.22 KB | Gitignored | **Metadata IDE/Agent**: Chứa kế hoạch phiên làm việc của ZCode IDE agent. |
| `.agents/` | Directory | 25 | 168.82 KB | Untracked | **Teamwork Metadata**: Thư mục làm việc của hệ thống multi-agent. |
| `.git/` | Directory | 37 | 1.81 MB | System | Thư mục dữ liệu Git repository. |
| `.editorconfig` | File | 1 | 0.24 KB | Tracked | Cấu hình định dạng code cho editor (indent, charset, newline). |
| `.env.example` | File | 1 | 0.40 KB | Tracked | Template cấu hình biến môi trường (`GEMINI_API_KEY`). |
| `.gitattributes` | File | 1 | 0.36 KB | Tracked | Cấu hình xử lý xuống dòng Git (CRLF / LF). |
| `.gitignore` | File | 1 | 0.53 KB | Tracked | Cấu hình loại trừ file khỏi Git. |
| `HANDOFF.md` | File | 1 | 26.00 KB | Tracked | Tài liệu bàn giao bối cảnh kỹ thuật, quyết định thiết kế và trạng thái thực nghiệm. |
| `ORIGINAL_REQUEST.md` | File | 1 | 3.02 KB | Untracked | Yêu cầu kiểm toán và phân tích toàn diện mã nguồn v1.0.1. |
| `README.md` | File | 1 | 3.03 KB | Tracked | Tài liệu giới thiệu dự án và hướng dẫn cơ bản. |

---

## 2. PHÁT HIỆN ĐẶC BIỆT VỀ HỆ THỐNG CẤU HÌNH (ROOT CONFIG ANOMALY)

- **Không có `package.json` tại Root**:
  - Khi thực hiện lệnh `npm test` hoặc `npm run build` tại root `d:\create\Live-Trans`, npm sẽ báo lỗi ngay lập tức:
    `npm error enoent Could not read package.json: Error: ENOENT: no such file or directory, open 'D:\create\Live-Trans\package.json'`.
  - Toàn bộ tooling, dependencies, TypeScript config (`tsconfig.json`), Linter (`eslint.config.mjs`), Bundler (`wxt.config.ts`), Test runner (`vitest.config.ts`) đều nằm cục bộ bên trong thư mục `extension/`.
- **Cơ chế CI & Script hiện tại**:
  - GitHub Actions (`.github/workflows/ci.yml`) phải thiết lập `defaults.run.working-directory: extension`.
  - Các script PowerShell tại `scripts/` (như `scripts/check.ps1`, `scripts/build-zip.ps1`) đều phải `Push-Location $ExtDir` (`d:\create\Live-Trans\extension`) trước khi thực thi.
- **Khuyến nghị kiến trúc**: Nên bổ sung một `package.json` ở root cấu hình npm workspaces hoặc các proxy scripts (`"build": "npm run build --prefix extension"`, `"test": "npm run test --prefix extension"`), hoặc giữ nguyên quy ước nếu repo định hướng micro-packages.

---

## 3. ĐÁNH GIÁ CHI TIẾT TỪNG THƯ MỤC VÀ MỨC ĐỘ LIÊN HỆ ĐẾN RUNTIME V1.0.1

### 3.1. Thư mục `extension/` (Cốt lõi - Runtime & Build Target chính)
- **Mục đích**: Là toàn bộ ứng dụng Chrome Extension Live-Trans v1.0.1.
- **Cấu trúc bên trong**:
  - `entrypoints/`: Chứa các thành phần mở rộng Chrome:
    - `background.ts`: Service Worker quản lý context menu, session audio, phím tắt.
    - `content/`: Content script gắn nút FAB trên các trang PDF/ArXiv và overlay phụ đề trên video.
    - `offscreen/`: Offscreen document xử lý bắt stream âm thanh (`tabCapture`), trích xuất PCM 16kHz WAV và điều phối gửi nhận.
    - `popup/`: Giao diện Popup (Preact) điều khiển bắt đầu dịch, chọn ngôn ngữ, chọn model, kiểm tra API key.
    - `options/`: Giao diện Cài đặt (Preact) cấu hình API key, Glossary, Provider Mode (Direct/Gateway/Demo).
    - `viewer/`: Trình đọc PDF học thuật song ngữ chuyên biệt (Preact + KaTeX + PDF.js), gồm Canvas View, Markdown Reader, Whiteboard.
  - `lib/`: Hệ thống module dịch thuật:
    - `asr/`: Client và parser nhận diện giọng nói qua Gemini Interactions API.
    - `capture/`: Thu âm tab và tạo header WAV.
    - `glossary/`: Bộ chọn lọc và kiểm định thuật ngữ học thuật (đo lường TSR ≥ 95%).
    - `masker/`: Bảo vệ thuật ngữ, công thức toán (`⟦MATH_N⟧`), link URL.
    - `pdf/`: Trích xuất text block (`blocks.ts`), tái cấu trúc Markdown (`markdown.ts`), chia câu song song (`translate.ts`), vision cache.
    - `protocol/`: Hàng đợi bản tin nội bộ extension.
    - `providers/`: Router xoay API key (`key-router.ts`), Direct Gemini, Local Gateway, Mock Provider, xử lý Retry-After 429 (`fetch-retry.ts`).
    - `subtitles/`: Phân đoạn phụ đề và xuất file `.srt`.
    - `translate/`: Batching câu văn, xây dựng prompt dịch học thuật.
  - `public/`:
    - `pdf.worker.min.mjs` (1.27 MB): Worker của PDF.js dùng cho viewer.
    - `icons/`: Icon 16, 32, 48, 128 px.
- **Tài nguyên dư thừa bên trong `extension/`**:
  - `extension/.output/live-trans-extension-0.1.0-chrome.zip` (38 KB): File zip build của v0.1.0 cũ.
  - `extension/.output/live-trans-extension-1.0.0-chrome.zip` (1.55 MB): File zip build của v1.0.0 cũ.
  *(Chỉ có `live-trans-extension-1.0.1-chrome.zip` và thư mục `chrome-mv3/` là bản build hiện tại).*

### 3.2. Thư mục `gateway/` (Runtime Service - Cần giữ lại)
- **Mục đích**: Proxy cục bộ viết bằng Node.js thuần (`gateway.mjs`), không phụ thuộc thư viện ngoài (`node:http`, `node:fs/promises`).
- **Mối liên hệ với Extension v1.0.1**:
  - Extension cung cấp tùy chọn `settings.mode === 'gateway'` trong cả Popup và Options UI.
  - Khi người dùng chọn chế độ này, extension gửi request tới `http://localhost:8787` (`LocalGatewayProvider` tại `extension/lib/providers/local-gateway.ts`). Gateway sẽ đọc `GEMINI_API_KEY` từ file `.env` cục bộ và gọi Google Generative Language API, giúp bảo vệ API key không bị lộ trong browser context.
- **Kết luận**: Thư mục này là **Runtime Dependency tùy chọn hợp lệ**, KHÔNG ĐƯỢC XÓA nếu dự án duy trì tính năng Gateway mode.

### 3.3. Thư mục `backend/` (Prototype cũ / Thử nghiệm độc lập)
- **Mục đích**: Prototype viết bằng Python (`translate_paper.py`) thử nghiệm thuật toán bóc tách layout PDF bằng PyMuPDF, batching dịch qua Gemini và chèn text lại vào PDF.
- **Phân tích các thành phần**:
  1. `backend/translate_paper.py` (13.9 KB): Script Python độc lập. Extension v1.0.1 hiện tại đã chuyển hoàn toàn sang chạy trực tiếp trong browser bằng PDF.js và Preact (`extension/entrypoints/viewer/`), không dùng backend Python này trong runtime.
  2. `backend/fonts/` (1.14 MB): Chứa `NotoSans-Regular.ttf` và `NotoSans-Bold.ttf`. Chỉ được gọi bởi `translate_paper.py`. Extension không dùng font này (dùng font hệ thống hoặc web fonts).
  3. `backend/output/` (879.8 KB): Chứa 2 file ảnh debug `preview_before_p1.png` và `preview_before_p3.png`. Đây là file rác sinh ra trong quá trình chạy script trước đây.
  4. `backend/samples/2302.07121.pdf` (50.7 MB / 53,165,173 bytes): Paper mẫu ArXiv. **ĐÂY LÀ ĐIỂM CẦN LƯU Ý ĐẶC BIỆT**:
     - Trong file unit test `extension/lib/pdf/blocks.test.ts` (dòng 372), có đoạn code:
       ```typescript
       const pdfPath = path.resolve(__dirname, '../../../backend/samples/2302.07121.pdf');
       if (!fs.existsSync(pdfPath)) return;
       // ... parse PDF bằng pdfjs-dist và assert các công thức (1), (2), (3)
       ```
     - Nếu xóa file này: Test vitest vẫn pass (do có guard `if (!fs.existsSync(pdfPath)) return;`), nhưng việc kiểm thử trích xuất block thực tế trên paper ArXiv thật sẽ bị bỏ qua (silent skip).
- **Kết luận**:
  - `backend/output/`: Xóa bỏ ngay.
  - `backend/samples/2302.07121.pdf`: Di chuyển vào `tests/fixtures/sample-paper.pdf` và cập nhật lại đường dẫn trong `blocks.test.ts` (hoặc cấu hình tải động).
  - `backend/translate_paper.py` và `backend/fonts/`: Di dời sang `archive/python-prototype/` hoặc giữ nguyên như tài liệu tham khảo thuật toán (như đã ghi trong `HANDOFF.md` §1.P.6).

### 3.4. Thư mục `demo/` (POC cũ v0.1 - Hoàn toàn dư thừa)
- **Mục đích**: Giao diện mockup tĩnh gồm `index.html` (12.9 KB), `demo.js` (10.8 KB), `style.css` (30.2 KB).
- **Mối liên hệ với Extension v1.0.1**: Hoàn toàn KHÔNG CÓ. Không có file nào trong `extension/`, `scripts/`, hay CI tham chiếu đến thư mục này.
- **Kết luận**: Đây là mã nguồn POC từ thời kỳ khảo sát ban đầu trước khi scaffold WXT. Có thể xóa an toàn hoặc chuyển vào thư mục `archive/demo/` mà không ảnh hưởng bất kỳ luồng chạy nào.

### 3.5. Thư mục `dist/` (Tài nguyên build cũ - File rác)
- **Mục đích & Hiện trạng**:
  - Chứa duy nhất 1 file `dist/live-trans-extension.zip` (38,249 bytes), tạo lúc 9/2/2026 1:03 PM (phiên bản v0.1.0).
  - Thư mục `dist/` đã được khai báo trong `.gitignore`, nhưng file này vẫn nằm trên ổ đĩa.
  - File build zip thực tế của v1.0.1 hiện nằm ở `extension/.output/live-trans-extension-1.0.1-chrome.zip` (1.55 MB).
- **Mối liên hệ với Scripts**: File `scripts/build-zip.ps1` có logic copy zip từ `extension/.output/` ra `dist/live-trans-extension.zip`.
- **Kết luận**: File `dist/live-trans-extension.zip` hiện tại là file rác từ bản build cũ. Có thể xóa an toàn file này. Thư mục `dist/` nên được dọn sạch và giữ trạng thái rỗng được gitignore.

### 3.6. Thư mục `tests/` (Fixtures dùng chung & Chờ tích hợp)
- **Mục đích & Hiện trạng**:
  - `tests/fixtures/speech.wav` (700 KB): File âm thanh mẫu tạo từ Windows SAPI, được dùng bởi các script `scripts/api-probe.mjs`, `scripts/probe-dump.mjs`, `scripts/probe-dump2.mjs`.
  - `tests/fixtures/golden-glossary.json` (885 B): Glossary mẫu chuẩn được dùng bởi `backend/translate_paper.py`.
  - `tests/fixtures/sample-transcript.json` (1.7 KB): Dữ liệu mẫu transcript.
  - `tests/integration/.gitkeep`: Thư mục placeholder cho test tích hợp e2e (Playwright/Contract test) theo kế hoạch trong `docs/plan.md`.
- **Mối liên hệ với Unit Test**: Hiện tại 123 unit tests của extension đều nằm trong `extension/lib/**/*.test.ts`, không phụ thuộc vào `tests/`.
- **Kết luận**: Giữ lại `tests/fixtures/` để phục vụ các script kiểm thử API và làm nơi lưu trữ các fixture dùng chung (như di chuyển file PDF mẫu về đây).

### 3.7. Thư mục `scripts/` (Công cụ phát triển - Phân hóa 2 nhóm)
Thư mục chứa 16 files (56.6 KB), được phân thành 2 nhóm rõ rệt:

#### Nhóm A: Công cụ Dev, Test & Build quan trọng (CẦN GIỮ)
1. `scripts/build-zip.ps1`: Tự động biên dịch và đóng gói extension zip.
2. `scripts/check.ps1`: Kiểm tra sức khỏe mã nguồn toàn diện (`typecheck + lint + vitest`).
3. `scripts/kill-cft.ps1`: Dọn dẹp Chromium for Testing zombie processes (bắt buộc trước khi test browser).
4. `scripts/run-paper-test.ps1`: Tự động khởi chạy trình duyệt CfT kèm extension và mở paper mẫu để test viewer.
5. `scripts/cdp.mjs`: Điều khiển tự động hóa tab YouTube qua giao thức Chrome DevTools (port 9222).
6. `scripts/cdp-ext.mjs`: Kết nối và kiểm tra trạng thái của Service Worker extension qua CDP.
7. `scripts/cdp-debug-offscreen.mjs`: Nghe lén log console và network của offscreen document.
8. `scripts/api-probe.mjs`: Probe kiểm tra toàn diện API key, danh sách model, upload file và Interactions API.
9. `scripts/make-speech-fixture.ps1`: Tạo file `speech.wav` bằng Windows SAPI.
10. `scripts/test-translate-paper.mjs`: Test script dịch paper tự động.

#### Nhóm B: Script tạm thời, Ad-hoc hoặc Trùng lặp (DƯ THỪA / NÊN DI DỜI)
1. `scripts/probe-dump.mjs` (904 B): Script scrap ad-hoc dump JSON của Interactions API ban đầu. Đã được thay thế hoàn toàn bởi `scripts/api-probe.mjs`.
2. `scripts/probe-dump2.mjs` (1.76 KB): Script scrap dump word timestamps. Đã được chuẩn hóa trong `scripts/api-probe.mjs` và unit test `parser.test.ts`.
3. `scripts/verify-gemini.mjs` (4.53 KB): Script cũ có bug URL upload (`/upload/v1beta/upload/v1beta/files` - đã ghi nhận tại `HANDOFF.md` dòng 196). Đã được thay thế bởi `api-probe.mjs`.
4. `scripts/verify-transcribe.mjs` (4.52 KB): Thử nghiệm upload WAV dạng raw, trùng lặp tính năng với `api-probe.mjs`.
5. `scripts/test-transcribe.mjs` (9.11 KB): Script kiểm thử ASR độc lập ngoài Node, chứa parser riêng trùng lặp với `extension/lib/asr/parser.ts`.

### 3.8. Thư mục `docs/` (Tài liệu dự án - CẦN GIỮ 100%)
- 10 tài liệu kỹ thuật hoàn chỉnh: `INSTALL.md`, `ISSUES_LOG.md`, `TESTING.md`, `architecture.md`, `open-questions.md`, `overview.md`, `pdf-viewer.md`, `plan.md`, `requirements.md`, `roadmap.md`.
- Chứa toàn bộ bối cảnh kiến trúc, log lỗi và lịch sử quyết định kỹ thuật của dự án. Không có file nào dư thừa.

### 3.9. Các thư mục ẩn và file cấu hình Root
1. `.tools/profile/` (291.7 MB): Chứa profile trình duyệt Chromium for Testing. Không nằm trong Git. Chứa cache trình duyệt sau khi test thực tế. Có thể xóa sạch để giải phóng dung lượng đĩa khi không cần giữ session đăng nhập/test.
2. `.zcode/` (10.2 KB): Thư mục cấu hình agent của IDE ZCode. Đã nằm trong `.gitignore`.
3. `.github/workflows/ci.yml`: File cấu hình CI chính thức của repo.
4. `.editorconfig`, `.env.example`, `.gitattributes`, `.gitignore`, `README.md`, `HANDOFF.md`: File cấu hình và tài liệu chuẩn của repo.

---

## 4. BẢNG TỔNG HỢP PHÂN LOẠI THEO YÊU CẦU AUDIT (3 NHÓM)

### Nhóm 1: Cốt lõi phục vụ Extension v1.0.1 (Runtime Dependencies)
- `extension/` (source code `entrypoints/`, `lib/`, `public/`, configs)
- `gateway/gateway.mjs` & `gateway/.env.example` (hỗ trợ Gateway mode)

### Nhóm 2: Phục vụ Build, Test, CI và Công cụ phát triển
- `.github/workflows/ci.yml` (CI pipeline)
- `scripts/build-zip.ps1`, `scripts/check.ps1`, `scripts/kill-cft.ps1`, `scripts/run-paper-test.ps1`
- `scripts/cdp.mjs`, `scripts/cdp-ext.mjs`, `scripts/cdp-debug-offscreen.mjs`, `scripts/api-probe.mjs`
- `tests/fixtures/speech.wav`, `tests/fixtures/golden-glossary.json`
- `docs/*` (10 file tài liệu)
- `.editorconfig`, `.env.example`, `.gitattributes`, `.gitignore`, `README.md`, `HANDOFF.md`

### Nhóm 3: POC cũ (v0.1), File rác, File build cũ, Dữ liệu mẫu không còn dùng
- `demo/` (`demo/index.html`, `demo/demo.js`, `demo/style.css`) — Mockup v0.1 cũ (52.7 KB).
- `dist/live-trans-extension.zip` — File zip build v0.1.0 cũ (38.2 KB).
- `extension/.output/live-trans-extension-0.1.0-chrome.zip` — File zip build cũ trong extension (38.2 KB).
- `extension/.output/live-trans-extension-1.0.0-chrome.zip` — File zip build cũ trong extension (1.55 MB).
- `backend/output/preview_before_p1.png`, `preview_before_p3.png` — File ảnh rác debug (879.8 KB).
- `backend/fonts/*` & `backend/translate_paper.py` — Prototype Python (1.15 MB, nên chuyển vào `archive/`).
- `backend/samples/2302.07121.pdf` — Sample PDF nặng 50.7 MB (cần di dời vào `tests/fixtures/` để tái cấu trúc).
- `scripts/probe-dump.mjs`, `scripts/probe-dump2.mjs`, `scripts/verify-gemini.mjs`, `scripts/verify-transcribe.mjs` — Script ad-hoc cũ (11.7 KB).
- `.tools/profile/` — Cache Chromium for Testing (291.7 MB, có thể dọn dẹp).

---

## 5. DANH SÁCH CHI TIẾT CÁC FILE / THƯ MỤC AN TOÀN ĐỂ XÓA HOẶC DI DỜI

Dưới đây là danh sách đề xuất cụ thể kèm mức độ rủi ro đối với lệnh build (`npm run build`) và test (`npm run test`):

| Đường dẫn tài nguyên | Dung lượng | Đề xuất hành động | Tác động đến `npm run build` | Tác động đến `npm run test` (123 tests) | Giải trình an toàn & Lưu ý |
|---|---|---|---|---|---|
| `dist/live-trans-extension.zip` | 38.25 KB | **Xóa ngay (Delete)** | Không ảnh hưởng (0%) | Không ảnh hưởng (0%) | Bản build cũ v0.1.0, không được dùng ở bất kỳ đâu. |
| `backend/output/preview_before_p1.png` | 571.51 KB | **Xóa ngay (Delete)** | Không ảnh hưởng (0%) | Không ảnh hưởng (0%) | Ảnh chụp debug cũ do script Python tạo ra. |
| `backend/output/preview_before_p3.png` | 308.31 KB | **Xóa ngay (Delete)** | Không ảnh hưởng (0%) | Không ảnh hưởng (0%) | Ảnh chụp debug cũ do script Python tạo ra. |
| `extension/.output/live-trans-extension-0.1.0-chrome.zip` | 38.25 KB | **Xóa ngay (Delete)** | Không ảnh hưởng (0%) | Không ảnh hưởng (0%) | Bản zip v0.1.0 cũ trong thư mục output của WXT. |
| `extension/.output/live-trans-extension-1.0.0-chrome.zip` | 1.55 MB | **Xóa ngay (Delete)** | Không ảnh hưởng (0%) | Không ảnh hưởng (0%) | Bản zip v1.0.0 cũ trong thư mục output của WXT. |
| `scripts/probe-dump.mjs` | 0.90 KB | **Xóa hoặc Archive** | Không ảnh hưởng (0%) | Không ảnh hưởng (0%) | Script scrap test API cũ, đã có `api-probe.mjs`. |
| `scripts/probe-dump2.mjs` | 1.77 KB | **Xóa hoặc Archive** | Không ảnh hưởng (0%) | Không ảnh hưởng (0%) | Script scrap test API cũ, đã có `api-probe.mjs`. |
| `scripts/verify-gemini.mjs` | 4.53 KB | **Xóa hoặc Archive** | Không ảnh hưởng (0%) | Không ảnh hưởng (0%) | Script cũ chứa bug sai URL endpoint upload. |
| `scripts/verify-transcribe.mjs` | 4.52 KB | **Xóa hoặc Archive** | Không ảnh hưởng (0%) | Không ảnh hưởng (0%) | Script cũ thử nghiệm upload raw WAV. |
| `demo/` (cả 3 files) | 52.72 KB | **Di dời sang `archive/demo/`** | Không ảnh hưởng (0%) | Không ảnh hưởng (0%) | POC giao diện tĩnh ban đầu, không liên quan đến WXT. |
| `backend/translate_paper.py` & `backend/fonts/` | 1.15 MB | **Di dời sang `archive/python-prototype/`** | Không ảnh hưởng (0%) | Không ảnh hưởng (0%) | Prototype Python ban đầu, extension đã có viewer riêng. |
| `backend/samples/2302.07121.pdf` | 50.70 MB | **Di dời sang `tests/fixtures/sample-paper.pdf`** | Không ảnh hưởng (0%) | **CẦN CẬP NHẬT PATH** trong `blocks.test.ts:372` | Nếu xóa mà không đổi path, test vẫn pass (do `if (!fs.existsSync)` skip), nhưng di dời và cập nhật path sẽ giữ trọn vẹn test coverage thực tế. |
| `.tools/profile/` | 291.70 MB | **Dọn dẹp cache (Purge)** | Không ảnh hưởng (0%) | Không ảnh hưởng (0%) | Cache Chromium test, tự động sinh lại khi chạy CfT. |

**Tổng dung lượng giải phóng ước tính:** ~346 MB (trong đó ~54 MB từ file mã nguồn/tài nguyên rác trong repo và ~292 MB từ cache browser test).

---

## 6. KẾT LUẬN & KIẾN NGHỊ CHO BƯỚC TÁI CẤU TRÚC (REFACTORING ROADMAP)

1. **Bảo toàn 100% lệnh Build và Test**:
   - Mọi đề xuất xóa và di dời trên đều độc lập hoàn toàn với runtime của Chrome Extension v1.0.1.
   - Việc xóa các file zip cũ, demo tĩnh, và script probe dump đảm bảo `123/123` unit tests tiếp tục pass 100% và `npm run build` tạo ra extension sạch sẽ.
2. **Khắc phục điểm nghẽn root `package.json`**:
   - Nên tạo `package.json` tại root dự án định nghĩa các lệnh tắt (`npm run build`, `npm run test`, `npm run check`) ủy quyền trực tiếp vào `extension/`, giúp lập trình viên và các công cụ CI/Agent thao tác tại root thuận tiện và trực quan.
3. **Tiến trình thực hiện an toàn**:
   - Theo đúng quy tắc hệ thống, toàn bộ khảo sát này ở chế độ Read-Only. Khi bước vào pha Refactoring (M2), các thao tác xóa/di dời sẽ được liệt kê chi tiết, xin xác nhận của người dùng trước khi thực thi.
