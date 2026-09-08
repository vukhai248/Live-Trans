# BRIEFING — 2026-09-08T19:22:30+07:00

## Mission
Khảo sát và phân tích chuyên sâu (line-by-line) 2 khối kỹ thuật phức tạp trong `extension/entrypoints/viewer/main.tsx`:
1. Khối Điều phối Cuộn Đồng Bộ & Khóa Trần (ScrollSync & Ceiling-Lock Engine)
2. Khối Hàng Đợi Song Song & Worker Engine (Multi-Worker Dual-Priority Queue)
và đề xuất thiết kế Custom Hook (useSyncScroll.ts, useVisionWorkerQueue.ts) chi tiết.

## 🔒 My Identity
- Archetype: Explorer
- Roles: Read-only investigation, code analysis, synthesis, architectural decoupling proposal
- Working directory: d:\create\Live-Trans\.agents\explorer_m1_2\
- Original parent: d425a8b5-1c4e-41c2-8306-bd871b6230ed
- Milestone: M1 (Deep Exploration & Decoupling Blueprint)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement / modify source code directly.
- All reports, progress updates and handoffs must be written to `.agents/explorer_m1_2/`.
- Language: Vietnamese (theo User Global Rules).
- All proposed custom hook files must be designed to be < 400 lines/file.
- Preserve 100% existing behaviors (161/161 unit tests, sync scroll, ceiling lock, worker queue dual-priority, preemption, pacing).

## Current Parent
- Conversation ID: d425a8b5-1c4e-41c2-8306-bd871b6230ed
- Updated: 2026-09-08T19:22:30+07:00

## Investigation State
- **Explored paths**:
  + `extension/entrypoints/viewer/main.tsx` (toàn bộ 2,429 dòng)
  + `extension/lib/pdf/vision-translate.ts`
  + `.agents/explorer_m1_1/DISPATCH.md` & `.agents/explorer_m1_3/DISPATCH.md`
- **Key findings**:
  + **Khối ScrollSync & Ceiling-Lock**: Nằm ở các dòng 107-139, 608-737, 739-940, 1062-1076, 2065-2164. Sử dụng giải thuật Page-to-Page Two-Way Alignment với mutex `isSyncingScroll` và requestAnimationFrame. Thuật toán Ceiling-Lock phân biệt lề đen (`isInSideMargin`), nhận diện trần trang (`offsetTop - 24`), khóa cứng khung cha khi nội dung trang con (`.lt-vision-body`) chưa cuộn hết, và hãm phanh chống vọt lố khi chuyển trang kế tiếp/trước, dồn lực cuộn thừa chuẩn xác.
  + **Khối Multi-Worker Dual-Priority Queue**: Nằm ở các dòng 221-229, 286-460, 462-606, 1023-1041. Gồm 2 hàng đợi `highPriorityQueueRef` (0ms, ưu tiên theo cụm cửa sổ concurrency) và `waterfallQueueRef` (nền, tuần tự 1..numPages). Điều phối worker pool coroutines (2-7 workers song song), nhịp pacing delay 400ms ngắt được ngay lập tức (`wakePacingTimerRef`), bộ đệm cuộn 300ms (`scrollDebounceTimerRef`), tự ngắt khi gặp lỗi 429 quota và tự phục hồi khi có tương tác người dùng. Token generation chống race conditions (`visionTokenRef`).
- **Unexplored areas**: Không còn vùng mù trong 2 khối được giao.

## Key Decisions Made
- Thiết kế 2 Custom Hooks chuyên biệt:
  1. `hooks/useSyncScroll.ts`: Bao bọc toàn bộ logic cuộn đồng bộ hai chiều, fit width auto scale, zoom Ctrl+Wheel độc lập, ceiling lock engine và hãm phanh.
  2. `hooks/useVisionWorkerQueue.ts`: Bao bọc toàn bộ logic multi-worker dual-priority queue, caching 0ms, batch preemption window, rate-limit defense, retry/retranslate.
- Cả 2 hooks tuân thủ tuyệt đối giới hạn < 400 dòng/file và giữ nguyên 100% logic nghiệp vụ hiện tại.

## Artifact Index
- `.agents/explorer_m1_2/DISPATCH.md` — Task assignment
- `.agents/explorer_m1_2/BRIEFING.md` — Situational awareness
- `.agents/explorer_m1_2/progress.md` — Progress tracker & liveness heartbeat
- `.agents/explorer_m1_2/handoff.md` — Final handoff report
