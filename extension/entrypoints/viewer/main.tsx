import { render } from 'preact';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { extractTextBlocks } from '@/lib/pdf/blocks';
import { translatePageBlocks } from '@/lib/pdf/translate';
import { WhiteboardPageRenderer } from './WhiteboardPageRenderer';
import { VisionPageRenderer } from './VisionPageRenderer';
import { translatePageVision, getCachedVisionTranslation, clearCachedVisionTranslation, pruneVisionCacheRegistry } from '@/lib/pdf/vision-translate';
import type { TextBlock, TranslatedBlock, ViewMode } from '@/lib/pdf/types';
import {
  loadSettings,
  saveSettings,
  DEFAULT_SETTINGS,
  DEFAULT_PDF_MODEL,
  PDF_GEMINI_MODELS,
  PDF_ZEN_MODELS,
  type Settings,
  type PdfProvider,
  type ApiKeyItem,
  getProviderKeys,
  maskApiKey,
} from '@/lib/settings';
import 'katex/dist/katex.min.css';
import { CustomSelect } from './CustomSelect';

// Configure PDF.js worker from extension bundle
pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.mjs');

export function ViewerApp() {
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [docTitle, setDocTitle] = useState<string>('Tài liệu PDF');
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [zoomMode, setZoomMode] = useState<'fit' | 'custom'>('fit');
  const [leftFitScale, setLeftFitScale] = useState<number>(1.0);
  const [rightFitScale, setRightFitScale] = useState<number>(1.0);
  const [viewMode, setViewMode] = useState<ViewMode>('bilingual');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [isSidebarPinned, setIsSidebarPinned] = useState<boolean>(false);
  const [hoveredSentenceId, setHoveredSentenceId] = useState<string | null>(null);
  // Vision AI (LaTeX) là mode đọc mặc định
  const [readerMode, setReaderMode] = useState<'whiteboard' | 'vision' | 'markdown' | 'overlay'>('vision');
  const [isModeMenuOpen, setIsModeMenuOpen] = useState<boolean>(false);
  const [isZoomMenuOpen, setIsZoomMenuOpen] = useState<boolean>(false);
  const [pageVisionTranslations, setPageVisionTranslations] = useState<Record<number, string>>({});
  const [pageVisionStatus, setPageVisionStatus] = useState<Record<number, 'loading' | 'done' | 'error' | 'queued'>>({});
  const [activePriorityPages, setActivePriorityPages] = useState<number[]>([]);
  const [pendingPriorityPages, setPendingPriorityPages] = useState<number[]>([]);
  const [pageVisionErrors, setPageVisionErrors] = useState<Record<number, string>>({});
  const [splitRatio, setSplitRatio] = useState<number>(0.45);
  const isDraggingSplitter = useRef<boolean>(false);

  const [pageBlocks, setPageBlocks] = useState<Record<number, TextBlock[]>>({});
  const [pageTranslations, setPageTranslations] = useState<Record<number, TranslatedBlock[]>>({});
  const [pageStatus, setPageStatus] = useState<Record<number, 'loading' | 'done' | 'error'>>({});
  // P2: số câu giữ nguyên văn (UTB) mỗi trang — hiện badge thay vì giấu im lặng.
  const [pageUntranslated, setPageUntranslated] = useState<Record<number, number>>({});

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [errorMsg, setErrorMsg] = useState<string>('');
  // Select provider/model là PENDING — chỉ có hiệu lực khi bấm Áp dụng.
  // Trang chưa dịch dùng model mới, trang đã dịch giữ nguyên.
  const [pendingProvider, setPendingProvider] = useState<PdfProvider>(DEFAULT_SETTINGS.pdfProvider);
  const [pendingModel, setPendingModel] = useState<string>(DEFAULT_SETTINGS.pdfModel);
  const [pendingConcurrency, setPendingConcurrency] = useState<number>(DEFAULT_SETTINGS.pdfConcurrency);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [keyItems, setKeyItems] = useState<ApiKeyItem[]>([]);
  const [newKeyProvider, setNewKeyProvider] = useState<PdfProvider>('gemini');
  const [newKeyText, setNewKeyText] = useState<string>('');
  const [isPostSavePromptOpen, setIsPostSavePromptOpen] = useState<boolean>(false);

  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);
  const isSyncingScroll = useRef<boolean>(false);

  // Tự động tính toán tỷ lệ zoom Fit màn hình riêng biệt cho từng khung xem
  const calculatePaneFitScale = useCallback((pane: HTMLElement | null) => {
    if (!pane) return 1.0;
    const availableWidth = pane.clientWidth - 32;
    if (availableWidth <= 100) return 1.0;
    const baseWidth = 612; // Khổ ngang PDF chuẩn
    const computed = Math.round((availableWidth / baseWidth) * 100) / 100;
    return Math.max(0.35, Math.min(3.0, computed));
  }, []);

  // Hook theo dõi resize cửa sổ, kéo splitter, đóng/mở sidebar để auto-fit scale độc lập 2 bên
  useEffect(() => {
    if (zoomMode !== 'fit') return;
    const handleResize = () => {
      const ls = calculatePaneFitScale(leftPaneRef.current);
      const rs = calculatePaneFitScale(rightPaneRef.current);
      setLeftFitScale(ls);
      setRightFitScale(rs);
    };

    handleResize();
    const t = setTimeout(handleResize, 120);

    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', handleResize);
    };
  }, [zoomMode, calculatePaneFitScale, splitRatio, sidebarOpen, isSidebarPinned, viewMode, pdfDoc]);

  const effectiveLeftScale = zoomMode === 'fit' ? leftFitScale : scale;
  const effectiveRightScale = zoomMode === 'fit' ? rightFitScale : scale;

  // 1. Initialize settings & load PDF document
  useEffect(() => {
    void (async () => {
      const s = await loadSettings();
      // Chuẩn hoá model theo provider (settings cũ có thể lưu model lạ).
      const validModels =
        s.pdfProvider === 'zen' ? PDF_ZEN_MODELS : PDF_GEMINI_MODELS;
      if (!(validModels as readonly string[]).includes(s.pdfModel)) {
        s.pdfModel = DEFAULT_PDF_MODEL[s.pdfProvider];
      }
      setSettings(s);
      setPendingProvider(s.pdfProvider);
      setPendingModel(s.pdfModel);
      setPendingConcurrency(s.pdfConcurrency || 5);
      setKeyItems(s.apiKeys || []);
      setNewKeyProvider(s.pdfProvider);

      const params = new URLSearchParams(window.location.search);
      const url = params.get('url');
      if (!url) {
        setErrorMsg('Không tìm thấy tham số URL của tài liệu PDF (?url=...).');
        return;
      }
      setPdfUrl(url);

      const filename = url.split('/').pop()?.split('#')[0]?.split('?')[0] || 'Paper';
      setDocTitle(decodeURIComponent(filename));

      try {
        const loadingTask = pdfjsLib.getDocument({
          url,
        });
        const doc = await loadingTask.promise;
        setPdfDoc(doc);
        setNumPages(doc.numPages);

        // Try getting paper title from metadata
        const meta = await doc.getMetadata().catch(() => null);
        const title = (meta?.info as Record<string, any>)?.Title;
        if (title && typeof title === 'string' && title.trim().length > 3) {
          setDocTitle(title.trim());
        }
      } catch (err: any) {
        console.error('[Live-Trans PDF] Failed to load document:', err);
        setErrorMsg(`Không thể tải file PDF: ${err.message || String(err)}`);
      }
    })();
  }, []);

  useEffect(() => {
    (window as any).__setSplitRatio = (r: number) => setSplitRatio(r);
    try {
      pruneVisionCacheRegistry();
    } catch {}

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest('.lt-dropdown-container')) {
        setIsModeMenuOpen(false);
        setIsZoomMenuOpen(false);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // =========================================================================
  // DUAL-PRIORITY QUEUE ENGINE CHO VISION AI (WATERFALL + INTERACTIVE PREEMPTION)
  // 1. highPriorityQueueRef: Chứa các trang người dùng chủ động nhìn/yêu cầu (0ms delay)
  // 2. waterfallQueueRef: Chứa các trang chưa dịch theo thứ tự tuần tự 1 -> numPages
  // 3. Pacing: Nghỉ 800ms giữa các trang background để bảo vệ Quota 15 RPM (an toàn tuyệt đối cho 1 API key)
  // 4. Preemption: Ngay khi user dừng tại trang >= 300ms, trang đó lập tức chen ngang lên đầu
  // =========================================================================
  // =========================================================================
  // MULTI-WORKER DUAL-PRIORITY QUEUE ENGINE CHO VISION AI (WATERFALL + BATCH PREEMPTION)
  // 1. highPriorityQueueRef: Chứa các trang ưu tiên (chen ngang theo cụm window)
  // 2. waterfallQueueRef: Chứa các trang chưa dịch theo thứ tự tuần tự 1 -> numPages
  // 3. activeProcessingPagesRef: Set các trang đang được xử lý bởi các workers (tránh chạy trùng)
  // 4. activeWorkersCountRef: Đếm số worker đang chạy song song (tối đa settings.pdfConcurrency, mặc định 5)
  // 5. Preemption: Khi user dừng xem trang K, ưu tiên cả cụm [K, ..., K + Concurrency - 1]
  // =========================================================================
  const highPriorityQueueRef = useRef<number[]>([]);
  const waterfallQueueRef = useRef<number[]>([]);
  const activeWorkersCountRef = useRef<number>(0);
  const activeProcessingPagesRef = useRef<Set<number>>(new Set());
  const wakePacingTimerRef = useRef<(() => void) | null>(null);
  const scrollDebounceTimerRef = useRef<any>(null);
  const isRateLimitedRef = useRef<boolean>(false);
  const initializedWaterfallRef = useRef<string>('');

  const activeProviderKeys = useMemo(() => {
    return getProviderKeys(settings, settings.pdfProvider);
  }, [settings]);

  const hasActiveKey = activeProviderKeys.length > 0;

  const modalProviderKeys = useMemo(() => {
    return keyItems.filter((k) => k.provider === pendingProvider);
  }, [keyItems, pendingProvider]);

  const handleAddKey = () => {
    const trimmed = newKeyText.trim();
    if (!trimmed) return;
    if (keyItems.some((k) => k.key === trimmed)) {
      alert('API Key này đã tồn tại trong danh sách!');
      return;
    }
    const newItem: ApiKeyItem = {
      id: `${newKeyProvider}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      provider: newKeyProvider,
      key: trimmed,
      createdAt: Date.now(),
    };
    setKeyItems((prev) => [...prev, newItem]);
    setNewKeyText('');
  };

  const handleRemoveKey = (id: string) => {
    setKeyItems((prev) => prev.filter((k) => k.id !== id));
  };

  // Giữ ref đồng bộ state để tránh stale closure trong vòng lặp queue
  const pageVisionStatusRef = useRef<Record<number, 'loading' | 'done' | 'error' | 'queued'>>({});
  const pageVisionTranslationsRef = useRef<Record<number, string>>({});
  const visionTokenRef = useRef<Record<number, number>>({});

  const executeVisionTranslation = async (pageNumber: number, force = false) => {
    if (!pdfDoc || pageNumber < 1 || pageNumber > numPages) return;

    // 1. Kiểm tra cache trước — nạp tức thì trong 0ms nếu đã có
    if (!force) {
      const modelToUse = settings.pdfModel || 'gemini-3.5-flash-lite';
      const candidates = [
        modelToUse,
        'gemini-3.5-flash-lite',
        'gemini-3.5-flash',
      ];
      for (const m of candidates) {
        const cached = getCachedVisionTranslation(pdfUrl, pageNumber, m);
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

      // Nếu gặp lỗi giới hạn tần suất 429 / Quota, tạm dừng thác nước ngầm để tránh bão lỗi
      if (/429|resource_exhausted|quota/i.test(msg)) {
        console.warn('[Live-Trans Vision] Rate limit detected (429/Quota). Pausing background waterfall.');
        isRateLimitedRef.current = true;
      }
    }
  };

  const runVisionWorker = async () => {
    try {
      while (true) {
        if (!pdfDoc) break;

        let nextPage: number | null = null;
        let isPriorityJob = false;

        // 1. Quét hàng đợi High Priority trước
        while (highPriorityQueueRef.current.length > 0) {
          const p = highPriorityQueueRef.current.shift()!;
          if (activeProcessingPagesRef.current.has(p)) continue;
          const modelToUse = settings.pdfModel || 'gemini-3.5-flash-lite';
          const cached = getCachedVisionTranslation(pdfUrl, p, modelToUse);
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

        // 2. Nếu không có việc ưu tiên, kiểm tra hàng đợi Waterfall ngầm (nếu chưa bị 429)
        if (nextPage === null && !isRateLimitedRef.current) {
          while (waterfallQueueRef.current.length > 0) {
            const p = waterfallQueueRef.current.shift()!;
            if (activeProcessingPagesRef.current.has(p)) continue;
            const modelToUse = settings.pdfModel || 'gemini-3.5-flash-lite';
            const cached = getCachedVisionTranslation(pdfUrl, p, modelToUse);
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

        // Không còn trang nào cần dịch trong lượt này
        if (nextPage === null) {
          break;
        }

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

  const processVisionQueue = () => {
    if (!pdfDoc) return;
    if (!hasActiveKey) return;
    const maxWorkers = Math.min(7, Math.max(2, settings.pdfConcurrency || 5));

    while (activeWorkersCountRef.current < maxWorkers) {
      const hasPriority = highPriorityQueueRef.current.length > 0;
      const hasWaterfall = waterfallQueueRef.current.length > 0 && !isRateLimitedRef.current;
      if (!hasPriority && !hasWaterfall) {
        break;
      }
      activeWorkersCountRef.current++;
      void runVisionWorker();
    }
  };

  const prioritizeVisionPage = useCallback((pageNumber: number, force = false) => {
    if (pageNumber < 1 || pageNumber > numPages) return;
    if (!pdfDoc) return;

    const concurrency = Math.min(7, Math.max(2, settings.pdfConcurrency || 5));
    // Tạo cụm cửa sổ concurrency trang liên tiếp bắt đầu từ pageNumber
    const batchPages: number[] = [];
    for (let i = 0; i < concurrency; i++) {
      const p = pageNumber + i;
      if (p <= numPages) {
        batchPages.push(p);
      }
    }

    const uncompletedBatch: number[] = [];
    for (const p of batchPages) {
      if (!force) {
        const modelToUse = settings.pdfModel || 'gemini-3.5-flash-lite';
        const cached = getCachedVisionTranslation(pdfUrl, p, modelToUse);
        if (cached) {
          setPageVisionTranslations((prev) => ({ ...prev, [p]: cached }));
          pageVisionTranslationsRef.current[p] = cached;
          setPageVisionStatus((prev) => ({ ...prev, [p]: 'done' }));
          pageVisionStatusRef.current[p] = 'done';
          continue;
        }
        if (pageVisionStatusRef.current[p] === 'done') {
          continue;
        }
        if (activeProcessingPagesRef.current.has(p)) {
          continue;
        }
      }
      uncompletedBatch.push(p);
    }

    if (uncompletedBatch.length === 0 && !force) return;

    // Đưa cả cụm uncompletedBatch lên đỉnh hàng đợi ưu tiên (deduplicate)
    highPriorityQueueRef.current = [
      ...uncompletedBatch,
      ...highPriorityQueueRef.current.filter((p) => !uncompletedBatch.includes(p)),
    ];
    // Loại khỏi waterfall để không dịch trùng
    waterfallQueueRef.current = waterfallQueueRef.current.filter((p) => !uncompletedBatch.includes(p));

    // Cập nhật trạng thái chờ/ưu tiên trên UI
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

    // Mở lại cờ rate limit nếu user chủ động bấm/xem trang
    isRateLimitedRef.current = false;
    setPendingPriorityPages((prev) => [
      ...uncompletedBatch,
      ...prev.filter((p) => !uncompletedBatch.includes(p)),
    ]);

    // Đánh thức worker ngay lập tức nếu đang ngủ trong nhịp pacing delay
    if (wakePacingTimerRef.current) {
      wakePacingTimerRef.current();
    }

    processVisionQueue();
  }, [numPages, pdfDoc, pdfUrl, settings]);

  const debouncedPrioritizePage = useCallback((pageNumber: number, force = false) => {
    if (scrollDebounceTimerRef.current) {
      clearTimeout(scrollDebounceTimerRef.current);
    }
    scrollDebounceTimerRef.current = setTimeout(() => {
      prioritizeVisionPage(pageNumber, force);
    }, 300);
  }, [prioritizeVisionPage]);

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

    if (scrollDebounceTimerRef.current) {
      clearTimeout(scrollDebounceTimerRef.current);
    }
    prioritizeVisionPage(pageNumber, true);
  };

  // Preload cached vision translations & Khởi chạy Background Waterfall khi nạp tài liệu
  useEffect(() => {
    if (readerMode !== 'vision' || !pdfUrl || !pdfDoc || numPages <= 0) return;
    const initKey = `${pdfUrl}_${settings.pdfModel}_${numPages}`;
    if (initializedWaterfallRef.current === initKey) return;
    initializedWaterfallRef.current = initKey;

    const initialTrans: Record<number, string> = {};
    const initialStatus: Record<number, 'done' | 'queued'> = {};
    const model = settings.pdfModel || 'gemini-3.5-flash-lite';
    const unrendered: number[] = [];

      for (let p = 1; p <= numPages; p++) {
        const cached = getCachedVisionTranslation(pdfUrl, p, model);
        if (cached) {
          initialTrans[p] = cached;
          initialStatus[p] = 'done';
        } else {
          initialStatus[p] = 'queued';
          unrendered.push(p);
        }
      }

      setPageVisionTranslations((prev) => {
        const merged = { ...initialTrans, ...prev };
        pageVisionTranslationsRef.current = merged;
        return merged;
      });
      setPageVisionStatus((prev) => {
        const merged = { ...initialStatus, ...prev };
        pageVisionStatusRef.current = merged;
        return merged;
      });

      // Nạp danh sách các trang chưa dịch vào hàng đợi thác nước
      waterfallQueueRef.current = unrendered;

      // Ưu tiên ngay trang 1 (hoặc trang hiện tại)
      prioritizeVisionPage(currentPage || 1);
  }, [readerMode, pdfUrl, pdfDoc, numPages, settings.pdfModel, prioritizeVisionPage]);

  // 2. Synchronized scrolling between left and right panels with Page-to-Page alignment
  const handleLeftScroll = () => {
    if (isSyncingScroll.current || viewMode !== 'bilingual') return;
    const left = leftPaneRef.current;
    const right = rightPaneRef.current;
    if (!left || !right) return;

    isSyncingScroll.current = true;

    // Detect which page is closest or currently visible at the top of the left pane
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

    // Align right pane to the exact corresponding page
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
    if (readerMode === 'vision') {
      debouncedPrioritizePage(bestPno);
    }
    requestAnimationFrame(() => {
      isSyncingScroll.current = false;
    });
  };

  const handleRightScroll = () => {
    if (isSyncingScroll.current || viewMode !== 'bilingual') return;
    const left = leftPaneRef.current;
    const right = rightPaneRef.current;
    if (!left || !right) return;

    isSyncingScroll.current = true;

    // Detect which page is closest or currently visible at the top of the right pane
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

    // Align left pane to the exact corresponding page
    const leftPage = left.querySelector<HTMLElement>(
      `.lt-page-wrap[data-page-number="${bestPno}"]`
    );
    if (leftPage) {
      left.scrollTop = leftPage.offsetTop + leftPage.offsetHeight * pageOffsetRatio;
    } else {
      const scrollMax = right.scrollHeight - right.clientHeight;
      const ratio = scrollMax > 0 ? right.scrollTop / scrollMax : 0;
      left.scrollTop = ratio * (left.scrollHeight - left.clientHeight);
    }

    setCurrentPage(bestPno);
    if (readerMode === 'vision') {
      debouncedPrioritizePage(bestPno);
    }
    requestAnimationFrame(() => {
      isSyncingScroll.current = false;
    });
  };

  // P3-quota: hàng đợi dịch theo trang, tối đa 2 trang đồng thời — tránh burst
  // chạm quota/overload khi user cuộn nhanh (mỗi trang đã có micro-batch song song).
  const pageQueueRef = useRef<{ active: number; waiting: Array<() => void> }>({
    active: 0,
    waiting: [],
  });

  const runWithPageSlot = async (fn: () => Promise<void>): Promise<void> => {
    const q = pageQueueRef.current;
    if (q.active >= 2) {
      await new Promise<void>((resolve) => q.waiting.push(resolve));
    }
    q.active++;
    try {
      await fn();
    } finally {
      q.active--;
      const next = q.waiting.shift();
      if (next) next();
    }
  };

  // 3. Trigger lazy translation for a page
  // Token chống race: request cũ (model cũ / lần thử cũ) về sau không được
  // đè kết quả của request mới hơn cùng trang.
  const pageTokenRef = useRef<Record<number, number>>({});
  const triggerPageTranslation = async (pageNumber: number, force = false) => {
    if (pageNumber < 1 || pageNumber > numPages) return;
    if (!force && (!pdfDoc || pageStatus[pageNumber])) return;
    if (!pdfDoc) return;

    const token = (pageTokenRef.current[pageNumber] || 0) + 1;
    pageTokenRef.current[pageNumber] = token;
    const alive = () => pageTokenRef.current[pageNumber] === token;

    setPageStatus((prev) => ({ ...prev, [pageNumber]: 'loading' }));

    await runWithPageSlot(async () => {
      if (!alive()) return;
      try {
        const page = await pdfDoc.getPage(pageNumber);
        const vp = page.getViewport({ scale: 1.0 });
        const textContent = await page.getTextContent();
        if (!alive()) return;

        const blocks = extractTextBlocks(
          textContent.items as any,
          vp.width,
          vp.height,
          pageNumber,
        );
        if (!alive()) return;
        setPageBlocks((prev) => ({ ...prev, [pageNumber]: blocks }));

        const result = await translatePageBlocks(blocks, pageNumber, pdfUrl, settings);
        if (!alive()) return;
        setPageTranslations((prev) => ({ ...prev, [pageNumber]: result.blocks }));
        setPageUntranslated((prev) => ({ ...prev, [pageNumber]: result.untranslatedCount || 0 }));
        setPageStatus((prev) => ({ ...prev, [pageNumber]: 'done' }));
      } catch (err) {
        if (!alive()) return;
        console.error(`[Live-Trans PDF] Error translating page ${pageNumber}:`, err);
        setPageStatus((prev) => ({ ...prev, [pageNumber]: 'error' }));
      }
    });
  };

  // Thử lại trang lỗi (badge ⚠).

  const retryPage = (pageNumber: number) => {
    setPageStatus((prev) => {
      const next = { ...prev };
      delete next[pageNumber];
      return next;
    });
    void triggerPageTranslation(pageNumber, true);
  };

  const applySettingsModal = () => {
    const validModels = pendingProvider === 'zen' ? PDF_ZEN_MODELS : PDF_GEMINI_MODELS;
    const pdfModel = (validModels as readonly string[]).includes(pendingModel)
      ? pendingModel
      : DEFAULT_PDF_MODEL[pendingProvider];
    const geminiKeys = keyItems.filter((k) => k.provider === 'gemini').map((k) => k.key.trim());
    const zenKeys = keyItems.filter((k) => k.provider === 'zen').map((k) => k.key.trim());
    const next: Settings = {
      ...settings,
      pdfProvider: pendingProvider,
      pdfModel,
      pdfConcurrency: pendingConcurrency,
      apiKeys: keyItems,
      apiKey: geminiKeys[0] || '',
      zenApiKey: zenKeys[0] || '',
    };
    setSettings(next);
    setPendingModel(pdfModel);
    void saveSettings(next);
    setIsSettingsOpen(false);

    // Mở popup hỏi người dùng muốn dịch lại trang hiện tại, toàn bộ tài liệu hay để sau
    setIsPostSavePromptOpen(true);
  };

  // Dịch lại toàn bộ các trang từ đầu với provider/model hiện tại.
  const retranslateAll = () => {
    if (readerMode === 'vision') {
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
      return;
    }

    try {
      const doomed: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith('live_trans_pdf_')) doomed.push(k);
      }
      for (const k of doomed) sessionStorage.removeItem(k);
    } catch {
      /* storage có thể bị chặn — vẫn reset state để dịch lại */
    }
    setPageBlocks({});
    setPageTranslations({});
    setPageUntranslated({});
    setPageStatus({});
    for (let p = 1; p <= numPages; p++) {
      void triggerPageTranslation(p, true);
    }
  };

  // Jump to specific page
  const scrollToPage = (pageNumber: number) => {
    setCurrentPage(pageNumber);
    if (readerMode === 'vision') {
      // Click trực tiếp từ người dùng là hành động dứt khoát -> Ưu tiên ngay 0ms không cần chờ debounce
      if (scrollDebounceTimerRef.current) {
        clearTimeout(scrollDebounceTimerRef.current);
      }
      prioritizeVisionPage(pageNumber);
    }
    const target = leftPaneRef.current?.querySelector(`[data-page-number="${pageNumber}"]`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (errorMsg) {
    return (
      <div class="lt-center-msg">
        <h2>Lỗi khi tải tài liệu</h2>
        <p>{errorMsg}</p>
        <button class="lt-btn lt-btn-primary" onClick={() => window.location.reload()}>
          Thử lại
        </button>
      </div>
    );
  }

  if (!pdfDoc) {
    return (
      <div class="lt-center-msg">
        <div class="lt-spinner" style={{ width: '32px', height: '32px' }} />
        <h2>Đang chuẩn bị trình đọc & dịch Live-Trans...</h2>
        <p>{docTitle}</p>
      </div>
    );
  }

  return (
    <div id="app">
      {/* TOP TOOLBAR (CODING-IDE STYLE) */}
      <header class="lt-toolbar">
        {/* LEFT: Brand & Document info */}
        <div class="lt-toolbar-group">
          <button
            class={`lt-btn lt-sidebar-toggle-btn ${sidebarOpen ? 'active' : ''}`}
            title={sidebarOpen ? 'Ẩn danh sách trang' : 'Danh sách trang'}
            onClick={() => setSidebarOpen((v) => !v)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2"/>
              <path d="M9 3v18"/>
            </svg>
          </button>
          <div class="lt-brand">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m5 8 6 6"/>
              <path d="m4 14 6-6 2-3"/>
              <path d="M2 5h12"/>
              <path d="M7 2h1"/>
              <path d="m22 22-5-10-5 10"/>
              <path d="M14 18h6"/>
            </svg>
            <span>Live-Trans</span>
          </div>
          <span class="lt-doc-title" title={docTitle}>
            {docTitle}
          </span>
        </div>

        {/* CENTER: Segmented View Controls & Reader Layout */}
        <div class="lt-toolbar-group">
          {/* Segmented View Mode */}
          <div class="lt-segmented-group" title="Chế độ xem">
            <button
              class={`lt-seg-btn ${viewMode === 'bilingual' ? 'active' : ''}`}
              onClick={() => setViewMode('bilingual')}
              title="Song ngữ đối chiếu"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2"/>
                <path d="M12 3v18"/>
              </svg>
            </button>
            <button
              class={`lt-seg-btn ${viewMode === 'translated' ? 'active' : ''}`}
              onClick={() => setViewMode('translated')}
              title="Chỉ hiển thị bản dịch"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4"/>
                <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
                <path d="m3 15 2 2 4-4"/>
              </svg>
            </button>
            <button
              class={`lt-seg-btn ${viewMode === 'original' ? 'active' : ''}`}
              onClick={() => setViewMode('original')}
              title="Chỉ hiển thị bản gốc"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </button>
          </div>

          {/* Nút đặt lại tỉ lệ 50:50 (Bilingual mode) */}
          {viewMode === 'bilingual' && (
            <button
              class="lt-btn"
              onClick={() => {
                setSplitRatio(0.5);
                if (zoomMode === 'fit') {
                  setTimeout(() => {
                    const ls = calculatePaneFitScale(leftPaneRef.current);
                    const rs = calculatePaneFitScale(rightPaneRef.current);
                    setLeftFitScale(ls);
                    setRightFitScale(rs);
                  }, 50);
                }
              }}
              title="Đặt lại tỉ lệ chia đều 50:50"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2"/>
                <path d="M12 3v18"/>
              </svg>
              <span>50:50</span>
            </button>
          )}

          {/* Mode Selector Dropdown - Click to expand (Không dàn trải gây tốn diện tích) */}
          <div class="lt-dropdown-container">
            <button
              class="lt-btn lt-dropdown-btn lt-mode-select-btn"
              onClick={() => {
                setIsModeMenuOpen(!isModeMenuOpen);
                setIsZoomMenuOpen(false);
              }}
              title="Chọn chế độ hiển thị bản dịch"
            >
              {readerMode === 'whiteboard' ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect width="7" height="7" x="3" y="3" rx="1"/>
                    <rect width="7" height="7" x="14" y="3" rx="1"/>
                    <rect width="7" height="7" x="14" y="14" rx="1"/>
                    <rect width="7" height="7" x="3" y="14" rx="1"/>
                  </svg>
                  <span>Bảng trắng</span>
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c084fc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                  <span style={{ color: '#c084fc', fontWeight: 600 }}>Vision AI</span>
                </>
              )}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style={{ opacity: 0.7 }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            {isModeMenuOpen && (
              <div class="lt-dropdown-menu lt-mode-menu" onClick={() => setIsModeMenuOpen(false)}>
                <div
                  class={`lt-dropdown-item ${readerMode === 'vision' ? 'active' : ''}`}
                  onClick={() => setReaderMode('vision')}
                >
                  <div class="lt-dropdown-item-title">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c084fc" stroke-width="2">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                    <strong style={{ color: '#c084fc' }}>Vision AI (Thị giác Đa phương thức) (Khuyên dùng)</strong>
                  </div>
                  <div class="lt-dropdown-item-desc">Chụp ảnh trang gửi Gemini 3.5 Flash-Lite, công thức KaTeX & Markdown học thuật siêu chuẩn.</div>
                </div>

                <div
                  class={`lt-dropdown-item ${readerMode === 'whiteboard' ? 'active' : ''}`}
                  onClick={() => setReaderMode('whiteboard')}
                >
                  <div class="lt-dropdown-item-title">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2">
                      <rect width="7" height="7" x="3" y="3" rx="1"/>
                      <rect width="7" height="7" x="14" y="3" rx="1"/>
                      <rect width="7" height="7" x="14" y="14" rx="1"/>
                      <rect width="7" height="7" x="3" y="14" rx="1"/>
                    </svg>
                    <strong>Bảng trắng Component (Chưa hoàn thiện)</strong>
                  </div>
                  <div class="lt-dropdown-item-desc">Bảo toàn vị trí và tỉ lệ tọa độ paper, từng component độc lập, hỗ trợ kéo thả.</div>
                </div>

                <div class="lt-dropdown-item lt-disabled">
                  <div class="lt-dropdown-item-title">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="21" y1="6" x2="3" y2="6"/>
                      <line x1="15" y1="12" x2="3" y2="12"/>
                      <line x1="17" y1="18" x2="3" y2="18"/>
                    </svg>
                    <strong>Markdown Dòng chảy (Chưa phát triển)</strong>
                  </div>
                  <div class="lt-dropdown-item-desc">Chưa hỗ trợ - đang trong lộ trình phát triển.</div>
                </div>

                <div class="lt-dropdown-item lt-disabled">
                  <div class="lt-dropdown-item-title">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polygon points="12 2 2 7 12 12 22 7 12 2"/>
                      <polyline points="2 17 12 22 22 17"/>
                      <polyline points="2 12 12 17 22 12"/>
                    </svg>
                    <strong>Overlay Đè chữ (Chưa phát triển)</strong>
                  </div>
                  <div class="lt-dropdown-item-desc">Chưa hỗ trợ - đang trong lộ trình phát triển.</div>
                </div>
              </div>
            )}
          </div>

          {/* PAGE NAVIGATOR */}
          <div class="lt-page-counter">
            <button
              class="lt-btn"
              disabled={currentPage <= 1}
              onClick={() => scrollToPage(currentPage - 1)}
              title="Trang trước"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <span>
              {currentPage} / {numPages}
            </span>
            <button
              class="lt-btn"
              disabled={currentPage >= numPages}
              onClick={() => scrollToPage(currentPage + 1)}
              title="Trang sau"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>
        </div>

        {/* RIGHT: Zoom, Actions, Settings */}
        <div class="lt-toolbar-group">
          {/* Zoom */}
          <button
            class="lt-btn"
            title="Thu nhỏ"
            onClick={() => {
              setZoomMode('custom');
              setScale((s) => Math.max(0.5, Math.round((s - 0.15) * 100) / 100));
            }}
          >
            −
          </button>
          <div class="lt-dropdown-container">
            <button
              class="lt-btn lt-dropdown-btn"
              onClick={() => {
                setIsZoomMenuOpen(!isZoomMenuOpen);
                setIsModeMenuOpen(false);
              }}
              title="Chọn mức thu phóng"
            >
              <span>{zoomMode === 'fit' ? 'Fit Width' : `${Math.round(scale * 100)}%`}</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {isZoomMenuOpen && (
              <div class="lt-dropdown-menu lt-zoom-menu" onClick={() => setIsZoomMenuOpen(false)}>
                <div
                  class={`lt-dropdown-item ${zoomMode === 'fit' ? 'active' : ''}`}
                  onClick={() => {
                    setZoomMode('fit');
                    const ls = calculatePaneFitScale(leftPaneRef.current);
                    const rs = calculatePaneFitScale(rightPaneRef.current);
                    setLeftFitScale(ls);
                    setRightFitScale(rs);
                  }}
                >
                  <div class="lt-dropdown-item-title"><strong>Fit Width</strong></div>
                  <div class="lt-dropdown-item-desc">Tự động vừa vặn khung đọc</div>
                </div>
                {[0.75, 0.9, 1.0, 1.15, 1.25, 1.5, 2.0].map((val) => (
                  <div
                    key={val}
                    class={`lt-dropdown-item ${zoomMode === 'custom' && Math.abs(scale - val) < 0.02 ? 'active' : ''}`}
                    onClick={() => {
                      setZoomMode('custom');
                      setScale(val);
                    }}
                  >
                    <div class="lt-dropdown-item-title"><strong>{Math.round(val * 100)}%</strong></div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            class="lt-btn"
            title="Phóng to"
            onClick={() => {
              setZoomMode('custom');
              setScale((s) => Math.min(2.5, Math.round((s + 0.15) * 100) / 100));
            }}
          >
            +
          </button>

          <button
            class="lt-btn"
            onClick={retranslateAll}
            title="Xoá cache + dịch lại toàn bộ các trang"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
            </svg>
            Dịch lại
          </button>

          <button
            class="lt-btn lt-btn-primary"
            title="Cài đặt (Model AI, API Key, Số luồng song song)"
            onClick={() => setIsSettingsOpen(true)}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
        </div>
      </header>

      {/* SETTINGS MODAL */}
      {isSettingsOpen && (
        <div class="lt-modal-backdrop" onClick={() => setIsSettingsOpen(false)}>
          <div class="lt-modal-card" onClick={(e) => e.stopPropagation()}>
            <div class="lt-modal-header">
              <div class="lt-modal-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                <span>Cài đặt Live-Trans</span>
              </div>
              <button
                class="lt-modal-close-btn"
                onClick={() => setIsSettingsOpen(false)}
                title="Đóng"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div class="lt-modal-body">
              {/* Provider */}
              <div class="lt-setting-field">
                <label class="lt-setting-label">Nhà cung cấp AI (Provider)</label>
                <div class="lt-setting-desc">
                  Chọn Google Gemini chính thức hoặc OpenCode Zen (OpenAI-compatible)
                </div>
                <CustomSelect
                  value={pendingProvider}
                  options={[
                    { value: 'gemini', label: 'Google Gemini (Mặc định, ổn định)', desc: 'Chính thức từ Google AI Studio, nhanh & nhiều quota' },
                    { value: 'zen', label: 'OpenCode Zen (Dự phòng SOTA)', desc: 'OpenAI-compatible proxy, hỗ trợ đa model SOTA' },
                  ]}
                  onChange={(val) => {
                    const p = val as PdfProvider;
                    setPendingProvider(p);
                    setPendingModel(DEFAULT_PDF_MODEL[p]);
                  }}
                />
              </div>

              {/* Model */}
              <div class="lt-setting-field">
                <label class="lt-setting-label">Mô hình AI (Model)</label>
                <div class="lt-setting-desc">
                  {pendingProvider === 'gemini'
                    ? 'Khuyên dùng gemini-3.5-flash-lite để dịch nhanh, nhiều quota và mượt'
                    : 'Các model mã nguồn mở hoặc thương mại hỗ trợ qua Zen API'}
                </div>
                <CustomSelect
                  value={pendingModel}
                  options={(pendingProvider === 'gemini' ? PDF_GEMINI_MODELS : PDF_ZEN_MODELS).map((m) => ({
                    value: m,
                    label: m,
                  }))}
                  onChange={(val) => setPendingModel(val as string)}
                />
              </div>

              {/* QUẢN LÝ ĐA API KEY VỚI SMART ROUTER */}
              <div class="lt-setting-field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label class="lt-setting-label" style={{ margin: 0 }}>Quản lý API Key (Đa khóa & Smart Router)</label>
                  <span class="lt-key-count-badge">
                    {modalProviderKeys.length} key {pendingProvider === 'gemini' ? 'Gemini' : 'Zen'}
                  </span>
                </div>
                <div class="lt-setting-desc">
                  Thêm một hoặc nhiều key để hệ thống tự động xoay tua (Router) khi gặp giới hạn hạn mức Rate Limit (429).
                </div>

                {/* Hàng thêm key: Dropdown chọn provider + Ô nhập key + Nút Thêm */}
                <div class="lt-add-key-row">
                  <CustomSelect
                    className="lt-key-provider-select"
                    value={newKeyProvider}
                    options={[
                      { value: 'gemini', label: 'Google Gemini' },
                      { value: 'zen', label: 'OpenCode Zen' },
                    ]}
                    onChange={(val) => setNewKeyProvider(val as PdfProvider)}
                  />
                  <input
                    type="password"
                    class="lt-setting-input lt-key-input"
                    placeholder={newKeyProvider === 'gemini' ? 'Nhập Gemini Key (AIzaSy...)' : 'Nhập Zen Key (sk-...)'}
                    value={newKeyText}
                    onInput={(e) => setNewKeyText((e.target as HTMLInputElement).value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddKey();
                      }
                    }}
                  />
                  <button
                    type="button"
                    class="lt-btn lt-btn-primary lt-btn-add-key"
                    onClick={handleAddKey}
                    title="Thêm API Key này vào danh sách"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <line x1="12" y1="5" x2="12" y2="19"/>
                      <line x1="5" y1="12" x2="12" y2="12"/>
                    </svg>
                    <span>Thêm</span>
                  </button>
                </div>

                {/* Danh sách các key đã thêm */}
                <div class="lt-keys-list">
                  {keyItems.length === 0 ? (
                    <div class="lt-keys-empty">Chưa có API key nào. Vui lòng thêm ít nhất 1 key ở trên để bắt đầu dịch.</div>
                  ) : (
                    keyItems.map((item, idx) => (
                      <div key={item.id} class="lt-key-card">
                        <div class="lt-key-card-left">
                          <span class={`lt-key-badge lt-key-badge-${item.provider}`}>
                            {item.provider === 'gemini' ? 'Gemini' : 'Zen'}
                          </span>
                          <span class="lt-key-masked">
                            {maskApiKey(item.key)}
                          </span>
                          {idx === 0 && (
                            <span class="lt-key-primary-tag">Mặc định</span>
                          )}
                        </div>
                        <button
                          type="button"
                          class="lt-key-del-btn"
                          title="Xóa key này"
                          onClick={() => handleRemoveKey(item.id)}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          </svg>
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Trạng thái Router tương ứng với provider đang chọn */}
                <div class="lt-router-status-note">
                  {modalProviderKeys.length >= 2 ? (
                    <div class="lt-router-alert lt-router-active">
                      🟢 <strong>Đang kích hoạt Smart Router ({modalProviderKeys.length} keys):</strong> Tự động xoay vòng sang key kế tiếp khi một key bị limit (429/quota).
                    </div>
                  ) : modalProviderKeys.length === 1 ? (
                    <div class="lt-router-alert lt-router-single">
                      ℹ️ <strong>Sử dụng 1 key đơn lẻ:</strong> Khi chạm hạn mức (429/quota), hệ thống sẽ thông báo lỗi trực tiếp thay vì xoay vòng.
                    </div>
                  ) : (
                    <div class="lt-router-alert lt-router-empty">
                      ⚠️ <strong>Chưa có API key:</strong> Cần thêm ít nhất 1 key cho {pendingProvider === 'gemini' ? 'Google Gemini' : 'OpenCode Zen'} để sử dụng tính năng dịch.
                    </div>
                  )}
                </div>
              </div>

              {/* Tùy chọn số luồng dịch song song (Concurrency) */}
              <div class="lt-setting-field">
                <label class="lt-setting-label">Số trang dịch song song (Concurrency)</label>
                <div class="lt-setting-desc">
                  Số worker dịch đồng thời theo hàng đợi thác nước. Khuyên dùng 5 trang để đọc nhanh mà không nghẽn mạng.
                </div>
                <CustomSelect
                  value={pendingConcurrency}
                  options={[
                    { value: 2, label: '2 trang song song' },
                    { value: 3, label: '3 trang song song' },
                    { value: 4, label: '4 trang song song' },
                    { value: 5, label: '5 trang song song (Mặc định, tối ưu)' },
                    { value: 6, label: '6 trang song song' },
                    { value: 7, label: '7 trang song song (Tối đa)' },
                  ]}
                  onChange={(val) => setPendingConcurrency(Number(val))}
                />
              </div>

              {/* Reset Layouts & Caches in settings */}
              <div class="lt-setting-field" style={{ borderTop: '1px solid #27272a', paddingTop: '14px' }}>
                <label class="lt-setting-label">Bố cục & Bộ nhớ tạm</label>
                <div style={{ fontSize: '11px', color: '#a1a1aa', marginBottom: '8px', lineHeight: '1.4' }}>
                  ⚡ <strong>Bộ nhớ đệm thông minh:</strong> Lưu trữ bền vững tối đa 50 bài báo trong 14 ngày (LRU). Tự động nạp tức thì 0ms khi mở lại trang hoặc khởi động lại Chrome.
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <button
                    class="lt-btn"
                    style={{ flex: 1 }}
                    onClick={() => {
                      retranslateAll();
                      setIsSettingsOpen(false);
                    }}
                  >
                    ↻ Xóa cache & Dịch lại
                  </button>
                </div>
              </div>
            </div>

            <div class="lt-modal-footer">
              <button class="lt-btn" onClick={() => setIsSettingsOpen(false)}>
                Hủy
              </button>
              <button class="lt-btn lt-btn-primary" onClick={applySettingsModal}>
                Lưu & Áp dụng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POST-SAVE ACTION POPUP MODAL (Lựa chọn dịch lại sau khi lưu API key) */}
      {isPostSavePromptOpen && (
        <div class="lt-modal-backdrop" onClick={() => setIsPostSavePromptOpen(false)}>
          <div class="lt-modal-card lt-modal-card-sm" onClick={(e) => e.stopPropagation()}>
            <div class="lt-modal-header">
              <div class="lt-modal-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <span>Đã lưu API Key thành công!</span>
              </div>
              <button
                class="lt-modal-close-btn"
                onClick={() => setIsPostSavePromptOpen(false)}
                title="Đóng"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div class="lt-modal-body">
              <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#e4e4e7', lineHeight: '1.5' }}>
                Bạn đã cập nhật cấu hình API Key. Bạn muốn áp dụng vào tài liệu đang mở như thế nào?
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  class="lt-btn lt-btn-primary"
                  style={{ justifyContent: 'flex-start', padding: '10px 14px', textAlign: 'left', gap: '12px' }}
                  onClick={() => {
                    setIsPostSavePromptOpen(false);
                    retryVisionPage(currentPage);
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                  <div>
                    <div style={{ fontWeight: 600 }}>Dịch lại Trang hiện tại (Trang {currentPage})</div>
                    <div style={{ fontSize: '11px', color: '#bae6fd' }}>Ưu tiên dịch ngay trang bạn đang xem với API Key mới</div>
                  </div>
                </button>

                <button
                  class="lt-btn"
                  style={{ justifyContent: 'flex-start', padding: '10px 14px', textAlign: 'left', gap: '12px', background: '#27272a', borderColor: '#3f3f46' }}
                  onClick={() => {
                    setIsPostSavePromptOpen(false);
                    retranslateAll();
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
                    <path d="M21 3v5h-5"/>
                  </svg>
                  <div>
                    <div style={{ fontWeight: 600 }}>Dịch lại Toàn bộ tài liệu</div>
                    <div style={{ fontSize: '11px', color: '#a1a1aa' }}>Xóa toàn bộ cache cũ và khởi động lại dịch từ Trang 1</div>
                  </div>
                </button>

                <button
                  class="lt-btn"
                  style={{ padding: '8px 12px', color: '#a1a1aa' }}
                  onClick={() => {
                    setIsPostSavePromptOpen(false);
                    processVisionQueue();
                  }}
                >
                  Để sau (tiếp tục đọc bình thường)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <div class="lt-main">
        {/* CLICK-TO-EXPAND SIDEBAR DRAWER (Chỉ mở khi bấm nút Trang, không chiếm diện tích) */}
        <div class={`lt-sidebar-drawer ${sidebarOpen || isSidebarPinned ? 'open' : ''}`}>
          <aside class={`lt-sidebar ${isSidebarPinned ? 'pinned' : ''}`}>
            {/* DRAWER HEADER: Ghim & Đóng */}
            <div class="lt-drawer-header">
              <div class="lt-drawer-top-row">
                <div class="lt-drawer-title">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/>
                    <path d="M6 6h10"/>
                    <path d="M6 10h10"/>
                  </svg>
                  Danh sách trang
                </div>
                <div class="lt-drawer-header-actions">
                  <button
                    class={`lt-drawer-pin-btn ${isSidebarPinned ? 'active' : ''}`}
                    onClick={() => setIsSidebarPinned(!isSidebarPinned)}
                    title={isSidebarPinned ? 'Bỏ ghim thanh bên' : 'Ghim thanh bên'}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="12" y1="17" x2="12" y2="22"/>
                      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a1 1 0 0 0 0-2H8a1 1 0 0 0 0 2h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>
                    </svg>
                  </button>
                  <button
                    class="lt-drawer-close-btn"
                    onClick={() => {
                      setSidebarOpen(false);
                      setIsSidebarPinned(false);
                    }}
                    title="Đóng thanh trang"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              </div>

              <div class="lt-drawer-page-stat">
                Đang xem: <strong>Trang {currentPage}</strong> / {numPages}
              </div>
            </div>

            {/* PAGE THUMBNAILS LIST - Gọn gàng 1 dòng duy nhất */}
            {Array.from({ length: numPages }).map((_, idx) => {
              const pno = idx + 1;
              const status = readerMode === 'vision' ? pageVisionStatus[pno] : pageStatus[pno];
              const isExecutingPriority = activePriorityPages.includes(pno);
              const isWaitingPriority = pendingPriorityPages.includes(pno);
              const isPriority = isExecutingPriority || isWaitingPriority;
              return (
                <div
                  key={pno}
                  class={`lt-thumb-item ${currentPage === pno ? 'active' : ''}`}
                  onClick={() => scrollToPage(pno)}
                >
                  <span class="lt-thumb-number">Trang {pno}</span>
                  {status === 'done' && (
                    <span class="lt-thumb-status lt-thumb-done">Đã dịch ✓</span>
                  )}
                  {status === 'loading' && (
                    <span class={`lt-thumb-status ${isPriority ? 'lt-thumb-priority' : 'lt-thumb-loading'}`}>
                      {isPriority ? 'Ưu tiên ⚡' : 'Đang dịch...'}
                    </span>
                  )}
                  {status === 'queued' && (
                    <span class={`lt-thumb-status ${isWaitingPriority ? 'lt-thumb-priority' : 'lt-thumb-queued'}`}>
                      {isWaitingPriority ? 'Chờ ưu tiên ⚡' : 'Đang đợi...'}
                    </span>
                  )}
                  {status === 'error' && (
                    <span class="lt-thumb-status lt-thumb-error">Lỗi ⚠</span>
                  )}
                  {!status && (
                    <span class="lt-thumb-status lt-thumb-pending">Chưa dịch</span>
                  )}
                </div>
              );
            })}
          </aside>
        </div>

        {/* WORKSPACE PANELS */}
        <main class="lt-workspace">
          {/* LEFT PANE (Original) - Shown in bilingual or original mode */}
          {(viewMode === 'bilingual' || viewMode === 'original') && (
            <div
              ref={leftPaneRef}
              class="lt-pane lt-pane-left"
              onScroll={handleLeftScroll}
              style={{
                width: viewMode === 'bilingual' ? `${splitRatio * 100}%` : '100%',
                flex: 'none',
              }}
            >
              {Array.from({ length: numPages }).map((_, idx) => (
                <PageRenderer
                  key={idx + 1}
                  pdfDoc={pdfDoc}
                  pageNumber={idx + 1}
                  scale={effectiveLeftScale}
                  blocks={pageBlocks[idx + 1] || []}
                  hoveredSentenceId={hoveredSentenceId}
                  onHoverSentence={setHoveredSentenceId}
                  onVisible={readerMode === 'vision' ? debouncedPrioritizePage : triggerPageTranslation}
                />
              ))}
            </div>
          )}

          {/* DRAGGABLE SPLITTER - In bilingual mode */}
          {viewMode === 'bilingual' && (
            <div
              class="lt-splitter"
              title="Kéo sang trái/phải để mở rộng không gian đọc bản dịch (khắc phục dãn nở văn bản)"
              onPointerDown={(e) => {
                e.preventDefault();
                isDraggingSplitter.current = true;
                document.body.classList.add('lt-resizing');
                const target = e.currentTarget as Element;
                try {
                  target.setPointerCapture?.(e.pointerId);
                } catch {}

                let currentRatio = splitRatio;
                let rafId = 0;

                const onPointerMove = (ev: PointerEvent) => {
                  if (!isDraggingSplitter.current) return;
                  const workspace = target.parentElement;
                  if (!workspace) return;
                  const rect = workspace.getBoundingClientRect();
                  const rawRatio = (ev.clientX - rect.left) / rect.width;
                  const clamped = Math.max(0.2, Math.min(0.8, rawRatio));
                  currentRatio = clamped;

                  if (rafId) cancelAnimationFrame(rafId);
                  rafId = requestAnimationFrame(() => {
                    if (leftPaneRef.current) {
                      leftPaneRef.current.style.width = `${clamped * 100}%`;
                    }
                    if (rightPaneRef.current) {
                      rightPaneRef.current.style.width = `${(1 - clamped) * 100}%`;
                    }
                  });
                };

                const onPointerUp = (ev: PointerEvent) => {
                  isDraggingSplitter.current = false;
                  document.body.classList.remove('lt-resizing');
                  if (rafId) cancelAnimationFrame(rafId);
                  try {
                    target.releasePointerCapture?.(ev.pointerId);
                  } catch {}
                  window.removeEventListener('pointermove', onPointerMove);
                  window.removeEventListener('pointerup', onPointerUp);

                  // Chỉ commit và tính lại scale một lần duy nhất khi nhả chuột
                  setSplitRatio(currentRatio);
                  if (zoomMode === 'fit') {
                    const ls = calculatePaneFitScale(leftPaneRef.current);
                    const rs = calculatePaneFitScale(rightPaneRef.current);
                    setLeftFitScale(ls);
                    setRightFitScale(rs);
                  }
                };

                window.addEventListener('pointermove', onPointerMove);
                window.addEventListener('pointerup', onPointerUp);
              }}
            >
              <div class="lt-splitter-bar" />
            </div>
          )}

          {/* RIGHT PANE (Translated) - Shown in bilingual or translated mode */}
          {(viewMode === 'bilingual' || viewMode === 'translated') && (
            <div
              ref={rightPaneRef}
              class="lt-pane lt-pane-right"
              onScroll={handleRightScroll}
              style={{
                width: viewMode === 'bilingual' ? `${(1 - splitRatio) * 100}%` : '100%',
                flex: 'none',
              }}
            >
              {/* WARNING BANNER NẾU CHƯA CÓ API KEY */}
              {!hasActiveKey && (
                <div class="lt-api-key-warning-banner">
                  <div class="lt-warning-left">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/>
                      <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    <div>
                      <div class="lt-warning-title">
                        Cảnh báo: Chưa cấu hình {settings.pdfProvider === 'zen' ? 'OpenCode Zen' : 'Google Gemini'} API Key
                      </div>
                      <div class="lt-warning-sub">
                        Hệ thống tạm dừng tiến trình dịch ngầm. Vui lòng thêm API Key để hệ thống dịch tài liệu sang tiếng Việt kèm công thức KaTeX.
                      </div>
                    </div>
                  </div>
                  <button class="lt-btn lt-btn-warning" onClick={() => setIsSettingsOpen(true)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="3"/>
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                    </svg>
                    <span>Cấu hình API Key</span>
                  </button>
                </div>
              )}

              {Array.from({ length: numPages }).map((_, idx) => {
                const pno = idx + 1;
                if (readerMode === 'whiteboard') {
                  return (
                    <WhiteboardPageRenderer
                      key={pno}
                      pdfDoc={pdfDoc}
                      pageNumber={pno}
                      scale={effectiveRightScale}
                      blocks={pageTranslations[pno] || []}
                      hoveredSentenceId={hoveredSentenceId}
                      onHoverSentence={setHoveredSentenceId}
                      onVisible={triggerPageTranslation}
                      status={pageStatus[pno]}
                      untranslatedCount={pageUntranslated[pno] || 0}
                      onRetry={retryPage}
                      visionMarkdown={pageVisionTranslations[pno] || ''}
                    />
                  );
                }

                return (
                  <VisionPageRenderer
                    key={pno}
                    pdfDoc={pdfDoc}
                    pageNumber={pno}
                    scale={effectiveRightScale}
                    markdownText={pageVisionTranslations[pno] || ''}
                    status={pageVisionStatus[pno] || 'loading'}
                    errorMsg={pageVisionErrors[pno] || ''}
                    hasApiKey={hasActiveKey}
                    blocks={pageBlocks[pno] || []}
                    onVisible={debouncedPrioritizePage}
                    onRetry={retryVisionPage}
                    isPriority={activePriorityPages.includes(pno) || pendingPriorityPages.includes(pno)}
                  />
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

interface PageRendererProps {
  pdfDoc: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  blocks: (TextBlock | TranslatedBlock)[];
  hoveredSentenceId: string | null;
  onHoverSentence: (id: string | null) => void;
  onVisible: (pageNumber: number) => void;
}

function PageRenderer({
  pdfDoc,
  pageNumber,
  scale,
  blocks,
  hoveredSentenceId,
  onHoverSentence,
  onVisible,
}: PageRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 612,
    height: 792,
  });
  // P0: chỉ raster canvas khi trang vào viewport (tiết kiệm CPU/RAM trên PC mở nhiều trang)
  const [isVisible, setIsVisible] = useState<boolean>(false);

  // Observe page visibility to trigger lazy translation + lazy canvas
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setIsVisible(true);
          onVisible(pageNumber);
          observer.disconnect();
        }
      },
      { rootMargin: '200px 0px', threshold: 0.1 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [pageNumber]);

  // Render PDF.js canvas with HiDPI / Retina super-sharp resolution (Khắc phục lỗi mờ ở Ảnh 3)
  // Giữ max(2.0, dpr) cho PC/máy tầm trung theo quyết định mới (bản mobile để sau).
  // Render PDF.js canvas — P0 lazy khi vào viewport.
  useEffect(() => {
    if (!isVisible) return;
    let active = true;

    void (async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (!active) return;

        const vp = page.getViewport({ scale });
        setDimensions({ width: vp.width, height: vp.height });

        const canvas = canvasRef.current;
        if (!canvas) return;

        const pixelRatio = window.devicePixelRatio || 1;
        const outputScale = Math.max(2.0, pixelRatio);

        canvas.width = Math.floor(vp.width * outputScale);
        canvas.height = Math.floor(vp.height * outputScale);
        canvas.style.width = `${vp.width}px`;
        canvas.style.height = `${vp.height}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;
        await (page.render as any)({
          canvasContext: ctx,
          viewport: vp,
          transform,
        }).promise;
      } catch (err) {
        console.warn(`[Live-Trans PDF] Canvas render failed for p${pageNumber}:`, err);
      }
    })();

    return () => {
      active = false;
    };
  }, [pdfDoc, pageNumber, scale, isVisible]);

  return (
    <div
      ref={containerRef}
      class="lt-page-wrap"
      data-page-number={pageNumber}
      style={{
        width: `${dimensions.width}px`,
        height: `${dimensions.height}px`,
      }}
    >
      {/* Background canvas (images, vectors, math formulas) */}
      <canvas ref={canvasRef} class="lt-page-canvas" />

      {/* Overlay text blocks with Precision Sentence-Level Hover Tracking */}
      <div class="lt-overlay-layer">
        {blocks.map((b) => (
          <FlowBlock
            key={b.id}
            b={b}
            scale={scale}
            hoveredSentenceId={hoveredSentenceId}
            onHoverSentence={onHoverSentence}
          />
        ))}
      </div>
    </div>
  );
}

interface FlowBlockProps {
  b: TextBlock | TranslatedBlock;
  scale: number;
  hoveredSentenceId: string | null;
  onHoverSentence: (id: string | null) => void;
}

/**
 * Component overlay cho trang gốc: render các span trong suốt phủ lên canvas gốc
 * để bắt sự kiện hover chuột từng câu và đồng bộ highlight hai chiều với bản dịch.
 */
function FlowBlock({
  b,
  scale,
  hoveredSentenceId,
  onHoverSentence,
}: FlowBlockProps) {
  const [bx, by, bw, bh] = b.bbox;
  const left = bx * scale;
  const top = by * scale;
  const width = bw * scale;
  const height = bh * scale;

  const isFormula = b.isFormula;
  const isHeader = b.isHeader;
  const isHeading = b.isHeading;
  const isFootnote = b.isFootnote;
  const isAlgorithm = b.isAlgorithm;

  // Cỡ chữ gốc (không co): footnote/algo hơi nhỏ hơn như bản gốc
  const baseFontSize = isFootnote
    ? Math.max(7.2, (b.fontSize || 7.5) * scale * 0.95)
    : isAlgorithm
      ? Math.max(7.5, (b.fontSize || 8.5) * scale * 0.92)
      : Math.max(7.2, (b.fontSize || 9.5) * scale);
  const computedLineHeight = isFootnote ? 1.2 : isAlgorithm ? 1.3 : 1.24;

  const sentenceItems =
    b.sentences && b.sentences.length > 0
      ? b.sentences
      : [{ id: b.id, text: b.text }];

  return (
    <div
      data-block-id={b.id}
      class={`lt-block lt-block-orig ${isFormula ? 'lt-block-formula' : ''} ${
        isHeader ? 'lt-block-header' : ''
      } ${isHeading ? 'lt-block-heading' : ''} ${
        isFootnote ? 'lt-block-footnote' : ''
      } ${isAlgorithm ? 'lt-block-algo' : ''}`}
      style={{
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        minHeight: isHeader || isFootnote ? undefined : `${Math.round(height)}px`,
        fontSize: `${baseFontSize}px`,
        lineHeight: computedLineHeight,
        fontWeight: isHeading ? 700 : b.bold ? 650 : 400,
        textAlign: isFormula
          ? 'center'
          : isHeading || isHeader || isFootnote || isAlgorithm
            ? 'left'
            : 'justify',
        overflow: 'visible',
        opacity: isFormula ? 0 : 1,
        pointerEvents: isFormula ? 'none' : 'auto',
        background: 'transparent',
        zIndex: 10,
      }}
    >
      {isFormula ? (
        <span style={{ opacity: 0 }}>{b.text}</span>
      ) : (
        sentenceItems.map((s) => {
          const isActive = hoveredSentenceId === s.id;
          return (
            <span
              key={s.id}
              data-sentence-id={s.id}
              class={`lt-sentence ${isActive ? 'lt-sentence-active' : ''}`}
              onMouseEnter={() => onHoverSentence(s.id)}
              onMouseLeave={() => onHoverSentence(null)}
            >
              <span style={{ opacity: 0 }}>{s.text} </span>
            </span>
          );
        })
      )}
    </div>
  );
}

render(<ViewerApp />, document.getElementById('app')!);
