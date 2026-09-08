# Báo cáo Khảo sát & Phân tích Kiến trúc: `viewer/main.tsx` (Explorer M1-3)

- **Mã nhiệm vụ**: Explorer M1-3
- **Đối tượng khảo sát**: `extension/entrypoints/viewer/main.tsx` (Tổng số dòng hiện tại: 2,429 dòng; kích thước: 110,256 bytes)
- **Thời gian thực hiện**: 2026-09-08
- **Mục tiêu**: Thống kê toàn diện States/Refs/Effects/Handlers, vẽ bản đồ phụ thuộc dữ liệu 2 chiều (Data & State Dependency Map) kết nối 4 khối logic lớn với core rendering, và thiết kế chiến lược tái cấu trúc bóc tách sub-components & custom hooks để đưa `main.tsx` về < 300 dòng mà vẫn bảo toàn 100% tính năng và 161/161 unit tests.

---

## 1. Observation (Quan sát Thực tế & Thống kê Chi tiết)

Qua khảo sát trực tiếp từng dòng mã nguồn trong `extension/entrypoints/viewer/main.tsx`, chúng tôi ghi nhận cấu trúc tổng thể như sau:
- **Dòng 1 - 26**: Các khai báo `import` (Preact, PDF.js, Katex CSS, thư viện xử lý PDF nội bộ, settings, CustomSelect).
- **Dòng 27 - 29**: Thiết lập cấu hình worker PDF.js qua `chrome.runtime.getURL('pdf.worker.min.mjs')`.
- **Dòng 30 - 34**: Hàm tiện ích `applyZoomStep(currentFactor, deltaY)`.
- **Dòng 36 - 2211**: Component chính `ViewerApp()` (chiếm 2,175 dòng).
- **Dòng 2213 - 2334**: Component nội bộ `PageRenderer` (chiếm 122 dòng).
- **Dòng 2336 - 2426**: Component nội bộ `FlowBlock` (chiếm 91 dòng).
- **Dòng 2428**: Điểm gắn kết `render(<ViewerApp />, document.getElementById('app')!)`.

### 1.1. Bảng Tổng kê Toàn bộ States trong `ViewerApp` (30 `useState`)

| STT | Tên State | Kiểu dữ liệu | Giá trị khởi tạo | Dòng | Mục đích & Trách nhiệm |
|:---:|-----------|--------------|------------------|:----:|------------------------|
| 1 | `pdfUrl` | `string` | `''` | 37 | Đường dẫn URL của tài liệu PDF trích xuất từ tham số URL `?url=`. |
| 2 | `docTitle` | `string` | `'Tài liệu PDF'` | 38 | Tiêu đề tài liệu hiển thị trên Toolbar (lấy từ file name hoặc PDF metadata). |
| 3 | `pdfDoc` | `PDFDocumentProxy \| null` | `null` | 39 | Đối tượng tài liệu PDF.js sau khi tải thành công. |
| 4 | `numPages` | `number` | `0` | 40 | Tổng số trang của tài liệu. |
| 5 | `currentPage` | `number` | `1` | 41 | Số trang hiện tại người dùng đang đọc. |
| 6 | `leftFitScale` | `number` | `1.0` | 42 | Tỷ lệ Fit Width tự động của khung xem bản gốc bên trái. |
| 7 | `rightFitScale` | `number` | `1.0` | 43 | Tỷ lệ Fit Width tự động của khung xem bản dịch bên phải. |
| 8 | `leftZoomFactor` | `number` | `1.0` | 44 | Hệ số phóng to/thu nhỏ tạm thời (Ctrl + Wheel) của khung trái. |
| 9 | `rightZoomFactor` | `number` | `1.0` | 45 | Hệ số phóng to/thu nhỏ tạm thời (Ctrl + Wheel) của khung phải. |
| 10 | `viewMode` | `ViewMode` | `'bilingual'` | 46 | Chế độ xem: `'bilingual'` (song ngữ), `'translated'` (chỉ dịch), `'original'` (chỉ gốc). |
| 11 | `sidebarOpen` | `boolean` | `false` | 47 | Trạng thái mở/đóng drawer danh sách trang ở thanh bên trái. |
| 12 | `isSidebarPinned` | `boolean` | `false` | 48 | Cố định (ghim) thanh bên không cho tự đóng. |
| 13 | `hoveredSentenceId` | `string \| null` | `null` | 49 | ID câu đang được hover chuột để đồng bộ highlight 2 chiều gốc - dịch. |
| 14 | `readerMode` | `'whiteboard' \| 'vision' \| 'markdown' \| 'overlay'` | `'vision'` | 51 | Chế độ đọc bản dịch (mặc định là Vision AI). |
| 15 | `isModeMenuOpen` | `boolean` | `false` | 52 | Trạng thái mở dropdown menu chọn Reader Mode trên toolbar. |
| 16 | `pageVisionTranslations` | `Record<number, string>` | `{}` | 53 | Bộ nhớ đệm kết quả dịch Markdown/KaTeX từng trang của Vision AI. |
| 17 | `pageVisionStatus` | `Record<number, 'loading' \| 'done' \| 'error' \| 'queued'>` | `{}` | 54 | Trạng thái tiến trình dịch Vision AI theo từng trang. |
| 18 | `activePriorityPages` | `number[]` | `[]` | 55 | Danh sách các trang ưu tiên đang được worker dịch tại thời điểm hiện tại. |
| 19 | `pendingPriorityPages` | `number[]` | `[]` | 56 | Danh sách các trang ưu tiên đang chờ worker tiếp nhận. |
| 20 | `pageVisionErrors` | `Record<number, string>` | `{}` | 57 | Thông báo lỗi Vision AI theo từng trang (nếu có). |
| 21 | `splitRatio` | `number` | `0.45` | 58 | Tỷ lệ chia màn hình giữa cột gốc và cột dịch (mặc định 45% bên trái). |
| 22 | `pageBlocks` | `Record<number, TextBlock[]>` | `{}` | 61 | Các khối văn bản trích xuất từ PDF gốc (dùng cho hover sync & legacy). |
| 23 | `pageTranslations` | `Record<number, TranslatedBlock[]>` | `{}` | 62 | Khối bản dịch từng trang (dùng cho Whiteboard mode). |
| 24 | `pageStatus` | `Record<number, 'loading' \| 'done' \| 'error'>` | `{}` | 63 | Trạng thái dịch khối văn bản (Whiteboard / legacy). |
| 25 | `pageUntranslated` | `Record<number, number>` | `{}` | 65 | Số câu chưa dịch (UTB) trên từng trang để hiển thị badge cảnh báo. |
| 26 | `settings` | `Settings` | `DEFAULT_SETTINGS` | 67 | Toàn bộ cấu hình ứng dụng (theme, font, scale, provider, model, v.v.). |
| 27 | `errorMsg` | `string` | `''` | 68 | Thông báo lỗi nạp tài liệu PDF toàn cục. |
| 28 | `isSettingsOpen` | `boolean` | `false` | 69 | Trạng thái mở modal Cài đặt (Settings Modal). |
| 29 | `activeSettingsTab` | `'appearance' \| 'models' \| 'performance'` | `'appearance'` | 70 | Tab đang kích hoạt trong modal Cài đặt. |
| 30 | `showAutoSaveBadge` | `boolean` | `false` | 71 | Cờ hiển thị badge thông báo "Đã tự động lưu" trên modal Cài đặt. |
| 31 | `keyItems` | `ApiKeyItem[]` | `[]` | 102 | Danh sách API Keys được quản lý trong modal Cài đặt. |
| 32 | `newKeyProvider` | `PdfProvider` | `'gemini'` | 103 | Provider của key mới đang nhập (`'gemini'` hoặc `'zen'`). |
| 33 | `newKeyText` | `string` | `''` | 104 | Giá trị chuỗi khóa API đang nhập trên form. |
| 34 | `isPostSavePromptOpen` | `boolean` | `false` | 105 | Trạng thái mở popup hỏi người dùng có muốn dịch lại sau khi lưu key. |

*(Ghi chú: 34 khai báo state cục bộ trong component chính `ViewerApp`)*

### 1.2. Bảng Tổng kê Toàn bộ Refs trong `ViewerApp` (15 `useRef`)

| STT | Tên Ref | Kiểu dữ liệu | Giá trị khởi tạo | Dòng | Mục đích & Trách nhiệm |
|:---:|---------|--------------|------------------|:----:|------------------------|
| 1 | `isDraggingSplitter` | `boolean` | `false` | 59 | Cờ đánh dấu người dùng đang kéo thả thanh phân chia Splitter. |
| 2 | `autoSaveTimerRef` | `any` | `null` | 72 | Timer định thời ẩn badge "Đã tự động lưu" sau 1.8 giây. |
| 3 | `leftPaneRef` | `HTMLDivElement` | `null` | 107 | Tham chiếu DOM của container khung bản gốc bên trái. |
| 4 | `rightPaneRef` | `HTMLDivElement` | `null` | 108 | Tham chiếu DOM của container khung bản dịch bên phải. |
| 5 | `isSyncingScroll` | `boolean` | `false` | 109 | Cờ khóa ngăn chặn đệ quy vô hạn giữa sự kiện cuộn của 2 khung trái/phải. |
| 6 | `highPriorityQueueRef` | `number[]` | `[]` | 221 | Hàng đợi chứa các trang ưu tiên do tương tác tức thì của người dùng. |
| 7 | `waterfallQueueRef` | `number[]` | `[]` | 222 | Hàng đợi chứa danh sách các trang dịch ngầm tuần tự từ 1 đến N (thác nước). |
| 8 | `activeWorkersCountRef` | `number` | `0` | 223 | Biến đếm số worker đang chạy song song (tối đa `settings.pdfConcurrency`). |
| 9 | `activeProcessingPagesRef` | `Set<number>` | `new Set()` | 224 | Tập hợp các trang đang được xử lý bởi các workers, ngăn chặn dịch trùng. |
| 10 | `wakePacingTimerRef` | `(() => void) \| null` | `null` | 225 | Hàm đánh thức/ngắt nhịp nghỉ 400ms khi có trang ưu tiên mới phát sinh. |
| 11 | `scrollDebounceTimerRef` | `any` | `null` | 226 | Timer debounce 300ms khi người dùng cuộn qua trang trước khi đẩy vào ưu tiên. |
| 12 | `isRateLimitedRef` | `boolean` | `false` | 227 | Cờ đánh dấu đã chạm ngưỡng Rate Limit 429/Quota, tạm dừng thác nước ngầm. |
| 13 | `initializedWaterfallRef` | `string` | `''` | 228 | Khóa định danh `url_model_lang_pages` ngăn khởi tạo lặp thác nước. |
| 14 | `pageVisionStatusRef` | `Record<number, 'loading' \| 'done' \| 'error' \| 'queued'>` | `{}` | 286 | Bản sao đồng bộ của state trạng thái Vision để tránh stale closure trong worker. |
| 15 | `pageVisionTranslationsRef` | `Record<number, string>` | `{}` | 287 | Bản sao đồng bộ của nội dung dịch để worker kiểm tra cache tức thời. |
| 16 | `visionTokenRef` | `Record<number, number>` | `{}` | 288 | Token số nguyên tăng dần chống race condition khi gọi API Vision AI. |
| 17 | `pageQueueRef` | `{ active: number; waiting: Array<() => void> }` | `{ active: 0, waiting: [] }` | 944-947 | Slot semaphore giới hạn tối đa 2 trang dịch song song cho legacy block. |
| 18 | `pageTokenRef` | `Record<number, number>` | `{}` | 967 | Token số nguyên chống race condition cho legacy block translation. |

### 1.3. Bảng Tổng kê Toàn bộ Effects trong `ViewerApp` (7 `useEffect`)

| STT | Dòng | Dependencies | Mục đích chi tiết |
|:---:|:----:|--------------|-------------------|
| 1 | 91 - 100 | `[isSettingsOpen]` | Lắng nghe sự kiện bàn phím `Escape` trên `window` để đóng modal Cài đặt. |
| 2 | 122 - 138 | `[calculatePaneFitScale, splitRatio, sidebarOpen, isSidebarPinned, viewMode, pdfDoc]` | Lắng nghe sự kiện `resize` trên window và thay đổi layout để tính lại độc lập `leftFitScale` và `rightFitScale`. Có kèm timer trễ 120ms. |
| 3 | 145 - 188 | `[]` | Hook khởi tạo khi mount: Nạp cấu hình từ storage, đọc tham số `?url=`, khởi tạo PDF Document qua PDF.js, đọc metadata trích xuất tiêu đề tài liệu. |
| 4 | 190 - 204 | `[]` | Lắng nghe click chuột ra ngoài vùng `.lt-dropdown-container` để đóng menu chế độ xem; đăng ký hook gỡ lỗi `__setSplitRatio`; dọn dẹp cache registry `pruneVisionCacheRegistry()`. |
| 5 | 572 - 606 | `[readerMode, pdfUrl, pdfDoc, numPages, settings.pdfModel, settings.targetLang, prioritizeVisionPage]` | Khởi tạo Background Waterfall: nạp toàn bộ cache sẵn có, gán các trang chưa có vào `waterfallQueueRef`, ưu tiên dịch ngay trang hiện tại (hoặc trang 1). Kích hoạt lại khi đổi model hoặc ngôn ngữ đích. |
| 6 | 724 - 737 | `[viewMode]` | Lắng nghe sự kiện `wheel` kết hợp phím `Ctrl` trên khung trái để zoom tạm thời (`leftZoomFactor`) trong phạm vi [0.5, 3.0]. |
| 7 | 747 - 940 | `[viewMode, numPages]` | **Engine Điều phối Cột đọc Thông minh & Khóa Trần (Intelligent Reading Column Coordinator & Ceiling-Lock)** trên khung phải: phân biệt lề đen 2 bên sườn, khóa cứng trần trang khi nội dung trang chưa cuộn hết, chống vọt lố và truyền lực cuộn dư chính xác sang trần trang tiếp theo. |

### 1.4. Bảng Tổng kê Handlers & Functions Chính trong `ViewerApp`

| Tên Hàm / Handler | Kiểu | Dòng | Trách nhiệm chính |
|-------------------|:----:|:----:|-------------------|
| `triggerAutoSaveBadge` | `useCallback` | 74 - 80 | Hiển thị huy hiệu tự động lưu và đặt timer tự ẩn sau 1.8s. |
| `updateSettingDirect` | `useCallback` | 82 - 89 | Cập nhật cấu hình tức thì vào state và `saveSettings`, kích hoạt badge. |
| `calculatePaneFitScale`| `useCallback` | 112 - 119 | Tính tỷ lệ fit chiều ngang cho container dựa trên khổ PDF chuẩn 612pt. |
| `activeProviderKeys` | `useMemo` | 230 - 232 | Lọc danh sách API key khả dụng cho provider hiện hành. |
| `modalProviderKeys` | `useMemo` | 236 - 238 | Lọc danh sách API key hiển thị trong modal theo provider đang chọn. |
| `handleAddKey` | Function | 240 - 267 | Thêm key mới, validate trùng, cập nhật `Settings`, lưu storage. |
| `handleRemoveKey` | Function | 269 - 283 | Xóa key theo ID, tự động gán key đầu tiên làm key mặc định. |
| `executeVisionTranslation` | Async | 290 - 347 | Dịch 1 trang: kiểm tra cache, gọi `translatePageVision`, bắt lỗi 429 để dừng thác nước. |
| `runVisionWorker` | Async | 349 - 444 | Vòng lặp worker xử lý tuần tự ưu tiên `highPriority` trước, `waterfall` sau; nhịp nghỉ pacing 400ms. |
| `processVisionQueue` | Function | 446 - 460 | Khởi chạy các worker đồng thời cho đến khi đạt `settings.pdfConcurrency` (tối đa 7). |
| `prioritizeVisionPage` | `useCallback` | 462 - 535 | Gom cụm batch `[P .. P + concurrency - 1]`, đẩy lên đỉnh ưu tiên, đánh thức worker. |
| `debouncedPrioritizePage`| `useCallback` | 537 - 544 | Chờ 300ms dừng cuộn mới gửi yêu cầu ưu tiên dịch trang. |
| `retryVisionPage` | Function | 546 - 569 | Xóa cache, xóa lỗi, đặt trạng thái loading và buộc dịch lại trang chỉ định. |
| `handleLeftScroll` | Function | 609 - 663 | Bắt sự kiện cuộn khung trái: tính vị trí trang và tỉ lệ offset, căn chỉnh khung phải khớp chính xác theo trang (Page-to-Page). |
| `handleRightScroll` | Function | 665 - 721 | Chiều ngược lại từ khung phải sang khung trái. |
| `runWithPageSlot` | Async | 949 - 962 | Semaphore điều tiết tối đa 2 trang đồng thời cho legacy block translation. |
| `triggerPageTranslation`| Async | 968 - 1007| Trích xuất blocks từ PDF và dịch khối văn bản (Whiteboard mode). |
| `retryPage` | Function | 1011 - 1018| Thử lại trang lỗi cho Whiteboard mode. |
| `retranslateAll` | Function | 1022 - 1060| Xóa toàn bộ cache (session & memory), reset trạng thái và chạy lại dịch toàn bộ từ đầu. |
| `scrollToPage` | Function | 1063 - 1076| Nhảy tới trang mong muốn và kích hoạt ưu tiên dịch ngay lập tức (0ms). |

---

## 2. Logic Chain (Bản đồ Phụ thuộc Dữ liệu & Ma trận Phụ thuộc)

### 2.1. Bản đồ Phụ thuộc Dữ liệu (Data Flow & State Dependency Architecture)

Quá trình điều phối dữ liệu trong `main.tsx` diễn ra qua 4 khối logic lớn kết nối với vùng hiển thị lõi (Core Rendering Region):

```
                                  +-----------------------------+
                                  |    PDF Document Loader      |
                                  |   (pdfUrl, pdfDoc, numPages)|
                                  +-----------------------------+
                                                 |
                   +-----------------------------+-----------------------------+
                   |                             |                             |
                   v                             v                             v
+------------------------------------+  +------------------+  +--------------------------------+
|          BLOCK 1: SETTINGS         |  | BLOCK 2: TOOLBAR |  |     BLOCK 3: SCROLL ENGINE     |
| - settings (Theme, Font, Scale)    |  | - viewMode       |  | - leftPaneRef, rightPaneRef    |
| - provider, model, apiKeys         |  | - readerMode     |  | - isSyncingScroll              |
| - pdfConcurrency, targetLang       |  | - currentPage    |  | - Page-to-Page Sync            |
| - Smart Router & AutoSave          |  | - Segmented View |  | - Ceiling-Lock & Margin Bypass |
+------------------------------------+  +------------------+  +--------------------------------+
                   |                             |                             |
                   +-----------------------------+-----------------------------+
                                                 |
                                                 v
                               +------------------------------------+
                               |     BLOCK 4: WORKER QUEUE ENGINE   |
                               | - highPriorityQueueRef (Window)    |
                               | - waterfallQueueRef (Pages 1..N)   |
                               | - Multi-Worker Pool (2..7 workers) |
                               | - Pacing Delay & Wake Interrupt    |
                               | - Rate-Limit (429) Auto Pause      |
                               +------------------------------------+
                                                 |
                     +---------------------------+---------------------------+
                     |                           |                           |
                     v                           v                           v
+----------------------------------+ +-----------------------+ +----------------------------------+
|    CORE: LEFT PANE (ORIGINAL)    | |  CORE: SPLITTER BAR   | |   CORE: RIGHT PANE (TRANSLATED)  |
| - PageRenderer (Lazy Canvas HiDPI)| | - Drag ratio [0.2..0.8| | - VisionPageRenderer (KaTeX)    |
| - FlowBlock (Hover sentence sync)| | - Pointer capture     | | - WhiteboardPageRenderer (Blocks)|
| - IntersectObserver (200px)      | | - rAF smooth resize   | | - CSS Variables (--lt-scale, font|
+----------------------------------+ +-----------------------+ +----------------------------------+
```

### 2.2. Ma trận Phụ thuộc giữa State và các Khối Chức năng

| State / Ref | Block 1: Settings | Block 2: Toolbar | Block 3: ScrollSync | Block 4: Worker Queue | Core: Panes, Splitter, Sidebar |
|-------------|:-----------------:|:----------------:|:-------------------:|:---------------------:|:------------------------------:|
| `pdfDoc` | R (reset context) | R (disabled check) | R (bounds check) | **R** (extract page image) | **R** (canvas rasterization) |
| `pdfUrl` | - | - | - | **R** (cache keys) | - |
| `docTitle` | - | **R** (brand title) | - | - | R (loading screen) |
| `numPages` | - | **R** (total pages)| R (clamp scroll) | **R** (waterfall loop) | **R** (page loop, drawer list) |
| `currentPage` | R (retry current) | **R/W** (prev/next) | **W** (detect from scroll) | R (initial priority page) | **R** (drawer active thumbnail)|
| `leftFitScale` / `rightFitScale` | - | - | - | - | **R** (pass to page renderers) |
| `leftZoomFactor` / `rightZoomFactor` | - | **W** (reset 50:50) | **W** (Ctrl+wheel zoom) | - | **R** (effective scales) |
| `viewMode` | - | **R/W** (buttons) | **R** (bilingual guard)| - | **R** (show/hide left/right pane)|
| `sidebarOpen` / `isSidebarPinned` | - | **R/W** (toggle) | - | - | **R** (drawer CSS classes) |
| `hoveredSentenceId` | - | - | - | - | **R/W** (FlowBlock & renderers)|
| `readerMode` | - | **R/W** (dropdown)| **R** (queue trigger) | **R** (init waterfall condition)| **R** (Vision vs Whiteboard) |
| `pageVisionTranslations` | - | - | - | **W** (worker write) | **R** (VisionPageRenderer prop) |
| `pageVisionStatus` | - | - | - | **W** (status update) | **R** (sidebar badges, loading)|
| `activePriorityPages` / `pendingPriorityPages` | - | - | - | **W** (queue management) | **R** (sidebar priority tags ⚡) |
| `pageVisionErrors` | - | - | - | **W** (error capture) | **R** (display error & retry) |
| `splitRatio` | - | **W** (reset 50:50) | - | - | **R/W** (drag resize & pane width)|
| `settings` | **R/W** (all controls)| - | - | **R** (model, concurrency, lang)| **R** (theme, font, scale CSS vars)|
| `keyItems` | **R/W** (add, delete) | - | - | R (active keys for router) | - |
| `isSettingsOpen` | **R/W** (open, close) | **W** (cog button) | - | - | **R** (render modal backdrop) |
| `activeSettingsTab` | **R/W** (tab buttons) | - | - | - | **R** (render tab content) |
| `isPostSavePromptOpen` | **R/W** (modal prompt)| - | - | R (trigger retry/retranslate)| **R** (render prompt card) |
| `highPriorityQueueRef` / `waterfallQueueRef` | - | - | - | **R/W** (dual queue engine) | - |
| `leftPaneRef` / `rightPaneRef` | - | - | **R/W** (DOM scroll events) | - | **R** (attach ref to container) |
| `isSyncingScroll` | - | - | **R/W** (loop prevention) | - | - |

*(Ý nghĩa: R = Read, W = Write, R/W = Read & Write)*

---

## 3. Caveats (Các Điểm Lưu ý Sâu & Ranh giới Kỹ thuật)

1. **Ranh giới Cuộn Đồng bộ & Hiện tượng Trễ Subpixel (Subpixel Clamping)**:
   - Trong `main.tsx` (dòng 827-837), khi cuộn trang bên trong `bodyCurr`, nếu `actualScrolled < deltaY` (do giới hạn subpixel của trình duyệt khi chạm đáy), mã nguồn đã tính toán `unusedDelta` và chuyển tiếp sang khoảng cách trần của trang tiếp theo. Bóc tách hook `useSyncScroll` phải giữ nguyên 100% thuật toán này để tránh giật cuộn khi đọc tài liệu dài.
2. **Khóa Trần và Lề Đen Hai Bên Sườn (Side Margin Bypass)**:
   - Tại dòng 772, điều kiện `e.clientX < firstPageRect.left || e.clientX > firstPageRect.right` cho phép con trỏ người dùng ở hai bên mép đen cuộn tự do toàn bộ trang web mà không bị kẹt trong logic khóa trần của trang đọc. Đây là tính năng UX quan trọng không được bỏ sót.
3. **Stale Closure trong Hàng đợi Đa Luồng (Multi-Worker Stale Closures)**:
   - Các worker chạy nền `runVisionWorker` hoạt động theo các chu kỳ bất đồng bộ kéo dài. Việc duy trì các ref đồng bộ như `pageVisionStatusRef`, `pageVisionTranslationsRef`, `isRateLimitedRef`, `wakePacingTimerRef` là bắt buộc. Không được chuyển các ref này hoàn toàn thành React state trong hook vì sẽ gây stale closure trong vòng lặp `while (true)`.
4. **Tránh Re-render Thừa Thãi (Re-render Optimization)**:
   - Thay vì truyền lẻ tẻ 30 state qua props drill, việc gom nhóm thành các Custom Hooks chuyên biệt với giao diện kết xuất (contract interfaces) rõ ràng sẽ cô lập phạm vi re-render. Ví dụ: khi gõ input thêm key mới (`newKeyText`), chỉ có sub-component `ModelsTab` re-render, toàn bộ phần rendering PDF và Toolbar không bị ảnh hưởng.
5. **Tính Bảo Toàn 161/161 Unit Tests**:
   - Khảo sát bộ test (`npm run test`) cho thấy toàn bộ 23 file test hiện tại tập trung kiểm thử các module bên trong `lib/` (`lib/pdf/*`, `lib/providers/*`, `lib/translate/*`, v.v.). Việc tái cấu trúc nội bộ `extension/entrypoints/viewer/main.tsx` sẽ **hoàn toàn không chạm vào `lib/`**, bảo đảm 100% không làm gãy bất kỳ unit test nào trong số 161 tests.

---

## 4. Conclusion & Kế hoạch Phân rã Kiến trúc (< 300 dòng cho `main.tsx`)

### 4.1. Kiến trúc Đích Đề xuất (Target Architecture)

Cây thư mục sau khi tái cấu trúc:
```
extension/entrypoints/viewer/
├── components/
│   ├── SettingsModal/
│   │   ├── SettingsModal.tsx         (~120 dòng) - Modal wrapper & sidebar nav
│   │   ├── AppearanceTab.tsx         (~180 dòng) - Themes, Fonts, Scale & Live Preview
│   │   ├── ModelsTab.tsx             (~165 dòng) - Provider, Model & Multi-Key Manager
│   │   ├── PerformanceTab.tsx        (~110 dòng) - Concurrency, TargetLang & Reset Cache
│   │   └── PostSavePromptModal.tsx   (~75 dòng)  - Popup hỏi dịch lại sau khi lưu key
│   ├── ViewerToolbar.tsx             (~180 dòng) - Brand, Mode dropdown, Navigator, Actions
│   ├── SidebarDrawer.tsx             (~110 dòng) - Danh sách thumbnail trang & real-time badges
│   ├── DraggableSplitter.tsx         (~85 dòng)  - Splitter bar, pointer capture, rAF resize
│   ├── ApiKeyWarningBanner.tsx       (~50 dòng)  - Cảnh báo chưa có API key
│   ├── PageRenderer.tsx              (~125 dòng) - Original PDF Canvas & HiDPI rasterization
│   └── FlowBlock.tsx                 (~95 dòng)  - Overlay câu trong suốt & hover sync
├── hooks/
│   ├── usePdfDocument.ts             (~120 dòng) - Load PDF, metadata, fit scales, resize
│   ├── useSettingsManager.ts         (~160 dòng) - Settings state, auto-save, key management
│   ├── useVisionWorkerQueue.ts       (~280 dòng) - Dual-priority queue, multi-workers, 429 guard
│   └── useSyncScroll.ts              (~260 dòng) - Page-to-page sync, zoom factor, ceiling-lock
├── CustomSelect.tsx                  (Đã có sẵn)
├── PdfSnippet.tsx                    (Đã có sẵn)
├── VisionPageRenderer.tsx            (Đã có sẵn)
├── WhiteboardPageRenderer.tsx        (Đã có sẵn)
├── style.css                         (Đã có sẵn)
└── main.tsx                          (~220 dòng)  - App Shell tinh gọn kết nối hooks & layout
```

### 4.2. Khung Thiết kế (Design Contract) của `main.tsx` mới (< 250 dòng)

```tsx
export function ViewerApp() {
  // 1. Quản lý tài liệu PDF & Tỷ lệ hiển thị
  const { pdfDoc, pdfUrl, docTitle, numPages, errorMsg, leftFitScale, rightFitScale } = usePdfDocument();

  // 2. Quản lý cấu hình & API Keys
  const {
    settings, updateSettingDirect, isSettingsOpen, setIsSettingsOpen,
    activeSettingsTab, setActiveSettingsTab, showAutoSaveBadge,
    keyItems, newKeyProvider, setNewKeyProvider, newKeyText, setNewKeyText,
    handleAddKey, handleRemoveKey, hasActiveKey, modalProviderKeys,
    isPostSavePromptOpen, setIsPostSavePromptOpen
  } = useSettingsManager();

  // 3. Quản lý Hàng đợi & Worker Vision AI
  const {
    pageVisionTranslations, pageVisionStatus, activePriorityPages,
    pendingPriorityPages, pageVisionErrors, prioritizeVisionPage,
    debouncedPrioritizePage, retryVisionPage, retranslateAllVision, processVisionQueue
  } = useVisionWorkerQueue({ pdfDoc, pdfUrl, numPages, settings, hasActiveKey });

  // 4. Quản lý Cuộn Đồng bộ & Khóa Trần
  const {
    leftPaneRef, rightPaneRef, leftZoomFactor, rightZoomFactor,
    setLeftZoomFactor, setRightZoomFactor, effectiveLeftScale, effectiveRightScale,
    handleLeftScroll, handleRightScroll
  } = useSyncScroll({ viewMode, numPages, readerMode, debouncedPrioritizePage });

  // Render App Shell cực kỳ tinh gọn...
}
```

Tất cả các tệp mới đều nằm trong ngưỡng an toàn **< 300 dòng**, tuân thủ tuyệt đối quy định không có file nào vượt quá 400 dòng của dự án.

---

## 5. Verification Method (Phương pháp Kiểm chứng Độc lập)

Để kiểm chứng tính chính xác của khảo sát và đảm bảo không có bất kỳ hồi quy nào sau khi thực hiện kế hoạch:

1. **Kiểm tra tính toàn vẹn của mã nguồn & kiểu dữ liệu**:
   ```powershell
   npm.cmd run typecheck --prefix extension
   npm.cmd run lint --prefix extension
   ```
   *Yêu cầu đạt được*: 0 lỗi TypeScript, 0 cảnh báo ESLint.

2. **Kiểm tra bộ Unit Tests toàn diện (161 tests)**:
   ```powershell
   npm.cmd test --prefix extension
   ```
   *Yêu cầu đạt được*: 23/23 test files passed, 161/161 tests passed.

3. **Kiểm tra quy trình CI tổng thể**:
   ```powershell
   npm.cmd run check --prefix extension
   ```
   *Yêu cầu đạt được*: Build WXT, typecheck, lint và test đều kết thúc với exit code 0.

4. **Kiểm tra chức năng thực tế trên trình duyệt (Visual & Interaction Inspection)**:
   - Mở viewer với file PDF test (ví dụ `?url=...`).
   - Kiểm tra cuộn đồng bộ: Cuộn chuột trên khung dịch phải có khóa trần tại đỉnh mỗi trang; cuộn ở lề đen 2 bên sườn phải lướt tự do.
   - Kiểm tra Settings Modal: Thay đổi Theme (5 màu), đổi Font family, kéo Slider Font Scale, thêm/xóa API key có hiển thị badge "Đã tự động lưu".
   - Kiểm tra thanh Splitter kéo sang trái/phải chia lại tỷ lệ mượt mà mà không giật lag.
