## 2026-09-08T12:18:05Z

[USER REQUEST]
Bạn là Project Orchestrator phụ trách dự án Live-Trans.
Thư mục làm việc của bạn: d:\create\Live-Trans\.agents\teamwork_preview_orchestrator_2
Yêu cầu gốc từ người dùng được ghi tại: d:\create\Live-Trans\.agents\ORIGINAL_REQUEST.md (mục ## 2026-09-08T12:16:07Z).

Nhiệm vụ:
Áp dụng chế độ tư duy sâu (High Thinking Mode), phân tích phản biện đa chiều, khảo sát và rà soát chi tiết từng dòng lệnh, từng hook, từng ref, và từng interface trong ~2,430 dòng của file extension/entrypoints/viewer/main.tsx và các file liên quan.
Xây dựng và lập Báo cáo Phân rã Module & Kiến trúc Tái cấu trúc chi tiết tại docs/MODULAR_DECOUPLING_PLAN.md nhằm bóc tách thành các Sub-components, Custom Hooks và Utility modules nhỏ gọn (< 400 dòng/file), nâng cao tối đa khả năng bảo trì và mở rộng về sau mà không gây hồi quy tính năng.

Chi tiết các yêu cầu cần hoàn thành:
1. R1. Khảo sát & Bóc tách Logic File Khổng Lồ viewer/main.tsx (~2,430 dòng):
   Phân tích toàn bộ mã nguồn, định danh và phân loại ranh giới trách nhiệm của 4 khối logic lớn kèm số dòng cụ thể:
   - Khối Modal Cài đặt (Settings Modal & Tab Panes): ~600 dòng JSX và handlers (Giao diện & Đọc, Mô hình AI & API, Hiệu năng & Bộ nhớ, Themes, Font custom select, Scale controls).
   - Khối Thanh Công Cụ (Viewer Toolbar & Mode Selectors): ~250 dòng (Brand info, Page navigation, Fit Width zoom reset, Segmented view mode, Vision AI / Whiteboard dropdown).
   - Khối Điều phối Cuộn Đồng Bộ & Khóa Trần (ScrollSync & Ceiling-Lock Engine): ~350 dòng logic sự kiện wheel, scroll listener hai chiều và giải thuật clamp trần trang.
   - Khối Hàng Đợi Song Song & Worker Engine (Multi-Worker Dual-Priority Queue): ~300 dòng quản lý highPriorityQueueRef, waterfallQueueRef, pacing delay, preemption window.
2. R2. Thiết kế Kiến trúc Phân rã Module Chi tiết (Decoupling Architecture Blueprint):
   - Đề xuất danh sách Sub-components mới (< 400 dòng/file), ví dụ: components/ViewerToolbar.tsx, components/SettingsModal/SettingsModal.tsx, components/SettingsModal/AppearanceTab.tsx, components/SettingsModal/ModelsTab.tsx, components/SettingsModal/PerformanceTab.tsx.
   - Đề xuất danh sách Custom Hooks mới (< 400 dòng/file), ví dụ: hooks/useVisionWorkerQueue.ts, hooks/useSyncScroll.ts, hooks/usePdfDocument.ts.
   - Định nghĩa đầy đủ Interfaces & Contracts TypeScript: State, Props, Callbacks giữa main.tsx và các components con để giữ cho component cha cực kỳ tinh gọn (< 300 dòng).
3. R3. Lập Báo cáo Kiểm toán & Lộ trình Thực thi Không Gãy (Roadmap & Zero-Regression Strategy):
   - Viết tài liệu đầy đủ vào docs/MODULAR_DECOUPLING_PLAN.md.
   - Sơ đồ cấu trúc cây thư mục trước và sau khi bóc tách.
   - Sơ đồ luồng dữ liệu (Data flow diagram) và quản lý State tập trung.
   - Chiến lược thực thi theo từng giai đoạn an toàn (Phase 1: Tách UI độc lập -> Phase 2: Tách Hooks -> Phase 3: Thu gọn main.tsx), cam kết bảo toàn 100% tính năng hiện tại và 161/161 unit tests.

Quy định vận hành:
- Bạn là Orchestrator. Hãy phân rã công việc và điều phối các chuyên gia (ví dụ explorer để khảo sát chi tiết từng block trong main.tsx, worker để phân tích sâu từng hook/ref/interface, worker để viết tài liệu kiến trúc, reviewer để rà soát phản biện).
- Duy trì thường xuyên progress.md và BRIEFING.md trong thư mục làm việc của bạn.
- Khi hoàn thành toàn bộ tài liệu docs/MODULAR_DECOUPLING_PLAN.md, báo cáo lại cho Sentinel kèm bản tóm tắt chi tiết để Sentinel kích hoạt Victory Auditor.
