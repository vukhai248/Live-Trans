# Task Assignment: Worker Decoupling Architect

## Mission
Xây dựng và lập Báo cáo Phân rã Module & Kiến trúc Tái cấu trúc hoàn chỉnh tại `docs/MODULAR_DECOUPLING_PLAN.md` dựa trên kết quả khảo sát từ 3 Explorer (M1-1, M1-2, M1-3).

## Tài liệu đầu vào bắt buộc đọc
1. `d:\create\Live-Trans\.agents\ORIGINAL_REQUEST.md` (mục ## 2026-09-08T12:16:07Z)
2. `d:\create\Live-Trans\.agents\explorer_m1_1\handoff.md` (Khảo sát Settings Modal & Toolbar)
3. `d:\create\Live-Trans\.agents\explorer_m1_2\handoff.md` (Khảo sát ScrollSync & Vision Worker Queue)
4. `d:\create\Live-Trans\.agents\explorer_m1_3\handoff.md` (Khảo sát Tổng thể & Bản đồ Phụ thuộc)

## Yêu cầu nội dung cho `docs/MODULAR_DECOUPLING_PLAN.md`:
1. **Executive Summary & Bảng chỉ số mục tiêu**:
   - Thống kê hiện trạng: 2,429 dòng.
   - Thống kê mục tiêu: `main.tsx` < 300 dòng (~220 dòng), tất cả các file sub-components và hooks mới đều < 400 dòng (hầu hết < 250 dòng).
   - Cam kết bảo toàn 100% tính năng và 161/161 unit tests.
2. **Khảo sát Hiện trạng & Bóc tách 4 Khối Logic Lớn**:
   - Khối 1: Modal Cài đặt (Settings Modal & Tab Panes): Dòng 1337-1863 (527 dòng), PostSave: dòng 1866-1944 (79 dòng), Warning: dòng 1947-1972 (26 dòng).
   - Khối 2: Thanh Công Cụ (Viewer Toolbar & Mode Selectors): Dòng 1102-1335 (234 dòng).
   - Khối 3: Điều phối Cuộn Đồng Bộ & Khóa Trần (ScrollSync & Ceiling-Lock Engine): Dòng 107-139, 608-737, 739-940, 1062-1076 (~350 dòng).
   - Khối 4: Hàng Đợi Song Song & Worker Engine (Multi-Worker Dual-Priority Queue): Dòng 221-229, 286-460, 462-606, 1023-1041 (~300 dòng).
3. **Bản vẽ Thiết kế Kiến trúc Phân rã Module Chi tiết (Decoupling Blueprint)**:
   - Danh sách Sub-components mới kèm số dòng dự kiến và trách nhiệm.
   - Danh sách Custom Hooks mới kèm số dòng dự kiến và trách nhiệm.
   - Toàn bộ Interfaces & Contracts TypeScript (State, Props, Callbacks).
4. **Sơ đồ Cây Thư mục & Sơ đồ Luồng Dữ liệu**:
   - Sơ đồ cây thư mục Trước và Sau khi bóc tách.
   - Sơ đồ ASCII Data Flow & State Management.
5. **Lộ trình Thực thi An toàn 3 Giai đoạn (Zero-Regression Strategy)**:
   - Phase 1: Tách UI Sub-components độc lập.
   - Phase 2: Tách Custom Hooks điều phối logic phức tạp.
   - Phase 3: Thu gọn và hoàn thiện `main.tsx` (< 300 dòng).
6. **Kế hoạch Kiểm chứng & Bảo toàn 161/161 Unit Tests**.

## Yêu cầu đầu ra:
- Tạo và ghi nội dung hoàn chỉnh vào `docs/MODULAR_DECOUPLING_PLAN.md`.
- Ghi báo cáo `handoff.md` tại `d:\create\Live-Trans\.agents\worker_decoupling_architect\handoff.md`.
- Gửi tin nhắn `send_message` thông báo hoàn tất tới parent.
