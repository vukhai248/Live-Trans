# DISPATCH: Forensic Auditor — Giám Định Pháp Y Toàn Vẹn Mã Nguồn (Integrity Forensics)

## 2026-09-08T13:33:12Z

## Mục tiêu
Thực hiện giám định pháp y tính toàn vẹn (Forensic Integrity Audit) đối với toàn bộ các thay đổi trong chiến dịch phân rã module `extension/entrypoints/viewer/main.tsx`.

## Nội dung giám định bắt buộc
1. **Kiểm tra Cheating / Facade Detection**:
   - Xác minh tất cả các Sub-components và Custom Hooks mới tạo có logic thực thụ hay chỉ là dummy/mock/facade.
   - Xác minh không có hardcoding test outputs, không có code giả lập bypass logic.
2. **Kiểm tra Tính Toàn Vẹn Bóc Tách (True Decoupling Verification)**:
   - So sánh các đoạn mã nguyên thủy trong `main.tsx` cũ với mã nguồn trong `components/` và `hooks/`.
   - Xác nhận thuật toán Ceiling-Lock, Side-margin bypass, Dual-priority queue, Batch preemption window, Rate-limit 429 guard, Pacing delay được chuyển giao 100% nguyên vẹn.
3. **Kiểm tra Tuân Thủ Quy Định**:
   - `extension/entrypoints/viewer/main.tsx` < 300 dòng.
   - 100% các file mới < 400 dòng.
   - Toàn bộ 161/161 unit tests PASS 100%.
   - Typecheck sạch 0 lỗi, lint 0 lỗi, build sạch sẽ.
4. Xuất báo cáo `handoff.md` với phán quyết nhị phân rõ ràng: `CLEAN` hoặc `INTEGRITY VIOLATION`.
