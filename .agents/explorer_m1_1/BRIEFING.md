# BRIEFING — 2026-09-08T12:19:29Z

## Mission
Khảo sát và phân tích chuyên sâu (line-by-line) Khối Modal Cài đặt (Settings Modal & Tab Panes) và Khối Thanh Công Cụ (Viewer Toolbar & Mode Selectors) trong `extension/entrypoints/viewer/main.tsx` để lập kế hoạch phân rã module không gây hồi quy.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis
- Working directory: d:\create\Live-Trans\.agents\explorer_m1_1
- Original parent: d425a8b5-1c4e-41c2-8306-bd871b6230ed
- Milestone: M1 (Viewer Decoupling Survey - Settings Modal & Toolbar)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement / modify source code
- Luôn sử dụng Tiếng Việt (theo quy tắc user_global)
- Khảo sát kỹ lưỡng Settings Modal & Toolbar trong `viewer/main.tsx`
- Tuân thủ cấu trúc Handoff Protocol 5 phần (Observation, Logic Chain, Caveats, Conclusion, Verification Method)
- File mới đề xuất phải đảm bảo < 400 dòng/file

## Current Parent
- Conversation ID: d425a8b5-1c4e-41c2-8306-bd871b6230ed
- Updated: 2026-09-08T12:23:00Z

## Investigation State
- **Explored paths**: `extension/entrypoints/viewer/main.tsx` (dòng 1102 - 1335: Toolbar; dòng 1337 - 1863: Settings Modal; dòng 1866 - 1944: Post-Save Modal; dòng 1947 - 1972: Warning Banner), `extension/entrypoints/viewer/CustomSelect.tsx`
- **Key findings**:
  - Toolbar chiếm 234 dòng (1102 - 1335). Tách thành `ViewerToolbar.tsx` (~160 dòng), `ModeSelectorDropdown.tsx` (~85 dòng), `PageNavigator.tsx` (~45 dòng), `types.ts` (~45 dòng).
  - Settings Modal chiếm 527 dòng (1337 - 1863). Tách thành `SettingsModal.tsx` (~130 dòng), `AppearanceTab.tsx` (~210 dòng), `ModelsTab.tsx` (~160 dòng), `PerformanceTab.tsx` (~90 dòng), `PostSaveActionModal.tsx` (~85 dòng), `ApiKeyWarningBanner.tsx` (~35 dòng), `types.ts` (~50 dòng).
  - Tất cả các component mới đều < 210 dòng, thấp hơn xa ngưỡng 400 dòng/file.
  - Cắt giảm trực tiếp ~866 dòng khỏi `main.tsx`.
- **Unexplored areas**: Đã hoàn thành 100% phạm vi khảo sát được giao trong M1-1.

## Key Decisions Made
- Thiết kế 2 cụm thư mục `components/SettingsModal/` và `components/Toolbar/` bên trong `extension/entrypoints/viewer/`.
- Tách bạch Props contracts và Interface vào 2 file `types.ts` riêng biệt.
- Di chuyển sự kiện Escape key vào trong `SettingsModal.tsx` để giảm re-render và dọn dẹp listener tự động.
- Giữ nguyên cấu trúc CSS và các class names của `style.css` để bảo toàn zero-regression.

## Artifact Index
- `d:\create\Live-Trans\.agents\explorer_m1_1\progress.md` — Tiến độ thực thi & Heartbeat
- `d:\create\Live-Trans\.agents\explorer_m1_1\handoff.md` — Báo cáo khảo sát & bàn giao kỹ thuật chi tiết
- `d:\create\Live-Trans\.agents\explorer_m1_1\DISPATCH.md` — Phân công nhiệm vụ & lịch sử dispatch

