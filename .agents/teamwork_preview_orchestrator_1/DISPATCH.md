## 2026-09-07T14:43:06Z

Bạn là Project Orchestrator phụ trách dự án Live-Trans (v1.0.1).

Working Directory của bạn: d:\create\Live-Trans\.agents\teamwork_preview_orchestrator_1
Project Root: d:\create\Live-Trans
File yêu cầu gốc của người dùng: d:\create\Live-Trans\.agents\ORIGINAL_REQUEST.md (hoặc d:\create\Live-Trans\ORIGINAL_REQUEST.md)

Nhiệm vụ của bạn:
Người dùng yêu cầu sử dụng đội ngũ chuyên gia/agent khảo sát, phân tích toàn bộ mã nguồn Live-Trans v1.0.1 để:
1. R1. Phân loại & Rà soát Thư mục/Tài nguyên dư thừa (Folder & Asset Redundancy Audit) qua toàn bộ cây thư mục: `backend/`, `demo/`, `dist/`, `gateway/`, `tests/`, `scripts/`, `docs/`, `extension/`.
2. R2. Phân tích mã nguồn chi tiết từng file trong `extension/` (viewer/, popup/, options/, background/, offscreen/, lib/): tìm dead code, DRY violations, bottleneck hiệu năng, memory leaks, DOM mutations thừa, main thread blocking.
3. R3. Lập Báo cáo Khảo sát Toàn diện & Lộ trình Tái cấu trúc (`docs/REFACTORING_AUDIT.md`), phân loại theo mức độ ưu tiên (High / Medium / Low), đề xuất phương án xóa bỏ/tinh gọn cụ thể cho từng file và xác nhận giữ nguyên tính toàn vẹn của 123 unit tests hiện tại.

Acceptance Criteria:
- Liệt kê đầy đủ 100% các thư mục ở root và giải trình rõ mức độ phụ thuộc/thừa thãi.
- Mọi phát hiện dead code / unoptimized code trong `extension/` đều trích dẫn chính xác file path và số dòng.
- Danh sách cụ thể các file/thư mục an toàn để xóa mà không làm gãy lệnh build (`npm run build`) và test (`npm run test`).
- Bảo đảm 123/123 tests tiếp tục pass 100%, `npm run check` không có lỗi.

LƯU Ý QUAN TRỌNG:
- Tuân thủ User Rules: Luôn dùng tiếng Việt cho tài liệu báo cáo và giao tiếp.
- Tuyệt đối KHÔNG xóa file hoặc sửa code của dự án thực tế ngay lúc này! User Rule: "Luôn luôn check các nội dung, lỗi trước, liệt kê thông tin lỗi và hỏi người dùng có thực thi không thay vì sửa ngay code". Nhiệm vụ hiện tại là khảo sát, kiểm toán và lập báo cáo chi tiết tại `docs/REFACTORING_AUDIT.md`.
- Sử dụng PowerShell command trên Windows, `npm.cmd` nếu cần chạy test/check.
- Hãy chủ động tạo và cập nhật định kỳ file `progress.md` và `BRIEFING.md` trong working directory của bạn (`d:\create\Live-Trans\.agents\teamwork_preview_orchestrator_1`) để Sentinel theo dõi liveness và tiến độ.
- Tổ chức subagents (ví dụ explorer, code analysts, test runner) để khảo sát song song, hiệu quả, kiểm tra test thực tế (`npm.cmd test`, `npm.cmd run check`), đối chiếu kỹ lưỡng trước khi hoàn thiện `docs/REFACTORING_AUDIT.md`.
- Khi hoàn thành báo cáo `docs/REFACTORING_AUDIT.md` và xác thực đầy đủ, gửi báo cáo hoàn thành về cho Sentinel qua send_message.
