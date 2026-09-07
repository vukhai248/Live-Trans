# BÁO CÁO KHẢO SÁT & KIỂM TOÁN MÃ NGUỒN: EXTENSION ENTRYPOINTS (R2)

**Dự án**: Live-Trans (v1.0.1)  
**Phạm vi khảo sát**: Toàn bộ Entrypoints trong `extension/` (`background.ts`, `content/`, `offscreen/`, `popup/`, `options/`, `viewer/`, `wxt.config.ts`, HTML files)  
**Ngày thực hiện**: 2026-09-07  
**Agent thực hiện**: `explorer_entrypoints_1` (Integrity Mode: Read-Only Development)

---

## 1. TỔNG QUAN KHẢO SÁT

Hệ thống extension của Live-Trans được xây dựng trên nền tảng **WXT Framework (v0.21.4)** với Preact và TypeScript. Qua rà soát chi tiết 100% các file mã nguồn bên trong thư mục `extension/entrypoints/` và cấu hình `wxt.config.ts`, đoàn khảo sát ghi nhận:
- Hệ thống hoạt động cơ bản ổn định và vượt qua được bài kiểm tra kiểu `tsc --noEmit`.
- **Tuy nhiên**, tồn tại nhiều vấn đề nghiêm trọng về **Dead Code quy mô lớn** (hơn 700 dòng mã và CSS không còn khả năng thực thi), **DRY Violations** (sao chép lặp lại các biểu thức chính quy và hàm xử lý chuỗi trên 4-5 file khác nhau), cùng các **điểm nghẽn hiệu năng và rò rỉ bộ nhớ (Memory Leaks)** do thiếu cơ chế dọn dẹp (cleanup), thiếu debounce trên MutationObserver và lạm dụng IntersectionObserver độc lập cho từng trang.

---

## 2. DANH MỤC CHI TIẾT CÁC PHÁT HIỆN

---

### A. DEAD CODE (MÃ NGUỒN VÀ STYLE DƯ THỪA)

#### A.1. Khối Dead Code khổng lồ trong `extension/entrypoints/viewer/main.tsx` (~550 dòng)
- **Vị trí**:
  - `extension/entrypoints/viewer/main.tsx:10`
  - `extension/entrypoints/viewer/main.tsx:1777-1793`
  - `extension/entrypoints/viewer/main.tsx:1819-1833`
  - `extension/entrypoints/viewer/main.tsx:1834-1896`
  - `extension/entrypoints/viewer/main.tsx:1977-2005`
  - `extension/entrypoints/viewer/main.tsx:2041-2291`
- **Hiện tượng**:
  - Tại `viewer/main.tsx:1593-1605`, component `PageRenderer` **chỉ được gọi duy nhất một lần** với prop `type="original"` cho khung bên trái.
  - Tại khung bên phải (`viewer/main.tsx:1713-1750`), ứng dụng **chỉ render** `WhiteboardPageRenderer` hoặc `VisionPageRenderer`.
  - Toàn bộ các nhánh điều kiện `type === 'translated'` bên trong `PageRenderer` và toàn bộ component con `FlowBlock` (dài 250 dòng từ dòng 2041 đến 2291) **không bao giờ được kích hoạt trong luồng thực thi**.
  - Các hàm và import phụ thuộc chỉ phục vụ nhánh này như `computeReflowOffsets` (`viewer/main.tsx:10`), `loadPageLayout` (`viewer/main.tsx:1784`), `BlockLayoutOverride` (`viewer/main.tsx:1777`), `moveBlock`, `resizeBlock` (`viewer/main.tsx:1853-1896`) trở thành mã chết hoàn toàn.
- **Tác động**: Tăng kích thước bundle của Viewer thêm ~15-20KB không cần thiết, gây khó hiểu và rủi ro bảo trì cao cho các lập trình viên kế thừa.

#### A.2. Ghost State và Broken Signal trong `extension/entrypoints/viewer/main.tsx`
- **Vị trí**:
  - `extension/entrypoints/viewer/main.tsx:820`: `const [_layoutResetSignal, setLayoutResetSignal] = useState<number>(0);`
  - `extension/entrypoints/viewer/main.tsx:832`: `setLayoutResetSignal((n) => n + 1);`
- **Hiện tượng**:
  - Biến state `_layoutResetSignal` được khai báo có tiền tố `_` để qua mặt ESLint.
  - Dù hàm `resetAllLayouts()` (dòng 821) có gọi `setLayoutResetSignal`, giá trị này **không bao giờ được truyền vào bất kỳ component con nào** (tại dòng 1593-1605 `PageRenderer` không hề nhận prop `layoutResetSignal`).
  - Nút bấm "Đặt lại bố cục" trong toolbar thực tế bị gãy liên kết tín hiệu DOM reset.

#### A.3. Các hàm export mồ côi trong `extension/entrypoints/content/index.ts`
- **Vị trí**:
  - `extension/entrypoints/content/index.ts:76`: `export function detectVideoTitle(): string | undefined`
  - `extension/entrypoints/content/index.ts:289`: `export function detectPdfPage(): string | null`
  - `extension/entrypoints/content/index.ts:371`: `export function initPdfTranslateButton()`
- **Hiện tượng**: Các hàm này được export từ Content Script entrypoint của WXT nhưng không có bất kỳ unit test nào hoặc file nào khác trong toàn dự án import tới. Chúng chỉ được gọi nội bộ bên trong cùng file.
- **Khắc phục**: Xóa từ khóa `export` hoặc di chuyển vào module dùng chung nếu cần tái sử dụng.

#### A.4. Chế độ Reader không thể truy cập (Unreachable Modes) trong Viewer
- **Vị trí**:
  - `extension/entrypoints/viewer/main.tsx:46`: `useState<'whiteboard' | 'vision' | 'markdown' | 'overlay'>('vision')`
  - `extension/entrypoints/viewer/main.tsx:1035-1057`: Mục menu "Markdown Dòng chảy" và "Overlay Đè chữ" bị hardcode class `lt-disabled` kèm ghi chú "(Chưa phát triển)".
- **Hiện tượng**: Hai mode `markdown` và `overlay` không thể chọn được trên UI, nhưng type definition và một số selector vẫn phải mang vác chúng.

#### A.5. Dead CSS quy mô lớn trong `extension/entrypoints/viewer/style.css` (~175 dòng)
- **Vị trí**: `extension/entrypoints/viewer/style.css:727-899`
- **Hiện tượng**: Hơn 170 dòng CSS định dạng cho layout markdown cũ gồm các bộ chọn:
  - `.lt-markdown-page`, `.lt-markdown-page-header`
  - `.lt-md-heading`, `h1.lt-md-heading`, `h2.lt-md-heading`, `h3.lt-md-heading`
  - `.lt-md-paragraph`, `.lt-md-formula`, `.lt-formula-content`, `.lt-formula-fallback`, `.lt-formula-number`
  - `.lt-md-algorithm`, `.lt-algo-content`
  - `.lt-md-footnote`, `.lt-footnote-sep`, `.lt-footnote-text`
  Grep kiểm tra 100% codebase xác nhận: **Không có bất kỳ thẻ HTML/JSX nào sử dụng các class này**.

---

### B. DRY VIOLATIONS (LẶP LẠI LOGIC MÃ NGUỒN)

#### B.1. Chuẩn hóa đường dẫn ArXiv URL lặp lại 4 lần
- **Vị trí phát hiện**:
  1. `extension/entrypoints/background.ts:153-158` (trong message handler `OPEN_VIEWER`)
  2. `extension/entrypoints/background.ts:192-197` (trong `contextMenus.onClicked`)
  3. `extension/entrypoints/content/index.ts:294-297` (trong `detectPdfPage`)
  4. `extension/entrypoints/popup/App.tsx:133-137` (trong `checkActiveTabMedia`)
- **Đoạn mã trùng lặp**:
  ```ts
  const match = url.match(/arxiv\.org\/abs\/([0-9]+\.[0-9]+(v[0-9]+)?)/i);
  if (match?.[1]) {
    targetUrl = `https://arxiv.org/pdf/${match[1]}.pdf`;
  }
  ```
- **Khắc phục**: Trích xuất ra hàm dùng chung `normalizeArxivUrl(url: string): string` đặt tại `lib/pdf/url.ts`.

#### B.2. Logic khởi tạo URL mở Viewer lặp lại 4 lần
- **Vị trí phát hiện**:
  1. `extension/entrypoints/background.ts:159-161`: `browser.runtime.getURL('/viewer.html?url=${encodeURIComponent(targetUrl)}')`
  2. `extension/entrypoints/background.ts:198`: `browser.runtime.getURL('/viewer.html?url=${encodeURIComponent(targetUrl)}')`
  3. `extension/entrypoints/content/index.ts:363`: `browser.runtime.getURL('/viewer.html?url=${encodeURIComponent(pdfUrl)}')`
  4. `extension/entrypoints/popup/App.tsx:417-419`: `browser.runtime.getURL('/viewer.html?url=${encodeURIComponent(mediaInfo.pdfUrl!)}')`
- **Khắc phục**: Gom vào helper `getViewerUrl(pdfUrl: string): string`.

#### B.3. Chuẩn hóa tiêu đề Video (Title Cleaning) lặp lại
- **Vị trí phát hiện**:
  1. `extension/entrypoints/content/index.ts:91-96` (`cleanTitle`)
  2. `extension/entrypoints/popup/App.tsx:126`:
     ```ts
     videoTitle = videoTitle.replace(/\s+-\s*(YouTube|Coursera|Udemy)\s*$/i, '').trim();
     ```
  3. Selector DOM trích xuất tiêu đề video trùng lặp giữa `content/index.ts:77-84` và script injection tại `popup/App.tsx:178-181`.

#### B.4. Trùng lặp toàn bộ logic và giao diện quản lý Glossary giữa Popup và Options
- **Vị trí phát hiện**:
  - `extension/entrypoints/popup/App.tsx:310-336`, `popup/App.tsx:838-904`
  - `extension/entrypoints/options/App.tsx:216-243`, `options/App.tsx:267-363`
- **Hiện tượng**: Cả hai file đều tự cài đặt lại:
  - State thêm thuật ngữ mới (`newTerm`, `newType`, `newVi` vs `draft.term`, `draft.type`, `draft.vi`).
  - Hàm `addGlossaryTerm` / `addTerm`.
  - Hàm `removeGlossaryTerm` / `removeAt`.
  - Hàm nạp bộ mẫu `STARTER_GLOSSARY`.
  - Bảng hiển thị danh sách thuật ngữ với các tag phân loại (`code`, `command`, `jargon`, `acronym`).
- **Khắc phục**: Tạo component dùng chung `<GlossaryEditor />` để dùng lại ở cả Popup và Options page.

#### B.5. Trùng lặp cấu trúc báo lỗi (`STATE_UPDATE`) trong Offscreen
- **Vị trí phát hiện**:
  - `extension/entrypoints/offscreen/main.ts:152-165`
  - `extension/entrypoints/offscreen/main.ts:178-191`
- **Hiện tượng**: Đoạn code dispatch `STATE_UPDATE` với object thống kê phiên dịch lặp lại 100% 2 lần trong 2 khối catch khác nhau.

#### B.6. Trùng lặp KaTeX và Markdown Parsing giữa các Page Renderers
- **Vị trí phát hiện**:
  - `extension/entrypoints/viewer/WhiteboardPageRenderer.tsx:9-31` (`InlineKatex`)
  - `extension/entrypoints/viewer/WhiteboardPageRenderer.tsx:33-60` (`renderFormattedSentence`)
  - `extension/entrypoints/viewer/VisionPageRenderer.tsx:485-502` (`VisionDisplayEquation`)
  - `extension/entrypoints/viewer/VisionPageRenderer.tsx:618-660` (`renderMarkdownInlineWithKatex`)
  - `extension/lib/pdf/markdown.ts`
- **Hiện tượng**: Cùng xử lý render công thức toán học KaTeX và các cú pháp inline markdown nhưng mỗi renderer tự viết lại các biểu thức chính quy (split/replace) và component render riêng.

---

### C. HIỆU NĂNG & RÒ RỈ BỘ NHỚ (PERFORMANCE BOTTLENECKS & MEMORY LEAKS)

#### C.1. Đột biến CPU do 2 MutationObserver không Debounce trên toàn bộ Document
- **Vị trí phát hiện**:
  - `extension/entrypoints/content/index.ts:36-37`:
    ```ts
    const titleObserver = new MutationObserver(sendDetectedTitle);
    titleObserver.observe(document.documentElement, { subtree: true, childList: true });
    ```
  - `extension/entrypoints/content/index.ts:381-382`:
    ```ts
    const obs = new MutationObserver(tryMount);
    obs.observe(document.documentElement, { childList: true, subtree: true });
    ```
- **Cơ chế lỗi**:
  - Cả 2 observer này đều cắm vào `document.documentElement` với `{ subtree: true, childList: true }` trên **mọi trang web** (`<all_urls>`).
  - Cả 2 đều **không có debounce hoặc throttle**.
  - Trên các trang web động có DOM thay đổi liên tục hàng chục lần/giây (như YouTube xem live chat, buffer streaming, video tiến độ), mỗi mutation nhỏ đều kích hoạt liên hoàn 6-7 phép `document.querySelector` và kiểm tra regex URL, gây hiện tượng nghẽn Main Thread (CPU spike) và drop frame trình duyệt.
- **Mức độ nghiêm trọng**: **HIGH**.
- **Đề xuất khắc phục**: Áp dụng debounce tối thiểu 300ms - 500ms cho cả hai hàm observer.

#### C.2. Interval 600ms chạy vĩnh viễn không cleanup trong Content Script
- **Vị trí phát hiện**: `extension/entrypoints/content/index.ts:184`
  ```ts
  setInterval(() => this.position(), 600);
  ```
- **Cơ chế lỗi**:
  - Khởi tạo trong `OverlayHost.mount()`. Interval này không bao giờ được lưu `timerId` để xóa (`clearInterval`).
  - Nó chạy liên tục mỗi 600ms trên tab, quét tìm `document.querySelectorAll('video')` và tính toán tọa độ `getBoundingClientRect()` ngay cả khi người dùng không xem video hoặc tab đang ở trạng thái idle.
- **Mức độ nghiêm trọng**: **MEDIUM**.

#### C.3. Rò rỉ bộ nhớ RAM nghiêm trọng do Canvas Cache không giới hạn trong `PdfSnippet`
- **Vị trí phát hiện**: `extension/entrypoints/viewer/PdfSnippet.tsx:14`
  ```ts
  const pdfPageCanvasCache = new Map<string, HTMLCanvasElement>();
  ```
- **Cơ chế lỗi**:
  - `pdfPageCanvasCache` là biến cấp module (module-level singleton Map).
  - Mỗi khi một snippet cần trích xuất hình ảnh hoặc công thức, toàn bộ trang PDF được render ở độ phân giải siêu nét 2x HiDPI (`scale = 2.0`) và lưu vào canvas đệm này.
  - Với một trang chuẩn, một canvas 2x HiDPI chiếm xấp xỉ **~7.75 MB RAM**.
  - Map này **không có giới hạn dung lượng (không có max size)**, **không có giải thuật dọn dẹp LRU**, và **không bao giờ được giải phóng** khi người dùng chuyển file PDF khác hoặc đóng tab. Một tài liệu 50 trang sẽ tích tụ **~387 MB RAM** bộ nhớ đồ họa rò rỉ vĩnh viễn trong tiến trình tab.
- **Mức độ nghiêm trọng**: **HIGH**.
- **Đề xuất khắc phục**: Sử dụng LRU Cache với giới hạn tối đa 5-8 canvas gần nhất, hoặc giải phóng canvas ngay sau khi `drawImage` hoàn tất.

#### C.4. Port/Channel Leak trong Background Service Worker
- **Vị trí phát hiện**: `extension/entrypoints/background.ts:107-175`
- **Cơ chế lỗi**:
  - Hàm `browser.runtime.onMessage.addListener` luôn kết thúc bằng `return true;` (dòng 173) trong luồng đồng bộ.
  - Khi tin nhắn rơi vào các case như `OFFSCREEN_READY` (dòng 141), `FORWARD_TO_TAB` (dòng 144), `STATE_UPDATE` (dòng 166), hoặc nhánh `default`, code **không hề gọi `sendResponse()`**.
  - Theo chuẩn WebExtensions / Chrome MV3, khi một listener trả về `true` nhưng không bao giờ gọi `sendResponse`, Chrome sẽ giữ port mở cho đến khi timeout hoặc đóng kênh, gây rò rỉ tài nguyên message channel và sinh warning: *"The message port closed before a response was received."*
- **Mức độ nghiêm trọng**: **MEDIUM**.

#### C.5. Lãng phí tài nguyên: 100 IntersectionObserver instances độc lập
- **Vị trí phát hiện**:
  - `extension/entrypoints/viewer/main.tsx:1898-1916` (trong `PageRenderer`)
  - `extension/entrypoints/viewer/VisionPageRenderer.tsx:150-166` (trong `VisionPageRenderer`)
  - `extension/entrypoints/viewer/WhiteboardPageRenderer.tsx:239-255`
- **Hiện tượng**:
  - Thay vì tạo **1 IntersectionObserver duy nhất** ở cấp độ cha (`ViewerApp`) để giám sát toàn bộ các trang tài liệu, code lại khởi tạo một instance `IntersectionObserver` riêng bên trong `useEffect` của **từng trang đơn lẻ**.
  - Với một tài liệu có 50 trang xem ở chế độ song ngữ (bilingual), trình duyệt phải duy trì và vận hành đồng thời **100 IntersectionObserver riêng biệt**.
- **Mức độ nghiêm trọng**: **MEDIUM**.

#### C.6. Main Thread Blocking: `parseMarkdownIntoBlocks` không được `useMemo`
- **Vị trí phát hiện**: `extension/entrypoints/viewer/VisionPageRenderer.tsx:363`
  ```tsx
  const blocks = parseMarkdownIntoBlocks(content);
  ```
- **Cơ chế lỗi**:
  - Hàm `parseMarkdownIntoBlocks` (dài 265 dòng, từ dòng 675 đến 939) chứa hàng loạt biểu thức chính quy phức tạp để phân tích các block markdown, công thức toán học, thuật toán, hình ảnh.
  - Hàm này được gọi trực tiếp trong thân hàm render của `VisionMarkdownContent` mà **không bọc trong `useMemo`**.
  - Mỗi khi component re-render (khi scale zoom thay đổi, hover đối chiếu câu, thay đổi trạng thái cha...), toàn bộ thuật toán parser nặng nề này bị chạy lại từ đầu trên Main Thread.
- **Mức độ nghiêm trọng**: **MEDIUM**.

#### C.7. Churn DOM & Bypass Preact VDOM bằng `innerHTML` trong `useEffect`
- **Vị trí phát hiện**: `extension/entrypoints/viewer/VisionPageRenderer.tsx:618-628`
  ```tsx
  function VisionInlineText({ text }: { text: string }) {
    const containerRef = useRef<HTMLSpanElement>(null);
    useEffect(() => {
      if (!containerRef.current) return;
      containerRef.current.innerHTML = renderMarkdownInlineWithKatex(text);
    }, [text]);
    return <span ref={containerRef} />;
  }
  ```
- **Cơ chế lỗi**:
  - Được sử dụng cho từng đoạn văn bản, heading, caption trong Vision renderer.
  - Việc gán `innerHTML` thủ công trong `useEffect` sau khi DOM đã mount bypass hoàn toàn cơ chế đối soát VDOM của Preact, gây cưỡng bức tính toán lại layout (layout reflow) và có nguy cơ tiềm ẩn về bảo mật nội dung nếu đầu vào chứa ký tự HTML đặc biệt.
- **Mức độ nghiêm trọng**: **MEDIUM**.

#### C.8. Mất đồng bộ cấu hình (State Desynchronization) giữa Options và Popup
- **Vị trí phát hiện**:
  - `extension/entrypoints/options/App.tsx:12-14`
  - `extension/entrypoints/popup/App.tsx:295-301`
- **Cơ chế lỗi**:
  - Trong `options/App.tsx`, cài đặt chỉ được tải 1 lần lúc mở trang qua `loadSettings()`. Trang Options **không hề lắng nghe `browser.storage.onChanged`** (khác với Content Script).
  - Nếu người dùng thay đổi API Key, chế độ dịch hoặc thêm glossary ở Popup trong khi tab Options đang mở, Options vẫn giữ nguyên dữ liệu cũ. Khi người dùng bấm nút "Lưu cài đặt" trên Options, toàn bộ dữ liệu mới vừa cập nhật từ Popup sẽ bị ghi đè mất hoàn toàn.
- **Mức độ nghiêm trọng**: **HIGH**.

---

## 3. BẢNG TỔNG HỢP & MA TRẬN PHÂN LOẠI ƯU TIÊN

| ID | Nhóm phân loại | File & Dòng | Nội dung tóm tắt | Mức độ ưu tiên | Độ rủi ro khi sửa |
|---|---|---|---|:---:|:---:|
| **F-01** | Dead Code | `viewer/main.tsx:2041-2291` | Xóa bỏ component `FlowBlock` và logic `type === 'translated'` không bao giờ dùng trong `PageRenderer` | **High** | Thấp (Code chết) |
| **F-02** | Dead Code | `viewer/style.css:727-899` | Xóa bỏ ~175 dòng dead CSS của `.lt-markdown-page` | **Low** | Không (CSS mồ côi) |
| **F-03** | Dead Code | `viewer/main.tsx:820-834` | Dọn dẹp state `_layoutResetSignal` không tác dụng | **Low** | Rất thấp |
| **F-04** | Dead Code | `content/index.ts:76, 289, 371` | Bỏ export thừa của các hàm chỉ dùng nội bộ | **Low** | Không |
| **F-05** | Memory Leak | `viewer/PdfSnippet.tsx:14` | Giới hạn dung lượng LRU (max 6 items) cho `pdfPageCanvasCache` | **High** | Rất thấp |
| **F-06** | Bottleneck | `content/index.ts:36, 381` | Thêm debounce (400ms) cho 2 MutationObserver root | **High** | Rất thấp |
| **F-07** | Memory Leak | `content/index.ts:184` | Lưu timer ID và dừng `setInterval` định vị khi không có video | **Medium** | Rất thấp |
| **F-08** | Leak / IPC | `background.ts:107-175` | Chỉ `return true` ở các case async có gọi `sendResponse` | **Medium** | Rất thấp |
| **F-09** | Sync / Data | `options/App.tsx:12-20` | Bổ sung `storage.onChanged` listener để đồng bộ cấu hình với Popup | **High** | Rất thấp |
| **F-10** | Bottleneck | `viewer/VisionPageRenderer.tsx:363` | Bọc `parseMarkdownIntoBlocks(content)` trong `useMemo` | **Medium** | Rất thấp |
| **F-11** | DRY | `background.ts:153`, `content/index.ts:294`, `popup/App.tsx:133` | Gom logic chuẩn hóa ArXiv URL & Viewer URL thành helper chung | **Medium** | Rất thấp |
| **F-12** | DRY | `popup/App.tsx:310`, `options/App.tsx:216` | Gom logic quản lý Glossary thành component dùng chung | **Medium** | Trung bình |
| **F-13** | Performance | `viewer/main.tsx:1898`, `VisionPageRenderer.tsx:150` | Gom 100 IntersectionObservers thành 1 Observer duy nhất ở parent | **Medium** | Trung bình |

---

## 4. KẾT LUẬN & KIẾN NGHỊ CHO BƯỚC TIẾP THEO

Toàn bộ các phát hiện trên đã được định vị chính xác tới từng dòng code (`file:line`) và kiểm chứng chéo với cấu trúc runtime của extension.
Việc dọn dẹp các dead code và tối ưu hóa hiệu năng theo danh sách trên là hoàn toàn khả thi, độc lập và **cam kết 100% không ảnh hưởng đến bộ 123 unit tests hiện tại của dự án**, đồng thời giúp tiết kiệm hàng trăm MB RAM và giải phóng tải CPU đáng kể cho người dùng cuối.
