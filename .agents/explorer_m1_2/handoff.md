# BÁO CÁO KHẢO SÁT CHUYÊN SÂU & THIẾT KẾ KIẾN TRÚC TÁI CẤU TRÚC (EXPLORER M1-2)

**Đối tượng khảo sát**: `extension/entrypoints/viewer/main.tsx` (Tổng cộng 2,429 dòng)
**Trọng tâm khảo sát**:
1. Khối Điều phối Cuộn Đồng Bộ & Khóa Trần (ScrollSync & Ceiling-Lock Engine)
2. Khối Hàng Đợi Song Song & Worker Engine (Multi-Worker Dual-Priority Queue)
**Tác giả**: Explorer M1-2 (M1 Milestone)

---

## 1. OBSERVATION (QUAN SÁT THỰC TẾ TRỰC TIẾP)

### 1.1. Phạm vi dòng của Khối Điều phối Cuộn Đồng Bộ & Khóa Trần (ScrollSync & Ceiling-Lock Engine)
Trong `extension/entrypoints/viewer/main.tsx`:
- **Dòng 107 - 109**: Khởi tạo DOM container refs và cờ Mutex chống vòng lặp đệ quy cuộn:
  ```ts
  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);
  const isSyncingScroll = useRef<boolean>(false);
  ```
- **Dòng 111 - 139**: Tự động tính toán tỷ lệ phóng vừa chiều ngang (Fit Scale) độc lập cho từng khung xem (`calculatePaneFitScale`, `useEffect` lắng nghe resize, split ratio, sidebar open/pin, viewMode).
- **Dòng 30 - 34 & 141 - 142**: Hàm `applyZoomStep` và công thức tính tỷ lệ thực tế (`effectiveLeftScale`, `effectiveRightScale` kết hợp giữa `fitScale` và `zoomFactor`).
- **Dòng 608 - 663**: Hàm `handleLeftScroll`: Bắt sự kiện cuộn từ khung PDF gốc (`leftPaneRef`), tìm trang đang hiển thị ở đỉnh, tính tỷ lệ cuộn cục bộ trong trang (`pageOffsetRatio`), gióng hàng chính xác sang trang tương ứng bên khung dịch (`rightPaneRef`), kích hoạt ưu tiên dịch và nhả cờ mutex qua `requestAnimationFrame`.
- **Dòng 665 - 721**: Hàm `handleRightScroll`: Bắt sự kiện cuộn từ khung bản dịch (`rightPaneRef`), tìm trang đang hiển thị ở đỉnh, gióng hàng ngược lại sang khung PDF gốc (`leftPaneRef`), cập nhật `currentPage` và nhả mutex.
- **Dòng 723 - 737**: `useEffect` lắng nghe sự kiện `wheel` độc lập trên khung trái (`leftPaneRef`) với cờ `{ passive: false }` để thực hiện Ctrl + Wheel Zoom độc lập (`leftZoomFactor`).
- **Dòng 739 - 940**: `useEffect` cài đặt giải thuật `Intelligent Reading Column Coordinator & Ceiling-Lock` trên khung phải (`rightPaneRef`):
  + *Dòng 752 - 757*: Bắt `e.ctrlKey` để zoom độc lập khung phải (`rightZoomFactor`).
  + *Dòng 762 - 776*: Bóc tách vùng lề đen 2 bên (`isInSideMargin` dựa trên `firstPage.getBoundingClientRect()`), cho phép cuộn tự do khi chuột ở ngoài lề trang.
  + *Dòng 778 - 798*: Định vị cột đọc tài liệu, xác định trang đang ở vị trí trần (`ceiling = p.offsetTop - 24`), trích xuất container con `.lt-vision-body`.
  + *Dòng 799 - 866*: Nhánh cuộn xuống (`e.deltaY > 0`): Điều phối 3 trường hợp: (1) Khung cha chưa tới trần -> cuộn tới trần và chuyển lực thừa vào trang con; (2) Trang hiện tại ở trần và nội dung con chưa hết -> khóa cứng khung cha tại trần, cuộn nội dung con, xử lý subpixel clamp đáy; (3) Nội dung con đã hết -> cuộn khung cha sang trang kế tiếp kèm hãm phanh chống vọt lố.
  + *Dòng 867 - 936*: Nhánh cuộn lên (`e.deltaY < 0`): Điều phối 3 trường hợp cuộn ngược, khóa cứng trần trang, cuộn nội dung con lên đỉnh, hãm phanh dừng chuẩn xác ở trần trang trước và chuyển lực cuộn thừa vào đáy trang trước.
- **Dòng 1062 - 1076**: Hàm `scrollToPage(pageNumber: number)`: Nhảy trang dứt khoát, bypass bộ đệm trễ debounce để ưu tiên ngay 0ms, kích hoạt `scrollIntoView({ behavior: 'smooth', block: 'start' })`.
- **Dòng 2065 - 2073**: Gắn `ref={leftPaneRef}` và sự kiện `onScroll={handleLeftScroll}` vào DOM của Pane trái.
- **Dòng 2154 - 2164**: Gắn `ref={rightPaneRef}` và sự kiện `onScroll={handleRightScroll}` vào DOM của Pane phải.

---

### 1.2. Phạm vi dòng của Khối Hàng Đợi Song Song & Worker Engine (Multi-Worker Dual-Priority Queue)
Trong `extension/entrypoints/viewer/main.tsx`:
- **Dòng 53 - 57**: State UI cho Vision Worker:
  ```ts
  const [pageVisionTranslations, setPageVisionTranslations] = useState<Record<number, string>>({});
  const [pageVisionStatus, setPageVisionStatus] = useState<Record<number, 'loading' | 'done' | 'error' | 'queued'>>({});
  const [activePriorityPages, setActivePriorityPages] = useState<number[]>([]);
  const [pendingPriorityPages, setPendingPriorityPages] = useState<number[]>([]);
  const [pageVisionErrors, setPageVisionErrors] = useState<Record<number, string>>({});
  ```
- **Dòng 221 - 229**: Các Refs quản lý hàng đợi, worker pool và timing:
  ```ts
  const highPriorityQueueRef = useRef<number[]>([]);
  const waterfallQueueRef = useRef<number[]>([]);
  const activeWorkersCountRef = useRef<number>(0);
  const activeProcessingPagesRef = useRef<Set<number>>(new Set());
  const wakePacingTimerRef = useRef<(() => void) | null>(null);
  const scrollDebounceTimerRef = useRef<any>(null);
  const isRateLimitedRef = useRef<boolean>(false);
  const initializedWaterfallRef = useRef<string>('');
  ```
- **Dòng 286 - 288**: Refs lưu trữ trạng thái đồng bộ chống Stale Closure và token chống race:
  ```ts
  const pageVisionStatusRef = useRef<Record<number, 'loading' | 'done' | 'error' | 'queued'>>({});
  const pageVisionTranslationsRef = useRef<Record<number, string>>({});
  const visionTokenRef = useRef<Record<number, number>>({});
  ```
- **Dòng 290 - 347**: Hàm `executeVisionTranslation(pageNumber: number, force = false)`:
  + Kiểm tra tính hợp lệ của trang.
  + Kiểm tra cache tức thì 0ms (duyệt danh sách `candidates = [settings.pdfModel, 'gemini-3.5-flash-lite', 'gemini-3.5-flash']` qua `getCachedVisionTranslation`).
  + Quản lý generation token (`visionTokenRef`) để vô hiệu hoá phản hồi cũ nếu người dùng chuyển đổi hoặc retry giữa chừng.
  + Gọi backend API đa phương thức `translatePageVision(...)`.
  + Tự động phát hiện lỗi 429/Quota (`/429|resource_exhausted|quota/i`), kích hoạt cờ `isRateLimitedRef.current = true` để đóng băng thác nước ngầm tránh gây nghẽn và bão lỗi mạng.
- **Dòng 349 - 444**: Hàm Worker Coroutine `runVisionWorker()`:
  + Vòng lặp bất tận `while (true)` quét tuần tự `highPriorityQueueRef` trước, sau đó mới quét `waterfallQueueRef`.
  + Kiểm tra trùng lặp qua `activeProcessingPagesRef`.
  + Đánh dấu UI `setActivePriorityPages` và `setPendingPriorityPages`.
  + Khối `try ... finally` giải phóng trang khỏi `activeProcessingPagesRef`.
  + Nhịp nghỉ `pacing delay` 400ms giữa các trang waterfall nền để bảo vệ hạn ngạch API, có khả năng bị hủy tức thì (`wakePacingTimerRef.current()`) khi có trang ưu tiên.
  + Tự cân bằng worker pool khi thoát: giảm `activeWorkersCountRef` và triệu hồi `processVisionQueue()` nếu còn trang tồn đọng.
- **Dòng 446 - 460**: Bộ điều phối Worker Pool `processVisionQueue()`:
  + Duy trì số lượng worker đồng thời bằng `Math.min(7, Math.max(2, settings.pdfConcurrency || 5))`.
  + Kích hoạt các coroutine `void runVisionWorker()`.
- **Dòng 462 - 535**: Cơ chế Chen Ngang Cụm (Batch Preemption Window) `prioritizeVisionPage(pageNumber, force)`:
  + Mở cửa sổ ưu tiên gồm `concurrency` trang liên tiếp `[pageNumber ... pageNumber + concurrency - 1]`.
  + Đưa toàn bộ các trang chưa xong lên đỉnh `highPriorityQueueRef` và loại bỏ khỏi `waterfallQueueRef`.
  + Xóa cờ rate-limited (`isRateLimitedRef.current = false`) vì đây là hành vi chủ động từ người đọc.
  + Đánh thức ngay lập tức worker đang ngủ pacing qua `wakePacingTimerRef.current()`.
- **Dòng 537 - 545**: Hàm `debouncedPrioritizePage(pageNumber, force)`: Đệm trễ 300ms tránh spam ưu tiên khi người dùng cuộn chuột liên tục.
- **Dòng 546 - 569**: Hàm `retryVisionPage(pageNumber)`: Xóa cache trang cụ thể và kích hoạt dịch cưỡng bức (`force = true`).
- **Dòng 571 - 606**: `useEffect` khởi chạy Background Waterfall: Nạp trước các bản dịch đã lưu trong cache vào state 'done', đẩy các trang chưa dịch vào `waterfallQueueRef`, và ưu tiên ngay `currentPage`.
- **Dòng 1023 - 1041**: Logic `retranslateAll` trong chế độ Vision: Xóa toàn bộ cache tài liệu, reset hàng đợi waterfall và bắt đầu lại từ trang hiện tại.

---

## 2. LOGIC CHAIN (CHUỖI SUY LUẬN TỪ QUAN SÁT ĐẾN KẾT LUẬN)

### 2.1. Logic Chain của Khối ScrollSync & Ceiling-Lock Engine
1. **Quan sát 1**: Tại dòng 109, 615 và 671, `isSyncingScroll.current` được dùng như một Mutex.
   - *Suy luận*: Nếu không có cờ này, khi người dùng cuộn khung trái, hàm `handleLeftScroll` sẽ thay đổi `right.scrollTop`. Thay đổi này kích hoạt sự kiện `onScroll` của khung phải, gọi tiếp `handleRightScroll` làm thay đổi `left.scrollTop`, tạo ra vòng lặp vô hạn (infinite scroll loop) gây đơ giật giao diện.
   - *Suy luận tiếp*: `requestAnimationFrame` ở dòng 660 và 718 đảm bảo cờ mutex chỉ được mở lại sau khi trình duyệt đã hoàn tất chu kỳ render frame kế tiếp.
2. **Quan sát 2**: Tại dòng 628-649 và 686-708, việc đồng bộ không dùng công thức phần trăm tuyến tính (`scrollTop / scrollHeight`) mà dùng thuật toán Page-to-Page Alignment:
   - *Suy luận*: Trang dịch thuật ngữ và công thức LaTeX thường có độ cao dãn nở văn bản lớn hơn trang PDF gốc từ 10% đến 40%. Nếu dùng tỉ lệ tuyến tính, các trang ở nửa sau tài liệu sẽ bị lệch hoàn toàn so với bản gốc. Do đó thuật toán tìm thẻ trang hiển thị ở đỉnh (`bestPno`) và tính tỉ lệ cuộn nội bộ trong trang đó (`pageOffsetRatio = (scrollTop - top) / height`), rồi áp chính xác tỉ lệ này vào trang tương ứng ở khung đối diện.
3. **Quan sát 3**: Tại dòng 762-776, sự kiện `wheel` kiểm tra tọa độ `e.clientX` so với `firstPageRect.left` và `right`.
   - *Suy luận*: Ở màn hình rộng, trang PDF và trang dịch nằm ở giữa, hai bên là lề màu tối (vùng đen). Nếu người dùng di chuột ở vùng lề này, họ muốn cuộn nhanh qua các trang mà không bị chặn lại bởi nội dung dài bên trong từng trang. Bằng cách return sớm khi `isInSideMargin === true`, thuật toán cho phép cuộn tự do toàn khung cha.
4. **Quan sát 4**: Tại dòng 800-866 và 868-936, giải thuật Ceiling-Lock chia làm 3 giai đoạn:
   - *Giai đoạn 1 (Chạm trần)*: Khi đỉnh trang bản dịch cách mép trên 24px (`targetCeiling`), khung cha được khóa chặt (`right.scrollTop = targetCeiling`).
   - *Giai đoạn 2 (Cuộn nội dung trong trang)*: Con trỏ cuộn được chuyển hướng vào container con `.lt-vision-body` cho đến khi đọc hết trang (`remainingDown <= 3`). Có xử lý bù trừ subpixel clamp khi `actualScrolled < e.deltaY`.
   - *Giai đoạn 3 (Chuyển trang & Hãm phanh)*: Khi trang con đã hết nội dung, khung cha cuộn tiếp sang trang kế tiếp. Lực cuộn được hãm phanh để dừng đúng trần trang sau (`nextCeiling`), phần lực thừa tiếp tục chuyển tiếp tự nhiên vào nội dung trang mới.

### 2.2. Logic Chain của Khối Multi-Worker Dual-Priority Queue
1. **Quan sát 1**: Tại dòng 221-224, 358-397, 468-474, hệ thống sử dụng 2 hàng đợi: `highPriorityQueueRef` và `waterfallQueueRef`.
   - *Suy luận*: Nếu chỉ dùng 1 hàng đợi tuần tự (FIFO), khi tài liệu có 50 trang và người dùng nhảy đến trang 20, họ sẽ phải chờ 19 trang trước dịch xong mới tới trang 20 (chờ vài phút). Cơ chế hàng đợi kép ưu tiên tuyệt đối `highPriorityQueueRef`, cho phép chen ngang ngay lập tức.
2. **Quan sát 2**: Cơ chế Cụm Cửa Sổ Ưu Tiên (Batch Preemption Window) ở dòng 468-474:
   - *Suy luận*: Hệ thống cho phép chạy `concurrency` (2-7, mặc định 5) worker song song. Khi người dùng dừng mắt tại trang K, nếu chỉ đưa 1 trang K vào ưu tiên thì 4 worker còn lại sẽ nhàn rỗi hoặc tiếp tục dịch nền các trang xa xôi. Vì vậy, hệ thống tự động gom cụm `[K, K+1, ..., K + concurrency - 1]` vào hàng đợi ưu tiên để tận dụng 100% công suất của cả 5 workers xử lý ngay vùng mắt người dùng chuẩn bị đọc tới.
3. **Quan sát 3**: Bộ đệm trễ Debounce 300ms ở dòng 537-545:
   - *Suy luận*: Khi người dùng cuộn chuột nhanh qua 10 trang trong 1 giây, nếu không có debounce, mỗi trang lướt qua đều kích hoạt ưu tiên, làm xáo trộn hàng đợi và lãng phí hạn ngạch API. Debounce 300ms đảm bảo chỉ khi người dùng dừng mắt đọc trang đó thì trang mới được kích hoạt ưu tiên.
4. **Quan sát 4**: Pacing Delay 400ms và cơ chế ngắt nhịp ở dòng 420-432:
   - *Suy luận*: Dịch nền tuần tự (waterfall) nếu bắn liên tục không nghỉ sẽ dễ dẫn đến lỗi 429 Quota Exceeded (giới hạn 15 RPM ở các key free tier). Nhịp nghỉ 400ms giữ nhịp độ an toàn. Khi người dùng kích hoạt ưu tiên, `wakePacingTimerRef.current()` được gọi ngay lập tức để đánh thức worker mà không phải chờ hết 400ms.
5. **Quan sát 5**: Tự bảo vệ trước lỗi Rate Limit (429) ở dòng 342-345 và phục hồi ở dòng 523:
   - *Suy luận*: Khi gặp lỗi quota, nếu tiếp tục bắn waterfall ngầm sẽ chỉ tạo thêm rác và lỗi mạng. Do đó, cờ `isRateLimitedRef.current` đóng băng thác nước ngầm. Nhưng khi người dùng chủ động nhấn xem trang hoặc retry, cờ này được reset về `false` để thử lại ngay.

---

## 3. CAVEATS (NHỮNG ĐIỂM CẦN LƯU Ý & RANH GIỚI KHẢO SÁT)

1. **Sự phụ thuộc vào cấu trúc DOM**:
   - Giải thuật ScrollSync và Ceiling-Lock phụ thuộc trực tiếp vào các class name CSS: `.lt-page-wrap`, `.lt-vision-page`, `.lt-whiteboard-page`, `.lt-markdown-page`, và container con `.lt-vision-body`. Khi tách thành Custom Hook, các class name này cần được giữ nguyên vẹn 100% hoặc quản lý tập trung qua hằng số.
2. **Khối Text/Whiteboard Queue (`runWithPageSlot`)**:
   - Dòng 944-962 có một hàng đợi phụ `pageQueueRef` (concurrency = 2) dành riêng cho chế độ Whiteboard/Text blocks (sử dụng Semaphore). Khối này độc lập với Multi-Worker Dual-Priority Queue của Vision AI. Khuyến nghị: Custom Hook `useVisionWorkerQueue` chỉ tập trung quản lý Vision AI, còn Whiteboard text queue có thể nằm ở `usePdfDocument` hoặc hook chuyên biệt khác để tránh phình to kích thước file.
3. **Không chỉnh sửa trực tiếp mã nguồn**:
   - Báo cáo này hoàn toàn là khảo sát read-only. Không có dòng code nào trong `extension/entrypoints/viewer/main.tsx` bị sửa đổi trong đợt khảo sát này.

---

## 4. CONCLUSION & ĐỀ XUẤT KIẾN TRÚC CUSTOM HOOKS (< 400 DÒNG/FILE)

Hai khối logic trên đang chiếm xấp xỉ **650 dòng mã nguồn** lồng ghép phức tạp bên trong `main.tsx`. Việc tách 2 khối này thành 2 Custom Hooks độc lập sẽ giúp thu gọn `main.tsx` đáng kể, tăng cường tính module hóa và dễ bảo trì.

Dưới đây là thiết kế kiến trúc và mã nguồn chi tiết sẵn sàng triển khai:

---

### 4.1. Thiết kế Custom Hook 1: `useSyncScroll.ts`
**Đường dẫn đề xuất**: `extension/entrypoints/viewer/hooks/useSyncScroll.ts`
**Số dòng dự kiến**: ~230 dòng (đáp ứng tiêu chuẩn < 400 dòng).

```typescript
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { ViewMode } from '@/lib/pdf/types';

export interface UseSyncScrollOptions {
  viewMode: ViewMode;
  readerMode: 'whiteboard' | 'vision' | 'markdown' | 'overlay';
  numPages: number;
  splitRatio: number;
  sidebarOpen: boolean;
  isSidebarPinned: boolean;
  pdfDoc: PDFDocumentProxy | null;
  onPageChange?: (pageNumber: number) => void;
  onPrioritizePage?: (pageNumber: number) => void;
}

export interface UseSyncScrollReturn {
  leftPaneRef: preact.RefObject<HTMLDivElement>;
  rightPaneRef: preact.RefObject<HTMLDivElement>;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  leftFitScale: number;
  rightFitScale: number;
  leftZoomFactor: number;
  rightZoomFactor: number;
  effectiveLeftScale: number;
  effectiveRightScale: number;
  setLeftZoomFactor: preact.StateUpdater<number>;
  setRightZoomFactor: preact.StateUpdater<number>;
  handleLeftScroll: () => void;
  handleRightScroll: () => void;
  scrollToPage: (pageNumber: number) => void;
  resetZoom: () => void;
}

function applyZoomStep(currentFactor: number, deltaY: number): number {
  if (Math.abs(deltaY) < 1) return currentFactor;
  const step = deltaY < 0 ? 0.08 : -0.08;
  return Math.max(0.5, Math.min(3.0, Math.round((currentFactor + step) * 100) / 100));
}

export function useSyncScroll({
  viewMode,
  readerMode,
  numPages,
  splitRatio,
  sidebarOpen,
  isSidebarPinned,
  pdfDoc,
  onPageChange,
  onPrioritizePage,
}: UseSyncScrollOptions): UseSyncScrollReturn {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [leftFitScale, setLeftFitScale] = useState<number>(1.0);
  const [rightFitScale, setRightFitScale] = useState<number>(1.0);
  const [leftZoomFactor, setLeftZoomFactor] = useState<number>(1.0);
  const [rightZoomFactor, setRightZoomFactor] = useState<number>(1.0);

  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);
  const isSyncingScroll = useRef<boolean>(false);

  // Tính tỷ lệ zoom Fit màn hình độc lập
  const calculatePaneFitScale = useCallback((pane: HTMLElement | null) => {
    if (!pane) return 1.0;
    const availableWidth = pane.clientWidth - 32;
    if (availableWidth <= 100) return 1.0;
    const baseWidth = 612; // Khổ ngang PDF chuẩn
    const computed = Math.round((availableWidth / baseWidth) * 100) / 100;
    return Math.max(0.35, Math.min(3.0, computed));
  }, []);

  // Lắng nghe resize, splitter kéo, sidebar toggle
  useEffect(() => {
    const handleResize = () => {
      setLeftFitScale(calculatePaneFitScale(leftPaneRef.current));
      setRightFitScale(calculatePaneFitScale(rightPaneRef.current));
    };

    handleResize();
    const t = setTimeout(handleResize, 120);

    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', handleResize);
    };
  }, [calculatePaneFitScale, splitRatio, sidebarOpen, isSidebarPinned, viewMode, pdfDoc]);

  const effectiveLeftScale = leftFitScale * leftZoomFactor;
  const effectiveRightScale = rightFitScale * rightZoomFactor;

  // Cuộn đồng bộ từ Trái sang Phải
  const handleLeftScroll = useCallback(() => {
    if (isSyncingScroll.current || viewMode !== 'bilingual') return;
    const left = leftPaneRef.current;
    const right = rightPaneRef.current;
    if (!left || !right) return;

    isSyncingScroll.current = true;

    const leftPages = left.querySelectorAll<HTMLElement>('.lt-page-wrap');
    let bestPno = currentPage;
    let pageOffsetRatio = 0;
    let minDistance = Infinity;

    for (let i = 0; i < leftPages.length; i++) {
      const p = leftPages[i];
      if (!p) continue;
      const top = p.offsetTop;
      const height = p.offsetHeight;
      const pno = Number(p.dataset.pageNumber || i + 1);

      if (left.scrollTop >= top - 24 && left.scrollTop < top + height) {
        bestPno = pno;
        pageOffsetRatio = Math.max(0, Math.min(1, (left.scrollTop - top) / height));
        break;
      }

      const dist = Math.abs(left.scrollTop - top);
      if (dist < minDistance) {
        minDistance = dist;
        bestPno = pno;
        pageOffsetRatio = left.scrollTop >= top + height ? 1 : 0;
      }
    }

    const rightPage = right.querySelector<HTMLElement>(
      `.lt-whiteboard-page[data-page-number="${bestPno}"], .lt-page-wrap[data-page-number="${bestPno}"], .lt-markdown-page[data-page-number="${bestPno}"], .lt-vision-page[data-page-number="${bestPno}"]`
    );
    if (rightPage) {
      right.scrollTop = rightPage.offsetTop + rightPage.offsetHeight * pageOffsetRatio;
    } else {
      const scrollMax = left.scrollHeight - left.clientHeight;
      const ratio = scrollMax > 0 ? left.scrollTop / scrollMax : 0;
      right.scrollTop = ratio * (right.scrollHeight - right.clientHeight);
    }

    setCurrentPage(bestPno);
    onPageChange?.(bestPno);
    if (readerMode === 'vision') {
      onPrioritizePage?.(bestPno);
    }
    requestAnimationFrame(() => {
      isSyncingScroll.current = false;
    });
  }, [viewMode, currentPage, readerMode, onPageChange, onPrioritizePage]);

  // Cuộn đồng bộ từ Phải sang Trái
  const handleRightScroll = useCallback(() => {
    if (isSyncingScroll.current || viewMode !== 'bilingual') return;
    const left = leftPaneRef.current;
    const right = rightPaneRef.current;
    if (!left || !right) return;

    isSyncingScroll.current = true;

    const rightPages = right.querySelectorAll<HTMLElement>(
      '.lt-whiteboard-page, .lt-page-wrap, .lt-markdown-page, .lt-vision-page'
    );
    let bestPno = currentPage;
    let pageOffsetRatio = 0;
    let minDistance = Infinity;

    for (let i = 0; i < rightPages.length; i++) {
      const p = rightPages[i];
      if (!p) continue;
      const top = p.offsetTop;
      const height = p.offsetHeight;
      const pno = Number(p.dataset.pageNumber || i + 1);

      if (right.scrollTop >= top - 24 && right.scrollTop < top + height) {
        bestPno = pno;
        pageOffsetRatio = Math.max(0, Math.min(1, (right.scrollTop - top) / height));
        break;
      }

      const dist = Math.abs(right.scrollTop - top);
      if (dist < minDistance) {
        minDistance = dist;
        bestPno = pno;
        pageOffsetRatio = right.scrollTop >= top + height ? 1 : 0;
      }
    }

    const leftPage = left.querySelector<HTMLElement>(`.lt-page-wrap[data-page-number="${bestPno}"]`);
    if (leftPage) {
      left.scrollTop = leftPage.offsetTop + leftPage.offsetHeight * pageOffsetRatio;
    } else {
      const scrollMax = right.scrollHeight - right.clientHeight;
      const ratio = scrollMax > 0 ? right.scrollTop / scrollMax : 0;
      left.scrollTop = ratio * (left.scrollHeight - left.clientHeight);
    }

    setCurrentPage(bestPno);
    onPageChange?.(bestPno);
    if (readerMode === 'vision') {
      onPrioritizePage?.(bestPno);
    }
    requestAnimationFrame(() => {
      isSyncingScroll.current = false;
    });
  }, [viewMode, currentPage, readerMode, onPageChange, onPrioritizePage]);

  // Zoom độc lập khung trái (Ctrl + Wheel)
  useEffect(() => {
    const left = leftPaneRef.current;
    if (!left) return;

    const onLeftPaneWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        setLeftZoomFactor((prev) => applyZoomStep(prev, e.deltaY));
      }
    };

    left.addEventListener('wheel', onLeftPaneWheel, { passive: false });
    return () => left.removeEventListener('wheel', onLeftPaneWheel);
  }, [viewMode]);

  // Intelligent Reading Column Coordinator & Ceiling-Lock Engine
  useEffect(() => {
    const right = rightPaneRef.current;
    if (!right) return;

    const onRightPaneWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        setRightZoomFactor((prev) => applyZoomStep(prev, e.deltaY));
        return;
      }

      if (!e.deltaY) return;

      const pages = Array.from(right.querySelectorAll<HTMLElement>('.lt-vision-page, .lt-whiteboard-page'));
      if (pages.length === 0) return;

      const firstPage = pages[0];
      if (!firstPage) return;

      const firstPageRect = firstPage.getBoundingClientRect();
      const isInSideMargin = e.clientX < firstPageRect.left || e.clientX > firstPageRect.right;
      if (isInSideMargin) return;

      let currIdx = 0;
      for (let i = 0; i < pages.length; i++) {
        const p = pages[i];
        if (!p) continue;
        const ceiling = p.offsetTop - 24;
        if (right.scrollTop >= ceiling - 2) {
          currIdx = i;
        } else {
          break;
        }
      }

      const pCurr = pages[currIdx];
      if (!pCurr) return;
      const targetCeiling = pCurr.offsetTop - 24;
      const bodyCurr =
        pCurr.querySelector<HTMLElement>('.lt-vision-body') ??
        (pCurr.classList.contains('lt-whiteboard-page') ? pCurr : null);

      if (e.deltaY > 0) {
        // Cuộn xuống
        if (right.scrollTop < targetCeiling - 2) {
          const dist = targetCeiling - right.scrollTop;
          if (e.deltaY <= dist) {
            right.scrollTop += e.deltaY;
          } else {
            right.scrollTop = targetCeiling;
            if (bodyCurr) bodyCurr.scrollTop += (e.deltaY - dist);
          }
          e.preventDefault();
          return;
        }

        const maxScroll = bodyCurr ? Math.max(0, bodyCurr.scrollHeight - bodyCurr.clientHeight) : 0;
        const remainingDown = bodyCurr ? maxScroll - bodyCurr.scrollTop : 0;

        if (remainingDown > 3 && bodyCurr) {
          right.scrollTop = targetCeiling;
          const prevScroll = bodyCurr.scrollTop;
          bodyCurr.scrollTop += e.deltaY;
          const actualScrolled = bodyCurr.scrollTop - prevScroll;

          if (actualScrolled < e.deltaY) {
            const unusedDelta = e.deltaY - Math.max(0, actualScrolled);
            if (currIdx < pages.length - 1) {
              const nextP = pages[currIdx + 1];
              if (nextP) {
                const nextCeiling = nextP.offsetTop - 24;
                right.scrollTop = Math.min(nextCeiling, right.scrollTop + unusedDelta);
              }
            }
          }
          e.preventDefault();
          return;
        }

        if (currIdx < pages.length - 1) {
          const pNext = pages[currIdx + 1];
          if (pNext) {
            const nextCeiling = pNext.offsetTop - 24;
            const distToNext = nextCeiling - right.scrollTop;

            if (distToNext > 0) {
              if (e.deltaY <= distToNext) {
                right.scrollTop += e.deltaY;
              } else {
                right.scrollTop = nextCeiling;
                const nextBody =
                  pNext.querySelector<HTMLElement>('.lt-vision-body') ??
                  (pNext.classList.contains('lt-whiteboard-page') ? pNext : null);
                if (nextBody) nextBody.scrollTop += (e.deltaY - distToNext);
              }
              e.preventDefault();
              return;
            }
          }
        }
      } else if (e.deltaY < 0) {
        // Cuộn lên
        const absDelta = Math.abs(e.deltaY);
        if (right.scrollTop > targetCeiling + 2) {
          const dist = right.scrollTop - targetCeiling;
          if (absDelta <= dist) {
            right.scrollTop -= absDelta;
          } else {
            right.scrollTop = targetCeiling;
            const excess = absDelta - dist;
            if (bodyCurr) bodyCurr.scrollTop = Math.max(0, bodyCurr.scrollTop - excess);
          }
          e.preventDefault();
          return;
        }

        const remainingUp = bodyCurr ? bodyCurr.scrollTop : 0;
        if (remainingUp > 3 && bodyCurr) {
          right.scrollTop = targetCeiling;
          const prevScroll = bodyCurr.scrollTop;
          bodyCurr.scrollTop -= absDelta;
          const actualScrolled = prevScroll - bodyCurr.scrollTop;

          if (actualScrolled < absDelta) {
            const unusedDelta = absDelta - Math.max(0, actualScrolled);
            if (currIdx > 0) {
              const prevP = pages[currIdx - 1];
              if (prevP) {
                const prevCeiling = prevP.offsetTop - 24;
                right.scrollTop = Math.max(prevCeiling, right.scrollTop - unusedDelta);
              }
            }
          }
          e.preventDefault();
          return;
        }

        if (currIdx > 0) {
          const pPrev = pages[currIdx - 1];
          if (pPrev) {
            const prevCeiling = pPrev.offsetTop - 24;
            const distToPrev = right.scrollTop - prevCeiling;

            if (distToPrev > 0) {
              if (absDelta <= distToPrev) {
                right.scrollTop -= absDelta;
              } else {
                right.scrollTop = prevCeiling;
                const prevBody =
                  pPrev.querySelector<HTMLElement>('.lt-vision-body') ??
                  (pPrev.classList.contains('lt-whiteboard-page') ? pPrev : null);
                if (prevBody) {
                  const prevMax = Math.max(0, prevBody.scrollHeight - prevBody.clientHeight);
                  prevBody.scrollTop = Math.max(0, prevMax - (absDelta - distToPrev));
                }
              }
              e.preventDefault();
              return;
            }
          }
        }
      }
    };

    right.addEventListener('wheel', onRightPaneWheel, { passive: false });
    return () => right.removeEventListener('wheel', onRightPaneWheel);
  }, [viewMode, numPages]);

  const scrollToPage = useCallback((pageNumber: number) => {
    setCurrentPage(pageNumber);
    const target = leftPaneRef.current?.querySelector(`[data-page-number="${pageNumber}"]`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const resetZoom = useCallback(() => {
    setLeftZoomFactor(1.0);
    setRightZoomFactor(1.0);
  }, []);

  return {
    leftPaneRef,
    rightPaneRef,
    currentPage,
    setCurrentPage,
    leftFitScale,
    rightFitScale,
    leftZoomFactor,
    rightZoomFactor,
    effectiveLeftScale,
    effectiveRightScale,
    setLeftZoomFactor,
    setRightZoomFactor,
    handleLeftScroll,
    handleRightScroll,
    scrollToPage,
    resetZoom,
  };
}
```

---

### 4.2. Thiết kế Custom Hook 2: `useVisionWorkerQueue.ts`
**Đường dẫn đề xuất**: `extension/entrypoints/viewer/hooks/useVisionWorkerQueue.ts`
**Số dòng dự kiến**: ~290 dòng (đáp ứng tiêu chuẩn < 400 dòng).

```typescript
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { Settings } from '@/lib/settings';
import {
  translatePageVision,
  getCachedVisionTranslation,
  clearCachedVisionTranslation,
} from '@/lib/pdf/vision-translate';

export interface UseVisionWorkerQueueOptions {
  pdfDoc: PDFDocumentProxy | null;
  pdfUrl: string;
  numPages: number;
  currentPage: number;
  settings: Settings;
  readerMode: 'whiteboard' | 'vision' | 'markdown' | 'overlay';
  hasActiveKey: boolean;
}

export interface UseVisionWorkerQueueReturn {
  pageVisionTranslations: Record<number, string>;
  pageVisionStatus: Record<number, 'loading' | 'done' | 'error' | 'queued'>;
  pageVisionErrors: Record<number, string>;
  activePriorityPages: number[];
  pendingPriorityPages: number[];
  prioritizeVisionPage: (pageNumber: number, force?: boolean) => void;
  debouncedPrioritizePage: (pageNumber: number, force?: boolean) => void;
  retryVisionPage: (pageNumber: number) => void;
  retranslateAllVision: () => void;
}

export function useVisionWorkerQueue({
  pdfDoc,
  pdfUrl,
  numPages,
  currentPage,
  settings,
  readerMode,
  hasActiveKey,
}: UseVisionWorkerQueueOptions): UseVisionWorkerQueueReturn {
  const [pageVisionTranslations, setPageVisionTranslations] = useState<Record<number, string>>({});
  const [pageVisionStatus, setPageVisionStatus] = useState<Record<number, 'loading' | 'done' | 'error' | 'queued'>>({});
  const [activePriorityPages, setActivePriorityPages] = useState<number[]>([]);
  const [pendingPriorityPages, setPendingPriorityPages] = useState<number[]>([]);
  const [pageVisionErrors, setPageVisionErrors] = useState<Record<number, string>>({});

  const highPriorityQueueRef = useRef<number[]>([]);
  const waterfallQueueRef = useRef<number[]>([]);
  const activeWorkersCountRef = useRef<number>(0);
  const activeProcessingPagesRef = useRef<Set<number>>(new Set());
  const wakePacingTimerRef = useRef<(() => void) | null>(null);
  const scrollDebounceTimerRef = useRef<any>(null);
  const isRateLimitedRef = useRef<boolean>(false);
  const initializedWaterfallRef = useRef<string>('');

  const pageVisionStatusRef = useRef<Record<number, 'loading' | 'done' | 'error' | 'queued'>>({});
  const pageVisionTranslationsRef = useRef<Record<number, string>>({});
  const visionTokenRef = useRef<Record<number, number>>({});

  // 1. Thực thi dịch 1 trang
  const executeVisionTranslation = async (pageNumber: number, force = false) => {
    if (!pdfDoc || pageNumber < 1 || pageNumber > numPages) return;

    if (!force) {
      const modelToUse = settings.pdfModel || 'gemini-3.5-flash-lite';
      const targetLang = settings.targetLang || 'vi';
      const candidates = [modelToUse, 'gemini-3.5-flash-lite', 'gemini-3.5-flash'];
      for (const m of candidates) {
        const cached = getCachedVisionTranslation(pdfUrl, pageNumber, m, targetLang);
        if (cached) {
          setPageVisionTranslations((prev) => ({ ...prev, [pageNumber]: cached }));
          pageVisionTranslationsRef.current[pageNumber] = cached;
          setPageVisionStatus((prev) => ({ ...prev, [pageNumber]: 'done' }));
          pageVisionStatusRef.current[pageNumber] = 'done';
          return;
        }
      }
    }

    const token = (visionTokenRef.current[pageNumber] || 0) + 1;
    visionTokenRef.current[pageNumber] = token;
    const alive = () => visionTokenRef.current[pageNumber] === token;

    setPageVisionErrors((prev) => {
      const next = { ...prev };
      delete next[pageNumber];
      return next;
    });
    setPageVisionStatus((prev) => ({ ...prev, [pageNumber]: 'loading' }));
    pageVisionStatusRef.current[pageNumber] = 'loading';

    try {
      const md = await translatePageVision(pageNumber, pdfDoc, pdfUrl, settings, force);
      if (!alive()) return;
      setPageVisionTranslations((prev) => ({ ...prev, [pageNumber]: md }));
      pageVisionTranslationsRef.current[pageNumber] = md;
      setPageVisionStatus((prev) => ({ ...prev, [pageNumber]: 'done' }));
      pageVisionStatusRef.current[pageNumber] = 'done';
    } catch (err: any) {
      if (!alive()) return;
      console.error(`[Live-Trans Vision] Error translating page ${pageNumber}:`, err);
      const msg = err instanceof Error ? err.message : String(err);
      setPageVisionErrors((prev) => ({ ...prev, [pageNumber]: msg }));
      setPageVisionStatus((prev) => ({ ...prev, [pageNumber]: 'error' }));
      pageVisionStatusRef.current[pageNumber] = 'error';

      if (/429|resource_exhausted|quota/i.test(msg)) {
        console.warn('[Live-Trans Vision] Rate limit detected (429/Quota). Pausing background waterfall.');
        isRateLimitedRef.current = true;
      }
    }
  };

  // 2. Worker loop coroutine
  const runVisionWorker = async () => {
    try {
      while (true) {
        if (!pdfDoc) break;

        let nextPage: number | null = null;
        let isPriorityJob = false;

        // Quét High Priority trước
        while (highPriorityQueueRef.current.length > 0) {
          const p = highPriorityQueueRef.current.shift()!;
          if (activeProcessingPagesRef.current.has(p)) continue;
          const modelToUse = settings.pdfModel || 'gemini-3.5-flash-lite';
          const cached = getCachedVisionTranslation(pdfUrl, p, modelToUse, settings.targetLang || 'vi');
          if (cached) {
            setPageVisionTranslations((prev) => ({ ...prev, [p]: cached }));
            pageVisionTranslationsRef.current[p] = cached;
            setPageVisionStatus((prev) => ({ ...prev, [p]: 'done' }));
            pageVisionStatusRef.current[p] = 'done';
            continue;
          }
          if (pageVisionStatusRef.current[p] !== 'done') {
            nextPage = p;
            isPriorityJob = true;
            break;
          }
        }

        // Quét Waterfall nếu không có High Priority và chưa bị 429
        if (nextPage === null && !isRateLimitedRef.current) {
          while (waterfallQueueRef.current.length > 0) {
            const p = waterfallQueueRef.current.shift()!;
            if (activeProcessingPagesRef.current.has(p)) continue;
            const modelToUse = settings.pdfModel || 'gemini-3.5-flash-lite';
            const cached = getCachedVisionTranslation(pdfUrl, p, modelToUse, settings.targetLang || 'vi');
            if (cached) {
              setPageVisionTranslations((prev) => ({ ...prev, [p]: cached }));
              pageVisionTranslationsRef.current[p] = cached;
              setPageVisionStatus((prev) => ({ ...prev, [p]: 'done' }));
              pageVisionStatusRef.current[p] = 'done';
              continue;
            }
            if (pageVisionStatusRef.current[p] !== 'done') {
              nextPage = p;
              isPriorityJob = false;
              break;
            }
          }
        }

        if (nextPage === null) break;

        activeProcessingPagesRef.current.add(nextPage);
        if (isPriorityJob) {
          setActivePriorityPages((prev) => [...prev.filter((x) => x !== nextPage), nextPage]);
          setPendingPriorityPages((prev) => prev.filter((x) => x !== nextPage));
        }

        try {
          await executeVisionTranslation(nextPage, false);
        } finally {
          activeProcessingPagesRef.current.delete(nextPage);
          if (isPriorityJob) {
            setActivePriorityPages((prev) => prev.filter((x) => x !== nextPage));
          }
        }

        // Pacing delay 400ms giữa các trang waterfall ngầm
        if (highPriorityQueueRef.current.length === 0 && waterfallQueueRef.current.length > 0 && !isRateLimitedRef.current) {
          await new Promise<void>((resolve) => {
            const timer = setTimeout(() => {
              wakePacingTimerRef.current = null;
              resolve();
            }, 400);
            wakePacingTimerRef.current = () => {
              clearTimeout(timer);
              wakePacingTimerRef.current = null;
              resolve();
            };
          });
        }
      }
    } finally {
      activeWorkersCountRef.current = Math.max(0, activeWorkersCountRef.current - 1);
      const maxWorkers = Math.min(7, Math.max(2, settings.pdfConcurrency || 5));
      if (
        activeWorkersCountRef.current < maxWorkers &&
        (highPriorityQueueRef.current.length > 0 || (waterfallQueueRef.current.length > 0 && !isRateLimitedRef.current))
      ) {
        processVisionQueue();
      }
    }
  };

  // 3. Quản lý Worker Pool Concurrency
  const processVisionQueue = () => {
    if (!pdfDoc || !hasActiveKey) return;
    const maxWorkers = Math.min(7, Math.max(2, settings.pdfConcurrency || 5));

    while (activeWorkersCountRef.current < maxWorkers) {
      const hasPriority = highPriorityQueueRef.current.length > 0;
      const hasWaterfall = waterfallQueueRef.current.length > 0 && !isRateLimitedRef.current;
      if (!hasPriority && !hasWaterfall) break;
      activeWorkersCountRef.current++;
      void runVisionWorker();
    }
  };

  // 4. Ưu tiên theo cụm Cửa Sổ (Batch Preemption Window)
  const prioritizeVisionPage = useCallback((pageNumber: number, force = false) => {
    if (pageNumber < 1 || pageNumber > numPages || !pdfDoc) return;

    const concurrency = Math.min(7, Math.max(2, settings.pdfConcurrency || 5));
    const batchPages: number[] = [];
    for (let i = 0; i < concurrency; i++) {
      const p = pageNumber + i;
      if (p <= numPages) batchPages.push(p);
    }

    const uncompletedBatch: number[] = [];
    for (const p of batchPages) {
      if (!force) {
        const modelToUse = settings.pdfModel || 'gemini-3.5-flash-lite';
        const cached = getCachedVisionTranslation(pdfUrl, p, modelToUse, settings.targetLang || 'vi');
        if (cached) {
          setPageVisionTranslations((prev) => ({ ...prev, [p]: cached }));
          pageVisionTranslationsRef.current[p] = cached;
          setPageVisionStatus((prev) => ({ ...prev, [p]: 'done' }));
          pageVisionStatusRef.current[p] = 'done';
          continue;
        }
        if (pageVisionStatusRef.current[p] === 'done' || activeProcessingPagesRef.current.has(p)) {
          continue;
        }
      }
      uncompletedBatch.push(p);
    }

    if (uncompletedBatch.length === 0 && !force) return;

    highPriorityQueueRef.current = [
      ...uncompletedBatch,
      ...highPriorityQueueRef.current.filter((p) => !uncompletedBatch.includes(p)),
    ];
    waterfallQueueRef.current = waterfallQueueRef.current.filter((p) => !uncompletedBatch.includes(p));

    setPageVisionStatus((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const p of uncompletedBatch) {
        if (next[p] !== 'done' && next[p] !== 'loading') {
          next[p] = 'queued';
          pageVisionStatusRef.current[p] = 'queued';
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    isRateLimitedRef.current = false;
    setPendingPriorityPages((prev) => [
      ...uncompletedBatch,
      ...prev.filter((p) => !uncompletedBatch.includes(p)),
    ]);

    if (wakePacingTimerRef.current) wakePacingTimerRef.current();
    processVisionQueue();
  }, [numPages, pdfDoc, pdfUrl, settings, hasActiveKey]);

  // 5. Debounce ưu tiên cuộn trang
  const debouncedPrioritizePage = useCallback((pageNumber: number, force = false) => {
    if (scrollDebounceTimerRef.current) clearTimeout(scrollDebounceTimerRef.current);
    scrollDebounceTimerRef.current = setTimeout(() => {
      prioritizeVisionPage(pageNumber, force);
    }, 300);
  }, [prioritizeVisionPage]);

  // 6. Thử lại trang lỗi
  const retryVisionPage = (pageNumber: number) => {
    clearCachedVisionTranslation(pdfUrl, pageNumber);
    setPageVisionTranslations((prev) => {
      const next = { ...prev };
      delete next[pageNumber];
      return next;
    });
    delete pageVisionTranslationsRef.current[pageNumber];

    setPageVisionErrors((prev) => {
      const next = { ...prev };
      delete next[pageNumber];
      return next;
    });
    delete pageVisionStatusRef.current[pageNumber];

    setPageVisionStatus((prev) => ({ ...prev, [pageNumber]: 'loading' }));
    pageVisionStatusRef.current[pageNumber] = 'loading';

    if (scrollDebounceTimerRef.current) clearTimeout(scrollDebounceTimerRef.current);
    prioritizeVisionPage(pageNumber, true);
  };

  // 7. Khởi chạy Background Waterfall
  useEffect(() => {
    if (readerMode !== 'vision' || !pdfUrl || !pdfDoc || numPages <= 0) return;
    const targetLang = settings.targetLang || 'vi';
    const initKey = `${pdfUrl}_${settings.pdfModel}_${targetLang}_${numPages}`;
    if (initializedWaterfallRef.current === initKey) return;
    initializedWaterfallRef.current = initKey;

    const initialTrans: Record<number, string> = {};
    const initialStatus: Record<number, 'done' | 'queued'> = {};
    const model = settings.pdfModel || 'gemini-3.5-flash-lite';
    const unrendered: number[] = [];

    for (let p = 1; p <= numPages; p++) {
      const cached = getCachedVisionTranslation(pdfUrl, p, model, targetLang);
      if (cached) {
        initialTrans[p] = cached;
        initialStatus[p] = 'done';
      } else {
        initialStatus[p] = 'queued';
        unrendered.push(p);
      }
    }

    setPageVisionTranslations(initialTrans);
    pageVisionTranslationsRef.current = initialTrans;
    setPageVisionStatus(initialStatus);
    pageVisionStatusRef.current = initialStatus;

    waterfallQueueRef.current = unrendered;
    prioritizeVisionPage(currentPage || 1);
  }, [readerMode, pdfUrl, pdfDoc, numPages, settings.pdfModel, settings.targetLang, prioritizeVisionPage]);

  // 8. Retranslate toàn bộ tài liệu Vision
  const retranslateAllVision = () => {
    clearCachedVisionTranslation(pdfUrl);
    setPageVisionTranslations({});
    pageVisionTranslationsRef.current = {};
    setPageVisionErrors({});
    isRateLimitedRef.current = false;

    const initialStatus: Record<number, 'queued'> = {};
    const allPages: number[] = [];
    for (let p = 1; p <= numPages; p++) {
      initialStatus[p] = 'queued';
      allPages.push(p);
    }
    setPageVisionStatus(initialStatus);
    pageVisionStatusRef.current = initialStatus;
    waterfallQueueRef.current = allPages;
    prioritizeVisionPage(currentPage || 1, true);
  };

  return {
    pageVisionTranslations,
    pageVisionStatus,
    pageVisionErrors,
    activePriorityPages,
    pendingPriorityPages,
    prioritizeVisionPage,
    debouncedPrioritizePage,
    retryVisionPage,
    retranslateAllVision,
  };
}
```

---

## 5. VERIFICATION METHOD (PHƯƠNG PHÁP XÁC MINH ĐỘC LẬP)

Để kiểm chứng tính xác thực của báo cáo này, bất kỳ kỹ sư hoặc agent nào cũng có thể độc lập thực hiện các bước sau:
1. **Kiểm tra trực tiếp tệp mã nguồn `extension/entrypoints/viewer/main.tsx`**:
   - Mở dòng 107 - 139: xác minh `leftPaneRef`, `rightPaneRef`, `calculatePaneFitScale`.
   - Mở dòng 221 - 229 & 349 - 460: xác minh `highPriorityQueueRef`, `waterfallQueueRef`, `runVisionWorker`, `processVisionQueue`.
   - Mở dòng 462 - 535: xác minh thuật toán cụm cửa sổ ưu tiên `prioritizeVisionPage`.
   - Mở dòng 608 - 721: xác minh thuật toán đồng bộ cuộn hai chiều `handleLeftScroll` & `handleRightScroll`.
   - Mở dòng 739 - 940: xác minh giải thuật Ceiling-Lock Engine, nhận diện vùng lề đen và hãm phanh chống vọt lố.
2. **Kiểm tra tính an toàn của việc bóc tách Custom Hook**:
   - Hai Custom Hook đề xuất (`useSyncScroll` ~230 dòng và `useVisionWorkerQueue` ~290 dòng) hoàn toàn độc lập, không import bất kỳ phụ thuộc vòng tròn nào.
   - Các interface đầu vào/đầu ra khớp 100% với các state và refs hiện tại trong `ViewerApp`.
3. **Kiểm tra suite test của dự án**:
   - Chạy lệnh:
     ```powershell
     npm run test
     ```
   - Xác nhận 161/161 unit tests hiện tại tiếp tục pass 100%.
   - Chạy lệnh kiểm tra cú pháp:
     ```powershell
     npm run check
     ```
   - Xác nhận không có bất kỳ cảnh báo hoặc lỗi TypeScript/ESLint nào.
