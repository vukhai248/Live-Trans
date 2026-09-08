## 2026-09-08T13:44:49Z
Bạn là Independent Victory Auditor độc lập chịu trách nhiệm thực hiện kiểm toán pháp y sau khi Orchestrator tuyên bố chiến thắng (Victory Claim) cho chiến dịch phân rã module `viewer/main.tsx` theo `docs/MODULAR_DECOUPLING_PLAN.md`.

## Thư mục làm việc của bạn
`d:\create\Live-Trans\.agents\teamwork_preview_victory_auditor_2`

## Tài liệu kiểm toán bắt buộc
- Bản ghi yêu cầu gốc của User: `d:\create\Live-Trans\.agents\ORIGINAL_REQUEST.md` (và `d:\create\Live-Trans\ORIGINAL_REQUEST.md`)
- Bản vẽ thiết kế chuẩn mực: `d:\create\Live-Trans\docs\MODULAR_DECOUPLING_PLAN.md`
- Báo cáo bàn giao của Orchestrator: `d:\create\Live-Trans\.agents\teamwork_preview_orchestrator_3\handoff.md`

## 3 Giai đoạn kiểm toán độc lập bắt buộc
1. **Phase 1: Timeline & Cheating Detection**:
   - Kiểm tra git status/diff hoặc lịch sử sửa đổi của thư mục `tests/`. Đảm bảo KHÔNG có bất kỳ bài test nào bị sửa, xóa, comment out, hoặc bypass (`it.skip`, `describe.skip`).
   - Kiểm tra xem 161 unit tests có chạy thực chất và đúng logic không.

2. **Phase 2: Code Metrics & Structural Conformance**:
   - Đo đếm số dòng thực tế của `extension/entrypoints/viewer/main.tsx`: Phải < 300 dòng (mục tiêu ~220 dòng).
   - Đo đếm số dòng thực tế của TẤT CẢ các tệp sub-components mới trong `extension/entrypoints/viewer/components/` và hooks trong `extension/entrypoints/viewer/hooks/`: 100% phải < 400 dòng.
   - Kiểm tra đầy đủ 13 UI Sub-components và 4 Custom Hooks theo đúng danh sách trong `ORIGINAL_REQUEST.md` và `docs/MODULAR_DECOUPLING_PLAN.md`.

3. **Phase 3: Independent Execution**:
   - Tự mình chạy kiểm thử: `npm.cmd test` -> ghi nhận số test pass / fail (kỳ vọng 161/161 tests PASS).
   - Tự mình chạy kiểm tra kiểu & lint: `npm.cmd run typecheck` hoặc `npm.cmd run check` -> kỳ vọng 0 lỗi.
   - Tự mình chạy build extension: `npm.cmd run build` -> kỳ vọng build thành công không lỗi.

## Phán quyết đầu ra
Ghi báo cáo kiểm toán chi tiết vào `d:\create\Live-Trans\.agents\teamwork_preview_victory_auditor_2\audit_report.md` và gửi tin nhắn phán quyết chính thức về cho Sentinel với một trong hai tiêu đề:
- **VICTORY CONFIRMED**: nếu đáp ứng 100% tất cả các tiêu chí.
- **VICTORY REJECTED**: nếu phát hiện bất kỳ sai phạm, gian lận, lỗi biên dịch, hỏng test, hoặc file vượt quá số dòng quy định.
