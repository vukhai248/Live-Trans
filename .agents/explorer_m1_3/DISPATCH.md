# Task Assignment: Explorer M1-3

## Mission
Khảo sát cấu trúc tổng thể và bản đồ phụ thuộc toàn diện của `extension/entrypoints/viewer/main.tsx` (~2,430 dòng):
1. **Tổng hợp toàn bộ Hooks, Refs, States, Handlers**: Thống kê danh mục đầy đủ các `useState`, `useRef`, `useCallback`, `useMemo`, `useEffect` từ đầu file đến cuối file.
2. **Bản đồ Phụ thuộc (State Dependency Graph)**: Phân tích các luồng trao đổi dữ liệu giữa 4 khối lớn (Settings Modal, Toolbar, ScrollSync, Worker Queue) và phần rendering lõi (PDF Pages / Translation Views / Whiteboard Canvas).
3. **Đánh giá ranh giới phân tách**: Đề xuất cách thức truyền props, context, hoặc custom hook extraction sao cho không gây re-render thừa và bảo toàn 100% 161/161 unit tests.

## Requirements
- Báo cáo kết quả chi tiết kèm handoff vào `d:\create\Live-Trans\.agents\explorer_m1_3\handoff.md`.

## 2026-09-08T12:19:29Z
Bạn là Explorer M1-3 (Khảo sát Cấu trúc Tổng thể & Phụ thuộc trong viewer/main.tsx).
Thư mục làm việc của bạn: d:\create\Live-Trans\.agents\explorer_m1_3\
Tệp phân công nhiệm vụ: d:\create\Live-Trans\.agents\explorer_m1_3\DISPATCH.md
Tệp yêu cầu gốc bắt buộc đọc: d:\create\Live-Trans\.agents\ORIGINAL_REQUEST.md

NHIỆM VỤ:
Áp dụng High Thinking Mode, đọc và khảo sát cấu trúc toàn diện file `d:\create\Live-Trans\extension\entrypoints\viewer\main.tsx` (~2,430 dòng):
1. Thống kê toàn bộ Imports, States, Refs, Handlers, Effects trong component chính.
2. Vẽ bản đồ phụ thuộc dữ liệu (Data & State Dependency Map) kết nối giữa 4 khối lớn (Settings, Toolbar, ScrollSync, WorkerQueue) và các vùng còn lại (PDF Rendering, Canvas/Whiteboard, Split Pane).
3. Đánh giá chiến lược tái cấu trúc: làm thế nào để bóc tách các sub-components và custom hooks mà main.tsx chỉ còn < 300 dòng và giữ nguyên 100% chức năng, bảo toàn 161/161 unit tests.

YÊU CẦU ĐẦU RA:
- Bảng tổng kê trạng thái (States, Refs, Effects) kèm dòng bắt đầu và kết thúc.
- Ma trận phụ thuộc giữa các state và các khối logic.
- Cập nhật progress.md thường xuyên và ghi báo cáo đầy đủ vào `d:\create\Live-Trans\.agents\explorer_m1_3\handoff.md`.
- Sau khi hoàn tất, gửi thông báo qua send_message tới parent kèm tóm tắt và đường dẫn handoff.md.
