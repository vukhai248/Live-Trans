# BRIEFING — 2026-09-08T13:21:00Z

## Mission
Trích xuất 4 Custom Hooks điều phối cho Live-Trans Viewer (hooks/types.ts, usePdfDocument.ts, useSettingsManager.ts, useVisionWorkerQueue.ts, useSyncScroll.ts) theo docs/MODULAR_DECOUPLING_PLAN.md.

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: d:\create\Live-Trans\.agents\worker_m2_hooks
- Original parent: c330f6e7-fa3e-48e0-9697-f08d88c57109
- Milestone: Milestone 2 — Trích xuất 4 Custom Hooks Điều Phối

## 🔒 Key Constraints
- Toàn quyền tạo và sửa các tệp trong extension/entrypoints/viewer/hooks/**.
- Không có file mới nào được vượt quá 400 dòng mã nguồn.
- Giữ nguyên các useRef nội bộ bên trong useVisionWorkerQueue để tránh Stale Closure trong vòng lặp bất đồng bộ.
- Chạy kiểm tra: npm.cmd run typecheck (0 lỗi), npm.cmd test (161/161 tests PASS), npm.cmd run lint (0 lỗi).
- Bảo toàn 100% logic thuật toán, không tạo dummy/facade hoặc hardcode test results.
- Ngôn ngữ giao tiếp: Tiếng Việt.

## Current Parent
- Conversation ID: c330f6e7-fa3e-48e0-9697-f08d88c57109
- Updated: 2026-09-08T13:21:00Z

## Task Summary
- **What to build**: 6 tệp trong `extension/entrypoints/viewer/hooks/`:
  1. `hooks/types.ts` (104 dòng)
  2. `hooks/usePdfDocument.ts` (106 dòng)
  3. `hooks/useSettingsManager.ts` (168 dòng)
  4. `hooks/useVisionWorkerQueue.ts` (390 dòng)
  5. `hooks/useSyncScroll.ts` (348 dòng)
  6. `hooks/index.ts` (6 dòng)
- **Success criteria**: 0 compile/typecheck errors, 161/161 tests PASS, 0 lint errors, < 400 lines per file.
- **Interface contracts**: docs/MODULAR_DECOUPLING_PLAN.md Mục 3.3.D
- **Code layout**: extension/entrypoints/viewer/hooks/

## Change Tracker
- **Files created**:
  - `extension/entrypoints/viewer/hooks/types.ts`: Type contracts cho 4 Custom Hooks
  - `extension/entrypoints/viewer/hooks/usePdfDocument.ts`: Nạp PDF, metadata docTitle, FitScale, window resize
  - `extension/entrypoints/viewer/hooks/useSettingsManager.ts`: chrome.storage, state settings, key items, modal states, auto-save timer
  - `extension/entrypoints/viewer/hooks/useVisionWorkerQueue.ts`: Dual-priority queue, worker pool 2..7, preemption window, debounce, pacing delay, 429 guard, LRU cache, anti-race tokens
  - `extension/entrypoints/viewer/hooks/useSyncScroll.ts`: Page-to-page alignment, Mutex lock rAF, Ceiling-Lock engine, side-margin bypass, Ctrl+Wheel zoom
  - `extension/entrypoints/viewer/hooks/index.ts`: Barrel export
- **Build status**: Pass 100% (npm.cmd run typecheck: 0 errors; npm.cmd test: 161/161 passed)
- **Pending issues**: none

## Quality Status
- **Build/test result**: Pass 100% (161/161 tests)
- **Lint status**: Clean (all files adhere to ESLint config)
- **Tests added/modified**: 0 regressions on existing 161 tests

## Loaded Skills
- None

## Key Decisions Made
- Sử dụng helper nội bộ `popNextEligible` và `findVisiblePage` để giảm trùng lặp mã nguồn, giữ cả `useVisionWorkerQueue.ts` và `useSyncScroll.ts` dưới ngưỡng trần 400 dòng.
- Duy trì đầy đủ các `useRef` nội bộ trong `useVisionWorkerQueue.ts` (`settingsRef`, `pdfDocRef`, `pdfUrlRef`, `numPagesRef`, `hasActiveKeyRef`, `pageVisionStatusRef`, `pageVisionTranslationsRef`, `isRateLimitedRef`, `wakePacingTimerRef`, `visionTokenRef`) để triệt tiêu triệt để Stale Closure trong các worker coroutines bất đồng bộ.

## Artifact Index
- .agents/worker_m2_hooks/DISPATCH.md — Nhiệm vụ được giao
- .agents/worker_m2_hooks/BRIEFING.md — Bộ nhớ hoạt động
- .agents/worker_m2_hooks/progress.md — Liveness & tiến độ
- .agents/worker_m2_hooks/handoff.md — Báo cáo nghiệm thu hoàn thành
