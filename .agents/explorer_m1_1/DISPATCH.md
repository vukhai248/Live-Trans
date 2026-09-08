# Task Assignment: Explorer M1-1

## Mission
Khảo sát và phân tích chuyên sâu (line-by-line) 2 khối logic lớn đầu tiên trong `extension/entrypoints/viewer/main.tsx`:
1. **Khối Modal Cài đặt (Settings Modal & Tab Panes)** (~600 dòng JSX và handlers: Giao diện & Đọc, Mô hình AI & API, Hiệu năng & Bộ nhớ, Themes, Font custom select, Scale controls).
2. **Khối Thanh Công Cụ (Viewer Toolbar & Mode Selectors)** (~250 dòng: Brand info, Page navigation, Fit Width zoom reset, Segmented view mode, Vision AI / Whiteboard dropdown).

## Requirements
- Xác định chính xác phạm vi dòng (StartLine -> EndLine) của từng khối trong `extension/entrypoints/viewer/main.tsx`.
- Liệt kê toàn bộ `useState`, `useRef`, `useCallback`, `useMemo` và các biến trạng thái liên quan đến Modal Cài đặt và Toolbar.
- Phân tích chi tiết từng Tab Pane (AppearanceTab, ModelsTab, PerformanceTab) và các component con tiềm năng.
- Báo cáo kết quả chi tiết kèm handoff vào `d:\create\Live-Trans\.agents\explorer_m1_1\handoff.md`.

## 2026-09-08T12:19:29Z
Bạn là Explorer M1-1 (Khảo sát Settings Modal & Toolbar trong viewer/main.tsx).
Thư mục làm việc của bạn: d:\create\Live-Trans\.agents\explorer_m1_1\
Tệp phân công nhiệm vụ: d:\create\Live-Trans\.agents\explorer_m1_1\DISPATCH.md
Tệp yêu cầu gốc bắt buộc đọc: d:\create\Live-Trans\.agents\ORIGINAL_REQUEST.md

NHIỆM VỤ:
Áp dụng High Thinking Mode, đọc và khảo sát kỹ lưỡng từng dòng mã nguồn trong file `d:\create\Live-Trans\extension\entrypoints\viewer\main.tsx` (tập trung vào 2 khối):
1. **Khối Modal Cài đặt (Settings Modal & Tab Panes)**: ~600 dòng JSX và handlers (Giao diện & Đọc, Mô hình AI & API, Hiệu năng & Bộ nhớ, Themes, Font custom select, Scale controls).
2. **Khối Thanh Công Cụ (Viewer Toolbar & Mode Selectors)**: ~250 dòng (Brand info, Page navigation, Fit Width zoom reset, Segmented view mode, Vision AI / Whiteboard dropdown).

YÊU CẦU ĐẦU RA:
- Liệt kê chính xác phạm vi dòng (StartLine -> EndLine) của từng khối và các khối con (AppearanceTab, ModelsTab, PerformanceTab, Toolbar, ModeSelector, etc.).
- Phân tích chi tiết toàn bộ State, Ref, Handler, Props truyền vào và ra.
- Đề xuất chữ ký props và interface chi tiết cho các sub-components này để tách ra các file < 400 dòng.
- Cập nhật progress.md thường xuyên và ghi báo cáo đầy đủ vào `d:\create\Live-Trans\.agents\explorer_m1_1\handoff.md`.
- Sau khi hoàn tất, gửi thông báo qua send_message tới parent kèm tóm tắt và đường dẫn handoff.md.

