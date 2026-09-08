# KẾ HOẠCH THỰC THI PHÂN RÃ MODULAR CHO `viewer/main.tsx`

**Tài liệu tham chiếu**: `docs/MODULAR_DECOUPLING_PLAN.md`  
**Mục tiêu**: Phân rã `extension/entrypoints/viewer/main.tsx` (2,429 dòng) thành 13 Sub-components và 4 Custom Hooks. Đảm bảo zero-regression (161/161 tests pass, 0 lỗi TypeScript/lint, build thành công), không có file con nào vượt quá 400 dòng, `main.tsx` < 300 dòng.

---

## Các Milestone Thực Thi Chi Tiết

### Milestone 1: Trích xuất 13 UI Sub-components Độc Lập
- **Thư mục mục tiêu**: `extension/entrypoints/viewer/components/`
- **Các tệp cần tạo**:
  1. `components/Toolbar/types.ts`: Interface props cho phân hệ Toolbar.
  2. `components/Toolbar/ViewerToolbar.tsx`: Khung Toolbar, brand, action buttons (~160 dòng).
  3. `components/Toolbar/ModeSelectorDropdown.tsx`: Dropdown chọn ReaderMode (~80 dòng).
  4. `components/Toolbar/PageNavigator.tsx`: Điều hướng trang (~45 dòng).
  5. `components/SettingsModal/types.ts`: Interface props cho phân hệ SettingsModal.
  6. `components/SettingsModal/SettingsModal.tsx`: Container shell modal, sidebar nav, topbar (~120 dòng).
  7. `components/SettingsModal/AppearanceTab.tsx`: Tab Themes, fonts, scale & live preview (~190 dòng).
  8. `components/SettingsModal/ModelsTab.tsx`: Tab Model, Smart Router, Multi-Key Manager (~160 dòng).
  9. `components/SettingsModal/PerformanceTab.tsx`: Tab Concurrency, TargetLang, Clear cache (~90 dòng).
  10. `components/SettingsModal/PostSavePromptModal.tsx`: Popup hỏi dịch lại sau khi lưu key (~80 dòng).
  11. `components/ApiKeyWarningBanner.tsx`: Banner cảnh báo chưa có API key (~35 dòng).
  12. `components/SidebarDrawer.tsx`: Drawer danh sách trang kèm status badges (~110 dòng).
  13. `components/DraggableSplitter.tsx`: Thanh kéo chia đôi tỷ lệ 2 pane (~85 dòng).
  14. `components/PageRenderer.tsx`: Trích xuất từ cuối main.tsx (dòng 2213, ~125 dòng).
  15. `components/FlowBlock.tsx`: Trích xuất từ cuối main.tsx (dòng 2336, ~95 dòng).
- **Tiêu chí kiểm chứng độc lập**: `npm.cmd run typecheck` thành công, 161/161 tests pass.

---

### Milestone 2: Trích xuất 4 Custom Hooks Điều Phối Logic
- **Thư mục mục tiêu**: `extension/entrypoints/viewer/hooks/`
- **Các tệp cần tạo**:
  1. `hooks/types.ts`: Interface và types cho các hook (~60 dòng).
  2. `hooks/usePdfDocument.ts`: Tải file PDF từ URL query, khởi tạo PDFDocumentProxy, trích xuất metadata tiêu đề, tính toán Fit Scale và window resize listener (~120 dòng).
  3. `hooks/useSettingsManager.ts`: Quản lý state settings, lưu vào chrome.storage, quản lý API keys (thêm, xóa, mask), auto-save 0ms badge timer và modal states (~170 dòng).
  4. `hooks/useVisionWorkerQueue.ts`: Dual-priority queue (`highPriorityQueueRef` & `waterfallQueueRef`), pool 2-7 workers, batch preemption window, pacing delay 400ms, tự ngắt khi 429 quota guard, 0ms LRU cache lookup, generation tokens (~290 dòng).
  5. `hooks/useSyncScroll.ts`: Cuộn đồng bộ 2 chiều Page-to-Page, Mutex rAF lock, zoom Ctrl+Wheel độc lập, Ceiling-Lock Engine và Side-Margin Bypass (~250 dòng).
- **Tiêu chí kiểm chứng độc lập**: `npm.cmd run typecheck` thành công, 161/161 tests pass.

---

### Milestone 3: Tinh Giản & Hoàn Thiện App Shell `viewer/main.tsx`
- **Mục tiêu**:
  - Tái cấu trúc `viewer/main.tsx` thành App Shell tinh gọn: kết nối 4 Hooks và render 13 Sub-components.
  - Xóa bỏ toàn bộ mã nguồn trùng lặp đã được di chuyển sang sub-components và hooks.
  - Đảm bảo `main.tsx` < 300 dòng (mục tiêu ~220 dòng).
- **Tiêu chí kiểm chứng độc lập**:
  - `npm.cmd run typecheck` không có lỗi nào.
  - `npm.cmd test` 161/161 tests passed 100%.
  - `npm.cmd run build` đóng gói extension thành công.

---

### Milestone 4: Verification, Adversarial Testing & Forensic Integrity Audit
- **Mục tiêu**:
  - Reviewer độc lập thẩm định tính toàn vẹn và sạch sẽ của code base.
  - Challenger kiểm thử các trường hợp biên và stress testing.
  - Forensic Auditor kiểm định tính toàn vẹn (không cheat, không hardcode kết quả, không làm mất tính năng).
  - Xác nhận Gate Status PASS toàn bộ.
- **Tiêu chí hoàn thành**: Báo cáo tổng kết Victory Claim gửi về Sentinel.
