# BRIEFING — 2026-09-08T13:32:00Z

## Mission
Tinh giản tệp `extension/entrypoints/viewer/main.tsx` từ ~2,215 dòng xuống < 300 dòng (mục tiêu ~220 dòng) thành App Shell kết nối 4 Custom Hooks và các Sub-components, đảm bảo 100% tính năng, type safety, và green test suite.

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: d:\create\Live-Trans\.agents\worker_m3_shell
- Original parent: c330f6e7-fa3e-48e0-9697-f08d88c57109
- Milestone: Milestone 3 — Tinh Giản App Shell `viewer/main.tsx`

## 🔒 Key Constraints
- Dung lượng `extension/entrypoints/viewer/main.tsx` < 300 dòng (mục tiêu ~220 dòng).
- Bảo đảm 100% logic, CSS classes, inline styles (`--lt-font-scale`, `--lt-font-family`, theme classes), responsive layout, và tương tác.
- Chạy xác minh: `npm.cmd run typecheck` (0 lỗi), `npm.cmd test` (161/161 PASS), `npm.cmd run lint` (0 lỗi), `npm.cmd run build` (thành công).
- Báo cáo handoff.md và nhắn tin hoàn thành cho parent.
- Không cheat, không hardcode kết quả kiểm thử.

## Current Parent
- Conversation ID: c330f6e7-fa3e-48e0-9697-f08d88c57109
- Updated: 2026-09-08T13:32:00Z

## Task Summary
- **What to build**: Tinh giản `viewer/main.tsx` thành App Shell kết nối `usePdfDocument`, `useSettingsManager`, `useVisionWorkerQueue`, `useSyncScroll` và các sub-components (`ViewerToolbar`, `SettingsModal`, `PostSavePromptModal`, `ApiKeyWarningBanner`, `SidebarDrawer`, `DraggableSplitter`, `PageRenderer`, `VisionPageRenderer`, `WhiteboardPageRenderer`).
- **Success criteria**: main.tsx < 300 dòng (đạt 263 dòng), typecheck PASS (0 lỗi), test 161/161 PASS, lint PASS (0 lỗi), build PASS.
- **Interface contracts**: `docs/MODULAR_DECOUPLING_PLAN.md` § 5.3.

## Change Tracker
- **Files modified**:
  - `extension/entrypoints/viewer/main.tsx`: Tinh giản từ 2,215 dòng xuống còn 263 dòng, loại bỏ toàn bộ code nguyên khối dư thừa, chuyển thành App Shell kết nối 4 Hooks và render Sub-components.
- **Build status**: PASS (Build thành công trong 2.086s)
- **Pending issues**: Không có lỗi nào tồn đọng.

## Quality Status
- **Build/test result**: PASS (161/161 unit tests pass, typecheck 0 errors, build thành công).
- **Lint status**: PASS (0 eslint violations).
- **Tests added/modified**: Không cần sửa test trong `lib/` hay `tests/` vì toàn bộ 161 test hiện hữu đều pass 100%.

## Loaded Skills
- Không yêu cầu skill ngoài đặc thù.

## Key Decisions Made
- Tuân thủ chính xác thiết kế mục 5.3 trong `docs/MODULAR_DECOUPLING_PLAN.md`.
- Giữ vững các class CSS kép tương thích giao diện (`.lt-main lt-main-viewport`, `.lt-workspace lt-panes-wrapper`, `.lt-pane-left lt-left-pane`, `.lt-pane-right lt-right-pane`).
- Đảm bảo hiển thị lỗi tải (`errorMsg`) và spinner chờ nạp (`!pdfDoc`).
