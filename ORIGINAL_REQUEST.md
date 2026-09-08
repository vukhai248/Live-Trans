# Original User Request

## 2026-09-07T14:42:24Z

Use a very large team of agents to explore the entire project.

Toàn diện khảo sát, phân tích và kiểm tra toàn bộ mã nguồn dự án Live-Trans (v1.0.1) nhằm phát hiện các thư mục, file, module dư thừa không còn sử dụng, đồng thời rà soát chi tiết từng file mã nguồn để phát hiện dead code, logic trùng lặp hoặc chưa tối ưu, từ đó lập báo cáo kiểm toán chi tiết và kế hoạch tái cấu trúc (refactoring) chuẩn xác.

Working directory: d:\create\Live-Trans
Integrity mode: development

## Requirements

### R1. Phân loại & Rà soát Thư mục/Tài nguyên dư thừa (Folder & Asset Redundancy Audit)
Khảo sát toàn bộ cây thư mục dự án (gồm `backend/`, `demo/`, `dist/`, `gateway/`, `tests/`, `scripts/`, `docs/`, `extension/`). Xác định mức độ liên quan của từng thư mục và file đối với luồng chạy thực tế của Extension v1.0.1, chỉ ra các file rác, file build cũ, dữ liệu mẫu hoặc mã nguồn POC v0.1 không còn phục vụ phát triển.

### R2. Phân tích mã nguồn chi tiết từng file trong `extension/` (Code Quality & Dead Code Inspection)
Đọc và phân tích sâu toàn bộ mã nguồn bên trong `extension/` (bao gồm entrypoints: `viewer/`, `popup/`, `options/`, `background/`, `offscreen/` và các thư viện trong `lib/`):
- Phát hiện dead code, biến/hàm/interface không còn được gọi hoặc không dùng đến.
- Nhận diện các đoạn logic xử lý trùng lặp (DRY violations) giữa các component và provider.
- Tìm các điểm thắt cổ chai về hiệu năng (memory leak tiềm ẩn, re-render dư thừa, DOM mutation không cần thiết, blocking trên main thread).

### R3. Lập Báo cáo Khảo sát Toàn diện & Lộ trình Tái cấu trúc (Refactoring Roadmap)
Tổng hợp toàn bộ phát hiện thành một tài liệu kiểm toán chi tiết (`docs/REFACTORING_AUDIT.md`), phân loại theo mức độ ưu tiên (High / Medium / Low), đề xuất phương án xóa bỏ/tinh gọn cụ thể cho từng file và xác nhận giữ nguyên tính toàn vẹn của 123 unit tests hiện tại.

## Acceptance Criteria

### Tính chính xác & Bao phủ
- [ ] Báo cáo kiểm toán liệt kê đầy đủ 100% các thư mục ở root và giải trình rõ mức độ phụ thuộc/thừa thãi của từng thư mục.
- [ ] Mọi phát hiện về dead code hoặc code chưa tối ưu trong `extension/` đều trích dẫn chính xác đường dẫn file và số dòng.
- [ ] Có danh sách cụ thể các file/thư mục an toàn để xóa mà không làm gãy lệnh build (`npm run build`) và test (`npm run test`).

### Tính bảo toàn hệ thống
- [ ] Đảm bảo 123/123 unit tests của dự án tiếp tục pass 100% sau bất kỳ đề xuất tái cấu trúc nào.
- [ ] Đảm bảo quy trình CI (`npm run check`) không phát sinh thêm bất kỳ lỗi ESLint hoặc TypeScript nào.

## 2026-09-08T12:13:59Z

Khảo sát, phân tích chuyên sâu cấu trúc mã nguồn file `extension/entrypoints/viewer/main.tsx` (hiện tại ~2,430 dòng) và các file liên quan, lập Báo cáo Phân rã Module & Kiến trúc Tái cấu trúc chi tiết (`docs/MODULAR_DECOUPLING_PLAN.md`) nhằm bóc tách thành các Sub-components, Custom Hooks và Utility modules nhỏ gọn (< 400 dòng/file), nâng cao tối đa khả năng bảo trì và mở rộng về sau mà không gây hồi quy tính năng.

Working directory: d:\create\Live-Trans
Integrity mode: development

## Requirements

### R1. Khảo sát & Bóc tách Logic File Khổng Lồ `viewer/main.tsx` (~2,430 dòng)
Phân tích toàn bộ mã nguồn bên trong `viewer/main.tsx`, định danh và phân loại ranh giới trách nhiệm của 4 khối logic lớn đang bị dồn ứ:
1. **Khối Modal Cài đặt (Settings Modal & Tab Panes)**: Chiếm ~600 dòng JSX và handlers (Giao diện & Đọc, Mô hình AI & API, Hiệu năng & Bộ nhớ, Themes, Font custom select, Scale controls).
2. **Khối Thanh Công Cụ (Viewer Toolbar & Mode Selectors)**: Chiếm ~250 dòng (Brand info, Page navigation, Fit Width zoom reset, Segmented view mode, Vision AI / Whiteboard dropdown).
3. **Khối Điều phối Cuộn Đồng Bộ & Khóa Trần (ScrollSync & Ceiling-Lock Engine)**: Chiếm ~350 dòng logic sự kiện wheel, scroll listener hai chiều và giải thuật clamp trần trang.
4. **Khối Hàng Đợi Song Song & Worker Engine (Multi-Worker Dual-Priority Queue)**: Chiếm ~300 dòng quản lý `highPriorityQueueRef`, `waterfallQueueRef`, pacing delay, preemption window.

### R2. Thiết kế Kiến trúc Phân rã Module Chi tiết (Decoupling Architecture Blueprint)
Xây dựng bản vẽ thiết kế phân rã modular cho thư mục `extension/entrypoints/viewer/` và `lib/`:
- **Đề xuất danh sách Sub-components mới**: Ví dụ `components/ViewerToolbar.tsx`, `components/SettingsModal/SettingsModal.tsx`, `components/SettingsModal/AppearanceTab.tsx`, `components/SettingsModal/ModelsTab.tsx`, `components/SettingsModal/PerformanceTab.tsx`.
- **Đề xuất danh sách Custom Hooks mới**: Ví dụ `hooks/useVisionWorkerQueue.ts`, `hooks/useSyncScroll.ts`, `hooks/usePdfDocument.ts`.
- **Định nghĩa Interfaces & Contracts**: Khai báo rõ ràng State, Props và Callbacks truyền qua lại giữa `main.tsx` và các components con để giữ cho component cha cực kỳ tinh gọn (< 300 dòng).

### R3. Lập Báo cáo Kiểm toán & Lộ trình Thực thi Không Gãy (Roadmap & Zero-Regression Strategy)
Tổng hợp thành tài liệu `docs/MODULAR_DECOUPLING_PLAN.md`, mô tả chi tiết:
- Sơ đồ cấu trúc cây thư mục trước và sau khi bóc tách.
- Sơ đồ luồng dữ liệu (Data flow diagram) và quản lý State tập trung.
- Chiến lược thực thi theo từng giai đoạn an toàn (Phase 1: Tách UI độc lập -> Phase 2: Tách Hooks -> Phase 3: Thu gọn `main.tsx`), cam kết bảo toàn 100% các tính năng hiện tại và 161/161 unit tests.

## Acceptance Criteria

### Tính chuẩn xác & Chi tiết của Báo cáo
- [ ] Báo cáo `docs/MODULAR_DECOUPLING_PLAN.md` phân loại chính xác 100% các khối logic trong `viewer/main.tsx` kèm số dòng cụ thể.
- [ ] Cung cấp đầy đủ interface Typescript cho tất cả các Sub-components và Custom Hooks đề xuất bóc tách.
- [ ] Kế hoạch phân tách đảm bảo sau khi hoàn tất, không có bất kỳ file mới nào vượt quá 400 dòng mã nguồn.

### Tính toàn vẹn & Tương thích
- [ ] Bản thiết kế bảo toàn nguyên vẹn 100% các tính năng hiện có: Chế độ Vision AI, Whiteboard, Cuộn đồng bộ Page-to-Page kèm khóa trần, Cài đặt đa theme, Font family dropdown, Đa API Key, Bộ nhớ đệm bền vững đa ngôn ngữ.
- [ ] Đảm bảo 161/161 unit tests hiện tại không bị ảnh hưởng.


## 2026-09-08T12:16:07Z

[CHẾ ĐỘ SUY NGHĨ SÂU - EXTENDED HIGH THINKING MODE]
Yêu cầu áp dụng mức độ tư duy suy luận tối đa (High Thinking), phân tích phản biện đa chiều, rà soát chi tiết từng dòng lệnh, từng hook, từng ref, và từng interface trong ~2,430 dòng của file `extension/entrypoints/viewer/main.tsx` trước khi đưa ra kiến trúc phân rã module.

Khảo sát, phân tích chuyên sâu cấu trúc mã nguồn file `extension/entrypoints/viewer/main.tsx` (hiện tại ~2,430 dòng) và các file liên quan, lập Báo cáo Phân rã Module & Kiến trúc Tái cấu trúc chi tiết (`docs/MODULAR_DECOUPLING_PLAN.md`) nhằm bóc tách thành các Sub-components, Custom Hooks và Utility modules nhỏ gọn (< 400 dòng/file), nâng cao tối đa khả năng bảo trì và mở rộng về sau mà không gây hồi quy tính năng.

Working directory: d:\create\Live-Trans
Integrity mode: development

## Requirements

### R1. Khảo sát & Bóc tách Logic File Khổng Lồ `viewer/main.tsx` (~2,430 dòng)
Phân tích toàn bộ mã nguồn bên trong `viewer/main.tsx`, định danh và phân loại ranh giới trách nhiệm của 4 khối logic lớn đang bị dồn ứ:
1. **Khối Modal Cài đặt (Settings Modal & Tab Panes)**: Chiếm ~600 dòng JSX và handlers (Giao diện & Đọc, Mô hình AI & API, Hiệu năng & Bộ nhớ, Themes, Font custom select, Scale controls).
2. **Khối Thanh Công Cụ (Viewer Toolbar & Mode Selectors)**: Chiếm ~250 dòng (Brand info, Page navigation, Fit Width zoom reset, Segmented view mode, Vision AI / Whiteboard dropdown).
3. **Khối Điều phối Cuộn Đồng Bộ & Khóa Trần (ScrollSync & Ceiling-Lock Engine)**: Chiếm ~350 dòng logic sự kiện wheel, scroll listener hai chiều và giải thuật clamp trần trang.
4. **Khối Hàng Đợi Song Song & Worker Engine (Multi-Worker Dual-Priority Queue)**: Chiếm ~300 dòng quản lý `highPriorityQueueRef`, `waterfallQueueRef`, pacing delay, preemption window.

### R2. Thiết kế Kiến trúc Phân rã Module Chi tiết (Decoupling Architecture Blueprint)
Xây dựng bản vẽ thiết kế phân rã modular cho thư mục `extension/entrypoints/viewer/` và `lib/`:
- **Đề xuất danh sách Sub-components mới**: Ví dụ `components/ViewerToolbar.tsx`, `components/SettingsModal/SettingsModal.tsx`, `components/SettingsModal/AppearanceTab.tsx`, `components/SettingsModal/ModelsTab.tsx`, `components/SettingsModal/PerformanceTab.tsx`.
- **Đề xuất danh sách Custom Hooks mới**: Ví dụ `hooks/useVisionWorkerQueue.ts`, `hooks/useSyncScroll.ts`, `hooks/usePdfDocument.ts`.
- **Định nghĩa Interfaces & Contracts**: Khai báo rõ ràng State, Props và Callbacks truyền qua lại giữa `main.tsx` và các components con để giữ cho component cha cực kỳ tinh gọn (< 300 dòng).

### R3. Lập Báo cáo Kiểm toán & Lộ trình Thực thi Không Gãy (Roadmap & Zero-Regression Strategy)
Tổng hợp thành tài liệu `docs/MODULAR_DECOUPLING_PLAN.md`, mô tả chi tiết:
- Sơ đồ cấu trúc cây thư mục trước và sau khi bóc tách.
- Sơ đồ luồng dữ liệu (Data flow diagram) và quản lý State tập trung.
- Chiến lược thực thi theo từng giai đoạn an toàn (Phase 1: Tách UI độc lập -> Phase 2: Tách Hooks -> Phase 3: Thu gọn `main.tsx`), cam kết bảo toàn 100% các tính năng hiện tại và 161/161 unit tests.

## Acceptance Criteria

### Tính chuẩn xác & Chi tiết của Báo cáo
- [ ] Báo cáo `docs/MODULAR_DECOUPLING_PLAN.md` phân loại chính xác 100% các khối logic trong `viewer/main.tsx` kèm số dòng cụ thể.
- [ ] Cung cấp đầy đủ interface Typescript cho tất cả các Sub-components và Custom Hooks đề xuất bóc tách.
- [ ] Kế hoạch phân tách đảm bảo sau khi hoàn tất, không có bất kỳ file mới nào vượt quá 400 dòng mã nguồn.

### Tính toàn vẹn & Tương thích
- [ ] Bản thiết kế bảo toàn nguyên vẹn 100% các tính năng hiện có: Chế độ Vision AI, Whiteboard, Cuộn đồng bộ Page-to-Page kèm khóa trần, Cài đặt đa theme, Font family dropdown, Đa API Key, Bộ nhớ đệm bền vững đa ngôn ngữ.
- [ ] Đảm bảo 161/161 unit tests hiện tại không bị ảnh hưởng.

## 2026-09-08T12:56:05Z

[CHẾ ĐỘ SUY NGHĨ SÂU - EXTENDED HIGH THINKING MODE]
Yêu cầu áp dụng mức độ tư duy suy luận tối đa (High Thinking), thực hiện cẩn trọng, tỉ mỉ, kiểm tra type safety và bảo toàn 100% tính năng cũng như toàn bộ test suite.

Thực hiện tái cấu trúc và phân rã file `extension/entrypoints/viewer/main.tsx` (~2,430 dòng) thành 13 Sub-components và 4 Custom Hooks theo đúng bản vẽ thiết kế chuẩn mực đã được phê duyệt tại `docs/MODULAR_DECOUPLING_PLAN.md`.

Working directory: d:\create\Live-Trans
Integrity mode: development
Reference document: docs/MODULAR_DECOUPLING_PLAN.md

## Requirements

### R1. Trích xuất Các UI Sub-components Độc Lập
Tạo và di chuyển các component giao diện vào `extension/entrypoints/viewer/components/`:
- `Toolbar/ViewerToolbar.tsx`, `Toolbar/ModeSelectorDropdown.tsx`, `Toolbar/PageNavigator.tsx`
- `SettingsModal/SettingsModal.tsx`, `SettingsModal/AppearanceTab.tsx`, `SettingsModal/ModelsTab.tsx`, `SettingsModal/PerformanceTab.tsx`, `SettingsModal/PostSavePromptModal.tsx`
- `ApiKeyWarningBanner.tsx`, `SidebarDrawer.tsx`, `DraggableSplitter.tsx`, `PageRenderer.tsx`, `FlowBlock.tsx`
- Đảm bảo giữ nguyên 100% CSS classes, inline styles, responsive layout, và behavior.

### R2. Trích xuất Các Custom Hooks Điều Phối
Tạo và di chuyển các hook logic vào `extension/entrypoints/viewer/hooks/`:
- `usePdfDocument.ts`: Nạp PDF, document proxy, metadata, tính toán Fit Scale và resize handler.
- `useSettingsManager.ts`: Cấu hình chrome.storage, quản lý đa API Key, mask key, auto-save feedback.
- `useVisionWorkerQueue.ts`: Dual-priority queue, pool 2-7 workers, batch preemption window, pacing delay 400ms, rate-limit 429 guard, 0ms LRU cache lookup.
- `useSyncScroll.ts`: Cuộn đồng bộ 2 chiều, Ceiling-Lock engine, side-margin bypass, Mutex lock rAF, zoom Ctrl+Wheel độc lập.

### R3. Tinh Giản File Trung Tâm `viewer/main.tsx`
Refactor `extension/entrypoints/viewer/main.tsx` trở thành App Shell tinh gọn:
- Kết nối 4 Custom Hooks và render 13 Sub-components.
- Đảm bảo kích thước `main.tsx` giảm từ 2,429 dòng xuống còn < 300 dòng (mục tiêu ~220 dòng).
- Đảm bảo không có bất kỳ file mới nào vượt quá 400 dòng.

### R4. Bảo Toàn Tuyệt Đối Tính Toàn Vẹn Hệ Thống
- Đảm bảo toàn bộ 161/161 unit tests (`npm run test`) tiếp tục PASS 100%.
- Đảm bảo `npm run check` hoàn thành sạch sẽ với 0 lỗi TypeScript và linting.
- Đảm bảo `npm run build` đóng gói extension thành công.

## Acceptance Criteria

### Kích thước mã nguồn & Cấu trúc
- [ ] Tệp `extension/entrypoints/viewer/main.tsx` có dung lượng dưới 300 dòng mã nguồn.
- [ ] Toàn bộ các file sub-components và custom hooks mới đều dưới 400 dòng mã nguồn.
- [ ] Cấu trúc cây thư mục tuân thủ chính xác thiết kế trong `docs/MODULAR_DECOUPLING_PLAN.md`.

### Kiểm chứng tự động (Automated Verification)
- [ ] `npm run test` chạy thành công với 161/161 tests PASS.
- [ ] `npm run check` không có lỗi TypeScript (`tsc --noEmit`).
- [ ] `npm run build` hoàn thành không có lỗi biên dịch.

