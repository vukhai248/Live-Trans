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
