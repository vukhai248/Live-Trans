# Progress — Milestone 3: Tinh Giản App Shell main.tsx

Last visited: 2026-09-08T13:32:30Z

- [x] Khảo sát kiến trúc `MODULAR_DECOUPLING_PLAN.md` (mục 5.3) và các tệp liên quan.
- [x] Kiểm tra các Sub-components (`components/Toolbar`, `components/SettingsModal`, `DraggableSplitter`, `SidebarDrawer`, `PageRenderer`, `ApiKeyWarningBanner`).
- [x] Kiểm tra các Custom Hooks (`usePdfDocument`, `useSettingsManager`, `useVisionWorkerQueue`, `useSyncScroll`).
- [x] Khởi tạo BRIEFING.md và progress.md.
- [x] Tái cấu trúc `extension/entrypoints/viewer/main.tsx` thành App Shell tinh gọn (giảm từ 2,215 dòng xuống 263 dòng, < 300 dòng).
- [x] Xác minh: `npm.cmd run typecheck` (0 lỗi).
- [x] Xác minh: `npm.cmd test` (161/161 tests PASS).
- [x] Xác minh: `npm.cmd run lint` (0 lỗi).
- [x] Xác minh: `npm.cmd run build` (build thành công).
- [x] Viết `handoff.md` và gửi tin nhắn hoàn thành cho parent.
