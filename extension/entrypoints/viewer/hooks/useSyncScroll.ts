import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { UseSyncScrollOptions, UseSyncScrollReturn } from './types';

function applyZoomStep(currentFactor: number, deltaY: number): number {
  if (Math.abs(deltaY) < 1) return currentFactor;
  const step = deltaY < 0 ? 0.08 : -0.08;
  return Math.max(0.5, Math.min(3.0, Math.round((currentFactor + step) * 100) / 100));
}

function findVisiblePage(
  container: HTMLElement,
  selector: string,
  currentPno: number,
): { bestPno: number; pageOffsetRatio: number } {
  const pages = container.querySelectorAll<HTMLElement>(selector);
  let bestPno = currentPno;
  let pageOffsetRatio = 0;
  let minDistance = Infinity;

  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    if (!p) continue;
    const top = p.offsetTop;
    const height = p.offsetHeight;
    const pno = Number(p.dataset.pageNumber || i + 1);

    if (container.scrollTop >= top - 24 && container.scrollTop < top + height) {
      return {
        bestPno: pno,
        pageOffsetRatio: Math.max(0, Math.min(1, (container.scrollTop - top) / height)),
      };
    }

    const dist = Math.abs(container.scrollTop - top);
    if (dist < minDistance) {
      minDistance = dist;
      bestPno = pno;
      pageOffsetRatio = container.scrollTop >= top + height ? 1 : 0;
    }
  }
  return { bestPno, pageOffsetRatio };
}

export function useSyncScroll({
  viewMode,
  readerMode,
  numPages,
  leftFitScale = 1.0,
  rightFitScale = 1.0,
  onPageChange,
  onPrioritizePage,
}: UseSyncScrollOptions): UseSyncScrollReturn {
  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);
  const isSyncingScroll = useRef<boolean>(false);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [leftZoomFactor, setLeftZoomFactor] = useState<number>(1.0);
  const [rightZoomFactor, setRightZoomFactor] = useState<number>(1.0);

  const effectiveLeftScale = leftFitScale * leftZoomFactor;
  const effectiveRightScale = rightFitScale * rightZoomFactor;

  const resetZoom = useCallback(() => {
    setLeftZoomFactor(1.0);
    setRightZoomFactor(1.0);
  }, []);

  // Cuộn đồng bộ từ Pane trái (Bản gốc) sang Pane phải (Bản dịch)
  const handleLeftScroll = useCallback(() => {
    if (isSyncingScroll.current || viewMode !== 'bilingual') return;
    const left = leftPaneRef.current;
    const right = rightPaneRef.current;
    if (!left || !right) return;

    isSyncingScroll.current = true;
    const { bestPno, pageOffsetRatio } = findVisiblePage(left, '.lt-page-wrap', currentPage);

    const rightPage = right.querySelector<HTMLElement>(
      `.lt-whiteboard-page[data-page-number="${bestPno}"], .lt-page-wrap[data-page-number="${bestPno}"], .lt-markdown-page[data-page-number="${bestPno}"], .lt-vision-page[data-page-number="${bestPno}"]`,
    );
    if (rightPage) {
      right.scrollTop = rightPage.offsetTop + rightPage.offsetHeight * pageOffsetRatio;
    } else {
      const scrollMax = left.scrollHeight - left.clientHeight;
      const ratio = scrollMax > 0 ? left.scrollTop / scrollMax : 0;
      right.scrollTop = ratio * (right.scrollHeight - right.clientHeight);
    }

    setCurrentPage(bestPno);
    if (onPageChange) onPageChange(bestPno);
    if (readerMode === 'vision' && onPrioritizePage) onPrioritizePage(bestPno);
    requestAnimationFrame(() => {
      isSyncingScroll.current = false;
    });
  }, [currentPage, onPageChange, onPrioritizePage, readerMode, viewMode]);

  // Cuộn đồng bộ từ Pane phải (Bản dịch) sang Pane trái (Bản gốc)
  const handleRightScroll = useCallback(() => {
    if (isSyncingScroll.current || viewMode !== 'bilingual') return;
    const left = leftPaneRef.current;
    const right = rightPaneRef.current;
    if (!left || !right) return;

    isSyncingScroll.current = true;
    const { bestPno, pageOffsetRatio } = findVisiblePage(
      right,
      '.lt-whiteboard-page, .lt-page-wrap, .lt-markdown-page, .lt-vision-page',
      currentPage,
    );

    const leftPage = left.querySelector<HTMLElement>(
      `.lt-page-wrap[data-page-number="${bestPno}"]`,
    );
    if (leftPage) {
      left.scrollTop = leftPage.offsetTop + leftPage.offsetHeight * pageOffsetRatio;
    } else {
      const scrollMax = right.scrollHeight - right.clientHeight;
      const ratio = scrollMax > 0 ? right.scrollTop / scrollMax : 0;
      left.scrollTop = ratio * (left.scrollHeight - left.clientHeight);
    }

    setCurrentPage(bestPno);
    if (onPageChange) onPageChange(bestPno);
    if (readerMode === 'vision' && onPrioritizePage) onPrioritizePage(bestPno);
    requestAnimationFrame(() => {
      isSyncingScroll.current = false;
    });
  }, [currentPage, onPageChange, onPrioritizePage, readerMode, viewMode]);

  // Nhảy tới trang chỉ định
  const scrollToPage = useCallback(
    (pageNumber: number) => {
      setCurrentPage(pageNumber);
      if (onPageChange) onPageChange(pageNumber);
      if (readerMode === 'vision' && onPrioritizePage) onPrioritizePage(pageNumber);
      const target = leftPaneRef.current?.querySelector(`[data-page-number="${pageNumber}"]`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [onPageChange, onPrioritizePage, readerMode],
  );

  // Zoom tạm thời độc lập cho khung bản gốc (trái): Ctrl + Wheel
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

  // Intelligent Reading Column Coordinator & Ceiling-Lock
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

      const pages = Array.from(
        right.querySelectorAll<HTMLElement>('.lt-vision-page, .lt-whiteboard-page'),
      );
      if (pages.length === 0) return;

      const firstPage = pages[0];
      if (!firstPage) return;

      // Side-Margin Bypass: Bỏ qua vùng lề đen 2 bên
      const firstPageRect = firstPage.getBoundingClientRect();
      const isInSideMargin = e.clientX < firstPageRect.left || e.clientX > firstPageRect.right;
      if (isInSideMargin) return;

      // Tìm trang đang ở vị trí trần hoặc hiển thị tại đỉnh khung
      let currIdx = 0;
      for (let i = 0; i < pages.length; i++) {
        const p = pages[i];
        if (!p) continue;
        if (right.scrollTop >= p.offsetTop - 26) {
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
        // === CUỘN XUỐNG ===
        if (right.scrollTop < targetCeiling - 2) {
          const dist = targetCeiling - right.scrollTop;
          if (e.deltaY <= dist) {
            right.scrollTop += e.deltaY;
          } else {
            right.scrollTop = targetCeiling;
            if (bodyCurr) bodyCurr.scrollTop += e.deltaY - dist;
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
                if (nextBody) nextBody.scrollTop += e.deltaY - distToNext;
              }
              e.preventDefault();
              return;
            }
          }
        }
      } else if (e.deltaY < 0) {
        // === CUỘN LÊN ===
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

  return {
    leftPaneRef,
    rightPaneRef,
    currentPage,
    setCurrentPage,
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
