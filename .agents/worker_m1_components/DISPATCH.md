# DISPATCH: Worker Milestone 1 — Trích xuất 13 UI Sub-components

## Mục tiêu nhiệm vụ
Thực hiện Giai đoạn 1 (Milestone 1) trong kế hoạch tái cấu trúc phân rã module `extension/entrypoints/viewer/main.tsx` theo thiết kế chuẩn mực tại `docs/MODULAR_DECOUPLING_PLAN.md`.

## Nhiệm vụ cụ thể
Trích xuất toàn bộ 13 UI Sub-components độc lập cùng các tệp Types TypeScript vào `extension/entrypoints/viewer/components/`:
1. `components/Toolbar/types.ts`
2. `components/Toolbar/ViewerToolbar.tsx`
3. `components/Toolbar/ModeSelectorDropdown.tsx`
4. `components/Toolbar/PageNavigator.tsx`
5. `components/SettingsModal/types.ts`
6. `components/SettingsModal/SettingsModal.tsx`
7. `components/SettingsModal/AppearanceTab.tsx`
8. `components/SettingsModal/ModelsTab.tsx`
9. `components/SettingsModal/PerformanceTab.tsx`
10. `components/SettingsModal/PostSavePromptModal.tsx`
11. `components/ApiKeyWarningBanner.tsx`
12. `components/SidebarDrawer.tsx`
13. `components/DraggableSplitter.tsx`
14. `components/PageRenderer.tsx` (trích xuất từ dòng 2213 của main.tsx)
15. `components/FlowBlock.tsx` (trích xuất từ dòng 2336 của main.tsx)
16. `components/types.ts` (các interfaces cho SidebarDrawer, DraggableSplitter, PageRenderer, FlowBlock theo bản vẽ)

## Phạm vi quyền ghi (Write Ownership)
- Toàn quyền tạo mới và chỉnh sửa các file trong `extension/entrypoints/viewer/components/**`.
- Được phép cập nhật `extension/entrypoints/viewer/main.tsx` để import `PageRenderer` và `FlowBlock` từ `components/` (xóa 2 component này ở cuối main.tsx nếu cần) nhằm đảm bảo không bị duplicate identifier và code vẫn chạy bình thường.
- KHÔNG làm hỏng logic hiện tại của `main.tsx`.

## Yêu cầu chất lượng & Ràng buộc
- Đảm bảo giữ nguyên 100% CSS classes, inline styles, responsive layout, và behavior.
- Mỗi file mới tạo phải < 400 dòng mã nguồn.
- Chạy xác minh:
  - `npm.cmd run typecheck` không có lỗi.
  - `npm.cmd test` toàn bộ 161/161 tests PASS 100%.
- Báo cáo kết quả chi tiết trong `handoff.md` tại thư mục làm việc của bạn.

## 2026-09-08T12:59:33Z
Bạn là Worker chuyên trách thực hiện Milestone 1: Trích xuất 13 UI Sub-components cho Live-Trans Viewer.
Thư mục làm việc: d:\create\Live-Trans\.agents\worker_m1_components
Tài liệu tham chiếu:
1. ORIGINAL_REQUEST.md
2. docs/MODULAR_DECOUPLING_PLAN.md
3. extension/entrypoints/viewer/main.tsx
4. DISPATCH.md

