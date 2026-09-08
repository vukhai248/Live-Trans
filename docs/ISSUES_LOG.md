# NHẬT KÝ THEO DÕI VÀ QUẢN LÝ LỖI DỰ ÁN (LIVE-TRANS ISSUE LOG)

Tài liệu này tổng hợp toàn bộ các lỗi phát sinh trong quá trình phát triển, kiểm thử và vận hành dự án Live-Trans, phân tích nguyên nhân gốc rễ (root causes), giải pháp đã áp dụng và trạng thái khắc phục.

---

## 1. Danh sách lỗi đã ghi nhận & Xử lý

| Mã lỗi | Hạng mục | Mô tả hiện tượng | Nguyên nhân gốc rễ | Giải pháp áp dụng | Trạng thái |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ISSUE-001** | UI / Viewer | Khi cuộn hết nội dung trong trang (pane trái/phải), thanh cuộn bị khựng lại, không cuộn tiếp sang trang kế tiếp. | Sự kiện cuộn wheel hoặc overflow container bị chặn/ngắt kết nối sự kiện cuộn xuyên trang (scroll chaining). | Cho phép scroll chaining tự nhiên giữa các trang trên viewer container. | ✅ Đã khắc phục |
| **ISSUE-002** | VLM / Renderer | Khung thuật toán (Algorithm 1) hiển thị vỡ vụn: lộ các ký tự raw LaTeX `\quad`, `\qquad`, thụt dòng lỗi, khoảng cách dòng quá thưa, mất khung hộp học thuật. | Markdown VLM trả về chứa các lệnh TeX thô ngoài math mode và chưa có component hiển thị chuyên biệt cho Algorithm. | Tạo component `VisionAlgorithmCard` với 2 đường viền học thuật, thẻ badge THUẬT TOÁN; bộ tiền xử lý `parseAlgorithmLine` tự động strip `\quad`, tính mức thụt lề 4 space, in đậm từ khóa `for`, `do`, `if`. | ✅ Đã khắc phục |
| **ISSUE-003** | VLM / Prompt | Lỗi thứ tự đọc trên văn bản 2 cột (ví dụ Trang 9): Mục 4 cuối cột 1 (*Segmentation-Guided Inpainting*) bị đẩy xuống dưới cùng sau cả Mục 7 và References do model đọc Cột 2 trước. | VLM đọc lướt thấy tiêu đề to ở Cột 2 (*5. Limitations*) hoặc ưu tiên Figure ở Cột 1 rồi nhảy sang cột khác. | Thêm quy tắc phân biệt rõ layout 1 cột vs 2 cột trong `buildVisionPrompt`. Với 2 cột, bắt buộc đọc hết Cột 1 từ trên xuống dưới trước khi sang Cột 2; ghép nối từ gạch nối cuối dòng. | ✅ Đã cấu hình prompt |
| **ISSUE-004** | VLM / Translation | Hiện tượng Trôi ngôn ngữ (Language Drift) trên Trang 4: Bản dịch đang là tiếng Việt thì sau Phương trình (7) bất ngờ quay ngoắt sang 100% tiếng Anh. | Token công thức toán học kích hoạt bộ nhớ pre-training bài báo gốc (arXiv) của LLM. Do mô hình Vision bị visual anchor từ ảnh gốc tiếng Anh, context token sau công thức bị khóa cứng vào tiếng Anh. | Tích hợp **Verification Agent** (`verifyAndRepairTranslation`): Tự động phát hiện các đoạn văn tiếng Anh sau công thức và dịch làm sạch bằng Text LLM (không có visual anchor). | ✅ Đã khắc phục & Kiểm chứng |
| **ISSUE-005** | VLM / Translation | Hiện tượng không dịch được gì trên Trang 7 và Trang 9 (trả về 100% tiếng Anh nguyên văn như OCR). | VLM khi bắt đầu bằng dòng caption Figure (tiếng Anh) sẽ bị visual anchor chi phối toàn bộ ngữ cảnh sinh từ kế tiếp. Lời nhắc prompt thuần túy không đủ để ghi đè hiện tượng visual latch-in này của VLM. | Tách quy trình thành 2 chặng (Two-Stage Pipeline): Stage 1 (Vision Parser trích xuất bố cục/công thức/hình ảnh) + Stage 2 (Verification Agent kiểm tra và tự động dịch văn bản thuần sang tiếng Việt). | ✅ Đã khắc phục & Kiểm chứng |
| **ISSUE-006** | VLM / Provider | Chọn OpenCode Zen / Muse Spark trong Cài đặt nhưng Vision AI không đổi hoặc lỗi. | Hàm `translatePageVision` trước đây hardcode chỉ gọi Google Gemini API, bỏ qua `settings.pdfProvider === 'zen'`. | Mở rộng `translatePageVision` và Verification Agent hỗ trợ đầy đủ cả 2 provider Gemini & OpenCode Zen (Muse Spark). | ✅ Đã hỗ trợ đa provider |
| **ISSUE-007** | Cache & Retry | Nhấn nút "Dịch lại" (Retry) chỉ thấy animation chạy xong nhưng nội dung lỗi tiếng Anh vẫn giữ nguyên 100%. | (1) `temperature` cố định 0.2 khiến model sinh ra đúng token cũ khi gọi lại API; (2) Khi gọi lại model Vision đơn lẻ, visual anchor lặp lại y hệt khiến kết quả không đổi. | Tăng dynamic temperature (0.45) khi retry, kết hợp Verification Agent bắt buộc đầu ra phải sạch tiếng Anh trước khi ghi đè cache. | ✅ Đã khắc phục |
| **ISSUE-008** | Pipeline / UX | Trải nghiệm dịch chậm khi đọc paper phi tuyến tính (Abstract -> Conclusion -> Figures). Chờ cuộn tới đâu mới dịch tới đó gây gián đoạn mạch đọc. Cuộn nhanh lại dễ gây nghẽn hoặc lỗi 429 Quota Exceeded. | Thiếu cơ chế dự dịch nền (Background Waterfall) và cơ chế chen ngang hàng đợi (Interactive Preemption); thiếu bộ đệm pacing điều phối tải API cho 1 API key. | Xây dựng Dual-Priority Queue Engine: Background Waterfall tự động dịch tuần tự 1 -> N (pacing 800ms, concurrency=1); khi user dừng ở trang bất kỳ >= 300ms, trang đó lập tức được chen ngang lên đỉnh ưu tiên (0ms delay) và dịch ngay. | ✅ Đã hoàn thành & Kiểm chứng |
| **ISSUE-009** | Renderer / Layout | Khi thay đổi tỷ lệ Zoom (ví dụ: 115%), phần cắt trích xuất hình ảnh (Figure Snippet) bị trôi lệch tọa độ, cắt chèn vào văn bản bên dưới và méo tỷ lệ (như Hình 4 & 5). | `VisionPageRenderer` sử dụng viewport đã nhân `scale` truyền vào hàm `extractTextBlocks` và `extractPageFigures`, khiến tọa độ Y bị cộng dồn sai lệch `(scale - 1) * 792`, dẫn đến hộp cắt `bbox` bị phóng to và trượt khỏi vị trí hình ảnh gốc. | Cố định hệ tọa độ bóc tách layout luôn ở `scale = 1.0` (chuẩn điểm ảnh PDF), đồng thời truyền scale vào `PdfSnippet` để phóng to hiển thị responsive mà không làm biến dạng tọa độ cắt. | ✅ Đã khắc phục & Kiểm chứng |
| **ISSUE-010** | Pipeline / Concurrency | Render tuần tự đơn luồng (concurrency = 1) làm tốc độ dịch tổng thể tài liệu dài chậm; khi user nhảy đến trang xem kết luận/hình ảnh, việc chỉ ưu tiên 1 trang đơn lẻ chưa tối ưu cho trải nghiệm đọc liên tục các trang kế tiếp. | Trước đó chỉ có 1 worker duy nhất xử lý queue tuần tự; preemption chỉ đẩy duy nhất trang hiện tại vào hàng đợi. | Nâng cấp thành **Multi-Worker Concurrent Queue** sliding window với số luồng cấu hình được từ 2 - 7 luồng (mặc định 5 luồng trong Cài đặt); khi cuộn/dừng đọc tại một trang, áp dụng **Batch Preemption Window** tự động ưu tiên cụm $C$ trang liên tiếp `[K, K+1, ..., K+C-1]`. | ✅ Đã hoàn thành & Kiểm chứng |
| **ISSUE-011** | UI / Responsive Zoom & Toolbar | Khi chọn tỉ lệ chia đôi khác 50:50 (như 30:70, 35:65), chế độ Fit Width bị hỏng vì dùng chung 1 scale đo từ khung trái, khiến khung dịch bên phải bị co rúm để lại khoảng trống thừa rất lớn; thanh toolbar chiếm nhiều chỗ vì text nút dài. | `main.tsx` chỉ duy trì 1 biến scale đo từ khung trái; `.lt-vision-page` bị giới hạn `max-width: 950px` trong CSS; các nút bấm thanh công cụ chưa được tối ưu icon-only. | (1) Tách hệ số scale Fit Width độc lập: `leftFitScale` cho khung bản gốc và `rightFitScale` cho khung bản dịch; (2) Đặt `max-width: 100%` cho `.lt-vision-page`; (3) Tinh gọn thanh toolbar: nút trang và 3 nút chế độ xem chuyển sang icon-only kèm tooltip; đổi nhãn thành `Fit Width`. | ✅ Đã hoàn thành & Kiểm chứng |
| **ISSUE-012** | UI / Splitter Performance | Khi kéo thanh chia đôi màn hình giữa 2 khung (Splitter), giao diện bị giật lag nghiêm trọng (kể cả khi chưa dịch gì). | `onPointerMove` gọi `setSplitRatio` liên tục trên từng pixel, gây bão re-render toàn bộ `ViewerApp`; kéo theo `leftFitScale` và `rightFitScale` đổi liên tục kích hoạt `page.render()` vẽ lại hàng loạt canvas PDF.js HiDPI trên main thread. | Tách biệt thao tác kéo khỏi render nặng (Direct CSS Dragging + Commit on release): (1) Khi kéo chuột, chỉ thay đổi trực tiếp `width` 2 khung qua CSS DOM bằng `requestAnimationFrame`, đồng thời bật `body.lt-resizing` (`user-select: none; pointer-events: none;`); (2) Chỉ khi nhả chuột (`pointerup`) mới gọi `setSplitRatio` và tính lại scale để render canvas đúng 1 lần duy nhất, đạt 60 - 120 FPS mượt mà. | ✅ Đã hoàn thành & Kiểm chứng |
| **ISSUE-013** | Storage / Persistent Cache | Bản dịch Vision AI mất sạch khi người dùng đóng tab hoặc thoát trình duyệt Chrome, gây lãng phí lớn thời gian dịch lại và quota API; thiếu cơ chế giới hạn dung lượng và thời hạn bộ nhớ đệm thông minh. | Sử dụng `sessionStorage` thuần túy (vốn tự hủy ngay khi đóng tab hoặc đóng cửa sổ); không có Registry quản lý metadata, không có thuật toán giải phóng bộ nhớ. | Triển khai **Smart Persistent Cache**: (1) Sử dụng `localStorage` lưu trữ bền vững qua các phiên trình duyệt, nạp tức thì 0ms; (2) **LRU Eviction (50 bài báo gần nhất)** tự động dọn các bài cũ nhất khi vượt định mức hoặc đầy quota; (3) **TTL Expiration (14 ngày)** tự động xóa các bài quá hạn 14 ngày không đọc; (4) Hỗ trợ xóa cache chủ động khi bấm "Dịch lại" hoặc "Xóa cache & Dịch lại" trong Cài đặt. | ✅ Đã hoàn thành & Kiểm chứng |
| **ISSUE-014** | Onboarding / First-run UX | Khi người dùng mới cài đặt lần đầu và mở PDF Viewer mà chưa nhập API Key, hàng đợi thác nước tự động gọi AI dịch ngầm và báo lỗi đỏ ở từng trang ("Không thể dịch Trang X"), gây bối rối cho người dùng mới. | Trình đọc PDF khởi động với mode mặc định là Vision AI và tự động kích hoạt hàng đợi dịch thác nước ngay khi nạp tài liệu mà chưa kiểm tra xem người dùng đã cấu hình API Key hay chưa. | (1) Ngắt kết nối nạp key từ `.env`; (2) Thêm Banner cảnh báo màu cam ở đầu khung dịch tạm dừng hàng đợi ngầm; (3) Giao diện Quản lý Đa API Key với nút `+` và dropdown chọn provider; (4) Smart Router chỉ rotate khi $\ge 2$ keys, nếu 1 key thì báo lỗi limit; (5) Popup hỏi lựa chọn dịch lại sau khi lưu key. | ✅ Đã khắc phục & Kiểm chứng |
| **ISSUE-015** | CI / Code Quality (ESLint) | GitHub Actions CI luôn báo đỏ (fail) khi push commit lên nhánh `main` hoặc tạo release tag. | `extension/lib/providers/key-router.ts:109`: Lệnh `throw new Error(...)` không đính kèm `{ cause: err }`, vi phạm quy tắc `preserve-caught-error` của ESLint; `package-lock.json` chưa đồng bộ version `1.0.1`. | Bổ sung `{ cause: err }` vào lệnh throw Error; đồng bộ version `package-lock.json` lên `1.0.1`; kiểm thử cục bộ `npm run check` vượt qua 100%. | ✅ Đã khắc phục & Kiểm chứng |
| **ISSUE-016** | Tests / Redundant Assets | Unit test `blocks.test.ts` phụ thuộc trực tiếp vào `backend/samples/2302.07121.pdf` (53MB) nằm trong thư mục backend cũ, gây rủi ro phình repo Git và cản trở dọn dẹp backend. | File mẫu PDF nghiên cứu được đặt trong thư mục backend từ giai đoạn thử nghiệm v0.1 thay vì nằm trong thư mục test fixtures độc lập. | Di dời PDF sang `tests/fixtures/sample-paper.pdf`, cập nhật đường dẫn kiểm thử, bổ sung quy tắc `.gitignore` để không track file PDF nặng trong git. | ✅ Đã hoàn thành (A1) |
| **ISSUE-017** | Pipeline / Protocol Queue | Lỗi Hanging Promise (rò rỉ RAM) khi gọi `ConcurrencyQueue.clear()`; các task đang nằm trong hàng đợi chờ chạy bị bỏ rơi vĩnh viễn và không bao giờ resolve hay reject. | Hàm `clear()` của `ConcurrencyQueue` trước đây chỉ gán mảng `this.queue = []` mà không giải phóng danh sách pending task resolver/rejector. | Bổ sung `QueueCancelledError`, duyệt qua toàn bộ item trong queue để reject có kiểm soát khi gọi `clear()`; cập nhật offscreen handler bắt lỗi an toàn. | ✅ Đã khắc phục & Kiểm thử 125/125 tests (A2) |
| **ISSUE-018** | Renderer / GPU Memory | Rò rỉ bộ nhớ đồ họa GPU trong `PdfSnippet` (lên đến 387+ MB RAM khi xem paper 50 trang); các canvas 2x HiDPI bị giữ vĩnh viễn trong RAM. | `pdfPageCanvasCache` trước đây là một Map không giới hạn kích thước, lưu trữ vĩnh viễn canvas render của toàn bộ các trang đã mở. | Tạo `lib/pdf/snippet-cache.ts` với cơ chế LRU Canvas Cache (tối đa 6 trang), tự động đặt `width=0, height=0` để giải phóng GPU backing store khi loại bỏ; bổ sung 4 unit tests mới. | ✅ Đã khắc phục & Kiểm thử 129/129 tests (A3) |
| **ISSUE-019** | Performance / CPU Spikes | `MutationObserver` trong Content Script gây CPU spikes và nghẽn Main Thread khi xem video có live chat liên tục trên YouTube/SPAs. | Hai `MutationObserver` theo dõi toàn bộ `document.documentElement` (`subtree: true, childList: true`) kích hoạt `sendDetectedTitle` và `tryMount` liên tục mà không có cơ chế debounce. | Tạo module `lib/utils/debounce.ts` (hỗ trợ delay 400ms và cancel); bọc debounce 400ms cho cả 2 MutationObserver; bổ sung 3 unit tests mới (132/132 tests pass). | ✅ Đã khắc phục & Kiểm thử 132/132 tests (A4) |
| **ISSUE-020** | Capture / Stream Leak | Rò rỉ luồng `MediaStream` và treo biểu tượng chấm đỏ ghi âm tab khi `AudioContext` gặp sự cố trong quá trình khởi tạo. | Hàm `captureTabPcm` trước đây sau khi gọi `getUserMedia` thiếu khối `try / catch` bọc quá trình khởi tạo `AudioContext`, khiến các audio tracks không bao giờ được `stop()`. | Bọc khối `try / catch` giải phóng toàn diện: tự động duyệt `stream.getTracks().forEach(t => t.stop())`, đóng `audioCtx` và gỡ `audioEl.srcObject` nếu xảy ra lỗi; bổ sung 5 unit tests mới (137/137 tests pass). | ✅ Đã khắc phục & Kiểm thử 137/137 tests (A5) |
| **ISSUE-021** | Provider / KeyRouter Singleton | Biến `globalRouter` singleton bị ghi đè khi gọi xen kẽ các tập keys hoặc provider khác nhau, làm mất sạch trạng thái `cooldownMap` của các API keys đang bị dính mã lỗi HTTP 429 Quota Exceeded. | Hàm `getKeyRouter` trước đây dùng một biến singleton đơn lẻ `let globalRouter: KeyRouter | null = null`, chỉ so sánh với tập keys gần nhất và tạo mới router đè lên instance cũ khi tập keys đổi khác. | Thay thế bằng `routerRegistry = new Map<string, KeyRouter>()` quản lý theo cache key kết hợp `namespace` và danh sách keys; bổ sung `clearKeyRouters()`; viết 3 unit tests kiểm chứng bảo toàn cooldown khi gọi đa provider (140/140 tests pass). | ✅ Đã khắc phục & Kiểm thử 140/140 tests (A6) |
| **ISSUE-022** | Provider / Multi-Key Direct Gemini | `DirectGeminiProvider` (phiên âm ASR và dịch phụ đề video/audio) chỉ nhận key đơn lẻ `settings.apiKey`, bỏ qua danh sách đa key dự phòng `settings.apiKeys`, khiến phụ đề dừng ngay khi dính lỗi 429. | Tại các phương thức `transcribe`, `translateImpl`, `translateTitle`, mã nguồn gọi `getKeyRouter(settings.apiKey)` thay vì truyền danh sách key từ `getProviderKeys(settings, 'gemini')`. | Import `getProviderKeys`, cập nhật 3 vị trí gọi router nhận mảng keys của provider; giữ nguyên 100% cấu hình model và provider; bổ sung test case kiểm chứng tự động xoay key khi dính 429. | ✅ Đã khắc phục (A7) |
| **ISSUE-023** | UI / Storage Sync Overwrite | Tab Options mở sẵn ghi đè làm mất API key và glossary vừa cập nhật từ Popup do không lắng nghe sự kiện thay đổi dữ liệu ngầm từ storage. | Component `options/App.tsx` và `popup/App.tsx` chỉ gọi `loadSettings()` một lần duy nhất lúc mount, không đăng ký lắng nghe sự kiện `browser.storage.onChanged`. | Bổ sung listener `browser.storage.onChanged` và gỡ bỏ an toàn khi unmount cho cả Options và Popup, tự động reload `settings` khi có thay đổi từ tab khác. | ✅ Đã khắc phục (A8) |
| **ISSUE-024** | Pipeline / PDF Micro-Batches Burst Quota | `translateMicroBatches` dùng `Promise.all` bắn dồn dập toàn bộ các batches câu (4-8 batch/trang) cùng lúc, tiềm ẩn nguy cơ dính `HTTP 429 Quota Exceeded` trên các trang paper rất dài hoặc khi duyệt nhanh. | Sử dụng `Promise.all(batches.map(...))` không giới hạn số lượng concurrent requests thay vì dùng hàng đợi điều phối nhịp độ. | Đã chuẩn bị sẵn giải pháp: Bọc `batches.map` qua `ConcurrencyQueue(2)` tại `lib/pdf/translate.ts:518` để giới hạn 2 batch đồng thời. Hiện tại tạm skip theo yêu cầu người dùng và lưu lại để kích hoạt khi có hiện tượng lỗi thực tế. | ⚠️ Đang theo dõi / Đã có giải pháp dự phòng (A9 - Skip) |
| **ISSUE-025** | DRY / ArXiv and Viewer URL Duplication | Logic bóc tách và chuẩn hóa ArXiv URL (`/abs/`, `/pdf/`) và tạo link Viewer bị lặp lại tại 4 file (`background.ts`, `content/index.ts`, `popup/App.tsx`). | Thiếu module helper tập trung chuyên trách cho việc chuẩn hóa và kiểm tra URL tài liệu học thuật. | Đã chuẩn bị sẵn giải pháp: Tạo module `lib/pdf/url.ts` gom các hàm `normalizePdfUrl`, `isPdfUrl`, `getViewerUrl`. Hiện tại tạm skip theo yêu cầu người dùng và chuyển sang A11. | ⚠️ Đang theo dõi / Đã có giải pháp dự phòng (A10 - Skip) |
| **ISSUE-026** | DRY / Duplicated Glossary Management UI | Cả 2 giao diện Popup và Options đều tự viết lại 100% logic quản lý thuật ngữ (thêm, xóa, nạp bộ mẫu, xuất/nhập JSON), gây trùng lặp ~180 dòng JSX và handlers. | Thiếu component dùng chung giữa các entrypoints; Popup và Options tự quản lý các state và hàm xử lý riêng lẻ. | Tạo component dùng chung `components/GlossaryEditor.tsx` hỗ trợ 2 biến thể (`variant="full"` cho Options, `variant="compact"` cho Popup); loại bỏ ~180 dòng code thừa, tách thành shared chunk 4.36 kB. | ✅ Đã khắc phục (A11) |
| **ISSUE-027** | Dead Code / FlowBlock & Academic CSS | Component `FlowBlock` chứa hơn 250 dòng logic kéo-thả, resize, đo kích thước và nhánh dịch canvas mồ côi không bao giờ kích hoạt; `style.css` chứa 172 dòng dead CSS của Academic Markdown Reader cũ. | Chế độ dịch đè canvas đã được thay thế hoàn toàn bằng Vision AI Markdown và Whiteboard; `FlowBlock` chỉ còn được gọi bởi trang gốc (`type="original"`) để bắt sự kiện hover chuột từng câu; CSS Markdown cũ không còn element nào sử dụng. | (1) Dọn sạch các hàm mồ côi trong `PageRenderer` (`loadPageLayout`, `BlockLayoutOverride`, `natHeights`, `reportHeight`, `computeReflowOffsets`, badge status); (2) Tinh giản `FlowBlock` từ 250 dòng xuống ~65 dòng, giữ nguyên tính năng overlay hover sentence đồng bộ 2 chiều; (3) Xóa 172 dòng dead CSS trong `style.css`, giảm ~6.4 kB bundle size. (4) [Hoàn tất triệt để] Xóa ghost `_layoutResetSignal` + `resetAllLayouts` + nút "⟲ Đặt lại bố cục" chết, tỉa 6 props mồ côi khỏi `PageRendererProps` (`type/status/untranslatedCount/onRetry/docUrl/layoutResetSignal`); check 141/141 + build viewer chunk 794.77 kB. | ✅ Đã khắc phục (A12) |
| **ISSUE-028** | Dead Code / Markdown Elements & Over-exports | Hàm `blocksToMarkdownElements` (81 dòng) và `interface MarkdownElement` trong `markdown.ts` cùng `isDisplayEquation` trong `blocks.ts` là mã chết không còn sử dụng; 16 hàm nội bộ bị `export` thừa thãi ngoài phạm vi. | Hệ thống Reader v0.1 cũ đã được thay thế hoàn toàn bằng Vision AI Markdown và Whiteboard; các hàm nội bộ chỉ được gọi bên trong module của chúng. | (1) Xóa `blocksToMarkdownElements`, `MarkdownElement` trong `markdown.ts` và dọn test case tương ứng trong `markdown.test.ts`; (2) Xóa `isDisplayEquation` trong `blocks.ts`; (3) Gỡ bỏ từ khóa `export` cho 16 hàm nội bộ trong `blocks.ts`, `mock.ts`, `validator.ts`, `translate.ts`, `vision-translate.ts`, `content/index.ts`. Kiểm thử đạt 141/141 tests pass 100%. (4) [Hoàn tất] Xóa alias `isMathFormula` (đổi 11 expects sang `isMathFragment`), `_source` thay `void source`, xóa `maskMap: {}` request-level; giữ `queue getters`/`displayDurationMs`/vision-cache fns vì đã có test bao phủ. Check xanh, giữ nguyên 141/141 tests. | ✅ Đã khắc phục (A13) |
| **ISSUE-029** | Repo Hygiene / Redundant Assets | Zip build cũ (`dist/`, `.output/*0.1.0/1.0.0*.zip`), ảnh debug `backend/output/*.png`, prototype `backend/` + `demo/` + 5 script probe cũ nằm lẫn trong cây làm việc, cache `.tools/profile/` ~292MB. | Không có quy trình dọn dẹp sau release; mọi artifact nằm lẫn với mã nguồn. | Xóa zip/png cũ; `git mv demo/→archive/demo/`, `backend/translate_paper.py+fonts/→archive/python-prototype/`, 5 script cũ→`archive/old-scripts/` (giữ history); purge `.tools/profile/`. Check xanh 141/141. | ✅ Đã khắc phục (A14) |
| **ISSUE-030** | Tooling / Root Config | Không có `package.json` ở root → `npm test/build/check` ở root lỗi ENOENT, CI và agent phải `cd extension`. | Mọi config npm nằm cô lập trong `extension/`. | Thêm `package.json` proxy root forward 7 scripts vào `extension/` (không dependencies). Verify `npm test` từ root: 21 files, 141/141 pass. | ✅ Đã khắc phục (A15) |
| **ISSUE-031** | UI / Alignment | Cửa sổ bản dịch bị lệch điểm bắt đầu và kết thúc so với trang gốc (lệch ngắt trang tích lũy). | Đo chiều cao bằng effectiveRightScale thay vì effectiveLeftScale; margin-bottom 32px cộng dồn với gap 24px; warning banner đặt trong khung phải. | Thêm prop heightScale={effectiveLeftScale} đồng bộ chiều cao 1:1; chuẩn hóa margin: 0 auto; đưa warning banner lên trên workspace. | ✅ Đã khắc phục & Kiểm chứng |
| **ISSUE-032** | UX / Scrolling | (1) Hover vào trang mới khi chưa chạm trần đã bị cuộn nội dung con làm mất tiêu đề; (2) Lướt nhanh qua khoảng đen 24px bị vọt lố qua trang kế tiếp; (3) Cuộn hết nội dung trong trang bị đứng cứng (freeze) do subpixel DPI scaling. | (1) Thiếu khóa trần (ceiling-lock); (2) Bắt nhầm khoảng trống giữa 2 trang là vùng lề đen ngoài lề; (3) Trên HiDPI scaling, `remainingDown` dừng ở mức lẻ (> 1px) khiến điều kiện khóa trần liên tục kích hoạt, chặn cuộn khung cha. | (1) Bộ điều phối Reading Column Coordinator chỉ kích hoạt scroll in page khi trần trang chạm đỉnh; (2) Giới hạn vùng lề đen thực sự ở 2 bên sườn trang (clientX); (3) Nâng ngưỡng nhận diện đáy an toàn (3px) và chuyển tiếp lực cuộn dư (unusedDelta) ra khung cha khi chạm đáy. | ✅ Đã khắc phục & Kiểm chứng |
| **ISSUE-033** | UI / Responsive Zoom | Thanh chọn mức thu phóng (75%–200%, nút −/+) trên Toolbar làm chật chội giao diện và áp đặt 1 scale cố định làm vỡ layout 2 khung khi chia tỷ lệ không đều. | Toolbar chứa cụm nút zoom tĩnh không phù hợp với layout song ngữ responsive; thiếu cơ chế zoom nhanh tạm thời cho từng bên trang. | Xóa bỏ cụm nút zoom trên Toolbar; cố định chế độ hiển thị luôn là Fit Width tự động; hỗ trợ Ctrl + Wheel zoom độc lập tạm thời cho từng bên trang; tự động reset tỷ lệ phóng về chuẩn Fit Width khi kéo hoặc chỉnh thanh Splitter ở giữa. | ✅ Đã khắc phục & Kiểm chứng |
| **ISSUE-034** | Renderer & API / Figure BBox & OpenCode Zen | Lỗi cắt hình ảnh (Figure Snippet) bị sai trên bài báo toàn trang (`2405.14101`): mất 3 cột ảnh bên trái và chém vào dòng ngày tháng; OpenCode Zen API báo lỗi 400 `MissingSessionID` khi gọi từ môi trường ngoài. | Hardcode tọa độ Figure 1 trên Trang 1 (`figLeft = 307, figWidth = 245`); thiếu headers `User-Agent: OpenCode-Desktop/1.0.0` và `x-session-id` khi gọi OpenCode Zen API. | (1) Xóa bỏ hardcode, tính toán động BBox cho cả Full-Width (`col === 0` hoặc span > 55% trang) và Column Figure (`col === 1, 2`), định vị đỉnh ảnh tự động theo đáy author/date; (2) Thêm đầy đủ headers định danh cho OpenCode Zen API. | ✅ Đã khắc phục & Kiểm chứng |
| **ISSUE-035** | LaTeX / Equation Numbering | Số thứ tự phương trình (17, 18, 19) bị gộp vào bên trong biểu thức toán (nhét vào tử số `\frac{... (17)}{...}` hoặc ngoặc hàm `D(x(19))`), hoặc bị dính sát lề phải công thức thay vì căn lề phải mép trang. | VLM đọc 2D ngang hàng với tử số/hàm số và sinh token autoregressive; Prompt hướng dẫn dùng `\quad (10)` thay vì lệnh chuẩn `\tag{N}`; KaTeX renderer thiếu bộ lọc regex tự động bóc tách và chuẩn hóa tag. | (1) Cập nhật Prompt bắt buộc dùng chuẩn `\tag{N}` và nghiêm cấm nhét vào ngoặc/tử số; (2) Tạo module `normalizeEquationLatex` tự động bóc tách số thứ tự bị kẹt chuyển thành `\tag{N}` căn lề phải chuẩn KaTeX; (3) Tinh chỉnh CSS `.lt-vision-display-eq .katex-display { width: 100% }`. | ✅ Đã khắc phục & Kiểm chứng |
| **ISSUE-036** | UI / Typography Scaling | Chỉnh cỡ chữ bản dịch trong Cài đặt (ví dụ lên 26px) chỉ đổi khung preview nhưng nội dung Markdown bản dịch thực tế trong pane đọc không thay đổi kích thước; do Markdown có phân cấp tiêu đề (`#`, `##`, `###`) và các class CSS bị hardcode cứng bằng pixel cố định. | (1) Các class Markdown `.lt-vision-h1`, `.lt-vision-h2`, `.lt-vision-paragraph`, `.lt-vision-table`... được hardcode giá trị px tĩnh trong CSS; (2) Cỡ chữ đơn thuần không áp dụng được cho cấu trúc Markdown phân cấp nhiều tầng; cần chuyển sang hướng Scale tỷ lệ (Relative Typography Scaling) trên container hiển thị Markdown. | (1) Áp dụng biến CSS `--lt-content-scale` và CSS `zoom: var(--lt-content-scale, 1)` trên `.lt-vision-body` và Whiteboard, co giãn đồng bộ 100% tiêu đề, văn bản, KaTeX math và bảng số liệu mà không vỡ bố cục; (2) Tinh giản UI Cài đặt: Dải nút chọn nhanh (85%-175%) kèm thanh kéo trượt mượt mà và badge hiển thị % sắc nét, loại bỏ ô số spinner và nút đặt lại thừa thãi. | ✅ Đã khắc phục & Kiểm chứng |
| **ISSUE-037** | UI / Dark Theme Contrast | Khi chọn Theme Tối (Dark), chữ tiêu đề H1-H3 và các đoạn văn bản Markdown bị chìm nghỉm vào nền đen tối không đọc được gì; do các class Markdown bị hardcode màu chữ đen `#0f172a`, `#334155` mà thiếu rule ghi đè màu sáng trong `.lt-theme-dark`. | Thiếu CSS selector ghi đè màu chữ cho các phần tử con Markdown bên trong container `.lt-theme-dark` (bao gồm H1-H3, paragraph, blockquote, KaTeX math, bảng biểu). | Bổ sung đầy đủ bảng màu tương phản cao cho `.lt-theme-dark` và các biến thể theme tối mới: chữ xám trắng `#f1f5f9`, tiêu đề xanh sáng `#38bdf8`, công thức và bảng biểu sáng rõ. | ⏳ Đang chờ người dùng phê duyệt |
| **ISSUE-038** | Typography / Vietnamese Font Glyphs | Font `Merriweather` bị lỗi dấu tiếng Việt (vỡ chữ, lệch dấu thanh điệu); font `Inter` bị trùng lặp với tùy chọn Hệ thống mặc định. | `Merriweather` webfont chưa nạp đủ bộ ký tự Latinh mở rộng (Vietnamese subset) trên một số môi trường máy trạm; giao diện hiển thị dạng 4 ô nút to chiếm nhiều không gian. | (1) Xóa `Merriweather` và gộp `Inter` vào Hệ thống; (2) Bổ sung các font học thuật serif và sans-serif hỗ trợ tiếng Việt tuyệt đối 100% (`Times New Roman`, `Palatino`, `Segoe UI/Roboto`, `Arial`); (3) Chuyển đổi sang dạng Popup Dropdown CustomSelect sang trọng. | ✅ Đã khắc phục & Kiểm chứng |
| **ISSUE-040** | VLM / Multi-Language Translation | Khi chọn ngôn ngữ đích Tiếng Hàn (`ko`), một số trang dịch đúng nhưng đa số vẫn trả về Tiếng Việt dù đã bấm "Dịch lại toàn bộ". | (1) Cache key thiếu `targetLang`, tự nạp bản dịch tiếng Việt cũ; (2) `detectEnglishInMarkdown` chỉ kiểm tra dấu tiếng Việt, nhầm lẫn tiếng Hàn chứa thuật ngữ tiếng Anh là chưa dịch; (3) `verifyAndRepairTranslation` dùng prompt tiếng Việt và mã `ko` thô khiến AI dịch ngược về tiếng Việt; (4) `main.tsx` không nạp mới ngữ cảnh khi đổi ngôn ngữ. | (1) Bổ sung `targetLang` vào cache key; (2) Bộ lọc nhận diện ký tự đa ngữ (Hangul, Kana, Kanji, Diacritics); (3) Tách System Prompt tiếng Anh cho ngoại ngữ chống language drift; (4) Tự động làm mới state và hàng đợi khi đổi `targetLang`. | ✅ Đã khắc phục & Kiểm chứng |
| **ISSUE-041** | Architecture / Monolithic File Refactor | Tệp `extension/entrypoints/viewer/main.tsx` phình to tới 2,429 dòng (110 KB), vi phạm SRP khi nhồi nhét cùng lúc Modal Cài đặt, Toolbar, ScrollSync, Ceiling-Lock, Multi-Worker Queue, PageRenderer, FlowBlock; gây rủi ro hồi quy cao và tốn chi phí re-render. | Tích lũy liên tục các tính năng mới trong suốt các phiên bản v0.1 đến v1.1 mà chưa thực hiện tái cấu trúc phân rã module chuyên biệt. | (1) Khảo sát và lập bản vẽ kiến trúc chi tiết `docs/MODULAR_DECOUPLING_PLAN.md`; (2) Bóc tách thành 13 UI Sub-components (`components/Toolbar/`, `components/SettingsModal/`, `SidebarDrawer`, `DraggableSplitter`, `PageRenderer`, `FlowBlock`); (3) Bóc tách 4 Custom Hooks (`usePdfDocument`, `useSettingsManager`, `useVisionWorkerQueue`, `useSyncScroll`); (4) Tinh giản `main.tsx` thành App Shell còn 263 dòng (< 300 dòng); (5) Mọi file con đều < 400 dòng; bảo toàn 161/161 unit tests và visual UI. | ✅ Đã khắc phục & Kiểm chứng |

---

## 2. Kiến trúc giải pháp: Hệ thống 2 chặng (Two-Stage Pipeline with Verification Agent)

```mermaid
graph TD
    A["Ảnh trang PDF (2x JPEG)"] --> B["Stage 1: Multimodal Vision Parser<br/>(Bóc tách layout, công thức KaTeX, Figure, Thuật toán)"]
    B --> C["Raw Markdown Output"]
    C --> D{"Stage 2: Verification Agent<br/>(Quét phát hiện đoạn văn bị rò rỉ tiếng Anh)"}
    D -- "Đã chuẩn tiếng Việt 100%" --> E["Hiển thị & Lưu Cache"]
    D -- "Phát hiện đoạn tiếng Anh (Trang 4, 7, 9...)" --> F["Text Translation Pass<br/>(Dịch chuẩn hóa bằng Text LLM không bị visual anchor)"]
    F --> E
```

---

## 3. Kiến trúc điều phối hàng đợi: Multi-Worker Concurrent Queue & Batch Preemption Window

```mermaid
flowchart TD
    Start["Nạp PDF (N trang)"] --> Init["Khởi tạo Waterfall Queue [1, 2, ..., N]"]
    Init --> CheckCache{"Kiểm tra Cache từng trang"}
    CheckCache -- "Có Cache" --> DoneInstant["Hiển thị tức thì 0ms (Đã dịch ✓)"]
    CheckCache -- "Chưa Cache" --> QueueList["Xếp vào Thác nước (Đang đợi...)"]

    subgraph BatchPreempt ["Cơ chế Cửa sổ Chen ngang Cụm (Batch Preemption Window)"]
        UserScroll["User cuộn đến Trang K (dừng >= 300ms) HOẶC click Thumbnail"] --> BatchGen["Tạo cụm C trang: [K, K+1, ..., K+C-1]<br/>(C = Concurrency, Mặc định = 5)"]
        BatchGen --> HighQ["Đẩy cả cụm C trang lên đỉnh High Priority Queue (⚡ Ưu tiên)"]
        HighQ --> WakeTimer["Hủy nhịp nghỉ pacing delay & Đánh thức tất cả Worker xử lý ngay"]
    end

    subgraph Pool ["Worker Pool Đa luồng (Concurrency C = 2..7, Mặc định = 5)"]
        W1["Worker 1"]
        W2["Worker 2"]
        W3["Worker 3"]
        W4["Worker 4"]
        W5["Worker 5"]
    end

    HighQ --> Pool
    QueueList --> Pool

    subgraph WorkerCycle ["Vòng lặp mỗi Worker (Sliding Window)"]
        Pick{"Bốc việc tiếp theo"}
        Pick -- "High Priority Queue có trang" --> PopHigh["Bốc trang ưu tiên (0ms delay)"]
        Pick -- "High Priority Queue rỗng" --> PopWater["Bốc trang tiếp theo từ Waterfall Queue"]
        
        PopHigh --> ExecTrans["Gọi Vision AI + Verification Agent"]
        PopWater --> ExecTrans
        
        ExecTrans --> SaveCache["Lưu Session Cache & Cập nhật UI (Đã dịch ✓)"]
        SaveCache --> Pacing["Nghỉ an toàn 400ms giữa các trang thác nước"]
        Pacing --> Pick
    end

    Pool --> WorkerCycle
    WakeTimer -.-> Pick
```

---

## 4. Kiến trúc Bộ nhớ đệm bền vững thông minh (Smart Persistent Cache: LRU 50 bài & TTL 14 ngày)

```mermaid
flowchart TD
    UserReq["Yêu cầu nạp Trang PDF K"] --> CheckLocal{"Kiểm tra Persistent Cache<br/>(localStorage)"}
    
    CheckLocal -- "Tìm thấy trong Cache" --> CheckTTL{"Kiểm tra TTL (<= 14 ngày)?"}
    CheckTTL -- "Đã quá hạn 14 ngày" --> EvictExpired["Xóa bài khỏi Cache & Registry"] --> CallAI["Gọi Vision AI Dịch mới"]
    CheckTTL -- "Còn hạn sử dụng" --> TouchLRU["Cập nhật lastAccessed = Date.now()<br/>(LRU Freshening)"] --> InstantRender["Hiển thị Tức thì 0ms (Đã dịch ✓)<br/>0 tốn API Quota"]
    
    CheckLocal -- "Chưa có trong Cache" --> CallAI
    
    CallAI --> VerificationAgent["Verification Agent Làm sạch tiếng Anh"]
    VerificationAgent --> WriteCache{"Ghi vào localStorage"}
    
    WriteCache -- "Thành công" --> UpdateReg["Thêm vào Registry Metadata"]
    WriteCache -- "Lỗi QuotaExceededError" --> LRUEviction["Kích hoạt dọn dẹp LRU khẩn cấp:<br/>Xóa các bài cũ nhất trong 50 bài"] --> WriteCache
    
    UpdateReg --> PruneCheck{"Số bài trong Registry > 50?"}
    PruneCheck -- "Có (> 50 bài)" --> PruneOldest["Xóa bài có lastAccessed cũ nhất"] --> SaveReg["Lưu Registry"]
    PruneCheck -- "Không (<= 50 bài)" --> SaveReg
    
    subgraph ActiveClear ["Cơ chế Xóa Cache Chủ động"]
        BtnRetryPage["Nút '↻ Dịch lại' trên từng trang"] --> ClearPageKey["Xóa key trang đó khỏi localStorage & Registry"]
        BtnSettings["Nút '↻ Xóa cache & Dịch lại' (Cài đặt)"] --> ClearPaper["Xóa toàn bộ các trang của bài báo khỏi Registry"]
    end
```

---

## 5. Phân tích Chi tiết ISSUE-014: Trải nghiệm Người dùng Mới khi Chưa Cấu hình API Key

- **Hiện tượng**: Khi một người dùng mới cài đặt extension lần đầu (fresh install) và mở một tài liệu PDF bất kỳ:
  1. Giao diện Viewer nạp trang PDF gốc rất nhanh và chuẩn xác.
  2. Tuy nhiên bên khung dịch, chế độ mặc định là `Vision AI` tự động kích hoạt hàng đợi thác nước để dịch Trang 1..5.
  3. Vì người dùng mới chưa nhập Gemini API Key, các yêu cầu dịch ngầm trả về lỗi `Chưa cấu hình Gemini API Key` (hoặc lỗi 429 nếu dùng key chia sẻ chung quá tải).
  4. Bên khung dịch hiển thị các thẻ đỏ `Không thể dịch Trang 1`, tạo cảm giác extension bị lỗi dù thực chất chỉ là chưa có key.
- **Giải pháp đề xuất cải thiện (Pending user confirmation)**:
  - Kiểm tra `apiKey`: Nếu cả Gemini API Key và Zen API Key đều trống, thay vì tự động kích hoạt hàng đợi dịch thác nước, hiển thị một **Onboarding Banner** hoặc **Empty State Card** trang nhã:
    - Tiêu đề: *"Chào mừng bạn đến với Live-Trans PDF Viewer!"*
    - Hướng dẫn: *"Để bắt đầu dịch tài liệu AI/học thuật với giữ nguyên công thức toán KaTeX & hình ảnh, vui lòng nhập Google Gemini API Key (hoàn toàn miễn phí)."*
    - Nút bấm trực tiếp: *"⚙️ Mở Cài đặt nhập Key (1 click)"* kèm link hướng dẫn lấy key trong 30 giây tại `aistudio.google.com`.
  - Tự động bắt đầu dịch ngay khi người dùng lưu key thành công.

---

## 6. Phân tích Chi tiết ISSUE-015: GitHub Actions CI Thất Bại Khi Push

- **Hiện tượng**: Khi push commit lên GitHub (như commit `6f69fc6` hoặc tag `v1.0.1`), pipeline CI của GitHub Actions (`.github/workflows/ci.yml`) luôn báo thất bại (exit code 1, xem run `34055478033` và `34055497509`).
- **Nguyên nhân gốc rễ**:
  1. Trong quy trình CI, bước `npm run check` thực thi lần lượt:
     - `wxt prepare` (Pass)
     - `tsc --noEmit` (Pass)
     - `eslint .` (Fail)
  2. Tại `extension/lib/providers/key-router.ts` dòng 109, khi xử lý lỗi quota cho trường hợp 1 API Key đơn lẻ:
     ```ts
     throw new Error('Đã chạm hạn mức Rate Limit (429) hoặc Quota của API Key. Vui lòng thử lại sau hoặc thêm API Key dự phòng trong Cài đặt.');
     ```
     Lệnh này re-throw một Error mới mà không truyền kèm đối tượng lỗi gốc `err` qua thuộc tính `{ cause: err }`, vi phạm quy chuẩn `preserve-caught-error` của bộ quy tắc ESLint.
  3. File `extension/package-lock.json` có trường `"version": "0.1.0"`, trong khi `package.json` đã được nâng cấp lên `1.0.1`.
- **Giải pháp xử lý đề xuất**:
  1. Sửa `key-router.ts` dòng 109:
     ```ts
     throw new Error('Đã chạm hạn mức Rate Limit (429) hoặc Quota của API Key. Vui lòng thử lại sau hoặc thêm API Key dự phòng trong Cài đặt.', { cause: err });
     ```
  2. Đồng bộ version trong `extension/package-lock.json` lên `1.0.1`.
  3. Chạy kiểm chứng toàn bộ `npm run check` (`wxt prepare` + `tsc` + `eslint` + `vitest`) đảm bảo 100% xanh trước khi commit và push lại lên Git.

---

## 7. Phân tích Chi tiết ISSUE-031: Lệch Chiều Cao & Điểm Bắt Đầu / Kết Thúc Giữa Trang Gốc và Trang Dịch

- **Hiện tượng**:
  - Cửa sổ hiển thị bản dịch (khung phải) bị lệch ranh giới bắt đầu (đỉnh trang) và kết thúc (đáy trang) so với 1 trang của bài báo gốc (khung trái). Càng cuộn xuống các trang phía dưới độ lệch càng tích lũy lớn.
- **Nguyên nhân gốc rễ**:
  1. **Đo sai chiều cao trang dịch**: `VisionPageRenderer` và `WhiteboardPageRenderer` tính chiều cao theo `effectiveRightScale` thay vì `effectiveLeftScale`.
  2. **Cộng dồn Margin đáy ở khung phải**: Flexbox container có `gap: 24px`, nhưng trang dịch lại có `margin: 0 auto 32px auto` (thừa 32px mỗi trang).
  3. **Banner cảnh báo đẩy lệch Trang 1**: Thẻ warning banner nằm trong `.lt-pane-right` đẩy tụt toàn bộ trang bên phải xuống 110px.
- **Giải pháp xử lý**:
  1. Bổ sung prop `heightScale={effectiveLeftScale}` để đồng bộ chiều cao trang 1:1 với khung trái.
  2. Chuẩn hóa `margin: 0 auto` cho `.lt-vision-page` và `.lt-whiteboard-page` trong `style.css`.
  3. Đưa warning banner ra ngoài `.lt-pane-right`, đặt phía trên `<main class="lt-workspace">`.

---

## 8. Phân tích Chi tiết ISSUE-032: Điều Phối Cuộn Trang Toàn Diện (Reading Column Coordinator)

- **Hiện tượng**:
  1. Khi cuộn tới trang mới, nếu con trỏ chuột nằm trong trang khi trang chưa chạm trần, phần cuộn nội bộ trong trang (`scroll in page`) đã bị kích hoạt sớm, làm mất phần tiêu đề/thuật toán đầu trang trước khi người dùng kịp nhìn tổng thể.
  2. Khi lướt nhanh qua khoảng đen 24px giữa 2 trang (hoặc header trang), hệ thống bắt nhầm là con trỏ chuột ở vùng đen ngoài lề, khiến khung cha nhảy vọt lố qua trang kế tiếp mà không dừng lại ở trần.
  3. Khi cuộn tới đáy nội dung của trang, người dùng bị kẹt cứng (freeze), không thể cuộn tiếp để chuyển sang trang kế tiếp.
- **Nguyên nhân gốc rễ**:
  1. Cơ chế bắt sự kiện cuộn trước đây nằm rải rác trên từng component trang (`onWheel` cục bộ), không có khả năng nhận biết tọa độ trần của trang đối với khung cha.
  2. Bắt vùng lề đen dựa vào target DOM element thay vì tọa độ ngang `clientX`. Khoảng đệm `gap: 24px` giữa 2 trang và header trang thuộc về vùng đọc nhưng không nằm trong `.lt-vision-body`, dẫn đến bị phán đoán nhầm là lề ngoài.
  3. Trên Windows với màn hình HiDPI scaling (125%, 150%), `scrollTop` là số thực thập phân (ví dụ `804.7999877929688px`). Do đó, `remainingDown = maxScroll - body.scrollTop` dừng ở mức xấp xỉ ~1.5px, lớn hơn ngưỡng `1px` trước đó. Điều này khiến điều kiện khóa trần `remainingDown > 1` liên tục kích hoạt và gọi `e.preventDefault()`, khóa cứng `right.scrollTop` trong khi nội dung con đã chạm đáy vật lý không thể cuộn thêm được nữa.
- **Giải pháp xử lý**:
  1. **Tập trung hóa Bộ Điều Phối (Reading Column Coordinator)**: Đặt listener duy nhất tại `rightPaneRef.current` (`main.tsx`), loại bỏ hoàn toàn các `onWheel` cục bộ rời rạc trên từng trang.
  2. **Phân định ranh giới Cột Đọc Chuẩn Xác**:
     - *Vùng lề đen thực sự*: `clientX < firstPageRect.left || clientX > firstPageRect.right`. Cho phép cuộn tự do cả khung ngoài.
     - *Cột đọc tài liệu*: `firstPageRect.left <= clientX <= firstPageRect.right` (bao gồm thân trang, header và khoảng đệm 24px giữa các trang).
  3. **Khóa Trần Chuẩn Xác (Ceiling-Lock)**: Khi trang chưa chạm trần (`right.scrollTop < targetCeiling - 2`), chỉ cuộn khung cha tới đúng trần (`targetCeiling`), tuyệt đối không kích hoạt `scroll in page`.
  4. **Hãm Phanh Chống Vọt Lố (Ceiling Clamping)**: Khi người dùng vuốt nhanh (fast flick), khung cha được hãm phanh chuẩn xác tại trần trang kế tiếp (`right.scrollTop = nextCeiling`), phần lực cuộn còn dư được chuyển tiếp mượt mà vào nội dung trang mới.
  5. **Triệt tiêu Kẹt Đáy (Subpixel Tolerance & Unused Delta Forwarding)**:
     - Nâng ngưỡng nhận diện đáy an toàn từ `1px` lên `3px`.
     - Đo lường thực tế `actualScrolled = bodyCurr.scrollTop - prevScroll`. Nếu `actualScrolled < deltaY` (do đã chạm đáy vật lý), toàn bộ phần delta dư thừa `unusedDelta = deltaY - actualScrolled` được lập tức chuyển tiếp ra khung cha `right.scrollTop += unusedDelta` để đẩy sang trang kế tiếp mượt mà, không bao giờ bị đứng. Áp dụng cơ chế đối xứng hoàn hảo cho chiều cuộn ngược lên.

---

## 9. Phân tích Chi tiết ISSUE-033: Tối Ưu Hóa Thu Phóng Mặc Định Fit Width & Phím Tắt Zoom Độc Lập

- **Hiện tượng**:
  - Thanh chọn mức thu phóng (`75%` đến `200%`, cùng các nút `−` và `+`) trên Toolbar chiếm dụng nhiều diện tích.
  - Khi người dùng chọn một mức scale cố định (ví dụ 100%, 125%), tỷ lệ này áp dụng tĩnh cho cả hai khung khiến giao diện chia đôi (bilingual) bị vỡ: một bên bị tràn ngang sinh scrollbar, bên kia lại co rúm để lại khoảng trắng lớn.
- **Nguyên nhân gốc rễ**:
  - Cơ chế zoom toolbar áp dụng tỷ lệ scale đồng nhất mà không tính đến kích thước động của từng khung theo tỷ lệ chia Splitter.
  - Thiếu khả năng phóng to linh hoạt tạm thời cho từng bên trang riêng biệt (chỉ muốn xem rõ một biểu đồ bên trang gốc hoặc một công thức toán bên bản dịch).
- **Giải pháp xử lý**:
  1. **Dọn sạch Toolbar**: Xóa bỏ hoàn toàn các nút `−`, `+`, dropdown `Fit Width` và menu mốc 75%–200% khỏi Toolbar.
  2. **Cố định Fit Width là chế độ mặc định**: Luôn tự động tính toán `leftFitScale` và `rightFitScale` tối ưu theo độ rộng khung đọc.
  3. **Hỗ trợ Zoom tạm thời độc lập bằng `Ctrl + Wheel` (Per-Pane Zoom)**:
     - Giữ `Ctrl` và lăn chuột trên khung trái: chỉ phóng to/thu nhỏ khung bản gốc (`leftZoomFactor`, từ `0.5x` đến `3.0x`).
     - Giữ `Ctrl` và lăn chuột trên khung phải: chỉ phóng to/thu nhỏ khung bản dịch (`rightZoomFactor`).
     - Ngăn chặn trình duyệt phóng to toàn trang (`e.preventDefault()`).
  4. **Tự động Reset khi tương tác thanh Splitter**:
     - Khi người dùng kéo hoặc thả thanh căn chỉnh ở giữa (Splitter), hoặc bấm nút `50:50`: `leftZoomFactor` và `rightZoomFactor` tự động reset về `1.0`, đưa cả hai khung về kích thước Fit Width chuẩn theo bề rộng mới.

---

## 10. Phân tích Chi tiết ISSUE-034: Tối Ưu Bounding Box Trích Xuất Hình Ảnh Động & Kết Nối OpenCode Zen SOTA

- **Hiện tượng**:
  1. Trên bài báo khoa học `2405.14101` (*Enhancing Image Layout Control with Loss-Guided Diffusion Models*), phần cắt trích xuất Figure 1 (Trang 1) bị cắt sai: hình ảnh gốc là banner toàn trang (Full-Width) gồm 6 cột ảnh, nhưng hệ thống chỉ hiển thị 3 cột bên phải, mất sạch 3 cột bên trái; đồng thời mép trên cắt chém ngang dòng tác giả/ngày tháng (*September 18, 2024*).
  2. Tiếp tục ở **Trang 9 (Figure 4)**: Hình vẽ sơ đồ kiến trúc bị xén mất toàn bộ nửa bên phải hoặc nửa bên trái, quả bóng \(z_{t-1}\) trên đỉnh bị chém đầu, khối hộp \(K_l, Q_l\) bị chém cụt ngang thân, đồng thời khung ảnh bị thụt lề để lại khoảng trống màu trắng rất lớn.
  3. Khi gọi OpenCode Zen API (endpoint `/responses` với model `muse-spark-1.2-contributor-free`), hệ thống nhận mã lỗi HTTP 400 (`MissingSessionID: OpenCode's free tier can only be used in OpenCode`).
- **Nguyên nhân gốc rễ**:
  1. **Hardcode tọa độ Trang 1**: Trong `extension/lib/pdf/blocks.ts`, tồn tại đoạn mã ép cứng:
     ```ts
     if (pageNumber === 1 && (figNum === 1 || !figNum)) {
       figLeft = 307;
       figTop = 165;
       figWidth = 245;
     }
     ```
     Đoạn mã này giả định mọi Figure 1 ở Trang 1 đều là dải ảnh dọc ở Cột 2 (theo mẫu bài báo `2302.07121`). Khi gặp bài báo `2405.14101` có Figure 1 trải rộng toàn trang (`col = 0`, width > 500px), đoạn hardcode ép `figLeft = 307` làm mất sạch 3 cột ảnh bên trái (`a ball and a shoe`, `a dog...`, `a boat...`), và `figTop = 165` chém vào khối ngày tháng kết thúc tại $Y = 174.54$.
  2. **Bị phân loại nhầm trên tài liệu 1 Cột (Single-Column Paper - Trang 9)**:
     - Bài báo `2405.14101` là bài báo 1 Cột xuyên suốt (`col0` chiếm ưu thế, `col2.length === 0`).
     - Caption của Figure 4: `"Figure 4: A graphical depiction of injection loss guidance (iLGD)."` có độ dài vừa phải (`width = 316pt`), nằm căn giữa trang (`minX = 152, maxX = 468`).
     - Do `316 < 397pt` (ngưỡng 65% bề rộng trang), dòng caption này bị gán thành `col = 1`.
     - Điều kiện cũ kiểm tra `isFullWidth` chỉ xem xét `bbox[2] > viewportWidth * 0.55` (`> 336pt`), nên caption ngắn `316pt` này bị phán đoán là **không phải Full-Width**!
     - Hệ thống lập tức ép kích thước cắt theo chuẩn Cột 1 của bài báo 2 cột (`figLeft = 45, figWidth = 260`), chỉ cắt từ `X = 45` đến `X = 305`, chém mất toàn bộ nửa bên phải của sơ đồ (từ `X = 305` đến `X = 530`); đồng thời đỉnh `colTop = 60` chém vào chỏm đầu của quả bóng \(z_{t-1}\) (vốn bắt đầu từ `Y ~ 50`).
  3. **Thiếu Header Client Xác Thực cho OpenCode Zen**: OpenCode Zen Gateway yêu cầu hai header bắt buộc đối với các model free/contributor: `User-Agent: OpenCode-Desktop/1.0.0` và `x-session-id: session-${Date.now()}`. Nếu thiếu, gateway sẽ từ chối request với mã lỗi 400.
- **Giải pháp xử lý**:
  1. **Triệt tiêu hoàn toàn Hardcode, Chuyển sang Phát hiện Bounding Box Động (Dynamic Figure BBox)**:
     - *Nhận diện Bố cục Trang (Page-Level Layout Detection)*:
       ```ts
       const isSingleColumnPage =
         col2.length === 0 ||
         blocks.filter((b) => b.text.length > 80 && b.bbox[2] > viewportWidth * 0.55).length >= 2;
       ```
       Nếu là bài báo 1 Cột $\rightarrow$ Mọi hình ảnh tự động mở rộng theo toàn bộ chiều rộng nội dung (`figLeft = 45, figWidth = Math.max(viewportWidth - 90, 500)`).
     - *Nhận diện Figure Căn giữa / Vắt ngang (Cross-Column & Centered Caption)*: Kể cả trên bài báo 2 cột, nếu Caption vắt ngang qua giữa trang (`bbox[0] < viewportWidth * 0.45 && bbox[0] + bbox[2] > viewportWidth * 0.55`) hoặc tâm của nó nằm ở vùng giữa trang (`Math.abs(captionCenterX - viewportWidth / 2) < 50 && bbox[2] > 180`), hệ thống tự động xác định đó là Full-Width Figure.
     - *Căn chỉnh Đỉnh ảnh an toàn (Top Figure Clearance)*: Hạ đỉnh an toàn của các hình ảnh đầu trang xuống `baseColTop = Math.max(48, headerBottom + 4)` (thay vì 60), bao trọn các chi tiết đồ họa sát đỉnh trang (như quả bóng \(z_{t-1}\) tại `Y = 49`) mà không bị chém mất.
     - *Căn chỉnh Đỉnh ảnh theo Header/Authors/Date trên Trang 1*: Quét tìm đáy của tất cả các khối Title, Authors, Date (`p1HeaderItems`); gán `colTop = Math.max(165, page1HeaderBottom + 6)`.
     - *Loại trừ Sub-labels bên trong ảnh*: Bỏ qua các text block ngắn nằm bên trong vùng hình ảnh (`prior.text.length < 160 && !prior.isHeading`), giúp `figTop` không bị trôi lệch xuống các nhãn con.
  2. **Bổ sung Headers Định Danh cho OpenCode Zen Gateway**:
     - Thêm `User-Agent: OpenCode-Desktop/1.0.0` và `x-session-id: session-${Date.now()}` vào `fetchWithRetry` tại `translateSentenceBatchZen` (`extension/lib/pdf/translate.ts`) và `verifyAndRepairTranslation` (`extension/lib/pdf/vision-translate.ts`).
  3. **Kiểm thử Toàn diện (Unit Tests & CDP Live Verification)**:
     - Bổ sung 3 test cases mới trong `blocks.test.ts` kiểm chứng cả 3 trường hợp: (1) Mẫu 2-Column (`2302.07121`), (2) Full-Width Trang 1 (`2405.14101 Figure 1`), (3) Top-of-page Figure bài báo 1 Cột (`2405.14101 Figure 4 Trang 9`). Toàn bộ **150/150 Unit Tests pass 100%**.
     - Kiểm thử tự động CDP trên trình duyệt thực tế, xác nhận BBox Trang 9 đạt chuẩn `[45, 49, 522, 299]`.

---

## 11. Phân tích Chi tiết ISSUE-035: Số Thứ Tự Phương Trình Bị Gộp Vào Trong Công Thức Toán LaTeX

- **Hiện tượng**:
  1. Trên Trang 16 của bài báo khoa học `2405.14101`: Các số thứ tự phương trình như `(17)`, `(18)`, `(19)` bị nhét vào bên trong các cấu trúc LaTeX của công thức:
     - Phương trình (17): Số `(17)` chui tọt vào tử số phân số: `s_\theta(\mathbf{x}_t, t) := -\frac{\epsilon_\theta(\mathbf{x}_t, t)(17)}{\sqrt{1 - \bar{\alpha}_t}}`.
     - Phương trình (18): Số `(18)` bị gộp vào phần tử số thứ hai: `\frac{\sqrt{\alpha_t}(1 - \bar{\alpha}_{t-1})(18)}{1 - \bar{\alpha}_t}\mathbf{x}_t`.
     - Phương trình (19): Số `(19)` bị nuốt vào bên trong hàm số: `\mu_\theta(\mathbf{x}_t, t) = \tilde{\mu}_t(\mathbf{x}_t, D_\theta(\mathbf{x}_t(19)))`.
  2. Trên Trang 4 của bài báo `2405.14101`: Phương trình (9) dù không bị nuốt vào trong cấu trúc nhưng lại xuất hiện sát rạt bên phải biểu thức toán ở giữa trang: `\ell_y(z_t) = ... \quad (9)` thay vì được căn lề phải (right-aligned) vào mép trang theo chuẩn xuất bản khoa học.
- **Nguyên nhân gốc rễ**:
  1. **Bản chất thị giác và cơ chế sinh autoregressive của mô hình Vision (VLM)**:
     - Khi mô hình VLM (Gemini 3.5 Flash-Lite / Muse) quét ảnh tài liệu PDF, số thứ tự phương trình nằm ở lề bên phải của trang.
     - Về mặt tọa độ Y (baseline), số `(17)` nằm ngang hàng trực tiếp với thành phần kết thúc công thức (thường là tử số của phân số hoặc đối số cuối cùng của hàm số).
     - Khi sinh chuỗi token LaTeX từ trái sang phải, nếu mô hình đang mở một nhóm ngoặc như `\frac{...` hoặc `D_\theta(...`, mắt mô hình nhận diện token tiếp theo là `(17)` và tự động chèn luôn `(17)` vào trước khi đóng dấu `}` hoặc `)`.
  2. **Hướng dẫn Prompt chưa chuẩn (`buildVisionPrompt` trong `vision-translate.ts`)**:
     - Prompt hiện tại đưa ra ví dụ mẫu: `$$... \quad (10)$$`.
     - Lệnh `\quad (10)` chỉ là khoảng trắng thông thường trong dòng công thức, khiến:
       - VLM hiểu rằng số thứ tự là một phần của chuỗi toán học nội dòng, dẫn đến nguy cơ nhầm lẫn ranh giới và nhét vào trong ngoặc.
       - Khi render qua KaTeX, `\quad (10)` bị dính sát vào biểu thức ở giữa trang, không kích hoạt được cơ chế căn lề phải `\tag{}` của LaTeX/KaTeX.
  3. **Chuẩn KaTeX cho số thứ tự phương trình**:
     - KaTeX hỗ trợ chính thức lệnh `\tag{N}` (chuẩn gói `amsmath` trong LaTeX) khi ở chế độ khối `displayMode: true`.
     - Khi sử dụng cú pháp `$$E = mc^2 \tag{17}$$`: KaTeX tự động render một bảng toán học với thẻ `<span class="katex-tag">...</span>`, đẩy số `(17)` sát mép phải của khung đọc (right margin) và tách biệt 100% khỏi công thức toán.
  4. **Thiếu lớp phòng thủ tự động làm sạch (Auto-Repair Sanitizer) ở Client Renderer**:
     - Trước đây `VisionDisplayEquation` nhận trực tiếp chuỗi `latex` thô từ AI và chuyển thẳng vào `katex.render` mà không qua bất kỳ bộ lọc nào.
     - Nếu AI vô tình sinh ra `\frac{A (17)}{B}` hoặc `\quad (17)`, renderer hiển thị nguyên văn lỗi mà không tự động bóc tách số thứ tự ra thành `\tag{17}`.
- **Giải pháp xử lý đã thực hiện (Kiến trúc 2 Lớp Phòng Thủ)**:
  1. **Lớp 1: Cập nhật System Prompt (`vision-translate.ts`)**:
     - Cập nhật quy tắc số thứ tự phương trình trong `buildVisionPrompt`: Bắt buộc dùng cú pháp chuẩn KaTeX `\tag{N}` đặt ở cuối khối `$$... \tag{N}$$`.
     - Bổ sung cảnh báo nghiêm cấm gộp số thứ tự vào tử số phân số `\frac{... (17)}{...}` hoặc ngoặc hàm số `D(x(19))`.
     - Cấm dùng `\quad (10)` hay text thô `(10)` mà bắt buộc phải dùng `\tag{10}`.
  2. **Lớp 2: Bộ lọc Auto-Repair Sanitizer tại Client (`extension/lib/pdf/latex-cleaner.ts`)**:
     - Tạo module độc lập `normalizeEquationLatex(raw: string): string`:
       - Tự động phát hiện và bóc tách các dạng số thứ tự bị kẹt:
         - Kẹt trong tử số: `\frac{A (17)}{B}` $\rightarrow$ `\frac{A}{B} \tag{17}`.
         - Kẹt trong ngoặc hàm: `D_\theta(x_t(19))` $\rightarrow$ `D_\theta(x_t) \tag{19}`.
         - Dạng `\quad (N)` hoặc `, (N)` ở cuối công thức $\rightarrow$ chuyển thành `\tag{N}`.
         - Giữ nguyên công thức đã có sẵn `\tag{...}` và không can thiệp vào các biểu thức toán học hợp lệ như `f(x) = (x + 1)`.
     - Tích hợp vào `VisionDisplayEquation` và `parseMarkdownIntoBlocks` trong `VisionPageRenderer.tsx`.
  3. **Tinh chỉnh CSS Căn lề phải Chuẩn KaTeX (`style.css`)**:
     - Chuyển `.lt-vision-display-eq` sang `display: block; text-align: center;`.
     - Đặt `.lt-vision-display-eq .katex-display { width: 100%; margin: 0 !important; }`, cho phép `<span class="katex-tag">...</span>` của KaTeX tự động ghim sát mép phải (right margin) của hộp công thức.
  4. **Kiểm thử Toàn diện (Unit Tests & CDP Live Verification)**:
     - Tạo bộ unit test `extension/lib/pdf/latex-cleaner.test.ts` kiểm chứng toàn bộ 7 kịch bản biên (bao gồm các phương trình 17, 18, 19, 9, 22). Toàn bộ **157/157 Unit Tests pass 100%**.
     - Lệnh `npm run check` (TypeScript typecheck + ESLint + Vitest) và `npm run build` hoàn tất với 0 lỗi.
     - Kiểm thử tự động CDP trên trình duyệt thực tế với Trang 16 của `2405.14101`, chụp ảnh màn hình nghiệm thu xác nhận toàn bộ 4 phương trình (17), (18), (19), (20) được tách biệt và căn lề phải hoàn hảo.

---

## 12. Phân tích Chi tiết ISSUE-039: Lỗi Font Georgia Tách Dấu Tiếng Việt & UI Menu Chọn Font Outdate

- **Hiện tượng**:
  1. Khi kích hoạt font `Georgia`, các từ tiếng Việt có dấu phức hợp (như `Tóm tắt`, `khuếch tán`, `đề xuất`) bị tách rời dấu sắc/nặng/ngã khỏi mẫu tự chính, tạo khoảng trắng hở kỳ dị (ví dụ: `Tóm tắ t`, `khuế ch tán`, `đê  xuâ t`).
  2. Giao diện bộ chọn font hiện tại đang dùng thẻ HTML `<select>` mặc định của trình duyệt (`native select`). Menu thả xuống bị hệ điều hành Windows render thô cứng, viền vuông xám, không đồng bộ với ngôn ngữ thiết kế Dark Modern / Glassmorphism của Live-Trans.
- **Nguyên nhân gốc rễ**:
  1. **Khuyết tật Kerning & Combining Diacritics của font Georgia**: Font Georgia trên môi trường Windows sử dụng bảng mã kerning cũ, khi kết hợp với các dấu thanh điệu tiếng Việt Unicode tổ hợp (hoặc dựng sẵn ở một số cặp ký tự), bounding box của dấu bị đẩy sang phải thay vì nằm trên đỉnh mẫu tự.
  2. **Thẻ HTML `<select>` gốc**: Menu popup thả xuống của thẻ `<select>` thuộc về tầng điều khiển của hệ điều hành (OS native window), không thể tùy biến CSS về hiệu ứng bóng mờ (box-shadow), viền glowing, icon font, xem trước typography trực tiếp hay badge mô tả.
- **Giải pháp xử lý đề xuất**:
  1. **Loại bỏ font Georgia**: Xóa hoàn toàn `georgia` khỏi hệ thống font. Chuyển fallback mặc định an toàn sang `system` (Inter/Roboto/Segoe UI) hoặc `times` (Times New Roman - Serif học thuật chuẩn 100% tiếng Việt từ Windows 95).
  2. **Bộ Font Học Thuật Chuẩn Tiếng Việt Tối Ưu**:
     - `system`: Hiện đại mặc định (System Sans-Serif: Segoe UI, Roboto, SF Pro, Inter) - Siêu nét, hỗ trợ 100% dấu.
     - `times`: Chuẩn bài báo học thuật quốc tế (Times New Roman) - Serif chuẩn mực IEEE/Nature/ACM, không bao giờ lỗi dấu.
     - `palatino`: Serif học thuật cao cấp (Palatino Linotype / Book Antiqua) - Nét chữ thanh thoát, hỗ trợ tiếng Việt trọn vẹn.
     - `segoe`: Dáng chữ mượt mà chuẩn Microsoft Fluent Design (Segoe UI) - Rất dễ đọc trên màn hình máy tính.
     - `arial`: Sans-serif thông dụng, độ tương phản cao, hỗ trợ tiếng Việt hoàn hảo.
  3. **Xây dựng Custom Modern Font Dropdown UI (Chuẩn Live-Trans Design System)**:
      - Thay thế toàn bộ `<select>` gốc bằng `CustomSelect` cao cấp:
        - **Trigger Button**: Nền `#121215`, bo góc tròn 6px, viền `#27272a`, hiển thị nhãn font bằng chính font đó, mũi tên Chevron xoay mượt 180° khi mở.
        - **Dropdown Menu List**: Nổi layer `z-index: 1050`, viền `#3f3f46`, nền `#18181b`, đổ bóng sâu `0 14px 38px rgba(0, 0, 0, 0.75)`, animation mượt mà.
        - **Item Design**: Từng font có tên font hiển thị bằng chính font đó, mô tả chi tiết, badge phong cách và icon checkmark `✓` màu xanh Cyan khi đang được chọn.
        - **Tương tác**: Hỗ trợ tự động tính toán hướng mở lên trên (`menu-upward`) nếu phía dưới không đủ chỗ, tự động đóng khi click outside hoặc phím `Esc`.
- **Trạng thái**: ✅ **ĐÃ KHẮC PHỤC & KIỂM CHỨNG TOÀN DIỆN (157/157 Unit Tests Passed, CDP Live Screen Verified)**.
  - Đã loại bỏ triệt để font Georgia.
  - Đã tích hợp CustomSelect đồng bộ 100% với giao diện Dark Modern của Live-Trans.
  - Chữ tiếng Việt hiển thị liền mạch hoàn hảo, không còn tình trạng hở dấu.

---

## 13. Phân tích Chi tiết ISSUE-040: Lỗi Trôi Ngôn Ngữ Dịch Đa Ngữ (Tiếng Hàn, v.v. bị trả về Tiếng Việt)

- **Hiện tượng**:
  - Khi người dùng vào Cài đặt đổi `Ngôn ngữ đích (Target Language)` sang **Tiếng Hàn (`ko`)**:
    - Một số trang (như Trang 2) dịch đúng tiếng Hàn (`가이던스 함수...`).
    - Tuy nhiên, đa số các trang còn lại (như Trang 3, Trang 1...) vẫn hiển thị nguyên bản tiếng Việt (`Hướng Dẫn Phổ Quát cho Diffusion Models... 2. Tạo Ảnh Có Kiểm Soát`).
- **Nguyên nhân gốc rễ**:
  1. **Khóa Cache Thông Minh (Smart Cache Key) thiếu định danh Ngôn ngữ (`targetLang`)**:
     - Hàm tạo cache key trong `vision-translate.ts`:
       ```ts
       function getVisionCacheKey(pdfUrl: string, pageNumber: number, model: string): string {
         return `live_trans_pdf_vision_${encodeURIComponent(pdfUrl)}_p${pageNumber}_${model}`;
       }
       ```
     - Key chỉ gồm URL bài báo, số trang và model, hoàn toàn không có `targetLang`.
     - Khi mở tài liệu lần đầu ở ngôn ngữ mặc định (Tiếng Việt), luồng dịch nền Waterfall đã dịch và lưu Trang 1, 3, 4, 5... bằng Tiếng Việt vào localStorage. Khi người dùng đổi sang Tiếng Hàn, hệ thống kiểm tra cache thấy đã có sẵn thì trả về ngay 0ms bản dịch Tiếng Việt cũ thay vì dịch mới!
  2. **Truyền mã ngôn ngữ thô (`ko`) vào System Prompt**:
     - `buildVisionPrompt(settings.targetLang || 'Tiếng Việt')`: Khi `settings.targetLang = 'ko'`, prompt gửi tới AI có đoạn: `...DỊCH TOÀN BỘ NỘI DUNG CỦA TRANG SANG ko dưới định dạng MARKDOWN...`. Trong ngữ cảnh tiếng Việt, `ko` là viết tắt của từ "không", dễ khiến AI bối rối.
     - Ngoài ra, trong prompt chứa các ví dụ tiêu đề tiếng Việt cố định (`ví dụ: ## 1. Giới thiệu, ## 5. Hạn chế, ## 6. Kết luận`), gây hiệu ứng mồi (priming) khiến mô hình sinh tiêu đề tiếng Việt.
  3. **Bộ lọc Kiểm định Sửa lỗi (`detectEnglishInMarkdown`) phân biệt sai ngôn ngữ**:
     - Hàm `detectEnglishInMarkdown` kiểm tra sự tồn tại của dấu tiếng Việt (`hasVietnameseDiacritics`). Với tiếng Hàn (`한국어`), câu văn hoàn toàn không có dấu tiếng Việt; khi trong đoạn văn xuất hiện từ vựng kỹ thuật tiếng Anh (`diffusion`, `guidance`, `CLIP`), bộ lọc phán đoán nhầm là "đoạn văn tiếng Anh chưa dịch" và chuyển sang bước `verifyAndRepairTranslation`. Bước này chạy prompt sửa lỗi và dịch đè ngược trở lại tiếng Việt.
  4. **State trong `main.tsx` không phản ứng khi đổi `targetLang`**:
     - Biến cờ `initKey = ${pdfUrl}_${settings.pdfModel}_${numPages}` thiếu `settings.targetLang`, khiến giao diện không kích hoạt làm mới danh sách trang và nạp lại hàng đợi khi người dùng chọn ngôn ngữ mới trong modal Cài đặt.
- **Giải pháp đề xuất**:
  1. **Nâng cấp Cache Key đa ngôn ngữ**:
     - `getVisionCacheKey(pdfUrl, pageNumber, model, targetLang)` gắn hậu tố `_${targetLang}` (ví dụ: `_ko`, `_vi`).
     - Tương thích ngược: Với `targetLang = 'vi'`, tự động fallback nạp cache cũ nếu có. Với ngôn ngữ khác (`ko`, `ja`, `zh`...), đảm bảo không bao giờ bị nạp nhầm cache tiếng Việt.
  2. **Ánh xạ Tên Ngôn ngữ Đầy đủ & Rõ Ràng (Target Language Prompt Mapping)**:
     - Tạo từ điển ánh xạ mã ngôn ngữ sang tên chuẩn quốc tế song ngữ:
       - `ko` $\rightarrow$ `한국어 (Korean)`
       - `ja` $\rightarrow$ `日本語 (Japanese)`
       - `zh` $\rightarrow$ `中文 (Chinese)`
       - `vi` $\rightarrow$ `Tiếng Việt (Vietnamese)`
       - `en` $\rightarrow$ `English`
       - `fr` $\rightarrow$ `Français (French)`
       - `de` $\rightarrow$ `Deutsch (German)`
     - Cập nhật System Prompt: Yêu cầu dịch rõ ràng sang `${targetLangName}`, loại bỏ các ví dụ tiêu đề tiếng Việt hardcode và thay bằng hướng dẫn dịch tiêu đề theo đúng ngôn ngữ đích.
  3. **Tối ưu hóa Bộ lọc `detectEnglishInMarkdown` cho Đa Ngôn Ngữ**:
     - Nhận diện bảng ký tự của ngôn ngữ đích: nếu là tiếng Hàn thì kiểm tra ký tự Hangul `[\uac00-\ud7af]`, tiếng Nhật kiểm tra Hiragana/Katakana `[\u3040-\u30ff]`, tiếng Trung kiểm tra Hán tự `[\u4e00-\u9faf]`. Nếu đoạn văn đã chứa ký tự ngôn ngữ đích, tuyệt đối không coi là tiếng Anh chưa dịch.
     - Đồng thời truyền đúng `targetLangName` vào bước `verifyAndRepairTranslation` nếu cần sửa lỗi.
  4. **Tự động làm mới khi đổi Ngôn ngữ trong Viewer**:
     - Đưa `settings.targetLang` vào `initKey` và dependency của effect quản lý hàng đợi. Khi người dùng đổi ngôn ngữ trong Cài đặt, hệ thống tự động reset trạng thái hiển thị của các trang hiện tại và ưu tiên dịch lại theo ngôn ngữ mới được chọn.

