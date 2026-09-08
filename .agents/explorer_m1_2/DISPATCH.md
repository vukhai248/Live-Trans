# Task Assignment: Explorer M1-2

## Mission
Khảo sát và phân tích chuyên sâu (line-by-line) 2 khối logic kỹ thuật phức tạp trong `extension/entrypoints/viewer/main.tsx`:
1. **Khối Điều phối Cuộn Đồng Bộ & Khóa Trần (ScrollSync & Ceiling-Lock Engine)** (~350 dòng logic sự kiện wheel, scroll listener hai chiều và giải thuật clamp trần trang).
2. **Khối Hàng Đợi Song Song & Worker Engine (Multi-Worker Dual-Priority Queue)** (~300 dòng quản lý highPriorityQueueRef, waterfallQueueRef, pacing delay, preemption window).

## Requirements
- Xác định chính xác phạm vi dòng (StartLine -> EndLine) của từng khối trong `extension/entrypoints/viewer/main.tsx`.
- Liệt kê toàn bộ các refs (`highPriorityQueueRef`, `waterfallQueueRef`, scroll refs, ceiling lock refs, container refs...), effect listeners, wheel handlers, timers.
- Phân tích chi tiết giải thuật clamp trần trang, cơ chế đồng bộ cuộn hai chiều (PDF container <-> Translation container), và cơ chế Dual-Priority Queue của Vision Worker.
- Báo cáo kết quả chi tiết kèm handoff vào `d:\create\Live-Trans\.agents\explorer_m1_2\handoff.md`.
