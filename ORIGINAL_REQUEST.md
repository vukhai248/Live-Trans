# Original User Request

## 2026-09-07T14:42:24Z

Use a very large team of agents to explore the entire project.

Toàn diện khảo sát, phân tích và kiểm tra toàn bộ mã nguồn dự án Live-Trans (v1.0.1) nhằm phát hiện các thư mục, file, module dư thừa không còn sử dụng, đồng thời rà soát chi tiết từng file mã nguồn để phát hiện dead code, logic trùng lặp hoặc chưa tối ưu, từ đó lập báo cáo kiểm toán chi tiết và kế hoạch tái cấu trúc (refactoring) chuẩn xác.

Working directory: d:\create\Live-Trans
Integrity mode: development

## Requirements

### R1. Phân loại & Rà soát Thư mục/Tài nguyên dư thừa (Folder & Asset Redundancy Audit)
Khảo sát toàn bộ cây thư mục dự án (gồm `backend/`, `demo/`, `dist/`, `gateway/`, `tests/`, `scripts/`, `docs/`, `extension/`). Xác định mức độ liên quan của từng thư mục và file đối với luồng chạy thực tế của Extension v1.0.1, chỉ ra các file rác, file build cũ, dữ liệu mẫu hoặc mã nguồn POC v0.1 không còn phục vụ phát triển.

### R2. Phân tích mã nguồn chi tiết từng file trong `extension/` (Code Quality & Dead Code Inspection)
Đọc và phân tích sâu toàn bộ mã nguồn bên trong `extension/` (bao gồm entrypoints: `viewer/`, `popup/`, `options/`, `background/`, `offscreen/` và các thư viện trong `lib/`):
- Phát hiện dead code, biến/hàm/interface không còn được gọi hoặc không dùng đến.
- Nhận diện các đoạn logic xử lý trùng lặp (DRY violations) giữa các component và provider.
- Tìm các điểm thắt cổ chai về hiệu năng (memory leak tiềm ẩn, re-render dư thừa, DOM mutation không cần thiết, blocking trên main thread).

### R3. Lập Báo cáo Khảo sát Toàn diện & Lộ trình Tái cấu trúc (Refactoring Roadmap)
Tổng hợp toàn bộ phát hiện thành một tài liệu kiểm toán chi tiết (`docs/REFACTORING_AUDIT.md`), phân loại theo mức độ ưu tiên (High / Medium / Low), đề xuất phương án xóa bỏ/tinh gọn cụ thể cho từng file và xác nhận giữ nguyên tính toàn vẹn của 123 unit tests hiện tại.

## Acceptance Criteria

### Tính chính xác & Bao phủ
- [ ] Báo cáo kiểm toán liệt kê đầy đủ 100% các thư mục ở root và giải trình rõ mức độ phụ thuộc/thừa thãi của từng thư mục.
- [ ] Mọi phát hiện về dead code hoặc code chưa tối ưu trong `extension/` đều trích dẫn chính xác đường dẫn file và số dòng.
- [ ] Có danh sách cụ thể các file/thư mục an toàn để xóa mà không làm gãy lệnh build (`npm run build`) và test (`npm run test`).

### Tính bảo toàn hệ thống
- [ ] Đảm bảo 123/123 unit tests của dự án tiếp tục pass 100% sau bất kỳ đề xuất tái cấu trúc nào.
- [ ] Đảm bảo quy trình CI (`npm run check`) không phát sinh thêm bất kỳ lỗi ESLint hoặc TypeScript nào.
