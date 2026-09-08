# Scope: Modular Decoupling Plan for viewer/main.tsx

## Architecture
- Mục tiêu: Bóc tách file khổng lồ `extension/entrypoints/viewer/main.tsx` (~2,430 dòng) thành các Sub-components, Custom Hooks và Utility modules nhỏ gọn (< 400 dòng/file).
- Giữ vững toàn vẹn 100% chức năng: Vision AI, Whiteboard, Cuộn đồng bộ Page-to-Page kèm khóa trần, Cài đặt đa theme, Font family dropdown, Đa API Key, Bộ nhớ đệm bền vững đa ngôn ngữ.
- Bảo toàn tuyệt đối 161/161 unit tests hiện có.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Settings Modal & Tab Panes | ~600 dòng JSX & handlers (Appearance, Models/API, Performance/Memory, Themes, Custom font select, Scale controls) | M1 & M2 | ORIGINAL_REQUEST.md |
| 2 | Viewer Toolbar & Mode Selectors | ~250 dòng (Brand info, Page nav, Fit Width zoom reset, Segmented view mode, Vision AI / Whiteboard dropdown) | M1 & M2 | ORIGINAL_REQUEST.md |
| 3 | ScrollSync & Ceiling-Lock Engine | ~350 dòng logic sự kiện wheel, scroll listener hai chiều và giải thuật clamp trần trang | M1 & M2 | ORIGINAL_REQUEST.md |
| 4 | Multi-Worker Dual-Priority Queue | ~300 dòng quản lý highPriorityQueueRef, waterfallQueueRef, pacing delay, preemption window | M1 & M2 | ORIGINAL_REQUEST.md |
| 5 | Sub-components Specification | Thiết kế danh sách components mới (< 400 dòng/file) | M2 | ORIGINAL_REQUEST.md |
| 6 | Custom Hooks Specification | Thiết kế danh sách hooks mới (< 400 dòng/file) | M2 | ORIGINAL_REQUEST.md |
| 7 | Interfaces & Contracts | Định nghĩa TypeScript Interfaces cho State, Props, Callbacks giữa main.tsx và sub-components | M2 | ORIGINAL_REQUEST.md |
| 8 | Decoupling Documentation | Soạn thảo docs/MODULAR_DECOUPLING_PLAN.md đầy đủ biểu đồ, cấu trúc và lộ trình 3 pha | M3 | ORIGINAL_REQUEST.md |
| 9 | Architecture Audit & Review | Phản biện đa chiều, rà soát tính khả thi và zero-regression | M4 | ORIGINAL_REQUEST.md |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Khảo sát & Bóc tách 4 Khối Logic | Đoạn dòng, hooks, refs, states, handlers trong viewer/main.tsx | none | PLANNED |
| M2 | Thiết kế Kiến trúc Phân rã Module | Sub-components, Hooks, Type contracts, Data flow | M1 | PLANNED |
| M3 | Xây dựng Báo cáo MODULAR_DECOUPLING_PLAN.md | Lập báo cáo hoàn chỉnh tại docs/MODULAR_DECOUPLING_PLAN.md | M2 | PLANNED |
| M4 | Rà soát & Thẩm định Phản biện Kiến trúc | Đánh giá độc lập chất lượng thiết kế, kiểm tra zero-regression | M3 | PLANNED |

## Interface Contracts
- Sẽ được chuẩn hóa chi tiết ở Milestone 2 dựa trên kết quả khảo sát từ Milestone 1.

## Code Layout
- Target Blueprint:
  - `extension/entrypoints/viewer/components/` (ViewerToolbar, SettingsModal/, etc.)
  - `extension/entrypoints/viewer/hooks/` (useVisionWorkerQueue, useSyncScroll, usePdfDocument, etc.)
  - `extension/entrypoints/viewer/types/` (viewer contracts, state interfaces)
  - `extension/entrypoints/viewer/main.tsx` (< 300 dòng điều phối tinh gọn)
