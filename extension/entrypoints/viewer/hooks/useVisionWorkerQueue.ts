import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import {
  translatePageVision,
  getCachedVisionTranslation,
  clearCachedVisionTranslation,
  pruneVisionCacheRegistry,
} from '@/lib/pdf/vision-translate';
import type { Settings } from '@/lib/settings';
import type { UseVisionWorkerQueueOptions, UseVisionWorkerQueueReturn } from './types';

const getMaxWorkers = (s: Settings): number =>
  Math.min(7, Math.max(2, (s as any).viewerWorkerConcurrency || s.pdfConcurrency || 5));

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
  const [pageVisionStatus, setPageVisionStatus] = useState<
    Record<number, 'loading' | 'done' | 'error' | 'queued'>
  >({});
  const [pageVisionErrors, setPageVisionErrors] = useState<Record<number, string>>({});
  const [activePriorityPages, setActivePriorityPages] = useState<number[]>([]);
  const [pendingPriorityPages, setPendingPriorityPages] = useState<number[]>([]);

  // Dual-Priority Queues & Worker Pool State Refs (chống Stale Closure trong coroutines)
  const highPriorityQueueRef = useRef<number[]>([]);
  const waterfallQueueRef = useRef<number[]>([]);
  const activeWorkersCountRef = useRef<number>(0);
  const activeProcessingPagesRef = useRef<Set<number>>(new Set());
  const wakePacingTimerRef = useRef<(() => void) | null>(null);
  const scrollDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRateLimitedRef = useRef<boolean>(false);
  const initializedWaterfallRef = useRef<string>('');

  const pageVisionStatusRef = useRef<Record<number, 'loading' | 'done' | 'error' | 'queued'>>({});
  const pageVisionTranslationsRef = useRef<Record<number, string>>({});
  const visionTokenRef = useRef<Record<number, number>>({});

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const pdfDocRef = useRef(pdfDoc);
  pdfDocRef.current = pdfDoc;
  const pdfUrlRef = useRef(pdfUrl);
  pdfUrlRef.current = pdfUrl;
  const numPagesRef = useRef(numPages);
  numPagesRef.current = numPages;
  const hasActiveKeyRef = useRef(hasActiveKey);
  hasActiveKeyRef.current = hasActiveKey;

  const executeVisionTranslation = async (pageNumber: number, force = false) => {
    const doc = pdfDocRef.current;
    const url = pdfUrlRef.current;
    const s = settingsRef.current;
    const totalPages = numPagesRef.current;
    if (!doc || pageNumber < 1 || pageNumber > totalPages) return;

    // 1. Kiểm tra cache trước — nạp tức thì trong 0ms nếu đã có
    if (!force) {
      const model = s.pdfModel || 'gemini-3.5-flash-lite';
      const targetLang = s.targetLang || 'vi';
      for (const m of [model, 'gemini-3.5-flash-lite', 'gemini-3.5-flash']) {
        const cached = getCachedVisionTranslation(url, pageNumber, m, targetLang);
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
      const md = await translatePageVision(pageNumber, doc, url, s, force);
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

  const popNextEligible = (queue: number[]): number | null => {
    const s = settingsRef.current;
    const url = pdfUrlRef.current;
    const model = s.pdfModel || 'gemini-3.5-flash-lite';
    const lang = s.targetLang || 'vi';

    while (queue.length > 0) {
      const p = queue.shift()!;
      if (activeProcessingPagesRef.current.has(p)) continue;
      const cached = getCachedVisionTranslation(url, p, model, lang);
      if (cached) {
        setPageVisionTranslations((prev) => ({ ...prev, [p]: cached }));
        pageVisionTranslationsRef.current[p] = cached;
        setPageVisionStatus((prev) => ({ ...prev, [p]: 'done' }));
        pageVisionStatusRef.current[p] = 'done';
        continue;
      }
      if (pageVisionStatusRef.current[p] !== 'done') return p;
    }
    return null;
  };

  const runVisionWorker = async () => {
    try {
      while (true) {
        if (!pdfDocRef.current) break;

        let nextPage: number | null = popNextEligible(highPriorityQueueRef.current);
        let isPriorityJob = nextPage !== null;

        if (nextPage === null && !isRateLimitedRef.current) {
          nextPage = popNextEligible(waterfallQueueRef.current);
          isPriorityJob = false;
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

        // Pacing delay 400ms giữa các trang thác nước nền (đánh thức tức thì khi có ưu tiên)
        if (
          highPriorityQueueRef.current.length === 0 &&
          waterfallQueueRef.current.length > 0 &&
          !isRateLimitedRef.current
        ) {
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
      const maxWorkers = getMaxWorkers(settingsRef.current);
      if (
        activeWorkersCountRef.current < maxWorkers &&
        (highPriorityQueueRef.current.length > 0 ||
          (waterfallQueueRef.current.length > 0 && !isRateLimitedRef.current))
      ) {
        processVisionQueue();
      }
    }
  };

  const processVisionQueue = useCallback(() => {
    if (!pdfDocRef.current || !hasActiveKeyRef.current) return;
    const maxWorkers = getMaxWorkers(settingsRef.current);
    while (activeWorkersCountRef.current < maxWorkers) {
      const hasPriority = highPriorityQueueRef.current.length > 0;
      const hasWaterfall = waterfallQueueRef.current.length > 0 && !isRateLimitedRef.current;
      if (!hasPriority && !hasWaterfall) break;
      activeWorkersCountRef.current++;
      void runVisionWorker();
    }
  }, []);

  const prioritizeVisionPage = useCallback(
    (pageNumber: number, force = false) => {
      const doc = pdfDocRef.current;
      const url = pdfUrlRef.current;
      const s = settingsRef.current;
      const totalPages = numPagesRef.current;
      if (pageNumber < 1 || pageNumber > totalPages || !doc) return;

      const concurrency = getMaxWorkers(s);
      const batchPages: number[] = [];
      for (let i = 0; i < concurrency; i++) {
        const p = pageNumber + i;
        if (p <= totalPages) batchPages.push(p);
      }

      const uncompletedBatch: number[] = [];
      for (const p of batchPages) {
        if (!force) {
          const modelToUse = s.pdfModel || 'gemini-3.5-flash-lite';
          const cached = getCachedVisionTranslation(url, p, modelToUse, s.targetLang || 'vi');
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
      waterfallQueueRef.current = waterfallQueueRef.current.filter(
        (p) => !uncompletedBatch.includes(p),
      );

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
    },
    [processVisionQueue],
  );

  const debouncedPrioritizePage = useCallback(
    (pageNumber: number, force = false) => {
      if (scrollDebounceTimerRef.current) clearTimeout(scrollDebounceTimerRef.current);
      scrollDebounceTimerRef.current = setTimeout(() => {
        prioritizeVisionPage(pageNumber, force);
      }, 300);
    },
    [prioritizeVisionPage],
  );

  const retryVisionPage = useCallback(
    (pageNumber: number) => {
      clearCachedVisionTranslation(pdfUrlRef.current, pageNumber);
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
    },
    [prioritizeVisionPage],
  );

  const retranslateAllVision = useCallback(() => {
    const url = pdfUrlRef.current;
    const totalPages = numPagesRef.current;

    clearCachedVisionTranslation(url);
    setPageVisionTranslations({});
    pageVisionTranslationsRef.current = {};
    setPageVisionErrors({});
    isRateLimitedRef.current = false;

    const initialStatus: Record<number, 'queued'> = {};
    const allPages: number[] = [];
    for (let p = 1; p <= totalPages; p++) {
      initialStatus[p] = 'queued';
      allPages.push(p);
    }
    setPageVisionStatus(initialStatus);
    pageVisionStatusRef.current = initialStatus;
    waterfallQueueRef.current = allPages;
    prioritizeVisionPage(currentPage || 1, true);
  }, [currentPage, prioritizeVisionPage]);

  // Preload cached translations & Khởi chạy Background Waterfall khi nạp tài liệu
  useEffect(() => {
    if (readerMode !== 'vision' || !pdfUrl || !pdfDoc || numPages <= 0) return;
    const targetLang = settings.targetLang || 'vi';
    const initKey = `${pdfUrl}_${settings.pdfModel}_${targetLang}_${numPages}`;
    if (initializedWaterfallRef.current === initKey) return;
    initializedWaterfallRef.current = initKey;

    try {
      pruneVisionCacheRegistry();
    } catch {}

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
  }, [readerMode, pdfUrl, pdfDoc, numPages, settings.pdfModel, settings.targetLang, currentPage, prioritizeVisionPage]);

  useEffect(() => {
    return () => {
      if (scrollDebounceTimerRef.current) clearTimeout(scrollDebounceTimerRef.current);
      if (wakePacingTimerRef.current) wakePacingTimerRef.current();
    };
  }, []);

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
    processVisionQueue,
  };
}
