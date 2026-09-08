# DISPATCH: Challenger 1 — Thử Thách Mã Nguồn & Giới Hạn Biên

## Mục tiêu
Thực hiện stress testing, kiểm tra tính chịu lỗi và các trường hợp biên của các Sub-components và Custom Hooks mới tạo.

## Nội dung thử thách
1. Kiểm tra giới hạn số dòng (file line count check) toàn diện bằng lệnh tự động:
   - `extension/entrypoints/viewer/main.tsx` phải < 300 dòng.
   - 100% các file trong `extension/entrypoints/viewer/components/` phải < 400 dòng.
   - 100% các file trong `extension/entrypoints/viewer/hooks/` phải < 400 dòng.
2. Kiểm tra các trường hợp biên:
   - Khi không có API key (`hasActiveKey = false`).
   - Khi numPages = 0 hoặc 1.
   - Khi splitRatio thay đổi hoặc reset 50:50.
   - Khi worker queue nhận lỗi 429 quota.
3. Chạy toàn bộ các lệnh build, typecheck, lint, test và xuất báo cáo `handoff.md` với phán quyết rõ ràng: `APPROVE` hoặc `REQUEST_CHANGES`.

## 2026-09-08T13:33:12Z

Bạn là Challenger 1 chuyên trách thử nghiệm stress testing và kiểm tra các trường hợp biên cho Live-Trans Viewer sau phân rã.

Thư mục làm việc của bạn:
d:\create\Live-Trans\.agents\challenger_1
Hãy tạo các tệp metadata (progress.md, handoff.md) trong thư mục làm việc của bạn.

Tài liệu tham chiếu bắt buộc:
1. ORIGINAL_REQUEST.md: d:\create\Live-Trans\.agents\ORIGINAL_REQUEST.md
2. Blueprint kiến trúc: d:\create\Live-Trans\docs\MODULAR_DECOUPLING_PLAN.md
3. File dispatch chi tiết: d:\create\Live-Trans\.agents\challenger_1\DISPATCH.md
4. Thư mục components: d:\create\Live-Trans\extension\entrypoints\viewer\components\
5. Thư mục hooks: d:\create\Live-Trans\extension\entrypoints\viewer\hooks\
6. App Shell: d:\create\Live-Trans\extension\entrypoints\viewer\main.tsx

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Nhiệm vụ cụ thể của bạn:
1. Chạy lệnh tự động kiểm tra số dòng của toàn bộ tệp mới và main.tsx (đảm bảo main.tsx < 300 dòng, tất cả các tệp con < 400 dòng).
2. Kiểm tra các trường hợp biên: thiếu key, trang rỗng, zoom cực hạn, cuộn nhanh, lỗi rate-limit.
3. Chạy các lệnh kiểm thử và build: npm.cmd run typecheck, npm.cmd test, npm.cmd run build.
4. Lập báo cáo handoff.md tại .agents/challenger_1/handoff.md với phán quyết rõ ràng: APPROVE hoặc REQUEST_CHANGES, và gửi tin nhắn kết quả về cho Orchestrator.

