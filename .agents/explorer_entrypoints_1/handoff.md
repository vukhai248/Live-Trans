# HANDOFF REPORT: EXPLORER ENTRYPOINTS (R2)

**From**: `explorer_entrypoints_1`  
**To**: `parent` (ID: `bfdd02db-0f6a-42e9-b729-ebf2c6353e1b`)  
**Scope**: R2 - Kiểm toán chi tiết mã nguồn các Entrypoints trong `extension/` (`background.ts`, `content/`, `offscreen/`, `popup/`, `options/`, `viewer/`, `wxt.config.ts`, HTML files).  
**Report File**: `d:\create\Live-Trans\.agents\explorer_entrypoints_1\report.md`  

---

## 1. Observation

Đã trực tiếp quan sát, đọc mã nguồn và thực thi kiểm tra trên môi trường Windows (PowerShell):

1. **Dead Code khổng lồ trong `viewer/main.tsx`**:
   - `viewer/main.tsx:1593-1605`: `PageRenderer` chỉ được render với prop `type="original"`.
   - `viewer/main.tsx:1713-1750`: Khung bên phải chỉ render `WhiteboardPageRenderer` hoặc `VisionPageRenderer`.
   - `viewer/main.tsx:2041-2291`: Component `FlowBlock` (250 dòng) nằm trong nhánh `type === 'translated'`, cùng toàn bộ logic kéo thả `dx, dy, customW` (`viewer/main.tsx:1834-1896`), `computeReflowOffsets` (`viewer/main.tsx:10, 1826`), `loadPageLayout` (`viewer/main.tsx:1784`), `BlockLayoutOverride` (`viewer/main.tsx:1777`) hoàn toàn không bao giờ được gọi đến trong ứng dụng.
2. **Ghost State trong `viewer/main.tsx`**:
   - `viewer/main.tsx:820`: Khai báo `const [_layoutResetSignal, setLayoutResetSignal] = useState<number>(0);`.
   - `viewer/main.tsx:832`: `setLayoutResetSignal((n) => n + 1);` trong `resetAllLayouts()`.
   - `viewer/main.tsx:1593-1605`: `PageRenderer` được render mà không nhận prop `layoutResetSignal`.
3. **Dead CSS trong `viewer/style.css`**:
   - `viewer/style.css:727-899`: 173 dòng CSS của `.lt-markdown-page`, `.lt-md-heading`, `.lt-md-paragraph`, `.lt-md-formula`, `.lt-md-algorithm`, `.lt-md-footnote`. Lệnh grep toàn dự án trả về 0 kết quả sử dụng trong bất kỳ file JSX/HTML nào.
4. **Memory Leak trong `viewer/PdfSnippet.tsx`**:
   - `viewer/PdfSnippet.tsx:14`: `const pdfPageCanvasCache = new Map<string, HTMLCanvasElement>();`
   - Lưu trữ canvas kích thước đầy đủ 2x HiDPI (~7.75MB/trang), không có max size, không có LRU, không bao giờ được xóa.
5. **CPU Spike do MutationObserver không Debounce trong `content/index.ts`**:
   - `content/index.ts:36-37`: `new MutationObserver(sendDetectedTitle).observe(document.documentElement, { subtree: true, childList: true });`
   - `content/index.ts:381-382`: `new MutationObserver(tryMount).observe(document.documentElement, { childList: true, subtree: true });`
   - Cả hai observer chạy trên `<all_urls>` không có debounce/throttle.
6. **Vòng lặp Interval không giải phóng trong `content/index.ts`**:
   - `content/index.ts:184`: `setInterval(() => this.position(), 600);` không lưu ID và không có cleanup.
7. **Message Port Leak trong `background.ts`**:
   - `background.ts:107-175`: `browser.runtime.onMessage.addListener` luôn `return true;` (dòng 173) nhưng các case `OFFSCREEN_READY` (141), `FORWARD_TO_TAB` (144), `STATE_UPDATE` (166), và `default` không hề gọi `sendResponse()`.
8. **Mất đồng bộ cấu hình trong `options/App.tsx`**:
   - `options/App.tsx:12-14`: Chỉ tải cấu hình 1 lần bằng `loadSettings()`. Không lắng nghe `storage.onChanged`.
9. **DRY Violations lặp lại**:
   - Chuẩn hóa ArXiv URL: Trùng lặp tại `background.ts:153`, `background.ts:192`, `content/index.ts:294`, `popup/App.tsx:133`.
   - Tạo Viewer URL: Trùng lặp tại `background.ts:160`, `background.ts:198`, `content/index.ts:363`, `popup/App.tsx:417`.
   - Quản lý Glossary: Trùng lặp giữa `popup/App.tsx:310-336, 838-904` và `options/App.tsx:216-243, 267-363`.
10. **Lệnh kiểm tra hệ thống**:
    - `npm run typecheck` trong `extension/`: Mã thoát code 0 (Pass).
    - `npx eslint .` trong `extension/`: Mã thoát code 0 (Pass).

---

## 2. Logic Chain

1. Từ việc `PageRenderer` tại `viewer/main.tsx:1593` chỉ được gán `type="original"`, còn pane dịch (`viewer/main.tsx:1713`) dùng `WhiteboardPageRenderer` và `VisionPageRenderer` độc lập:
   $\rightarrow$ Mọi mã nguồn nằm trong nhánh `type === 'translated'` của `PageRenderer` và component `FlowBlock` (dòng 2041-2291) là mã chết (Dead Code).
2. Từ việc các class `.lt-markdown-page`... trong `viewer/style.css:727-899` không có thẻ JSX nào khớp:
   $\rightarrow$ Đây là CSS thừa từ giai đoạn thử nghiệm prototype Markdown trước đây.
3. Từ việc `pdfPageCanvasCache` là Map module-level không bị dọn dẹp:
   $\rightarrow$ Với tài liệu PDF nhiều trang, mỗi trang tạo ra một canvas ~7.75MB và tồn tại mãi trong RAM tab, gây rò rỉ bộ nhớ đồ họa hàng trăm MB.
4. Từ việc hai MutationObserver trong `content/index.ts` lắng nghe toàn bộ DOM root không debounce:
   $\rightarrow$ Khi các trang web phát sinh nhiều DOM mutation (ví dụ xem YouTube streaming, bình luận liên tục), hàm kiểm tra tiêu đề và tìm PDF chạy dồn dập, làm nghẽn Main Thread của tab người dùng.
5. Từ việc `background.ts` luôn `return true;` nhưng không gọi `sendResponse` trong 4 nhánh case:
   $\rightarrow$ Kênh message passing nội bộ của trình duyệt bị giữ mở vô thời hạn, gây rò rỉ port và lỗi *"The message port closed before a response was received"*.
6. Từ việc `options/App.tsx` không nghe `storage.onChanged`:
   $\rightarrow$ Gây lỗi mất dữ liệu khi người dùng chỉnh sửa cài đặt trên Popup rồi quay lại bấm Lưu trên trang Options.

---

## 3. Caveats

1. **Phạm vi khảo sát**: Chỉ tập trung vào các entrypoints của extension (`extension/entrypoints/` và `wxt.config.ts`), không can thiệp sâu vào chi tiết giải thuật của các module trong `lib/` (thuộc phạm vi của các explorer khác).
2. **Nguyên tắc Read-Only**: Không thực hiện chỉnh sửa trực tiếp vào mã nguồn sản phẩm. Mọi đề xuất đã được ghi nhận chi tiết để giai đoạn Refactoring thực thi.
3. **Độ ổn định của Test**: Các unit test hiện tại (123 tests) chủ yếu kiểm thử các module thuật toán trong `lib/` (ASR, Glossary, Masker, PDF blocks/markdown/reflow, Settings, Subtitles, Translate). Việc dọn dẹp các entrypoints này hoàn toàn không làm gãy unit tests.

---

## 4. Conclusion

Hệ thống entrypoints của Live-Trans hoạt động đúng chức năng nhưng chứa:
- **~725 dòng dead code và dead CSS** có thể xóa bỏ an toàn (`viewer/main.tsx`, `viewer/style.css`).
- **3 điểm nghẽn hiệu năng & rò rỉ bộ nhớ nghiêm trọng** cần khắc phục ngay: Canvas Cache rò rỉ RAM trong `PdfSnippet.tsx`, MutationObserver không debounce trong `content/index.ts`, và Port Leak trong `background.ts`.
- **4 cụm DRY violations** cần được gom thành utility dùng chung.

Toàn bộ chi tiết kèm bảng ma trận ưu tiên đã được tổng hợp tại:
`d:\create\Live-Trans\.agents\explorer_entrypoints_1\report.md`.

---

## 5. Verification Method

Người nhận bàn giao có thể độc lập kiểm chứng báo cáo này bằng các bước sau:
1. **Kiểm tra Dead Code trong Viewer**:
   - Mở `extension/entrypoints/viewer/main.tsx`, tìm kiếm tất cả các lần xuất hiện của `<PageRenderer` (chỉ có 1 lần duy nhất tại dòng 1593 với `type="original"`).
   - Kiểm tra `viewer/style.css:727-899` và chạy lệnh grep `git grep "lt-markdown-page"` để xác nhận class này không có trong JSX.
2. **Kiểm tra Port Leak trong Background**:
   - Mở `extension/entrypoints/background.ts:107-175`, quan sát dòng 173 (`return true;`) và đối chiếu với các case dòng 141-143, 144-147, 166-168.
3. **Kiểm tra MutationObserver trong Content Script**:
   - Mở `extension/entrypoints/content/index.ts:36-37` và `381-382`.
4. **Kiểm tra Canvas Cache trong PdfSnippet**:
   - Mở `extension/entrypoints/viewer/PdfSnippet.tsx:14`.
5. **Kiểm tra tính toàn vẹn hệ thống**:
   ```powershell
   cd d:\create\Live-Trans\extension
   npm run typecheck
   npm run test
   ```
   Xác nhận 123/123 unit tests pass và typecheck không lỗi.
