# BRIEFING — 2026-09-07T14:50:00Z

## Mission
Khảo sát, đọc và phân tích chi tiết R2: Entrypoints trong `extension/` (`viewer/`, `popup/`, `options/`, `background/`, `offscreen/`, `manifest.json`, HTML files) để phát hiện dead code, DRY violations, memory leaks và hiệu năng.

## 🔒 My Identity
- Archetype: explorer
- Roles: read-only investigation, code quality & dead code inspection
- Working directory: d:\create\Live-Trans\.agents\explorer_entrypoints_1
- Original parent: bfdd02db-0f6a-42e9-b729-ebf2c6353e1b
- Milestone: R2 - Extension Entrypoints Audit

## 🔒 Key Constraints
- Read-only investigation — do NOT implement or modify source code
- Always use Vietnamese
- Mọi phát hiện bắt buộc trích dẫn chính xác file:line
- Báo cáo chi tiết ghi vào report.md và handoff.md

## Current Parent
- Conversation ID: bfdd02db-0f6a-42e9-b729-ebf2c6353e1b
- Updated: 2026-09-07T14:50:00Z

## Investigation State
- **Explored paths**:
  - `extension/wxt.config.ts`, `extension/package.json`
  - `extension/entrypoints/background.ts`
  - `extension/entrypoints/content/index.ts`
  - `extension/entrypoints/offscreen/index.html`, `offscreen/main.ts`
  - `extension/entrypoints/popup/index.html`, `main.tsx`, `App.tsx`, `style.css`
  - `extension/entrypoints/options/index.html`, `main.tsx`, `App.tsx`, `style.css`
  - `extension/entrypoints/viewer/index.html`, `main.tsx`, `CustomSelect.tsx`, `PdfSnippet.tsx`, `VisionPageRenderer.tsx`, `WhiteboardPageRenderer.tsx`, `style.css`
- **Key findings**:
  - ~550 dòng dead code trong `viewer/main.tsx` (`FlowBlock`, `type === 'translated'` trong `PageRenderer`, `reflow`, `loadPageLayout`, etc.)
  - ~175 dòng dead CSS trong `viewer/style.css` (`.lt-markdown-page`, `.lt-md-*`)
  - Rò rỉ bộ nhớ RAM nghiêm trọng do `pdfPageCanvasCache` không LRU/không clear trong `PdfSnippet.tsx`
  - Đột biến CPU do 2 MutationObserver không debounce quan sát toàn bộ `document.documentElement` trong `content/index.ts`
  - Port leak trong `background.ts` do luôn `return true;` mà không gọi `sendResponse`
  - Nguy cơ ghi đè mất cấu hình do `options/App.tsx` không nghe `storage.onChanged`
  - DRY: Lặp lại ArXiv regex (4 lần), tạo Viewer URL (4 lần), Quản lý Glossary (2 lần), Trích xuất tiêu đề video (3 lần)
- **Unexplored areas**: Không còn file nào chưa khám phá trong phạm vi Entrypoints.

## Key Decisions Made
- Tuân thủ 100% nguyên tắc Read-Only, không sửa code sản phẩm.
- Đã chạy kiểm tra typecheck và eslint để thu thập chẩn đoán.
- Hoàn thành đầy đủ `report.md` và `handoff.md`.

## Artifact Index
- `.agents/explorer_entrypoints_1/DISPATCH.md` — Chỉ thị nhiệm vụ
- `.agents/explorer_entrypoints_1/BRIEFING.md` — Bộ nhớ làm việc
- `.agents/explorer_entrypoints_1/progress.md` — Nhật ký tiến độ và heartbeat
- `.agents/explorer_entrypoints_1/report.md` — Báo cáo kiểm toán chi tiết
- `.agents/explorer_entrypoints_1/handoff.md` — Báo cáo bàn giao theo 5 thành phần
