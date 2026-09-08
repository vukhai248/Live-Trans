# BRIEFING — 2026-09-08T12:28:00Z

## Mission
Khảo sát cấu trúc tổng thể và bản đồ phụ thuộc toàn diện của `extension/entrypoints/viewer/main.tsx` (~2,430 dòng), lập danh mục toàn bộ imports, states, refs, handlers, effects, vẽ bản đồ phụ thuộc giữa 4 khối lớn và core rendering, và đề xuất chiến lược tái cấu trúc bóc tách sub-components và custom hooks đưa main.tsx < 300 dòng, bảo toàn 161/161 tests.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis
- Working directory: d:\create\Live-Trans\.agents\explorer_m1_3\
- Original parent: d425a8b5-1c4e-41c2-8306-bd871b6230ed
- Milestone: M1 - Comprehensive Codebase & Architecture Exploration

## 🔒 Key Constraints
- Read-only investigation — do NOT modify source code (main.tsx, etc.)
- Metadata only in .agents/explorer_m1_3/
- Language: Vietnamese (per user global rules)
- Zero regressions: Preserve 100% functionality and 161/161 unit tests

## Current Parent
- Conversation ID: d425a8b5-1c4e-41c2-8306-bd871b6230ed
- Updated: 2026-09-08T12:28:00Z

## Investigation State
- **Explored paths**: `extension/entrypoints/viewer/main.tsx`, `package.json`, `extension/entrypoints/viewer/*`, `lib/` tests
- **Key findings**:
  - `main.tsx` dài 2,429 dòng, chứa 34 states, 18 refs, 7 effects trong `ViewerApp`, cùng 2 components con nội bộ (`PageRenderer`, `FlowBlock`).
  - Phân tích chi tiết 4 khối lớn: Settings (~650 dòng), Toolbar (~240 dòng), ScrollSync & Ceiling-Lock (~340 dòng), Worker Queue (~420 dòng), cùng Core Panes/Splitter/Sidebar (~780 dòng).
  - Bản đồ phụ thuộc dữ liệu 2 chiều và ma trận State Dependency đã được lập toàn diện.
  - Thiết kế kiến trúc phân rã: 4 custom hooks (`usePdfDocument`, `useSettingsManager`, `useVisionWorkerQueue`, `useSyncScroll`) và 10 sub-components, đưa `main.tsx` xuống ~220 dòng (< 300 dòng). Không có file nào > 400 dòng.
  - Toàn bộ 161 unit tests (23 files) độc lập với `viewer/main.tsx` vì kiểm thử `lib/`, đảm bảo 0 rủi ro gãy unit test.
- **Unexplored areas**: None for M1-3 mission.

## Key Decisions Made
- Lập bảng tổng kê chính xác dòng bắt đầu và kết thúc của toàn bộ state/ref/effect/handler.
- Thiết kế phân rã hoàn chỉnh bảo toàn tuyệt đối thuật toán khóa trần (ceiling clamp), phân biệt lề đen (side margin bypass), batch preemption, pacing delay 400ms và rate-limit 429 guard.

## Artifact Index
- `d:\create\Live-Trans\.agents\explorer_m1_3\DISPATCH.md` — Task assignment
- `d:\create\Live-Trans\.agents\explorer_m1_3\BRIEFING.md` — Persistent situational awareness
- `d:\create\Live-Trans\.agents\explorer_m1_3\progress.md` — Liveness & heartbeat progress tracker
- `d:\create\Live-Trans\.agents\explorer_m1_3\handoff.md` — Final 5-component handoff report
