# BÁO CÁO KHẢO SÁT TOÀN DIỆN & LỘ TRÌNH TÁI CẤU TRÚC (REFACTORING AUDIT & ROADMAP)
### Dự án: Live-Trans (Phiên bản v1.0.1 - Chrome Extension)

---

| Thuộc tính | Chi tiết |
|---|---|
| **Dự án** | Live-Trans (Chrome Extension Manifest V3 dịch song ngữ & ASR cho Audio/Video/PDF) |
| **Phiên bản khảo sát** | v1.0.1 (Baseline hiện tại) |
| **Ngày lập báo cáo** | 2026-09-07 |
| **Tình trạng Baseline** | **123/123 Unit Tests PASS (100%)**, `npm run check` 0 lỗi, Bundle Build 3.31 MB |
| **Phạm vi kiểm toán** | 100% Thư mục Root (`d:\create\Live-Trans`) và 100% Mã nguồn `extension/` |
| **Chế độ kiểm toán** | Read-Only Audit & Non-Destructive Plan (Bảo toàn tuyệt đối mã nguồn và test) |
| **Mục tiêu tài liệu** | Nhận diện toàn diện tài nguyên dư thừa, Dead code, DRY violations, Performance Bottlenecks, Memory Leaks, Test Integrity và thiết lập Kế hoạch Tái cấu trúc chuẩn xác kèm Checklist xin phê duyệt từ Người dùng |

---

## MỤC LỤC TỔNG QUAN

1. [Phần 1: Executive Summary & Hiện Trạng Baseline Kỹ Thuật](#phần-1-executive-summary--hiện-trạng-baseline-kỹ-thuật)
   - 1.1. Tóm tắt kết quả kiểm toán toàn diện
   - 1.2. Hiện trạng Baseline của Hệ thống v1.0.1
   - 1.3. Đặc thù Kiến trúc & Bất thường Cấu hình Root (Root Config Anomaly)
2. [Phần 2 (R1): Phân Loại & Rà Soát Thư Mục / Tài Nguyên Dư Thừa Tại Root](#phần-2-r1-phân-loại--rà-soát-thư-mục--tài-nguyên-dư-thừa-tại-root)
   - 2.1. Khảo sát 100% Cây Thư mục & Tệp tin tại Root Repository
   - 2.2. Phân loại 3 Nhóm Tài nguyên & Mức độ Phụ thuộc Thực tế
   - 2.3. Danh mục Cụ thể Các File / Thư mục An toàn để Xóa hoặc Di dời (~346 MB giải phóng)
3. [Phần 3 (R2): Phân Tích Chi Tiết Mã Nguồn Trong `extension/` (Code Quality & Dead Code)](#phần-3-r2-phân-tích-chi-tiết-mã-nguồn-trong-extension-code-quality--dead-code)
   - 3.1. Dead Code, Ghost State & Orphan Exports (Dẫn chứng `file:line`)
   - 3.2. DRY Violations — Trùng lặp Logic Giữa Các Module
   - 3.3. Điểm Thắt Cổ Chai Hiệu Năng & Rò Rỉ Bộ Nhớ (Bottlenecks & Memory Leaks)
   - 3.4. Hardcoded Heuristics & Rủi ro Phụ thuộc Dữ liệu Mẫu trong PDF Engine
4. [Phần 4: Tính Toàn Vẹn Hệ Thống Kiểm Thử & Phụ Thuộc Ẩn (Test Integrity)](#phần-4-tính-toàn-vẹn-hệ-thống-kiểm-thử--phụ-thuộc-ẩn-test-integrity)
   - 4.1. Phân tích Chi tiết 123 Unit Tests trên 17 Test Suites
   - 4.2. CẢNH BÁO ĐẶC BIỆT: Phụ thuộc ẩn tại `blocks.test.ts:372` và Nguy cơ "Silent Skip"
   - 4.3. Đánh giá Mức độ Độc lập của Bộ Test đối với các Thư mục ngoài `extension/`
5. [Phần 5 (R3): Lộ Trình Tái Cấu Trúc Chi Tiết (Refactoring Roadmap)](#phần-5-r3-lộ-trình-tái-cấu-trúc-chi-tiết-refactoring-roadmap)
   - 5.1. Phân nhóm Ưu tiên Theo Cấp độ (High / Medium / Low)
   - 5.2. Kế hoạch Hành động Cụ thể Cho Từng File & Module
   - 5.3. Chiến lược Bảo toàn Tuyệt đối 123/123 Tests và Quy trình CI `npm run check`
6. [Phần 6: Danh Mục Câu Hỏi & Đề Xuất Phê Duyệt (Actionable Checklist for User)](#phần-6-danh-mục-câu-hỏi--đề-xuất-phê-duyệt-actionable-checklist-for-user)
   - 6.1. Tuân thủ Nguyên tắc "Hỏi trước khi sửa" (User Global Rules Compliance)
   - 6.2. Bảng Tổng Hợp Đề Xuất Phê Duyệt Tái Cấu Trúc (Dành cho Người Dùng Quyết Định)
   - 6.3. Kiến nghị Trình tự Triển khai Khuyến nghị (Staged Execution Plan)

---
## PHẦN 1: EXECUTIVE SUMMARY & HIỆN TRẠNG BASELINE KỸ THUẬT

### 1.1. Tóm tắt kết quả kiểm toán toàn diện

Dự án **Live-Trans (v1.0.1)** là tiện ích mở rộng trình duyệt (Chrome Extension Manifest V3) cung cấp dịch vụ dịch thuật phụ đề trực tiếp cho Video/Audio (thông qua Gemini Interactions ASR và Web Audio API) và hệ thống đọc & dịch song ngữ tài liệu PDF học thuật chuyên sâu (thông qua PDF.js, KaTeX và Gemini/OpenCode Zen LLM).

Đợt kiểm toán toàn diện ngày 2026-09-07 đã tiến hành rà soát 100% không gian lưu trữ mã nguồn tại thư mục Root (`d:\create\Live-Trans`) và toàn bộ các module trong `extension/`. Kết quả kiểm toán được cô đọng qua các phát hiện then chốt sau:

1. **Về Baseline Sức khỏe Mã nguồn**:
   - Hệ thống vượt qua **123/123 unit tests (100% PASS)** trên 17 test suites với thời gian chạy ~1.70s - 2.43s.
   - Trình kiểm tra kiểu tĩnh (`tsc --noEmit`) và linter (`eslint .`) hoàn toàn sạch (**0 lỗi, 0 cảnh báo**).
   - Quy trình build production (`wxt build`) hoạt động ổn định, sản sinh bundle 3.31 MB tại `extension/.output/chrome-mv3/`.

2. **Về Tài nguyên Dư thừa tại Root (R1)**:
   - Phát hiện **~346 MB** tài nguyên dư thừa có thể dọn dẹp hoặc di dời (gồm ~54 MB mã nguồn POC cũ, file rác debug, zip build cũ trong repo và ~292 MB cache Chromium for Testing).
   - Thư mục `backend/` chứa prototype Python cũ cùng file PDF mẫu 50.7 MB; `demo/` chứa mockup HTML/CSS v0.1 không còn sử dụng; `dist/` chứa zip build v0.1.0 lỗi thời.

3. **Về Chất lượng Mã nguồn bên trong `extension/` (R2)**:
   - **Dead Code quy mô lớn**: Phát hiện hơn **725 dòng code và CSS chết** không bao giờ được kích hoạt trong luồng chạy thực tế, tập trung tại `viewer/main.tsx:2041-2291` (~250 dòng component `FlowBlock`), `viewer/style.css:727-899` (~175 dòng CSS markdown mồ côi), `markdown.ts:134-214` (81 dòng `blocksToMarkdownElements`), cùng 16 hàm nội bộ bị `export` dư thừa.
   - **DRY Violations**: Phát hiện **11 trường hợp trùng lặp logic** nghiêm trọng (chuẩn hóa URL arXiv lặp lại ở 4 file, logic mở Viewer lặp lại ở 4 file, trùng lặp 100% giao diện và logic quản lý Glossary giữa Popup và Options, trùng lặp chuyển đổi Base64 nhị phân, bảng mã TeX OML và regex công thức toán).
   - **Memory Leaks & Performance Bottlenecks**: Phát hiện **17 điểm nghẽn hiệu năng**, đặc biệt là rò rỉ bộ nhớ RAM không giới hạn do `pdfPageCanvasCache` trong `viewer/PdfSnippet.tsx` (~387 MB cho 50 trang), 2 `MutationObserver` cắm vào `document.documentElement` trên mọi trang web không có debounce gây nghẽn Main Thread, lỗi treo Promise vĩnh viễn (Hanging Promise) trong `ConcurrencyQueue` khi clear session ghi âm gây giữ chặt ~1.44 MB audio buffer mỗi lần tắt/bật, rò rỉ GPU Canvas backing store trong Vision AI, và nguy cơ bùng nổ HTTP 429 do bắn 15-25 request song song ở micro-batches PDF.

4. **Cảnh báo Phụ thuộc Ẩn (Hidden Test Dependency)**:
   - Phát hiện bài unit test số 15 trong `extension/lib/pdf/blocks.test.ts:372` đang đọc trực tiếp file mẫu `backend/samples/2302.07121.pdf` (50.7 MB). Do có guard `if (!fs.existsSync(pdfPath)) return;`, nếu xóa thư mục `backend/` mà không di dời file này, bài test sẽ bị **Silent Skip** (trở thành test rỗng), vi phạm tính trung thực của quy trình kiểm thử.

---
### 1.2. Hiện trạng Baseline của Hệ thống v1.0.1

Đoàn kiểm toán đã tiến hành chạy độc lập toàn bộ các bộ công cụ xác thực sức khỏe mã nguồn trong môi trường tiêu chuẩn:

#### 1.2.1. Kết quả Unit Tests (`npm.cmd test`)
- **Công cụ thực thi**: Vitest v4.1.11, cấu hình tại `extension/vitest.config.ts`.
- **Kết quả tổng quát**: **17/17 test suites PASSED**, **123/123 tests PASSED (100%)**, 0 failures, 0 skipped.
- **Thời gian chạy**: ~2.43s (cold start) và ~1.70s (warm).

| STT | File Test Suite | Số Test Cases | Trạng thái | Thời gian | Đối tượng kiểm thử chính |
|:---:|---|:---:|:---:|:---:|---|
| 1 | `lib/asr/parser.test.ts` | 15 | PASSED | 0.02s | Phân tích JSON payload ASR (Gemini Interactions, legacy, word timestamps) |
| 2 | `lib/capture/wav.test.ts` | 5 | PASSED | 0.01s | Đóng gói header RIFF/WAVE 44-byte, 16kHz mono PCM |
| 3 | `lib/protocol/queue.test.ts` | 2 | PASSED | 0.07s | Điều phối hàng đợi đồng thời `ConcurrencyQueue` |
| 4 | `lib/pdf/blocks.test.ts` | 18 | PASSED | 1.58s | Bóc tách khối layout PDF, lọc watermark arXiv, phân cột, phát hiện công thức |
| 5 | `lib/pdf/markdown.test.ts` | 5 | PASSED | 0.02s | Chuẩn hóa Markdown, bọc toán học inline `$`, chuẩn hóa $(f, \ell)$ |
| 6 | `lib/pdf/reflow.test.ts` | 5 | PASSED | 0.01s | Thuật toán reflow dồn cột, tính độ tràn văn bản vừa khung gốc |
| 7 | `lib/pdf/translate.test.ts` | 9 | PASSED | 0.02s | Che chắn công thức toán LaTeX & URLs, phục hồi fuzzy token, router Zen/Gemini |
| 8 | `lib/pdf/vision-cache.test.ts` | 8 | PASSED | 0.02s | Quản lý bộ nhớ đệm trang PDF (LRU 50 papers, TTL 14 ngày, QuotaExceeded fallback) |
| 9 | `lib/masker/masker.test.ts` | 5 | PASSED | 0.01s | Mặt nạ hóa thuật ngữ code, command line, URLs qua placeholder |
| 10 | `lib/providers/fetch-retry.test.ts` | 5 | PASSED | 0.08s | Xử lý HTTP 429, exponential backoff, đọc header `Retry-After` |
| 11 | `lib/providers/key-router.test.ts` | 6 | PASSED | 0.01s | Xoay vòng mảng API Key (Key Pool) khi cạn hạn mức Quota |
| 12 | `lib/glossary/selector.test.ts` | 8 | PASSED | 0.01s | Lọc thuật ngữ glossary xuất hiện trong văn bản nguồn |
| 13 | `lib/glossary/validator.test.ts` | 4 | PASSED | 0.01s | Xác thực tính toàn vẹn của thuật ngữ và placeholder roundtrip |
| 14 | `lib/subtitles/segmenter.test.ts` | 7 | PASSED | 0.01s | Phân đoạn phụ đề, giới hạn ký tự trên dòng (CPS), ghép câu |
| 15 | `lib/subtitles/srt.test.ts` | 10 | PASSED | 0.01s | Định dạng xuất file phụ đề `.srt` song ngữ |
| 16 | `lib/translate/batcher.test.ts` | 8 | PASSED | 0.02s | Batching cụm câu, đo lường Term Survival Rate (TSR), retry tự động |
| 17 | `lib/translate/prompt.test.ts` | 3 | PASSED | 0.01s | Xây dựng prompt dịch thuật chuyên sâu định dạng JSON |
| **Tổng** | **17 test files** | **123 tests** | **123 PASS** | **~1.70s** | **Độ bao phủ trọn vẹn tầng Core Library (`extension/lib/`)** |

#### 1.2.2. Kiểm tra Kiểu dữ liệu & Linting (`npm.cmd run check`)
- Lệnh `npm run check` thực thi chuỗi 4 công đoạn kiểm tra nghiêm ngặt:
  1. `prepare:wxt`: Sinh các file kiểu dữ liệu định tuyến `.wxt/types/` (hoàn thành trong 1.57s).
  2. `typecheck` (`tsc --noEmit`): Quét toàn bộ TypeScript codebase với TypeScript 6.0.3. Kết quả: **0 errors, 0 warnings**.
  3. `lint` (`eslint .`): ESLint 10.9.1 Flat Config với bộ luật Prettier và TypeScript-ESLint. Kết quả: **0 errors, 0 warnings**.
  4. `test` (`vitest run`): 123/123 tests pass.
- Kết luận: Mã nguồn hiện tại không có bất kỳ nợ kỹ thuật (technical debt) nào về typing hoặc vi phạm quy chuẩn định dạng mã.

#### 1.2.3. Kiểm tra Đóng gói Production (`npm.cmd run build`)
- **Bộ công cụ**: WXT v0.21.4 (Vite/Rolldown engine). Thời gian biên dịch: **3.90s**.
- **Thư mục đầu ra**: `extension/.output/chrome-mv3/` (Chrome Extension Manifest V3 hoàn chỉnh).
- **Tổng kích thước bundle**: **3.31 MB** (gồm 82 artifacts).
- **Phân bổ kích thước chi tiết**:
  - `pdf.worker.min.mjs`: **1.27 MB** (Web Worker độc lập của PDF.js dùng cho tác vụ parse PDF ngoài luồng chính).
  - KaTeX Fonts (`.woff2`, `.ttf` gồm 58 tệp): **~1.10 MB** (phục vụ hiển thị công thức toán học chất lượng cao).
  - `chunks/viewer-*.js`: **799.27 kB** (Logic giao diện Reader song ngữ Preact, chiếm phần lớn JS mã nguồn).
  - `assets/viewer-*.css`: **62.61 kB** (Style của Viewer).
  - `chunks/popup-*.js` + `chunks/options-*.js` + `chunks/offscreen-*.js`: **~38.43 kB**.
  - `content-scripts/content.js`: **13.49 kB**.
  - `background.js`: **5.64 kB** (Service Worker MV3).

---

### 1.3. Đặc thù Kiến trúc & Bất thường Cấu hình Root (Root Config Anomaly)

#### 1.3.1. Hiện tượng ghi nhận
Tại thư mục gốc của repository (`d:\create\Live-Trans`), **hoàn toàn không tồn tại tệp tin `package.json`**.
Khi một lập trình viên hoặc công cụ CI thực hiện lệnh quen thuộc tại root:
```powershell
npm test
# hoặc
npm run build
```
Hệ thống sẽ ngay lập tức trả về lỗi nghiêm trọng:
```text
npm error enoent Could not read package.json: Error: ENOENT: no such file or directory, open 'D:\create\Live-Trans\package.json'
```

#### 1.3.2. Cơ chế thực tế của dự án
Toàn bộ hệ sinh thái phát triển của dự án được đặt cô lập bên trong thư mục con `extension/`:
- Dependencies: `extension/package.json` và `extension/package-lock.json`.
- Cấu hình TypeScript: `extension/tsconfig.json`.
- Cấu hình Linting: `extension/eslint.config.mjs`.
- Cấu hình Framework WXT: `extension/wxt.config.ts`.
- Cấu hình Vitest: `extension/vitest.config.ts`.

#### 1.3.3. Tác động tiêu cực đối với quy trình làm việc
1. **Đối với CI Pipeline**: File cấu hình GitHub Actions (`.github/workflows/ci.yml`) bắt buộc phải thêm chỉ thị `defaults.run.working-directory: extension` cho toàn bộ các bước, nếu thiếu bước này CI sẽ sập ngay lập tức.
2. **Đối với các Script Tự động hóa**: Toàn bộ script trong `scripts/` (như `check.ps1`, `build-zip.ps1`) đều phải sử dụng lệnh `Push-Location $ExtDir` để chuyển ngữ cảnh làm việc vào `extension/` trước khi chạy npm.
3. **Đối với Developer & AI Agents**: Gây trải nghiệm phát triển không trực quan (non-standard repo convention), dễ phát sinh lỗi khi các agent tự động cố gắng thực thi lệnh npm tại thư mục làm việc root.

#### 1.3.4. Đề xuất chuẩn hóa kiến trúc
Tạo một file `package.json` tối giản tại thư mục Root đóng vai trò làm proxy ủy quyền (NPM Scripts Forwarding) mà không làm xáo trộn cấu trúc `node_modules` bên trong `extension/`:
```json
{
  "name": "live-trans-monorepo-root",
  "private": true,
  "scripts": {
    "prepare": "npm run prepare:wxt --prefix extension",
    "check": "npm run check --prefix extension",
    "typecheck": "npm run typecheck --prefix extension",
    "lint": "npm run lint --prefix extension",
    "test": "npm run test --prefix extension",
    "build": "npm run build --prefix extension",
    "zip": "npm run zip --prefix extension"
  }
}
```
Giải pháp này giữ nguyên tính độc lập của `extension/`, đồng thời cho phép bất kỳ lệnh nào tại root (`npm run check`, `npm test`, `npm run build`) đều thực thi thông suốt.

---
## PHẦN 2 (R1): PHÂN LOẠI & RÀ SOÁT THƯ MỤC / TÀI NGUYÊN DƯ THỪA TẠI ROOT

### 2.1. Khảo sát 100% Cây Thư mục & Tệp tin tại Root Repository

Đoàn kiểm toán đã tiến hành quét thực địa toàn bộ 100% các thư mục và tệp tin hiện diện tại thư mục gốc `d:\create\Live-Trans`. Dưới đây là bảng thống kê tổng hợp:

| Tên Thư mục / File | Kiểu | Số lượng file | Dung lượng | Trạng thái Git | Mục đích kỹ thuật & Vai trò thực tế trong dự án |
|---|---|---|---|---|---|
| `extension/` | Thư mục | 8,830 | 194.12 MB | Tracked (trừ `node_modules`, `.output`, `.wxt`) | **Cốt lõi sản phẩm v1.0.1**: Toàn bộ mã nguồn Chrome Extension MV3, WXT Framework, Preact UI, Core translation libraries và 17 unit test suites. |
| `gateway/` | Thư mục | 2 | 10.62 KB | Tracked | **Runtime Service tùy chọn**: Local HTTP Proxy (`gateway.mjs`) chạy tại port 8787 phục vụ tính năng "Gateway Mode" nhằm bảo vệ API key ngoài browser context. |
| `backend/` | Thư mục | 7 | 52.65 MB | Một phần Tracked, một phần Gitignored | **POC cũ / Thử nghiệm độc lập**: Prototype Python (`translate_paper.py`) thử nghiệm bóc tách layout PDF bằng PyMuPDF; chứa font tiếng Việt và sample PDF nặng 50.7 MB. |
| `demo/` | Thư mục | 3 | 52.72 KB | Tracked | **POC v0.1 cũ**: Giao diện mockup tĩnh (HTML/CSS/JS) từ giai đoạn sơ khởi của dự án, hoàn toàn tách biệt khỏi extension. |
| `dist/` | Thư mục | 1 | 37.35 KB | Gitignored (tồn tại trên đĩa) | **File build cũ**: Chứa file zip đóng gói của phiên bản v0.1.0 (`live-trans-extension.zip` 38 KB) đã lỗi thời. |
| `scripts/` | Thư mục | 16 | 56.65 KB | Tracked | **Dev Tools & Scripts**: Chứa scripts tự động hóa build, CI check, điều khiển Chromium qua CDP và một số script probe dump API cũ. |
| `tests/` | Thư mục | 6 | 687.22 KB | Tracked | **Fixtures & Integration Test**: Chứa audio mẫu (`speech.wav`), glossary chuẩn (`golden-glossary.json`), transcript mẫu và placeholder integration test. |
| `docs/` | Thư mục | 10 | 98.43 KB | Tracked | **Tài liệu dự án**: 10 tài liệu kỹ thuật hoàn chỉnh về kiến trúc, kế hoạch, roadmap, cài đặt, và nhật ký lỗi (`ISSUES_LOG.md`). |
| `.github/` | Thư mục | 1 | 0.38 KB | Tracked | **CI Pipeline**: Workflow GitHub Actions (`ci.yml`) tự động hóa kiểm tra mã nguồn. |
| `.tools/` | Thư mục | 541 | 291.70 MB | Gitignored | **Môi trường Test**: Profile người dùng Chromium for Testing (`profile/`) tích lũy cache sau các phiên chạy test trình duyệt thực tế. |
| `.zcode/` | Thư mục | 1 | 10.22 KB | Gitignored | **Metadata IDE/Agent**: Kế hoạch phiên làm việc của ZCode IDE agent. |
| `.agents/` | Thư mục | 25 | 168.82 KB | Untracked | **Teamwork Metadata**: Thư mục làm việc của hệ thống multi-agent khảo sát. |
| `.git/` | Thư mục | 37 | 1.81 MB | System | Thư mục dữ liệu Git repository. |
| `.editorconfig` | Tệp tin | 1 | 0.24 KB | Tracked | Cấu hình chuẩn định dạng mã nguồn (indent 2 spaces, UTF-8, LF). |
| `.env.example` | Tệp tin | 1 | 0.40 KB | Tracked | Bản mẫu khai báo biến môi trường (`GEMINI_API_KEY`). |
| `.gitattributes` | Tệp tin | 1 | 0.36 KB | Tracked | Quy định xử lý xuống dòng tự động của Git. |
| `.gitignore` | Tệp tin | 1 | 0.53 KB | Tracked | Cấu hình các thư mục/tệp tin loại trừ khỏi quản lý phiên bản. |
| `HANDOFF.md` | Tệp tin | 1 | 26.00 KB | Tracked | Báo cáo bàn giao bối cảnh kỹ thuật, các quyết định kiến trúc và kết quả thực nghiệm. |
| `ORIGINAL_REQUEST.md` | Tệp tin | 1 | 3.02 KB | Untracked | Yêu cầu kiểm toán và phân tích toàn diện mã nguồn v1.0.1. |
| `README.md` | Tệp tin | 1 | 3.03 KB | Tracked | Tài liệu giới thiệu tổng quan dự án và hướng dẫn sử dụng nhanh. |

---

### 2.2. Phân loại 3 Nhóm Tài nguyên & Mức độ Phụ thuộc Thực tế

Dựa trên phân tích luồng chạy thực tế (Runtime Execution Flow), quy trình CI/CD và hệ thống kiểm thử, toàn bộ tài nguyên tại thư mục gốc được phân định rõ ràng thành 3 nhóm:

#### Nhóm 1: Cốt lõi phục vụ Extension v1.0.1 (Runtime Dependencies — BẮT BUỘC GIỮ)
1. **`extension/`**: Toàn bộ mã nguồn sản phẩm v1.0.1, bao gồm:
   - Các entrypoints: `background.ts`, `content/`, `popup/`, `options/`, `viewer/`, `offscreen/`.
   - Lõi dịch thuật `lib/`: ASR streaming, Audio capture, Glossary validation, Masker token, PDF layout engine, Provider router.
   - Tài nguyên tĩnh `public/`: `pdf.worker.min.mjs` (1.27 MB) và hệ thống biểu tượng extension.
2. **`gateway/`**:
   - Tệp tin `gateway/gateway.mjs` (10.2 KB) và `gateway/.env.example` (405 B).
   - *Mức độ phụ thuộc*: Đây là **Runtime Dependency tùy chọn hợp lệ**. Tiện ích Live-Trans hỗ trợ chế độ cấu hình `mode: 'gateway'` trong cả Popup và Options UI. Khi người dùng bật chế độ này, extension sẽ định tuyến các yêu cầu dịch thuật qua proxy cục bộ tại `http://localhost:8787` để giữ API key an toàn tuyệt đối ngoài trình duyệt context. Do đó, **thư mục `gateway/` không được xóa**.

#### Nhóm 2: Phục vụ Build, Test, CI và Công cụ phát triển (Tooling / Testing — GIỮ & CHUẨN HÓA)
1. **`.github/workflows/ci.yml`**: Quản lý quy trình kiểm tra tự động trên GitHub Actions.
2. **`scripts/` (Nhóm script cốt lõi - 10 files)**:
   - `build-zip.ps1`, `check.ps1`, `kill-cft.ps1`, `run-paper-test.ps1`.
   - `cdp.mjs`, `cdp-ext.mjs`, `cdp-debug-offscreen.mjs`, `api-probe.mjs`.
   - `make-speech-fixture.ps1`, `test-translate-paper.mjs`.
3. **`tests/fixtures/`**:
   - `tests/fixtures/speech.wav` (700 KB): File âm thanh mẫu kiểm thử ASR.
   - `tests/fixtures/golden-glossary.json` (885 B): Bộ từ điển thuật ngữ chuẩn.
   - `tests/fixtures/sample-transcript.json` (1.7 KB): Dữ liệu mẫu kiểm thử phụ đề.
4. **`docs/` (10 tài liệu kỹ thuật)**: Lưu trữ toàn bộ tri thức kỹ thuật và nhật ký kiến trúc của dự án.
5. **Các file cấu hình chuẩn tại root**: `.editorconfig`, `.env.example`, `.gitattributes`, `.gitignore`, `README.md`, `HANDOFF.md`.

#### Nhóm 3: POC cũ (v0.1), File rác, Artifact build cũ & Dữ liệu mẫu không còn sử dụng (REDUNDANT — CẦN DỌN DẸP / DI DỜI)
1. **`demo/` (52.7 KB)**: Chứa `index.html`, `demo.js`, `style.css`. Đây là POC giao diện tĩnh ban đầu trước khi dự án chuyển sang WXT + Preact. Không có bất kỳ thành phần nào của Extension v1.0.1 tham chiếu đến `demo/`.
2. **`dist/live-trans-extension.zip` (38.2 KB)**: File zip đóng gói phiên bản cũ v0.1.0 nằm sót lại trên ổ đĩa. Bản build v1.0.1 hiện tại nằm tại `extension/.output/`.
3. **`extension/.output/live-trans-extension-0.1.0-chrome.zip` (38.2 KB)** & **`1.0.0-chrome.zip` (1.55 MB)**: Các bản zip của các bản phát hành trước nằm tồn đọng trong thư mục output của WXT.
4. **`backend/output/preview_before_p1.png` (571.5 KB)** & **`preview_before_p3.png` (308.3 KB)**: File ảnh rác debug sinh ra trong quá trình chạy script Python trước đây.
5. **`backend/translate_paper.py` (13.9 KB)** & **`backend/fonts/` (1.14 MB)**: Prototype Python thử nghiệm thuật toán layout PDF bằng PyMuPDF. Hiện tại Extension v1.0.1 đã xử lý 100% bằng JavaScript trong browser (`viewer/`).
6. **`backend/samples/2302.07121.pdf` (50.7 MB)**: File PDF mẫu bài báo ArXiv. Cần được di dời sang `tests/fixtures/sample-paper.pdf` thay vì để ở `backend/` để bảo đảm tính toàn vẹn của test suite.
7. **`scripts/` cũ (5 files - 11.7 KB)**: `probe-dump.mjs`, `probe-dump2.mjs`, `verify-gemini.mjs` (chứa bug sai URL endpoint upload), `verify-transcribe.mjs`, `test-transcribe.mjs`. Các script này đã được chuẩn hóa và thay thế hoàn toàn bởi `api-probe.mjs`.
8. **`.tools/profile/` (291.7 MB)**: Thư mục cache của trình duyệt Chromium for Testing, có thể dọn dẹp sạch sẽ mà không làm mất bất kỳ cấu hình nào.

---
### 2.3. Danh mục Cụ thể Các File / Thư mục An toàn để Xóa hoặc Di dời

Bảng dưới đây liệt kê chi tiết từng tài nguyên dư thừa, đề xuất hành động cụ thể và đánh giá mức độ ảnh hưởng đến hai lệnh kiểm thử bắt buộc: `npm run build` và `npm run test`:

| STT | Đường dẫn tài nguyên | Dung lượng | Hành động đề xuất | Tác động đến `npm run build` | Tác động đến `npm run test` (123 tests) | Giải trình an toàn kỹ thuật & Phương án thực hiện |
|:---:|---|:---:|:---:|:---:|:---:|---|
| 1 | `dist/live-trans-extension.zip` | 38.25 KB | **Xóa ngay (Delete)** | Không ảnh hưởng (0%) | Không ảnh hưởng (0%) | Bản nén v0.1.0 cũ, nằm ngoài cây mã nguồn `extension/`, không có file nào import. |
| 2 | `backend/output/preview_before_p1.png` | 571.51 KB | **Xóa ngay (Delete)** | Không ảnh hưởng (0%) | Không ảnh hưởng (0%) | Ảnh chụp màn hình debug cũ của script Python, hoàn toàn vô dụng. |
| 3 | `backend/output/preview_before_p3.png` | 308.31 KB | **Xóa ngay (Delete)** | Không ảnh hưởng (0%) | Không ảnh hưởng (0%) | Tương tự mục 2. |
| 4 | `extension/.output/live-trans-extension-0.1.0-chrome.zip` | 38.25 KB | **Xóa ngay (Delete)** | Không ảnh hưởng (0%) | Không ảnh hưởng (0%) | Artifact build của bản 0.1.0 nằm dư thừa trong output của WXT. |
| 5 | `extension/.output/live-trans-extension-1.0.0-chrome.zip` | 1.55 MB | **Xóa ngay (Delete)** | Không ảnh hưởng (0%) | Không ảnh hưởng (0%) | Artifact build của bản 1.0.0 cũ. Bản build hiện hành v1.0.1 là `live-trans-extension-1.0.1-chrome.zip`. |
| 6 | `scripts/probe-dump.mjs` | 0.90 KB | **Xóa hoặc Archive** | Không ảnh hưởng (0%) | Không ảnh hưởng (0%) | Script cào JSON thô ban đầu, đã được tích hợp vào `api-probe.mjs`. |
| 7 | `scripts/probe-dump2.mjs` | 1.77 KB | **Xóa hoặc Archive** | Không ảnh hưởng (0%) | Không ảnh hưởng (0%) | Script cào word timestamps, đã được tích hợp vào `api-probe.mjs` và `parser.test.ts`. |
| 8 | `scripts/verify-gemini.mjs` | 4.53 KB | **Xóa hoặc Archive** | Không ảnh hưởng (0%) | Không ảnh hưởng (0%) | Script cũ chứa lỗi lặp đường dẫn `/upload/v1beta/upload/v1beta/files` (đã ghi nhận tại `HANDOFF.md:196`). |
| 9 | `scripts/verify-transcribe.mjs` | 4.52 KB | **Xóa hoặc Archive** | Không ảnh hưởng (0%) | Không ảnh hưởng (0%) | Thử nghiệm upload raw WAV cũ, trùng lặp chức năng với `api-probe.mjs`. |
| 10 | `demo/` (Toàn bộ 3 tệp) | 52.72 KB | **Di dời sang `archive/demo/`** | Không ảnh hưởng (0%) | Không ảnh hưởng (0%) | Mockup HTML/CSS v0.1 cũ, không liên quan đến WXT runtime. |
| 11 | `backend/translate_paper.py` & `backend/fonts/` | 1.15 MB | **Di dời sang `archive/python-prototype/`** | Không ảnh hưởng (0%) | Không ảnh hưởng (0%) | Prototype Python thử nghiệm thuật toán PyMuPDF ban đầu. Đã chuyển hóa sang TypeScript trong `extension/entrypoints/viewer/`. |
| 12 | `backend/samples/2302.07121.pdf` | 50.70 MB | **Di dời sang `tests/fixtures/sample-paper.pdf`** | Không ảnh hưởng (0%) | **CẦN ĐỔI PATH** trong `blocks.test.ts:372` | **LƯU Ý ĐẶC BIỆT**: `blocks.test.ts` có guard kiểm tra file. Di dời và cập nhật đường dẫn tương đối giúp bài test số 15 tiếp tục chạy thật 100% thay vì bị silent skip. |
| 13 | `.tools/profile/` | 291.70 MB | **Dọn dẹp cache (Purge)** | Không ảnh hưởng (0%) | Không ảnh hưởng (0%) | Cache trình duyệt Chromium for Testing, tự động tạo lại khi chạy lại script kiểm thử browser. |

**Tổng kết Dung lượng Giải phóng**:
- **Dung lượng rác & tài nguyên mẫu trong repository**: **~54.38 MB**.
- **Dung lượng cache trình duyệt kiểm thử ngoài repo**: **~291.70 MB**.
- **Tổng dung lượng bộ nhớ giải phóng ước tính**: **~346.08 MB**.

---
## PHẦN 3 (R2): PHÂN TÍCH CHI TIẾT MÃ NGUỒN TRONG `extension/` (CODE QUALITY & DEAD CODE)

Kiểm toán mã nguồn chi tiết 100% các tệp tin trong `extension/` (bao gồm entrypoints: `viewer/`, `popup/`, `options/`, `background/`, `offscreen/`, `content/` và lõi `lib/`). Mọi phát hiện dưới đây đều được xác minh tĩnh và đối chiếu chéo AST kèm vị trí chính xác `file:line`.

---

### 3.1. Dead Code, Ghost State & Orphan Exports

#### D-01: Khối Dead Code Khổng Lồ Trong `viewer/main.tsx` (~250 dòng)
- **Vị trí phát hiện**:
  - `extension/entrypoints/viewer/main.tsx:10` (import `computeReflowOffsets`)
  - `extension/entrypoints/viewer/main.tsx:1777-1793` (khai báo type `BlockLayoutOverride`)
  - `extension/entrypoints/viewer/main.tsx:1819-1833` (hàm `loadPageLayout`, `saveBlockLayout`)
  - `extension/entrypoints/viewer/main.tsx:1834-1896` (hàm `moveBlock`, `resizeBlock`)
  - `extension/entrypoints/viewer/main.tsx:1977-2005` (nhánh `renderFlowBlock` trong `PageRenderer`)
  - `extension/entrypoints/viewer/main.tsx:2041-2291` (component con `FlowBlock` dài 250 dòng)
- **Cơ chế & Nguyên nhân**:
  - Tại `viewer/main.tsx:1593-1605`, component `PageRenderer` **chỉ được gọi duy nhất 1 lần** với prop cố định `type="original"` cho khung xem tài liệu gốc bên trái.
  - Tại khung bên phải (`viewer/main.tsx:1713-1750`), giao diện **chỉ render** `WhiteboardPageRenderer` hoặc `VisionPageRenderer`.
  - Hậu quả: Toàn bộ nhánh điều kiện `type === 'translated'` bên trong `PageRenderer` và toàn bộ component `FlowBlock` (từ dòng 2041 đến dòng 2291) **hoàn toàn không có bất kỳ khả năng nào được gọi trong runtime**.
  - Các hàm tính toán reflow dồn cột, kéo thả điều chỉnh kích thước block (`moveBlock`, `resizeBlock`) chỉ phục vụ cho nhánh này đều trở thành dead code.
- **Tác động**: Làm phình to file bundle JS của Viewer thêm ~15-20 KB, gây nhiễu loạn luồng đọc hiểu của lập trình viên.
- **Đề xuất**: Xóa bỏ component `FlowBlock`, loại bỏ prop `type` khỏi `PageRenderer` (chuyển hẳn thành renderer cho trang gốc) và dọn sạch các hàm layout kéo thả mồ côi.

#### D-02: Ghost State & Broken Signal Trong `viewer/main.tsx`
- **Vị trí phát hiện**:
  - `extension/entrypoints/viewer/main.tsx:820`: `const [_layoutResetSignal, setLayoutResetSignal] = useState<number>(0);`
  - `extension/entrypoints/viewer/main.tsx:832`: `setLayoutResetSignal((n) => n + 1);`
- **Cơ chế & Nguyên nhân**:
  - Biến state được đặt tên với tiền tố gạch dưới `_layoutResetSignal` để qua mặt cảnh báo biến không sử dụng của ESLint.
  - Hàm `resetAllLayouts()` (dòng 821) kích hoạt `setLayoutResetSignal`, nhưng giá trị này **không hề được truyền xuống bất kỳ component con nào qua props** (tại dòng 1593 `PageRenderer` không nhận prop này).
- **Tác động**: Nút "Đặt lại bố cục" trên thanh công cụ thực tế là một broken feature, không thể kích hoạt reset DOM ở các trang con.
- **Đề xuất**: Dọn dẹp biến state thừa hoặc kết nối tín hiệu reset này vào logic reset canvas/zoom của trang nếu có nhu cầu.

#### D-03: Dead CSS Khổng Lồ Trong `viewer/style.css` (~175 dòng)
- **Vị trí phát hiện**: `extension/entrypoints/viewer/style.css:727-899`
- **Cơ chế & Nguyên nhân**:
  - Hơn 170 dòng CSS định dạng layout Markdown cũ gồm các bộ chọn mồ côi:
    - `.lt-markdown-page`, `.lt-markdown-page-header`
    - `.lt-md-heading`, `h1.lt-md-heading`, `h2.lt-md-heading`, `h3.lt-md-heading`
    - `.lt-md-paragraph`, `.lt-md-formula`, `.lt-formula-content`, `.lt-formula-fallback`, `.lt-formula-number`
    - `.lt-md-algorithm`, `.lt-algo-content`
    - `.lt-md-footnote`, `.lt-footnote-sep`, `.lt-footnote-text`
  - Rà soát toàn bộ JSX/TSX trong dự án xác nhận: **Không có bất kỳ phần tử DOM nào sử dụng các class CSS này**.
- **Đề xuất**: Xóa bỏ toàn bộ dòng 727 đến 899 trong `viewer/style.css`, giảm ngay 4.5 KB CSS bundle.

#### D-04: Chế độ Reader Không Thể Truy Cập (Unreachable Modes) Trong Viewer UI
- **Vị trí phát hiện**:
  - `extension/entrypoints/viewer/main.tsx:46`: `useState<'whiteboard' | 'vision' | 'markdown' | 'overlay'>('vision')`
  - `extension/entrypoints/viewer/main.tsx:1035-1057`: Các mục menu "Markdown Dòng chảy" và "Overlay Đè chữ" bị hardcode thuộc tính `class="lt-disabled"` kèm nhãn "(Chưa phát triển)".
- **Tác động**: Gây phân mảnh type definition, để lại các selector style mồ côi trong CSS.
- **Đề xuất**: Tinh gọn kiểu Union Type thành `'whiteboard' | 'vision'` cho đến khi tính năng được phát triển chính thức.

#### D-05: Orphan Exports Trong Content Script
- **Vị trí phát hiện**:
  - `extension/entrypoints/content/index.ts:76`: `export function detectVideoTitle(): string | undefined`
  - `extension/entrypoints/content/index.ts:289`: `export function detectPdfPage(): string | null`
  - `extension/entrypoints/content/index.ts:371`: `export function initPdfTranslateButton()`
- **Cơ chế & Nguyên nhân**: Các hàm này được export từ Content Script entrypoint của WXT nhưng không có bất kỳ unit test nào hoặc module nào khác trong toàn dự án import tới. Chúng chỉ được gọi nội bộ bên trong file.
- **Đề xuất**: Gỡ bỏ từ khóa `export` để thu hẹp phạm vi module.
#### D-06: Dead Code & Type Trong `extension/lib/pdf/markdown.ts` (81 dòng)
- **Vị trí phát hiện**:
  - `extension/lib/pdf/markdown.ts:3-14`: `interface MarkdownElement`
  - `extension/lib/pdf/markdown.ts:134-214`: `export function blocksToMarkdownElements(blocks: TextBlock[]): MarkdownElement[]`
- **Cơ chế & Nguyên nhân**:
  - Hàm `blocksToMarkdownElements` dài 81 dòng chỉ có duy nhất file test `extension/lib/pdf/markdown.test.ts:47` gọi để kiểm thử.
  - Giao diện Viewer trong sản phẩm thực tế render trực tiếp từ `TextBlock[]` (Whiteboard) hoặc Markdown string do Vision AI sinh ra (Vision), hoàn toàn không sử dụng mảng `MarkdownElement[]` này.
- **Đề xuất**: Xóa bỏ hàm `blocksToMarkdownElements`, interface `MarkdownElement`, và dọn dẹp test case tương ứng trong `markdown.test.ts`.

#### D-07: Dead Functions Trong `extension/lib/pdf/blocks.ts`
- **Vị trí phát hiện**:
  - `extension/lib/pdf/blocks.ts:388-390`: `export function isDisplayEquation(block: TextBlock): boolean`
  - `extension/lib/pdf/blocks.ts:392-394`: `export function isMathFormula(text: string): boolean`
- **Cơ chế & Nguyên nhân**:
  - `isDisplayEquation`: Hoàn toàn không có bất kỳ caller nào trong toàn bộ mã nguồn và test suite (0 references).
  - `isMathFormula`: Bản chất chỉ là wrapper alias gọi `isMathFragment(text)`. Trong runtime `blocks.ts` gọi thẳng `isMathFragment`, chỉ có file test `blocks.test.ts` gọi kiểm tra `isMathFormula`.
- **Đề xuất**: Xóa `isDisplayEquation`. Trong `blocks.test.ts`, thay thế các lời gọi `isMathFormula` bằng `isMathFragment` và xóa hàm alias này.

#### D-08: Dead Getters Trong `extension/lib/protocol/queue.ts`
- **Vị trí phát hiện**: `extension/lib/protocol/queue.ts:15-21` (`get pendingCount`, `get activeCount`).
- **Cơ chế**: Không có bất kỳ dòng code nào trong runtime hoặc test truy cập 2 getters này.
- **Đề xuất**: Xóa bỏ để tinh giản class `ConcurrencyQueue`.

#### D-09: Dead Helper Trong `extension/lib/subtitles/segmenter.ts`
- **Vị trí phát hiện**: `extension/lib/subtitles/segmenter.ts:94-96` (`export function displayDurationMs(text: string): number`).
- **Cơ chế**: Chỉ được gọi duy nhất tại `segmenter.test.ts:45`. Runtime phụ đề v1.0.1 tính duration trực tiếp từ timestamp của từng từ (word-level timestamps) do Gemini ASR trả về.
- **Đề xuất**: Di dời vào `segmenter.test.ts` làm test helper cục bộ hoặc loại bỏ.

#### D-10: Dead Cache Management Functions Trong `extension/lib/pdf/vision-translate.ts`
- **Vị trí phát hiện**:
  - `extension/lib/pdf/vision-translate.ts:421-454`: `clearAllVisionCache()`
  - `extension/lib/pdf/vision-translate.ts:458-469`: `getVisionCacheStats()`
- **Cơ chế**: Không có bất kỳ giao diện người dùng nào (trong Viewer hay Options) có nút bấm xem dung lượng cache hay xóa toàn bộ cache Vision AI. Chỉ có `vision-cache.test.ts` gọi để assert.
- **Đề xuất**: Tích hợp các hàm này vào giao diện Cài đặt (Options) để người dùng chủ động quản lý bộ nhớ, hoặc đánh dấu rõ ràng phạm vi nội bộ.

#### D-11: Dead Object Property Trong `extension/lib/translate/batcher.ts`
- **Vị trí phát hiện**: `extension/lib/translate/batcher.ts:132, 156` (`maskMap: {}`).
- **Cơ chế**: Thuộc tính `maskMap` ở cấp độ request `TranslateBatchRequest` luôn được gán object rỗng `{}` và không bao giờ được đọc (thực tế dữ liệu `maskMap` được lưu tại từng unit con `maskedUnit.maskMap`).
- **Đề xuất**: Xóa thuộc tính `maskMap` thừa ở request level.

#### D-12: Unused Parameter Trong `extension/lib/glossary/validator.ts`
- **Vị trí phát hiện**: `extension/lib/glossary/validator.ts:102` (`void source;`).
- **Cơ chế**: Tham số `source: string` trong hàm `validateTranslation(source, translation, ...)` hoàn toàn không được sử dụng trong thân hàm, buộc phải viết lệnh hack `void source;` để qua mặt linter.
- **Đề xuất**: Bỏ tham số `source` hoặc đổi thành `_source`.

#### D-13: 16 Over-exported Functions Trong Tầng Core Library (`lib/`)
Kiểm tra tĩnh AST phát hiện 16 hàm được khai báo từ khóa `export` nhưng không hề có file nào khác ngoài module đó import vào:

| STT | File & Dòng | Tên hàm / Định danh | Phạm vi gọi thực tế |
|:---:|---|---|---|
| 1 | `extension/lib/providers/mock.ts:72` | `mockTranslate()` | Chỉ dùng nội bộ tại dòng 115 trong cùng file |
| 2 | `extension/lib/providers/mock.ts:86` | `mockTranslateTitle()` | Chỉ dùng nội bộ tại dòng 123 |
| 3 | `extension/lib/glossary/validator.ts:38` | `termExpectations()` | Chỉ dùng nội bộ tại dòng 78 |
| 4 | `extension/lib/glossary/validator.ts:51` | `validatePlaceholderRoundtrip()` | Chỉ dùng nội bộ tại dòng 88 |
| 5 | `extension/lib/pdf/translate.ts:114` | `getCacheKey()` | Chỉ dùng nội bộ trong `translate.ts` |
| 6 | `extension/lib/pdf/translate.ts:127` | `getGlossaryHash()` | Chỉ dùng nội bộ trong `translate.ts` |
| 7 | `extension/lib/pdf/vision-translate.ts:479` | `detectEnglishInMarkdown()` | Chỉ dùng nội bộ tại dòng 535 |
| 8 | `extension/lib/pdf/vision-translate.ts:531` | `verifyAndRepairTranslation()` | Chỉ dùng nội bộ tại dòng 728 |
| 9 | `extension/lib/pdf/blocks.ts:62` | `normalizeTextItems()` | Chỉ dùng nội bộ tại dòng 844 |
| 10 | `extension/lib/pdf/blocks.ts:162` | `groupIntoLines()` | Chỉ dùng nội bộ tại dòng 845 |
| 11 | `extension/lib/pdf/blocks.ts:305` | `isStandaloneHeading()` | Chỉ dùng nội bộ tại dòng 569, 570, 756 |
| 12 | `extension/lib/pdf/blocks.ts:333` | `isMathFragment()` | Chỉ dùng nội bộ tại dòng 578, 579, 754 |
| 13 | `extension/lib/pdf/blocks.ts:399` | `isAlgorithmLine()` | Chỉ dùng nội bộ tại dòng 522, 574, 575, 755 |
| 14 | `extension/lib/pdf/blocks.ts:416` | `isFootnoteItem()` | Chỉ dùng nội bộ tại dòng 582, 583, 757 |
| 15 | `extension/lib/pdf/blocks.ts:464` | `splitTextIntoSentences()` | Chỉ dùng nội bộ tại dòng 763 |
| 16 | `extension/lib/pdf/blocks.ts:514` | `groupIntoBlocks()` | Chỉ dùng nội bộ tại dòng 846 |

**Đánh giá tác động**: Việc export vô tội vạ làm phình to module interface, gây ô nhiễm gợi ý auto-complete và cản trở Tree-Shaking của bundler. Cần gỡ bỏ từ khóa `export` cho cả 16 hàm này.

---
### 3.2. DRY Violations — Trùng lặp Logic Giữa Các Module

#### DRY-01: Chuẩn Hóa Đường Dẫn ArXiv URL Lặp Lại 4 Lần
- **Vị trí trùng lặp**:
  1. `extension/entrypoints/background.ts:153-158` (trong message handler `OPEN_VIEWER`)
  2. `extension/entrypoints/background.ts:192-197` (trong `contextMenus.onClicked`)
  3. `extension/entrypoints/content/index.ts:294-297` (trong `detectPdfPage`)
  4. `extension/entrypoints/popup/App.tsx:133-137` (trong `checkActiveTabMedia`)
- **Đoạn mã trùng lặp nguyên bản**:
  ```typescript
  const match = url.match(/arxiv\.org\/abs\/([0-9]+\.[0-9]+(v[0-9]+)?)/i);
  if (match?.[1]) {
    targetUrl = `https://arxiv.org/pdf/${match[1]}.pdf`;
  }
  ```
- **Giải pháp**: Trích xuất thành hàm dùng chung `normalizeArxivUrl(url: string): string` đặt tại `extension/lib/pdf/url.ts`.

#### DRY-02: Logic Khởi Tạo URL Mở Viewer Lặp Lại 4 Lần
- **Vị trí trùng lặp**:
  1. `extension/entrypoints/background.ts:159-161`
  2. `extension/entrypoints/background.ts:198`
  3. `extension/entrypoints/content/index.ts:363`
  4. `extension/entrypoints/popup/App.tsx:417-419`
- **Đoạn mã trùng lặp**:
  ```typescript
  browser.runtime.getURL(`/viewer.html?url=${encodeURIComponent(targetUrl)}`)
  ```
- **Giải pháp**: Gom vào helper tập trung `getViewerUrl(pdfUrl: string): string` trong `extension/lib/pdf/url.ts`.

#### DRY-03: Chuẩn Hóa Tiêu Đề Video (Title Cleaning) Lặp Lại
- **Vị trí trùng lặp**:
  1. `extension/entrypoints/content/index.ts:91-96` (`cleanTitle`)
  2. `extension/entrypoints/popup/App.tsx:126`: `videoTitle = videoTitle.replace(/\s+-\s*(YouTube|Coursera|Udemy)\s*$/i, '').trim();`
  3. Selector DOM trích xuất tiêu đề video trùng lặp giữa `content/index.ts:77-84` và script injection tại `popup/App.tsx:178-181`.
- **Giải pháp**: Gom chung hàm làm sạch tiêu đề video vào `extension/lib/subtitles/title.ts`.

#### DRY-04: Trùng Lặp 100% Giao Diện & Quản Lý Glossary Giữa Popup và Options
- **Vị trí trùng lặp**:
  - `extension/entrypoints/popup/App.tsx:310-336, 838-904`
  - `extension/entrypoints/options/App.tsx:216-243, 267-363`
- **Hiện tượng**: Cả hai tệp tin đều viết lại toàn bộ:
  - Khai báo state form thêm thuật ngữ mới (`newTerm`, `newType`, `newVi` vs `draft.term`, `draft.type`, `draft.vi`).
  - Hàm thêm thuật ngữ (`addGlossaryTerm` / `addTerm`).
  - Hàm xóa thuật ngữ (`removeGlossaryTerm` / `removeAt`).
  - Hàm nạp bộ thuật ngữ mẫu khởi đầu `STARTER_GLOSSARY`.
  - Bảng JSX hiển thị danh sách thuật ngữ với các badge kiểu (`code`, `command`, `jargon`, `acronym`).
- **Giải pháp**: Xây dựng một Preact component dùng chung `<GlossaryEditor />` đặt tại `extension/components/GlossaryEditor.tsx` để dùng chung cho cả hai trang.

#### DRY-05: Chuyển Đổi Nhị Phân Sang Base64 (Binary Chunking)
- **Vị trí trùng lặp**:
  - `extension/lib/capture/wav.ts:9-14`
  - `extension/lib/capture/audio-capture.ts:117-122`
- **Đoạn mã trùng lặp**:
  ```typescript
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
  ```
- **Giải pháp**: Trích xuất thành hàm tiện ích `uint8ArrayToBase64(bytes: Uint8Array): string` đặt tại `extension/lib/capture/wav.ts`.

#### DRY-06: Bảng Giải Mã Ký Tự TeX Math OML (Greek Symbol Mapping)
- **Vị trí trùng lặp**:
  - `extension/lib/pdf/blocks.ts:42-50` (`sanitizeTeXMathCharacters`)
  - `extension/lib/pdf/markdown.ts:35-43` (`wrapInlineMath`)
- **Hiện tượng**: Cả hai nơi đều khai báo một bảng ánh xạ từ hex `0x0b-0x1f` sang ký tự Hy Lạp / LaTeX command. Nếu một bên được cập nhật ký hiệu mới (như theta, phi, epsilon mũ), bên kia sẽ bị lệch chuẩn.
- **Giải pháp**: Định nghĩa hằng số bảng mã OML tập trung tại `extension/lib/pdf/oml-map.ts`.

#### DRY-07: Mẫu Regex Nhận Diện Biến Toán và Công Thức LaTeX
- **Vị trí trùng lặp**:
  - `extension/lib/pdf/markdown.ts:63-118` (bước wrap `$...\`)
  - `extension/lib/pdf/translate.ts:408-415` (mảng `mathPatterns` trong `shieldTokens`)
- **Hiện tượng**: Cả hai module đều viết lại các biểu thức Regex phức tạp để phát hiện biến toán học có chỉ số trên/dưới như `z_0, z_t, x_t, \hat{...}, \tilde{...}, \Delta, (f, \ell)`.
- **Giải pháp**: Tạo file `extension/lib/pdf/math-patterns.ts` quản lý thống nhất các mẫu Regex toán học.

#### DRY-08: Logic Kết Nối và Xử Lý Phản Hồi OpenCode Zen Gateway
- **Vị trí trùng lặp**:
  - `extension/lib/pdf/translate.ts:13-50, 277-324`
  - `extension/lib/pdf/vision-translate.ts:557-596`
- **Hiện tượng**: Cả hai file đều trực tiếp xử lý phân loại model `muse-spark-*` (gọi endpoint `/responses`) với các model khác (gọi `/chat/completions`), tự thiết lập headers Authorization, timeout fetch 90s và parse text.
- **Giải pháp**: Đưa logic này thành một class provider chuẩn `OpenCodeZenProvider` đặt trong `extension/lib/providers/opencode-zen.ts`.

#### DRY-09: Gọi Trực Tiếp Google Generative Language REST API
- **Vị trí trùng lặp**:
  - `extension/lib/providers/direct-gemini.ts:100, 122`
  - `extension/lib/pdf/translate.ts:351`
  - `extension/lib/pdf/vision-translate.ts:604, 678`
- **Hiện tượng**: Cả 3 file đều tự ghép nối URL thủ công `${BASE}/models/${model}:generateContent`, chèn header `x-goog-api-key`, và parse JSON `candidates?.[0]?.content?.parts?.[0]?.text`.
- **Giải pháp**: Sử dụng thống nhất `DirectGeminiProvider` cho mọi tác vụ gọi Gemini thay vì gọi fetch trực tiếp ở tầng PDF.

#### DRY-10: Cấu Trúc Báo Lỗi `STATE_UPDATE` Trong Offscreen
- **Vị trí trùng lặp**:
  - `extension/entrypoints/offscreen/main.ts:152-165`
  - `extension/entrypoints/offscreen/main.ts:178-191`
- **Hiện tượng**: Lặp lại 100% object thống kê phiên dịch (`STATE_UPDATE`) trong 2 khối `catch` khác nhau.

#### DRY-11: Trùng Lặp Logic Render KaTeX Giữa Các Page Renderers
- **Vị trí trùng lặp**:
  - `extension/entrypoints/viewer/WhiteboardPageRenderer.tsx:9-60` (`InlineKatex`, `renderFormattedSentence`)
  - `extension/entrypoints/viewer/VisionPageRenderer.tsx:485-502, 618-660` (`VisionDisplayEquation`, `renderMarkdownInlineWithKatex`)
- **Giải pháp**: Gom các thành phần KaTeX inline/display renderer thành component dùng chung `<KatexMath />` và helper parse inline.

---
### 3.3. Điểm Thắt Cổ Chai Hiệu Năng & Rò Rỉ Bộ Nhớ (Bottlenecks & Memory Leaks)

#### PERF-01: Lỗi Treo Promise Vĩnh Viễn (Unresolved Promise Leak) Trong `ConcurrencyQueue`
- **Vị trí phát hiện**: `extension/lib/protocol/queue.ts:24-26, 39-41`
- **Mã nguồn hiện tại**:
  ```typescript
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
  - Khi người dùng bấm dừng phiên ghi âm (`STOP_SESSION`), `offscreen/main.ts:204, 226` gọi `liveTaskQueue.clear()`.
  - Hàm `clear()` chỉ đơn thuần gán `this.queue = []`.
  - **Hậu quả nghiêm trọng**: Các Promise đang bị giữ lại bởi `await new Promise(...)` sẽ **vĩnh viễn không bao giờ được resolve hay reject**!
  - Các microtask này bị treo mãi mãi trong Event Loop. Tệ hơn, closure của task giữ chặt biến `chunk: AudioChunk` (chứa chuỗi base64 PCM 45 giây âm thanh nặng ~1.44 MB) và `settings`. Garbage Collector không thể thu hồi vùng nhớ này. Mỗi lần người dùng bật/tắt ghi âm, hàng chục MB RAM bị rò rỉ tích lũy.
- **Mức độ**: **HIGH (Khẩn cấp)**.
- **Giải pháp**: Khi gọi `clear()`, phải duyệt qua toàn bộ queue và reject các pending promise với lỗi hủy phiên (`SessionCancelledError`).

#### PERF-02: Rò Rỉ MediaStream Track & AudioContext Teardown Thiếu Sót
- **Vị trí phát hiện**: `extension/lib/capture/audio-capture.ts:26-44, 99-111`
- **Phân tích cơ chế lỗi**:
  1. Dòng 26 gọi `navigator.mediaDevices.getUserMedia(...)` thành công và nhận về `stream`. Tuy nhiên, các dòng tiếp theo (khởi tạo `new AudioContext`, gọi `await audioCtx.resume()`) nằm ngoài khối `try/catch`. Nếu `AudioContext` ném lỗi (ví dụ vượt quá số lượng context tối đa cho phép trên Chrome), hàm sẽ thoát ra mà không thể dọn dẹp `stream`. Các `MediaStreamTrack` tiếp tục chạy ngầm, Chrome tiếp tục hiển thị biểu tượng chấm đỏ ghi âm tab vĩnh viễn.
  2. Trong hàm `stop()` (dòng 105), mã nguồn chỉ gán `audioEl.srcObject = null;` mà không gọi `audioEl.pause()`.
  3. Dòng 46 sử dụng `audioCtx.createScriptProcessor(4096, 1, 1)`. Đây là API đã bị W3C chính thức deprecate vì chạy trên main thread, có nguy cơ gây giật UI khi tải nặng.
- **Mức độ**: **HIGH**.
- **Giải pháp**: Bọc toàn bộ quy trình khởi tạo trong `try/catch/finally`, đảm bảo gọi `track.stop()` nếu có bất kỳ lỗi nào xảy ra; bổ sung `audioEl.pause()`.

#### PERF-03: Áp Lực Dọn Rác (GC Pressure) Do Cấp Phát Mảng & Tạo Chuỗi Lặp Lại
- **Vị trí phát hiện**: `extension/lib/capture/audio-capture.ts:53, 77, 115-123`
- **Phân tích cơ chế lỗi**:
  - Mỗi chu kỳ audio chunk (45 giây = 720,000 mẫu âm thanh = 1.44 MB), mã nguồn lại cấp phát mảng mới `buffer = new Int16Array(currentTargetSamples)`.
  - Tiếp theo, hàm `int16ToBase64` cắt mảng thành các khối `0x8000`, nối chuỗi liên tục rồi gọi `btoa`. Quá trình này sinh ra hàng nghìn chuỗi tạm thời trong heap, gây ra các đỉnh nhọn dọn rác (GC spikes) làm đơ nhẹ tiến trình âm thanh.
- **Mức độ**: **MEDIUM**.
- **Giải pháp**: Sử dụng một mảng đệm tái sử dụng (Ring Buffer / Pre-allocated pool).

#### PERF-04: Rò Rỉ Bộ Nhớ Đồ Họa (Canvas GPU Backing Store) Trong Vision AI
- **Vị trí phát hiện**: `extension/lib/pdf/vision-translate.ts:91-114`
- **Phân tích cơ chế lỗi**:
  - Trong hàm `renderPageToBase64Jpeg`, mỗi trang PDF được tạo một phần tử canvas: `const canvas = document.createElement('canvas')` với tỉ lệ 2.0x (khoảng 1224 x 1584 px = gần 2 triệu pixels, tương đương ~8 MB bộ nhớ đệm đồ họa RGBA).
  - Sau khi gọi `canvas.toDataURL('image/jpeg', 0.88)`, phần tử canvas bị bỏ rơi mà không được giải phóng bộ nhớ đồ họa (`canvas.width = 0; canvas.height = 0`). Khi dịch tài liệu 20-30 trang, hàng trăm MB bộ nhớ GPU tích tụ trong tiến trình extension trước khi Garbage Collector giải phóng.
- **Mức độ**: **HIGH**.
- **Giải pháp**: Gán `canvas.width = 0; canvas.height = 0;` ngay sau khi lấy xong chuỗi Base64.

#### PERF-05: Rò Rỉ Bộ Nhớ RAM Do Canvas Cache Không Giới Hạn Trong `PdfSnippet`
- **Vị trí phát hiện**: `extension/entrypoints/viewer/PdfSnippet.tsx:14`
  ```typescript
  const pdfPageCanvasCache = new Map<string, HTMLCanvasElement>();
  ```
- **Phân tích cơ chế lỗi**:
  - `pdfPageCanvasCache` là biến singleton cấp module (Module-level singleton Map).
  - Mỗi khi một snippet cần trích xuất công thức hoặc hình ảnh, trang PDF được render ở độ phân giải siêu nét 2.0x HiDPI và lưu trực tiếp vào Map này.
  - Một canvas 2x HiDPI chiếm xấp xỉ **~7.75 MB RAM**.
  - Map này **hoàn toàn không có giới hạn số lượng phần tử (Unbounded Cache)**, không có cơ chế dọn dẹp LRU và không bao giờ được xóa khi đổi tài liệu hoặc đóng tab. Một tài liệu 50 trang sẽ tích lũy **~387 MB RAM** vĩnh viễn trong tiến trình tab trình duyệt!
- **Mức độ**: **HIGH (Nghiêm trọng)**.
- **Giải pháp**: Giới hạn LRU Cache tối đa 5-8 canvas gần nhất, hoặc thu hồi canvas ngay sau khi `drawImage` hoàn tất.

#### PERF-06: Đột Biến CPU Do 2 MutationObserver Không Debounce Trên Toàn Bộ Document
- **Vị trí phát hiện**:
  - `extension/entrypoints/content/index.ts:36-37`:
    ```typescript
    const titleObserver = new MutationObserver(sendDetectedTitle);
    titleObserver.observe(document.documentElement, { subtree: true, childList: true });
    ```
  - `extension/entrypoints/content/index.ts:381-382`:
    ```typescript
    const obs = new MutationObserver(tryMount);
    obs.observe(document.documentElement, { childList: true, subtree: true });
    ```
- **Phân tích cơ chế lỗi**:
  - Cả hai observer này được gắn vào `document.documentElement` với `{ subtree: true, childList: true }` trên **mọi trang web** (`<all_urls>`).
  - Cả hai đều **không có debounce hoặc throttle**.
  - Trên các trang web động có DOM biến thiên liên tục hàng chục lần/giây (như YouTube live stream, buffer tiến độ video, web chat), mỗi mutation nhỏ đều kích hoạt liên hoàn 6-7 phép `document.querySelector` và kiểm tra regex URL, gây nghẽn Main Thread, sụt giảm khung hình (drop FPS) và làm nóng máy người dùng.
- **Mức độ**: **HIGH (Nghiêm trọng)**.
- **Giải pháp**: Áp dụng debounce tối thiểu 300ms - 500ms cho cả hai hàm observer.

#### PERF-07: Interval 600ms Chạy Vĩnh Viễn Không Dọn Dẹp Trong Content Script
- **Vị trí phát hiện**: `extension/entrypoints/content/index.ts:184`
  ```typescript
  setInterval(() => this.position(), 600);
  ```
- **Phân tích cơ chế lỗi**:
  - Được khởi tạo trong `OverlayHost.mount()`. Lệnh interval này không bao giờ được lưu giữ `timerId` để dọn dẹp (`clearInterval`).
  - Nó chạy liên tục mỗi 600ms trên tab, quét `document.querySelectorAll('video')` và tính toán tọa độ `getBoundingClientRect()` ngay cả khi người dùng không xem video hoặc tab đang ở chế độ nền (idle).
- **Mức độ**: **MEDIUM**.
- **Giải pháp**: Lưu `timerId` và gọi `clearInterval` khi unmount overlay hoặc khi không tìm thấy video.

#### PERF-08: Port/Channel Message Leak Trong Background Service Worker
- **Vị trí phát hiện**: `extension/entrypoints/background.ts:107-175`
- **Phân tích cơ chế lỗi**:
  - Hàm `browser.runtime.onMessage.addListener` luôn kết thúc bằng `return true;` (dòng 173) trong luồng đồng bộ.
  - Tuy nhiên, khi tin nhắn rơi vào các case như `OFFSCREEN_READY` (dòng 141), `FORWARD_TO_TAB` (dòng 144), `STATE_UPDATE` (dòng 166), hoặc nhánh `default`, code **không hề gọi `sendResponse()`**.
  - Theo chuẩn WebExtensions MV3, khi một listener trả về `true` nhưng không gọi `sendResponse`, Chrome sẽ giữ port mở cho đến khi timeout, gây rò rỉ tài nguyên message channel và sinh cảnh báo lỗi: *"The message port closed before a response was received."*
- **Mức độ**: **MEDIUM**.
- **Giải pháp**: Chỉ trả về `true` ở các case bất đồng bộ thực sự có gọi `sendResponse`.
#### PERF-09: Lãng Phí Tài Nguyên: 100 IntersectionObserver Instances Độc Lập
- **Vị trí phát hiện**:
  - `extension/entrypoints/viewer/main.tsx:1898-1916` (trong `PageRenderer`)
  - `extension/entrypoints/viewer/VisionPageRenderer.tsx:150-166`
  - `extension/entrypoints/viewer/WhiteboardPageRenderer.tsx:239-255`
- **Hiện tượng**: Thay vì tạo duy nhất **1 IntersectionObserver ở cấp component cha** (`ViewerApp`) để theo dõi tất cả các trang, mã nguồn lại khởi tạo một instance `IntersectionObserver` riêng bên trong `useEffect` của **từng trang đơn lẻ**. Với tài liệu 50 trang xem song ngữ, trình duyệt phải duy trì **100 IntersectionObserver độc lập**.
- **Mức độ**: **MEDIUM**.
- **Giải pháp**: Tạo 1 Observer dùng chung ở cấp cha quản lý danh sách phần tử trang qua `data-page-number`.

#### PERF-10: Main Thread Blocking Do `parseMarkdownIntoBlocks` Không Bọc Trong `useMemo`
- **Vị trí phát hiện**: `extension/entrypoints/viewer/VisionPageRenderer.tsx:363`
- **Hiện tượng**: Hàm `parseMarkdownIntoBlocks(content)` dài 265 dòng chứa hàng loạt Regex phức tạp phân tích block markdown và công thức toán học. Hàm này được gọi trực tiếp trong thân hàm render của `VisionMarkdownContent` mà **không được bọc trong `useMemo`**. Mỗi khi component re-render (khi zoom, hover đối chiếu câu...), toàn bộ thuật toán parser nặng nề này bị chạy lại từ đầu trên Main Thread.
- **Mức độ**: **MEDIUM**.
- **Giải pháp**: Bọc trong `useMemo(() => parseMarkdownIntoBlocks(content), [content])`.

#### PERF-11: Churn DOM & Bypass Preact VDOM Bằng `innerHTML` Trong `useEffect`
- **Vị trí phát hiện**: `extension/entrypoints/viewer/VisionPageRenderer.tsx:618-628` (`VisionInlineText`)
- **Hiện tượng**: Việc gán `innerHTML` thủ công trong `useEffect` bypass hoàn toàn cơ chế đối soát VDOM của Preact, gây cưỡng bức layout reflow và tiềm ẩn rủi ro nếu nội dung chứa ký tự HTML đặc biệt.
- **Mức độ**: **MEDIUM**.

#### PERF-12: Mất Đồng Bộ Cấu Hình (State Desynchronization) Giữa Options và Popup
- **Vị trí phát hiện**:
  - `extension/entrypoints/options/App.tsx:12-14`
  - `extension/entrypoints/popup/App.tsx:295-301`
- **Cơ chế lỗi**: Trong `options/App.tsx`, cài đặt chỉ được tải 1 lần lúc mở trang qua `loadSettings()`. Trang Options **không hề lắng nghe sự kiện `browser.storage.onChanged`**. Nếu người dùng cập nhật API Key hoặc Glossary ở Popup trong khi tab Options đang mở, Options vẫn giữ dữ liệu cũ. Khi người dùng bấm "Lưu cài đặt" trên Options, toàn bộ dữ liệu mới vừa cập nhật từ Popup sẽ bị ghi đè mất hoàn toàn.
- **Mức độ**: **HIGH**.
- **Giải pháp**: Bổ sung listener `browser.storage.onChanged` trong trang Options để đồng bộ dữ liệu hai chiều tức thì.

#### PERF-13: Nguy Cơ Bùng Nổ HTTP 429 Quota Exceeded Ở Micro-batches Của PDF
- **Vị trí phát hiện**: `extension/lib/pdf/translate.ts:518-520`
  ```typescript
  const results = await Promise.all(
    batches.map((batch) => translateSentenceBatchDirect(batch, targetLang, settings)),
  );
  ```
- **Phân tích cơ chế lỗi**:
  - Một trang PDF có thể chứa 60-100 câu, chia thành 3-5 micro-batches. Toàn bộ các batches này được gửi song song bằng `Promise.all`.
  - Đồng thời, ở cấp độ trang, Viewer cho phép dịch đồng thời tới 5 trang (`pdfConcurrency: 5`).
  - **Hệ quả**: Có thể có tới **15 đến 25 HTTP requests đồng thời bắn vào Gemini API trong cùng 1 giây**! Đối với gói Gemini Free Tier (giới hạn 15 RPM), toàn bộ các request này sẽ lập tức dính mã lỗi `HTTP 429 Quota Exceeded`. Việc dồn quá nhiều request song song sẽ làm cạn kiệt số lần retry backoff và làm sập tiến trình dịch của cả trang.
- **Mức độ**: **HIGH**.
- **Giải pháp**: Giới hạn concurrency ở mức 2 cho các micro-batches bằng `ConcurrencyQueue(2)`.

#### PERF-14: Lỗi Reset Singleton Làm Mất `cooldownMap` Trong KeyRouter
- **Vị trí phát hiện**: `extension/lib/providers/key-router.ts:155-169`
- **Phân tích cơ chế lỗi**:
  - Hệ thống dùng 1 biến singleton duy nhất `globalRouter`.
  - Khi `translate.ts:18` gọi `getKeyRouter(zenKeys)` rồi ngay sau đó `translate.ts:339` gọi `getKeyRouter(geminiKeys)`, do danh sách keys của 2 nhà cung cấp khác nhau, hàm kiểm tra trả về `false` và khởi tạo lại: `globalRouter = new KeyRouter(inputKeys)`.
  - **Toàn bộ `cooldownMap` (danh sách các key đang bị tạm ngưng vì dính 429) và `currentIndex` của router trước đó bị xóa sổ hoàn toàn!** Key vừa bị lỗi 429 lại tiếp tục bị gọi lại ở vòng lặp kế tiếp.
- **Mức độ**: **HIGH**.
- **Giải pháp**: Quản lý nhiều Router instances theo Map: `Map<string, KeyRouter>` dựa trên provider ID.

#### PERF-15: Bỏ Qua Smart Key Rotation Trong `DirectGeminiProvider` (ASR Phụ Đề)
- **Vị trí phát hiện**: `extension/lib/providers/direct-gemini.ts:85, 121, 143`
- **Mã nguồn**: `const router = getKeyRouter(settings.apiKey);`
- **Phân tích cơ chế lỗi**:
  - Trong khi tính năng dịch PDF (`translate.ts:339`) dùng `getKeyRouter(getProviderKeys(settings, 'gemini'))` để lấy toàn bộ danh sách đa API keys mà người dùng cấu hình trong Settings, thì `DirectGeminiProvider` (phụ đề trực tiếp video/audio) lại chỉ truyền duy nhất chuỗi đơn `settings.apiKey`!
  - Hậu quả: **Dù người dùng cấu hình 5 API keys dự phòng, tính năng phụ đề trực tiếp vẫn chỉ dùng 1 key duy nhất và không bao giờ tự động xoay key khi gặp lỗi 429!**
- **Mức độ**: **HIGH**.
- **Giải pháp**: Đổi thành `getKeyRouter(getProviderKeys(settings, 'gemini'))` đồng bộ như bên PDF.

#### PERF-16: Nguy Cơ `QuotaExceededError` Trong LocalStorage Vision Cache
- **Vị trí phát hiện**: `extension/lib/pdf/vision-translate.ts:283-343`
- **Phân tích cơ chế lỗi**: Lưu trữ toàn bộ bản dịch Markdown của các trang PDF vào `localStorage` với giới hạn `MAX_CACHED_PAPERS = 50`. Do `localStorage` chỉ có hạn mức 5MB - 10MB cho toàn extension, 50 bài báo khoa học kèm công thức KaTeX chắc chắn sẽ gây ngoại lệ `QuotaExceededError` và việc liên tục parse Registry trên synchronous storage sẽ gây đơ giật UI.
- **Mức độ**: **MEDIUM**.
- **Giải pháp**: Chuyển đổi cache sang `IndexedDB` hoặc `chrome.storage.local` (sử dụng permission `unlimitedStorage`).

---

### 3.4. Hardcoded Heuristics & Rủi ro Phụ thuộc Dữ liệu Mẫu trong PDF Engine

Trong `extension/lib/pdf/blocks.ts`, đoàn kiểm toán phát hiện nhiều đoạn mã heuristic bị "hardcode" dựa trên một tài liệu nghiên cứu cụ thể:

1. **Hardcode tọa độ hình ảnh Page 1** (`blocks.ts:925-930`):
   ```typescript
   // Special case for Page 1 where Figure 1 is a tall banner in Column 2
   if (pageNumber === 1 && (figNum === 1 || !figNum)) {
     figLeft = 307;
     figTop = 165;
     figWidth = 245;
   }
   ```
   *Rủi ro*: Bất kỳ tài liệu khoa học nào khác có Trang 1 không chứa Figure 1 ở tọa độ x=307, y=165 đều sẽ bị cắt sai lệch toàn bộ bounding box hình ảnh hoặc chèn đè lên khối chữ khác.

2. **Hardcode từ khóa chuyên ngành AI** (`blocks.ts:615, 708`):
   ```typescript
   /^(We|The|In|For|To|Our|However|Although|Finally|Moreover|Furthermore|OpenAI|Stable|CLIP|Diffusion|Specifically|Empirically)\b/
   /\b(diffusion|models?|algorithm|propose|trained|paper|framework|method)\b/i
   ```
   *Rủi ro*: Thuật toán phụ thuộc vào các từ khóa riêng biệt (`OpenAI`, `Stable`, `CLIP`, `Diffusion`). Khi dịch các bài báo về Y sinh học, Kinh tế lượng, hoặc Toán học lý thuyết, các luật phân loại khối văn bản này sẽ hoạt động kém chính xác.
   *Giải pháp*: Chuyển đổi sang phân tích cấu trúc trực quan (visual gap detection) thay vì lọc từ khóa văn bản cứng.

---
## PHẦN 4: TÍNH TOÀN VẸN HỆ THỐNG KIỂM THỬ & PHỤ THUỘC ẨN (TEST INTEGRITY)

### 4.1. Phân tích Chi tiết 123 Unit Tests trên 17 Test Suites

Hệ thống kiểm thử đơn vị của Live-Trans được thiết lập bằng Vitest v4.1.11, bao phủ toàn bộ các module nghiệp vụ phức tạp của tiện ích tại `extension/lib/`. 

#### 4.1.1. Phạm vi bao phủ của các bài test
- **ASR Streaming & Parse tín hiệu giọng nói (`lib/asr/`, `lib/capture/`)**: 20 tests kiểm tra cấu trúc gói tin WAV, chuẩn hóa timestamps, trích xuất text từ Gemini Interactions API.
- **PDF Layout, Bóc tách khối & Toán học KaTeX (`lib/pdf/`)**: 45 tests kiểm tra thuật toán phân cột hai hàng, lọc watermark, nhận diện công thức toán học inline/display, tính toán reflow dồn cột, che chắn và giải mã fuzzy token, quản lý bộ nhớ đệm Vision Cache (LRU, TTL, QuotaExceeded).
- **Thuật ngữ & Kiểm chuẩn Dịch thuật (`lib/glossary/`, `lib/masker/`, `lib/translate/`)**: 28 tests kiểm tra bộ chọn glossary, đo lường tỷ lệ sống sót của thuật ngữ (Term Survival Rate - TSR ≥ 95%), cơ chế bảo vệ token code/link và xây dựng prompt dịch thuật chuyên sâu.
- **Quản lý Provider & Xoay API Key (`lib/providers/`, `lib/protocol/`)**: 13 tests kiểm tra cơ chế xoay vòng Key Pool, xử lý lỗi 429, header `Retry-After`, và điều phối hàng đợi tác vụ đồng thời.
- **Phân đoạn & Định dạng Phụ đề (`lib/subtitles/`)**: 17 tests kiểm tra phân đoạn câu, giới hạn CPS và định dạng file `.srt` song ngữ.

#### 4.1.2. Vùng chưa có kiểm thử tự động (Test Blindspots)
Hiện tại, toàn bộ các thành phần giao diện người dùng (`viewer/`, `popup/`, `options/`) và các luồng tương tác với Chrome Extension API (`background.ts`, `content/`, `offscreen/`) chưa có unit test trực tiếp do môi trường Vitest chạy trên Node context. Đây là lý do các lỗi như Memory Leak của Canvas hay Unthrottled MutationObserver tồn tại mà không bị phát hiện bởi test suite.

---

### 4.2. CẢNH BÁO ĐẶC BIỆT: Phụ Thuộc Ẩn & Nguy Cơ "Silent Skip" Tại `blocks.test.ts:372`

#### 4.2.1. Vị trí và Hiện tượng phát hiện
Trong tệp tin kiểm thử `extension/lib/pdf/blocks.test.ts` tại dòng 367 - 375:
```typescript
it('extracts Page 2 blocks and identifies equations', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const pdfPath = path.resolve(__dirname, '../../../backend/samples/2302.07121.pdf');
  if (!fs.existsSync(pdfPath)) return;
  // ... Thực thi nạp PDF thật, bóc tách khối trang 2, assert đếm block > 5 và phương trình (1), (2), (3)
});
```

#### 4.2.2. Phân tích rủi ro & Vi phạm Integrity Mandate
- Hiện tại, tệp `backend/samples/2302.07121.pdf` đang tồn tại trên ổ đĩa với kích thước **50.7 MB (53,165,173 bytes)**.
- Khi chạy `npm.cmd test`, bài test số 15 này thực sự mở file PDF 53MB, mất khoảng **~1.55 giây** để parse bằng `pdfjs-dist` và thực hiện các phép so khớp logic thực tế.
- **Nguy cơ tiềm ẩn**: Do tác giả viết dòng kiểm tra bảo vệ `if (!fs.existsSync(pdfPath)) return;`:
  - **Nếu một lập trình viên hoặc kịch bản tái cấu trúc xóa thư mục `backend/`**: Lệnh `npm test` **vẫn sẽ báo 123/123 PASSED**!
  - **Tuy nhiên**, bài test số 15 sẽ bị **Silent Skip** (chạy vào return ngay dòng đầu, không thực hiện bất kỳ phép assert nào, trở thành một "test rỗng" / facade test).
  - Điều này vi phạm nghiêm trọng tôn chỉ kiểm thử trung thực (Integrity Mandate) và làm mất đi bài kiểm thử tích hợp thực tế duy nhất kiểm chứng khả năng bóc tách công thức toán học trên file PDF ArXiv thực tế!

#### 4.2.3. Giải pháp Khắc phục Toàn diện
1. **Di dời tệp mẫu**: Chuyển tệp tin `backend/samples/2302.07121.pdf` sang thư mục kiểm thử chuẩn: `tests/fixtures/sample-paper.pdf`.
2. **Cập nhật đường dẫn trong bài test**:
   ```typescript
   // Tại extension/lib/pdf/blocks.test.ts:372
   const pdfPath = path.resolve(__dirname, '../../../../tests/fixtures/sample-paper.pdf');
   ```
3. **Chuyển đổi sang Assert bắt buộc**: Thay vì `if (!fs.existsSync(pdfPath)) return;`, đổi thành:
   ```typescript
   expect(fs.existsSync(pdfPath), `File mẫu PDF phải tồn tại tại ${pdfPath}`).toBe(true);
   ```
   Điều này đảm bảo nếu file mẫu bị mất, bài test sẽ báo FAILED ngay lập tức thay vì bỏ qua âm thầm.

---

### 4.3. Đánh giá Mức độ Độc lập của Bộ Test Đối với các Thư mục Ngoài `extension/`

Qua phân tích toàn bộ AST của 17 file unit test:
- **`demo/`**: 0% phụ thuộc. Không có bất kỳ test nào import từ `demo/`.
- **`gateway/`**: 0% phụ thuộc lúc chạy test. `batcher.test.ts` chỉ sử dụng chuỗi URL mock `'http://localhost:8787'`.
- **`scripts/`**: 0% phụ thuộc. Các file test không gọi script nào trong `scripts/`.
- **`dist/`**: 0% phụ thuộc.
- **16 file test còn lại**: Độc lập hoàn toàn (100% self-contained) bên trong `extension/lib/`.

**Kết luận**: Ngoại trừ duy nhất tệp PDF mẫu tại `blocks.test.ts:372`, toàn bộ hệ thống test của Live-Trans hoàn toàn tự chủ. Việc dọn dẹp các thư mục ngoài `extension/` là an toàn tuyệt đối một khi file PDF mẫu được di dời sang `tests/fixtures/`.

---
## PHẦN 5 (R3): LỘ TRÌNH TÁI CẤU TRÚC CHI TIẾT (REFACTORING ROADMAP)

Lộ trình tái cấu trúc được thiết kế dựa trên nguyên tắc **Minimal Change — Maximum Stability**, ưu tiên xử lý các lỗi rò rỉ bộ nhớ nghiêm trọng và các vấn đề an toàn dữ liệu trước, sau đó mới tiến hành tinh giản dead code và chuẩn hóa cấu trúc.

---

### 5.1. Phân nhóm Ưu tiên Theo Cấp độ (Priority Tiers)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  TIER 1: HIGH PRIORITY (Khẩn cấp — Rò rỉ RAM/GPU, Treo Promise, Mất Quota)  │
├─────────────────────────────────────────────────────────────────────────────┤
│  • PERF-01: Sửa Hanging Promise trong ConcurrencyQueue (giải phóng audio)    │
│  • PERF-05: Thêm LRU Cache / Cleanup cho pdfPageCanvasCache (PdfSnippet)    │
│  • PERF-06: Thêm Debounce (400ms) cho 2 MutationObserver trong Content Script│
│  • PERF-02: Bọc an toàn MediaStream / AudioContext Teardown                  │
│  • PERF-14 & PERF-15: Sửa KeyRouter Singleton & Kích hoạt Multi-key cho ASR  │
│  • PERF-12: Đồng bộ storage.onChanged giữa Popup và Options                 │
│  • PERF-13: Thêm ConcurrencyQueue(2) cho micro-batches PDF (tránh 429)      │
│  • TEST: Di dời sample PDF 50.7MB sang tests/fixtures/ và sửa path test     │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  TIER 2: MEDIUM PRIORITY (Tối ưu Hiệu năng, Ngăn chặn Giật lag & DRY)       │
├─────────────────────────────────────────────────────────────────────────────┤
│  • PERF-04: Thu hồi Canvas GPU Backing Store (vision-translate.ts)          │
│  • PERF-07: Lưu timerId và clearInterval cho Content Script overlay         │
│  • PERF-08: Chỉ return true khi async sendResponse trong background.ts      │
│  • PERF-09: Gom 100 IntersectionObservers thành 1 Observer tại component cha│
│  • PERF-10: Bọc parseMarkdownIntoBlocks trong useMemo                       │
│  • PERF-16: Chuyển đổi Vision Cache từ LocalStorage sang IndexedDB          │
│  • DRY-01 & DRY-02: Gom chuẩn hóa ArXiv URL & Viewer URL vào lib/pdf/url.ts │
│  • DRY-04: Tạo component <GlossaryEditor /> dùng chung cho Popup & Options  │
│  • DRY-05, 06, 07: Gom Base64 chunking, TeX OML map, Math regex chung      │
│  • DRY-08: Chuẩn hóa OpenCodeZenProvider kế thừa Provider interface         │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  TIER 3: LOW PRIORITY (Dọn dẹp Dead Code, Dead CSS & Tinh giản Repository)   │
├─────────────────────────────────────────────────────────────────────────────┤
│  • D-01: Xóa component FlowBlock & logic type === 'translated' (main.tsx)   │
│  • D-03: Xóa ~175 dòng dead CSS (.lt-markdown-page) trong viewer/style.css  │
│  • D-02 & D-04: Xóa ghost state _layoutResetSignal & unreachable modes      │
│  • D-06: Xóa blocksToMarkdownElements & MarkdownElement (markdown.ts)       │
│  • D-07, 08, 09, 11, 12: Xóa dead functions, getters, maskMap rỗng         │
│  • D-13: Gỡ bỏ từ khóa export cho 16 hàm nội bộ trong lib/                  │
│  • ROOT: Xóa dist/ zip cũ, backend/output/, demo/, scripts cũ               │
│  • ROOT: Thêm package.json proxy tại Root repository                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 5.2. Kế hoạch Hành động Cụ thể Cho Từng File & Module

| Mã mục | Tệp tin tác động | Hành động kỹ thuật cụ thể | Rủi ro tiềm ẩn | Phương án phòng ngừa & Bảo toàn Test |
|---|---|---|---|---|
| **P1-01** | `extension/lib/protocol/queue.ts` | Trong `clear()`, duyệt qua `this.queue` và gọi reject với `SessionCancelledError`. | Một số caller không bắt lỗi reject có thể gây unhandled rejection. | Bổ sung unit test kiểm tra `queue.clear()` kích hoạt hủy task an toàn; bọc try/catch ở caller `offscreen/main.ts`. |
| **P1-02** | `extension/entrypoints/viewer/PdfSnippet.tsx` | Chuyển đổi `pdfPageCanvasCache` sang Map có giới hạn LRU (tối đa 6 items). | Render lại snippet trang cũ có thể mất thêm ~50ms để vẽ lại canvas. | 6 canvas đủ giữ các trang đang hiển thị; tiết kiệm ngay 300+ MB RAM. |
| **P1-03** | `extension/entrypoints/content/index.ts` | Tạo hàm tiện ích `debounce(fn, 400)` và bọc cho cả 2 MutationObserver. | Tiêu đề hoặc nút FAB có thể xuất hiện trễ 400ms sau khi trang load xong. | Hoàn toàn vô hại đối với trải nghiệm người dùng; giải phóng 90% CPU spikes khi xem video. |
| **P1-04** | `extension/lib/providers/key-router.ts` | Chuyển `globalRouter` thành `Map<string, KeyRouter>` phân theo provider name/hash keys. | Có thể tăng nhẹ bộ nhớ nếu khởi tạo quá nhiều instance. | Mỗi provider chỉ có 1 router duy nhất; bảo toàn 100% `cooldownMap` khi dính lỗi 429. |
| **P1-05** | `extension/lib/providers/direct-gemini.ts` | Đổi `getKeyRouter(settings.apiKey)` thành `getKeyRouter(getProviderKeys(settings, 'gemini'))`. | Không có rủi ro. | Kích hoạt tính năng xoay API keys tự động cho phụ đề âm thanh/video. |
| **P1-06** | `extension/entrypoints/options/App.tsx` | Thêm `useEffect` lắng nghe `browser.storage.onChanged` để cập nhật state. | Gây re-render Options khi Popup đổi dữ liệu. | Re-render nhẹ; loại bỏ hoàn toàn nguy cơ ghi đè mất dữ liệu cấu hình. |
| **P1-07** | `extension/lib/pdf/translate.ts` | Thay `Promise.all(batches.map(...))` bằng `ConcurrencyQueue(2).run(...)`. | Tăng thời gian dịch toàn trang thêm khoảng 15-20%. | Đổi lại việc không bao giờ bị Google trả về mã lỗi 429 Quota Exceeded do spam request. |
| **P1-08** | `extension/lib/pdf/blocks.test.ts` & `backend/` | Di dời `backend/samples/2302.07121.pdf` sang `tests/fixtures/sample-paper.pdf` và đổi path tại dòng 372. | Lỗi đường dẫn nếu gõ sai relative path. | Chạy `npm test` ngay lập tức để xác nhận bài test số 15 chạy thật và pass 100%. |
| **P2-01** | `extension/lib/pdf/vision-translate.ts` | Thêm `canvas.width = 0; canvas.height = 0;` trong khối `finally` của `renderPageToBase64Jpeg`. | Không có rủi ro. | Giải phóng bộ nhớ đồ họa GPU tức thì sau mỗi trang PDF. |
| **P2-02** | `extension/entrypoints/background.ts` | Chỉ trả về `true` tại các nhánh `switch` có tác vụ async gọi `sendResponse`. | Message port có thể đóng sớm nếu phân loại nhầm nhánh. | Kiểm tra kỹ từng action type trong `onMessage`; loại bỏ cảnh báo channel leak. |
| **P2-03** | `extension/entrypoints/viewer/main.tsx` & `VisionPageRenderer.tsx` | Khởi tạo 1 `IntersectionObserver` ở ViewerApp, dùng `data-page-number` để dispatch trang active. | Code refactor ở component cha. | Giảm 99 instances observer thừa; mượt mà khi cuộn trang. |
| **P2-04** | `extension/lib/pdf/url.ts` | Tạo helper `normalizeArxivUrl` và `getViewerUrl`, import vào 4 file liên quan. | Không có rủi ro logic. | Tái sử dụng code, sửa 1 nơi có tác dụng toàn hệ thống. |
| **P2-05** | `extension/components/GlossaryEditor.tsx` | Trích xuất UI quản lý Glossary thành component dùng chung. | Cần điều chỉnh props và callback lưu storage. | Giảm ~180 dòng code trùng lặp giữa Popup và Options. |
| **P3-01** | `extension/entrypoints/viewer/main.tsx` | Xóa component `FlowBlock` và nhánh `type === 'translated'`. | Gãy giao diện nếu có caller gọi `type='translated'`. | Đã kiểm tra tĩnh: chỉ có 1 caller duy nhất gọi với `type='original'`. An toàn 100%. |
| **P3-02** | `extension/entrypoints/viewer/style.css` | Xóa dòng 727-899 (`.lt-markdown-page`). | Mất style nếu có thẻ HTML dùng. | Đã grep toàn bộ codebase xác nhận không có class nào được gọi. An toàn 100%. |
| **P3-03** | `extension/lib/pdf/markdown.ts` | Xóa hàm `blocksToMarkdownElements` và `interface MarkdownElement`; xóa test trong `markdown.test.ts`. | Bài test số 3 trong `markdown.test.ts` sẽ bị xóa. | 4 bài test còn lại của suite này vẫn bao phủ đầy đủ logic chuẩn hóa công thức toán. |
| **P3-04** | `extension/lib/pdf/blocks.ts` | Xóa `isDisplayEquation`; đổi `isMathFormula` thành `isMathFragment` trong `blocks.test.ts`. | Test fail nếu chưa đổi tên hàm trong test. | Cập nhật file test đồng bộ trước khi xóa alias. |
| **P3-05** | 6 files trong `extension/lib/` | Gỡ bỏ từ khóa `export` cho 16 hàm nội bộ. | File khác không import được nếu cần. | Đã xác minh 100% không có file nào ngoài import đến. |
| **P3-06** | Root directory | Xóa `dist/`, `backend/output/`, archive `demo/`, archive script cũ. | Mất tài liệu tham khảo cũ. | Lưu trữ vào thư mục `archive/` thay vì xóa vĩnh viễn (trừ file rác và zip cũ). |
### 5.3. Chiến lược Bảo Toàn Tuyệt Đối 123/123 Tests và Quy Trình CI `npm run check`

Để đảm bảo quá trình tái cấu trúc không gây ra bất kỳ sự cố hồi quy nào (Zero Regressions), mọi hành động phải tuân thủ nghiêm ngặt quy trình 5 bước sau:

#### Bước 1: Baseline Checkpoint trước mỗi thay đổi
- Chạy toàn bộ chuỗi kiểm tra trước khi đụng vào bất kỳ file nào:
  ```powershell
  npm --prefix extension run check
  ```
  Xác nhận 100% PASS: 123 unit tests pass, typecheck 0 error, lint 0 error.

#### Bước 2: Nguyên tắc Tái cấu trúc từng bước nhỏ (Micro-commit Pattern)
- Không bao giờ thực hiện gộp nhiều nhóm tái cấu trúc trong một lần.
- Mỗi tác vụ trong bảng mục 5.2 phải được thực hiện trên một nhánh/commit riêng lẻ kèm theo test xác thực ngay lập tức.
- Ví dụ:
  - Commit 1: Di dời file PDF mẫu sang `tests/fixtures/` và cập nhật đường dẫn `blocks.test.ts:372` -> Chạy test kiểm tra bài test số 15 chạy thật.
  - Commit 2: Sửa `ConcurrencyQueue` -> Chạy `npm --prefix extension test lib/protocol/queue.test.ts`.
  - Commit 3: Sửa `key-router.ts` -> Chạy `npm --prefix extension test lib/providers/key-router.test.ts`.

#### Bước 3: Đồng bộ hóa Test khi Xóa Hàm Dead Code
- Khi xóa các hàm dead code có test case đi kèm (như `blocksToMarkdownElements` trong `markdown.ts` hoặc `isMathFormula` trong `blocks.ts`):
  1. Cập nhật bài test `blocks.test.ts` chuyển sang gọi hàm trực tiếp `isMathFragment`.
  2. Xóa bài test tương ứng trong `markdown.test.ts` (suite giảm từ 5 tests xuống 4 tests, nhưng là giảm có chủ đích và minh bạch, không phải test fail).
  3. Kiểm tra lại toàn bộ suite để đảm bảo không còn tệp nào tham chiếu hàm cũ.

#### Bước 4: Kiểm tra Bundle Build sau khi dọn dẹp Dead Code UI & CSS
- Sau khi xóa `FlowBlock` và dead CSS trong `viewer/`:
  ```powershell
  npm --prefix extension run build
  ```
  Kiểm tra kích thước bundle của `extension/.output/chrome-mv3/chunks/viewer-*.js` giảm từ 799 kB xuống ~780 kB và `assets/viewer-*.css` giảm từ 62.6 kB xuống ~58 kB.

#### Bước 5: Kiểm tra Linter & Typecheck cuối cùng
- Chạy kiểm tra tĩnh toàn diện:
  ```powershell
  npm --prefix extension run typecheck
  npm --prefix extension run lint
  ```
  Đảm bảo việc gỡ bỏ `export` cho 16 hàm nội bộ không gây lỗi kiểu dữ liệu hoặc vi phạm quy chuẩn eslint.

---
## PHẦN 6: DANH MỤC CÂU HỎI & ĐỀ XUẤT PHÊ DUYỆT (ACTIONABLE CHECKLIST FOR USER)

### 6.1. Tuân thủ Nguyên tắc "Hỏi Trước Khi Sửa" (User Global Rules Compliance)

Theo quy định bắt buộc trong User Global Rules của dự án Live-Trans:
> *"Luôn luôn check các nội dung, lỗi trước, liệt kê thông tin lỗi và hỏi người dùng có thực thi không thay vì sửa ngay code."*

Báo cáo kiểm toán này được lập hoàn toàn ở trạng thái **Read-Only / Non-Destructive**. Không có bất kỳ dòng code nào trong dự án bị thay đổi, xóa bỏ hay di dời trong quá trình kiểm toán. Dưới đây là danh mục tổng hợp các đề xuất cụ thể để Người Dùng xem xét, cân nhắc và phê duyệt trước khi đội ngũ kỹ thuật bước vào pha thực thi mã nguồn.

---

### 6.2. Bảng Tổng Hợp Đề Xuất Phê Duyệt Tái Cấu Trúc

Kính đề nghị Người Dùng phê duyệt hoặc từ chối từng hạng mục theo bảng dưới đây:

| STT | Hạng mục & Tệp tin tác động | Loại thao tác đề xuất | Lợi ích đạt được | Rủi ro kỹ thuật | Lựa chọn của Người Dùng |
|:---:|---|---|---|---|:---:|
| **A1** | **Di dời file mẫu PDF `2302.07121.pdf`**<br>`backend/samples/` ➔ `tests/fixtures/sample-paper.pdf`<br>Cập nhật đường dẫn tại `extension/lib/pdf/blocks.test.ts:372` | Di dời tệp & Cập nhật test path | Bảo toàn 100% tính chân thực của unit test số 15, chống lỗi Silent Skip khi dọn dẹp thư mục `backend/`. | Rất thấp (chỉ đổi đường dẫn relative). | [ ] Phê duyệt<br>[ ] Từ chối |
| **A2** | **Sửa lỗi Hanging Promise trong ConcurrencyQueue**<br>`extension/lib/protocol/queue.ts:39` | Sửa logic (Reject pending task khi clear) | Giải phóng ~1.44 MB audio buffer và triệt tiêu rò rỉ bộ nhớ khi bật/tắt ghi âm nhiều lần. | Rất thấp (cần try/catch ở caller). | [ ] Phê duyệt<br>[ ] Từ chối |
| **A3** | **Giới hạn LRU Canvas Cache trong `PdfSnippet`**<br>`extension/entrypoints/viewer/PdfSnippet.tsx:14` | Giới hạn dung lượng Map (max 6 items) | Ngăn chặn rò rỉ ~387 MB RAM bộ nhớ đồ họa khi đọc tài liệu 50 trang. | Rất thấp (vẽ lại canvas mất ~50ms khi cuộn ngược xa). | [ ] Phê duyệt<br>[ ] Từ chối |
| **A4** | **Thêm Debounce (400ms) cho MutationObserver**<br>`extension/entrypoints/content/index.ts:36, 381` | Bọc hàm debounce | Triệt tiêu hiện tượng CPU spike và nghẽn Main Thread khi xem video YouTube live chat. | Không có (chỉ trễ nhẹ 400ms lúc mount ban đầu). | [ ] Phê duyệt<br>[ ] Từ chối |
| **A5** | **Bọc an toàn MediaStream / AudioContext Teardown**<br>`extension/lib/capture/audio-capture.ts:26-44` | Bổ sung try/finally cleanup | Đảm bảo ngắt microphone và biểu tượng chấm đỏ ghi âm tab khi AudioContext lỗi. | Không có. | [ ] Phê duyệt<br>[ ] Từ chối |
| **A6** | **Sửa lỗi đè Router Singleton trong KeyRouter**<br>`extension/lib/providers/key-router.ts:155` | Quản lý Router theo Map provider | Giữ nguyên danh sách key bị 429 (`cooldownMap`), ngăn chặn gọi lại key vừa bị lỗi. | Rất thấp. | [ ] Phê duyệt<br>[ ] Từ chối |
| **A7** | **Kích hoạt Multi-Key Rotation cho DirectGeminiProvider**<br>`extension/lib/providers/direct-gemini.ts:85` | Truyền `getProviderKeys(settings, 'gemini')` | Cho phép tự động xoay vòng API keys khi dịch phụ đề trực tiếp (trước đây chỉ dùng 1 key). | Không có. | [ ] Phê duyệt<br>[ ] Từ chối |
| **A8** | **Đồng bộ hóa 2 chiều cấu hình qua `storage.onChanged`**<br>`extension/entrypoints/options/App.tsx:12` | Thêm listener sự kiện | Ngăn chặn việc tab Options mở sẵn ghi đè làm mất dữ liệu mới cập nhật từ Popup. | Không có. | [ ] Phê duyệt<br>[ ] Từ chối |
| **A9** | **Giới hạn Concurrency cho Micro-batches của PDF**<br>`extension/lib/pdf/translate.ts:518` | Dùng `ConcurrencyQueue(2)` thay cho `Promise.all` | Chống lỗi `HTTP 429 Quota Exceeded` hàng loạt khi dịch trang PDF nhiều chữ trên Gemini Free Tier. | Thời gian dịch trang tăng ~15-20%. | [ ] Phê duyệt<br>[ ] Từ chối |
| **A10** | **Gom logic ArXiv URL & Viewer URL thành Helper chung**<br>`background.ts`, `content/index.ts`, `popup/App.tsx` | Refactor DRY (tạo `lib/pdf/url.ts`) | Giảm trùng lặp mã nguồn tại 4 vị trí, dễ bảo trì khi ArXiv đổi định dạng URL. | Không có. | [ ] Phê duyệt<br>[ ] Từ chối |
| **A11** | **Xây dựng Component dùng chung `<GlossaryEditor />`**<br>`popup/App.tsx` & `options/App.tsx` | Refactor DRY (tạo `components/GlossaryEditor.tsx`) | Loại bỏ ~180 dòng code và JSX trùng lặp 100% giữa Popup và Options. | Trung bình (cần test giao diện 2 trang). | [ ] Phê duyệt<br>[ ] Từ chối |
| **A12** | **Xóa bỏ Dead Code `FlowBlock` và Dead CSS**<br>`viewer/main.tsx:2041-2291` & `viewer/style.css:727-899` | Xóa mã chết (~425 dòng code & CSS) | Giảm ~25 KB kích thước file bundle của Viewer; làm sạch cấu trúc component. | Thấp (nhánh translated không bao giờ được gọi). | [ ] Phê duyệt<br>[ ] Từ chối |
| **A13** | **Xóa hàm `blocksToMarkdownElements` & 16 Over-exports**<br>`lib/pdf/markdown.ts:134`, `lib/pdf/blocks.ts:388` | Xóa dead function & gỡ `export` thừa | Tinh giản API nội bộ của module, hỗ trợ bundler Tree-Shaking tối đa. | Cần xóa 1 test case trong `markdown.test.ts`. | [ ] Phê duyệt<br>[ ] Từ chối |
| **A14** | **Dọn dẹp Tài nguyên Rác tại Root Repository**<br>Xóa `dist/` zip cũ, `backend/output/`, archive `demo/` | Xóa tệp rác & Di dời vào `archive/` | Giải phóng ~54 MB dung lượng lưu trữ repo và ~292 MB cache Chromium test. | Không có (0% ảnh hưởng đến extension). | [ ] Phê duyệt<br>[ ] Từ chối |
| **A15** | **Thêm `package.json` Proxy tại Root Repository**<br>Tạo `package.json` ủy quyền lệnh vào `extension/` | Thêm cấu hình thuận tiện | Cho phép chạy `npm test`, `npm run build`, `npm run check` trực tiếp từ Root. | Không có (không ảnh hưởng `extension/`). | [ ] Phê duyệt<br>[ ] Từ chối |

---
### 6.3. Kiến nghị Trình Tự Triển Khai Khuyến Nghị (Staged Execution Plan)

Để đảm bảo an toàn tuyệt đối và có thể nghiệm thu kiểm thử sau mỗi giai đoạn, nhóm kiểm toán kiến nghị phân chia lộ trình thực thi thành 3 Sprint rõ ràng:

#### Sprint 1: Ổn định Hệ thống & Vá Lỗi Rò rỉ Bộ nhớ (Stability & Memory Hotfixes)
- **Mục tiêu**: Loại bỏ triệt để các rủi ro sập tab do tràn RAM/GPU, treo Promise ngầm và chống dính lỗi Quota HTTP 429.
- **Phạm vi công việc**:
  1. Di dời `backend/samples/2302.07121.pdf` sang `tests/fixtures/sample-paper.pdf` và cập nhật `blocks.test.ts:372` (Bảo toàn test integrity).
  2. Triển khai fix lỗi Hanging Promise trong `ConcurrencyQueue` (A2).
  3. Bổ sung cơ chế LRU Cache cho `pdfPageCanvasCache` trong `PdfSnippet` (A3).
  4. Thêm debounce cho 2 MutationObserver trong Content Script (A4).
  5. Bọc an toàn MediaStream teardown trong `audio-capture.ts` (A5).
  6. Sửa KeyRouter Registry và kích hoạt Multi-Key Rotation cho DirectGeminiProvider (A6, A7).
  7. Bổ sung `storage.onChanged` đồng bộ Options với Popup (A8).
  8. Kiểm soát concurrency micro-batches PDF (A9).
- **Tiêu chuẩn nghiệm thu**: 123/123 tests tiếp tục PASS 100%, `npm run check` 0 error; kiểm tra thực tế trên tab xem video YouTube không drop FPS và RAM viewer không phình to.

#### Sprint 2: Tái cấu trúc Logic Trùng lặp & Tối ưu Giao diện (DRY & UI Performance)
- **Mục tiêu**: Tinh gọn mã nguồn, loại bỏ trùng lặp code giữa các thành phần và tối ưu rendering DOM.
- **Phạm vi công việc**:
  1. Gom helper ArXiv URL và Viewer URL (A10).
  2. Tạo component dùng chung `<GlossaryEditor />` cho Popup và Options (A11).
  3. Gom các tiện ích Base64, bảng mã TeX OML và Regex công thức toán.
  4. Chuẩn hóa `OpenCodeZenProvider` trong `lib/providers/`.
  5. Gom 100 IntersectionObservers thành 1 Observer tại `ViewerApp`.
  6. Bọc `parseMarkdownIntoBlocks` trong `useMemo` và thu hồi GPU Canvas backing store.
- **Tiêu chuẩn nghiệm thu**: Giảm ~300 dòng code trùng lặp; giao diện cuộn tài liệu PDF đạt 60 FPS ổn định.

#### Sprint 3: Loại bỏ Dead Code & Dọn dẹp Tài nguyên Root (Dead Code Elimination & Repo Hygiene)
- **Mục tiêu**: Làm sạch toàn bộ repo, giảm kích thước bundle và chuẩn hóa quy trình phát triển.
- **Phạm vi công việc**:
  1. Xóa component `FlowBlock` và dead CSS trong `viewer/` (A12).
  2. Xóa các hàm dead code `blocksToMarkdownElements`, `isDisplayEquation` và gỡ `export` cho 16 hàm nội bộ (A13).
  3. Dọn dẹp file zip cũ, ảnh debug, archive `demo/` và script probe cũ (A14).
  4. Bổ sung `package.json` proxy tại Root repository (A15).
- **Tiêu chuẩn nghiệm thu**: Bundle viewer giảm ~25 KB; giải phóng ~346 MB dung lượng đĩa; các lệnh `npm test`, `npm run build` tại root chạy thông suốt.

---

## PHỤ LỤC & TÀI LIỆU THAM KHẢO

1. **Báo cáo Khảo sát Root & Redundant Assets**: `.agents/explorer_root_1/report.md`
2. **Báo cáo Kiểm toán Extension Entrypoints**: `.agents/explorer_entrypoints_1/report.md`
3. **Báo cáo Kiểm toán Core Library & Services**: `.agents/explorer_lib_1/report.md`
4. **Báo cáo Baseline 123 Tests & Build Artifacts**: `.agents/worker_baseline_1/report.md`
5. **Kế hoạch Dự án & Quyết định Kỹ thuật**: `docs/plan.md`, `docs/architecture.md`, `HANDOFF.md`
6. **Nhật ký Lỗi Kỹ thuật Dự án**: `docs/ISSUES_LOG.md`
7. **Yêu cầu Khảo sát Ban đầu**: `ORIGINAL_REQUEST.md`

---
*Báo cáo được hoàn thành vào ngày 2026-09-07 bởi Tổ chuyên viên Kiểm toán Mã nguồn Live-Trans v1.0.1.*
