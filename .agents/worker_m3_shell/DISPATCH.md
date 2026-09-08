# DISPATCH: Worker Milestone 3 — Tinh Giản App Shell `viewer/main.tsx`

## Mục tiêu nhiệm vụ
Thực hiện Giai đoạn 3 (Milestone 3) theo thiết kế chuẩn mực tại `docs/MODULAR_DECOUPLING_PLAN.md` (đặc biệt mục 5.3):
Tinh giản toàn diện tệp `extension/entrypoints/viewer/main.tsx` từ ~2,215 dòng hiện tại thành một App Shell tinh gọn, thanh thoát với dung lượng < 300 dòng (mục tiêu ~220 dòng).

## Nhiệm vụ cụ thể
1. Đọc và kết nối đầy đủ:
   - 4 Custom Hooks từ `./hooks`:
     - `usePdfDocument`
     - `useSettingsManager`
     - `useVisionWorkerQueue`
     - `useSyncScroll`
   - 13 Sub-components từ `./components`:
     - `./components/Toolbar/ViewerToolbar`
     - `./components/SettingsModal/SettingsModal`
     - `./components/SettingsModal/PostSavePromptModal`
     - `./components/ApiKeyWarningBanner`
     - `./components/SidebarDrawer`
     - `./components/DraggableSplitter`
     - `./components/PageRenderer`
     - Cùng các component hiện có: `./VisionPageRenderer`, `./WhiteboardPageRenderer`
2. Tái cấu trúc component `ViewerApp` trong `extension/entrypoints/viewer/main.tsx`:
   - Giữ lại các local states giao diện đơn giản (`viewMode`, `readerMode`, `isModeMenuOpen`, `sidebarOpen`, `isSidebarPinned`, `splitRatio`, `isDraggingSplitter`, `hoveredSentenceId`).
   - Kết nối 4 Hooks và truyền dữ liệu/callbacks chuẩn mực vào các sub-components theo thiết kế tại mục 5.3 của `MODULAR_DECOUPLING_PLAN.md`.
   - Giữ lại hàm `handleReset5050` để đặt lại tỷ lệ chia đôi và reset zoom.
   - Giữ lại `render(<ViewerApp />, document.getElementById('app')!)` ở cuối file.
   - Xóa bỏ toàn bộ mã nguồn cũ đã được chuyển giao vào các hooks và sub-components (không để sót code thừa).
3. Đảm bảo:
   - File `extension/entrypoints/viewer/main.tsx` sau khi tái cấu trúc có dung lượng **< 300 dòng** (mục tiêu ~220 dòng).
   - Bảo toàn 100% các class CSS, inline styles (`--lt-font-scale`, `--lt-font-family`, theme classes), hành vi và tính năng.
4. Chạy xác minh toàn diện:
   - `npm.cmd run typecheck`: 0 lỗi TypeScript.
   - `npm.cmd test`: 161/161 unit tests PASS 100%.
   - `npm.cmd run lint`: 0 lỗi ESLint.
   - `npm.cmd run build`: Build extension thành công.
5. Viết báo cáo `handoff.md` chi tiết tại thư mục của bạn và gửi tin nhắn hoàn thành cho Orchestrator.
