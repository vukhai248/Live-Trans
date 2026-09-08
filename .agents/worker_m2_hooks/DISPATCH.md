# DISPATCH: Worker Milestone 2 — Trích xuất 4 Custom Hooks Điều Phối

## 2026-09-08T13:11:25Z

### Mục tiêu nhiệm vụ
Thực hiện Giai đoạn 2 (Milestone 2) theo thiết kế chuẩn mực tại `docs/MODULAR_DECOUPLING_PLAN.md`: Trích xuất toàn bộ 4 Custom Hooks điều phối logic phức tạp từ `extension/entrypoints/viewer/main.tsx` vào `extension/entrypoints/viewer/hooks/`.

### Nhiệm vụ cụ thể
Tạo thư mục `extension/entrypoints/viewer/hooks/` và tạo 5 tệp:
1. `hooks/types.ts`: Interface hợp đồng TypeScript cho 4 hooks (xem chi tiết mục 3.3.D trong `docs/MODULAR_DECOUPLING_PLAN.md`).
2. `hooks/usePdfDocument.ts`:
   - Nạp PDF từ URL params (`url`), khởi tạo `PDFDocumentProxy`, trích xuất metadata tiêu đề `docTitle`.
   - Tính toán `leftFitScale` và `rightFitScale` độc lập dựa trên khổ rộng 612pt và lắng nghe sự kiện window resize.
   - Trả về: `{ pdfUrl, docTitle, pdfDoc, numPages, errorMsg, leftFitScale, rightFitScale, calculatePaneFitScale }`.
3. `hooks/useSettingsManager.ts`:
   - Quản lý state `settings` đồng bộ `chrome.storage.local`.
   - Cập nhật tức thời `updateSettingDirect`.
   - Quản lý danh sách API Key: thêm, xóa, mask key, Smart Router badge, xác định `hasActiveKey`.
   - Quản lý modal states: `isSettingsOpen`, `isPostSavePromptOpen`.
   - Tự động hiển thị huy hiệu đã lưu `showAutoSaveBadge` với timer tự tắt.
4. `hooks/useVisionWorkerQueue.ts`:
   - Dual-Priority Queue: `highPriorityQueueRef` (ưu tiên tuyệt đối) và `waterfallQueueRef` (nền 1..N).
   - Multi-Worker Pool: Coroutines `runVisionWorker` với số luồng 2..7 (`settings.viewerWorkerConcurrency`).
   - Batch Preemption Window: Cụm cửa sổ ưu tiên kích thước `concurrency` khi người dùng dừng mắt.
   - Debounce 300ms cho việc đổi trang ưu tiên (`debouncedPrioritizePage`).
   - Pacing Delay 400ms giữa các trang nền kèm cơ chế ngắt tức thì `wakePacingTimerRef`.
   - Rate-limit 429 Guard: Tự động đóng băng hàng đợi thác nước khi gặp lỗi quota/429.
   - Kiểm tra LRU Cache 0ms qua đa model trước khi gọi API mạng.
   - Anti-race token cho từng trang (`visionTokenRef[pageNumber]`).
   - **LƯU Ý CỰC KỲ QUAN TRỌNG**: Giữ nguyên các `useRef` nội bộ bên trong hook (`pageVisionStatusRef`, `pageVisionTranslationsRef`, `isRateLimitedRef`, `wakePacingTimerRef`, v.v.) để tránh hiện tượng **Stale Closure** trong vòng lặp bất đồng bộ `runVisionWorker`.
5. `hooks/useSyncScroll.ts`:
   - Quản lý `leftPaneRef`, `rightPaneRef`.
   - Cờ Mutex `isSyncingScroll` mở khóa bằng `requestAnimationFrame`.
   - Thuật toán gióng hàng hai chiều Page-to-Page (`handleLeftScroll`, `handleRightScroll`).
   - Bộ điều phối cột đọc thông minh & Khóa Trần (Ceiling-Lock Engine) và bỏ qua vùng lề đen (Side-Margin Bypass).
   - Quản lý Zoom Ctrl+Wheel độc lập 2 pane, tính toán `effectiveLeftScale`, `effectiveRightScale`, `resetZoom`.

### Quyền hạn & Ràng buộc
- Toàn quyền tạo và sửa các tệp trong `extension/entrypoints/viewer/hooks/**`.
- Không có file mới nào được vượt quá 400 dòng mã nguồn.
- Chạy kiểm tra:
  - `npm.cmd run typecheck`: 0 lỗi TypeScript.
  - `npm.cmd test`: 161/161 tests PASS 100%.
  - `npm.cmd run lint`: 0 lỗi ESLint.
- Ghi nhận chi tiết trong `handoff.md` tại thư mục của bạn và gửi tin nhắn hoàn thành cho Orchestrator.
