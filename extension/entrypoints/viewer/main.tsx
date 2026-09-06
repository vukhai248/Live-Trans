import { render } from 'preact';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { extractTextBlocks } from '@/lib/pdf/blocks';
import { translatePageBlocks } from '@/lib/pdf/translate';
import { blocksToMarkdownElements } from '@/lib/pdf/markdown';
import { WhiteboardPageRenderer } from './WhiteboardPageRenderer';
import { computeReflowOffsets } from '@/lib/pdf/reflow';
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
} from '@/lib/settings';
import 'katex/dist/katex.min.css';

// Configure PDF.js worker from extension bundle
pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.mjs');

export function ViewerApp() {
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [docTitle, setDocTitle] = useState<string>('Tài liệu PDF');
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [viewMode, setViewMode] = useState<ViewMode>('bilingual');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [hoveredSentenceId, setHoveredSentenceId] = useState<string | null>(null);
  // Bảng trắng Component là mode mặc định (khắc phục dãn nở văn bản & ghosting).
  const [readerMode, setReaderMode] = useState<'whiteboard' | 'markdown' | 'overlay'>('whiteboard');
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
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [geminiKeyInput, setGeminiKeyInput] = useState<string>('');
  const [zenKeyInput, setZenKeyInput] = useState<string>('');

  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);
  const isSyncingScroll = useRef<boolean>(false);

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
      setGeminiKeyInput(s.apiKey || '');
      setZenKeyInput(s.zenApiKey || '');

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
  }, []);

  // 2. Synchronized scrolling between left and right panels with Page-to-Page alignment
  const handleLeftScroll = () => {
    if (isSyncingScroll.current || viewMode !== 'bilingual') return;
    const left = leftPaneRef.current;
    const right = rightPaneRef.current;
    if (!left || !right) return;

    isSyncingScroll.current = true;

    // Detect which page is at the top of the left pane
    const leftPages = left.querySelectorAll<HTMLElement>('.lt-page-wrap');
    let currentPno = 1;
    let pageOffsetRatio = 0;

    for (let i = 0; i < leftPages.length; i++) {
      const p = leftPages[i];
      if (!p) continue;
      const top = p.offsetTop;
      const height = p.offsetHeight;
      if (left.scrollTop >= top - 20 && left.scrollTop < top + height) {
        currentPno = Number(p.dataset.pageNumber || i + 1);
        pageOffsetRatio = Math.max(0, Math.min(1, (left.scrollTop - top) / height));
        break;
      }
    }

    // Align right pane to the exact corresponding page
    const rightPage = right.querySelector<HTMLElement>(
      `.lt-whiteboard-page[data-page-number="${currentPno}"], .lt-page-wrap[data-page-number="${currentPno}"], .lt-markdown-page[data-page-number="${currentPno}"]`
    );
    if (rightPage) {
      right.scrollTop = rightPage.offsetTop + rightPage.offsetHeight * pageOffsetRatio;
    } else {
      const scrollMax = left.scrollHeight - left.clientHeight;
      const ratio = scrollMax > 0 ? left.scrollTop / scrollMax : 0;
      right.scrollTop = ratio * (right.scrollHeight - right.clientHeight);
    }

    setCurrentPage(currentPno);
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

    // Detect which page is at the top of the right pane
    const rightPages = right.querySelectorAll<HTMLElement>(
      '.lt-whiteboard-page, .lt-page-wrap, .lt-markdown-page'
    );
    let currentPno = 1;
    let pageOffsetRatio = 0;

    for (let i = 0; i < rightPages.length; i++) {
      const p = rightPages[i];
      if (!p) continue;
      const top = p.offsetTop;
      const height = p.offsetHeight;
      if (right.scrollTop >= top - 20 && right.scrollTop < top + height) {
        currentPno = Number(p.dataset.pageNumber || i + 1);
        pageOffsetRatio = Math.max(0, Math.min(1, (right.scrollTop - top) / height));
        break;
      }
    }

    // Align left pane to the exact corresponding page
    const leftPage = left.querySelector<HTMLElement>(
      `.lt-page-wrap[data-page-number="${currentPno}"]`
    );
    if (leftPage) {
      left.scrollTop = leftPage.offsetTop + leftPage.offsetHeight * pageOffsetRatio;
    } else {
      const scrollMax = right.scrollHeight - right.clientHeight;
      const ratio = scrollMax > 0 ? right.scrollTop / scrollMax : 0;
      left.scrollTop = ratio * (left.scrollHeight - left.clientHeight);
    }

    setCurrentPage(currentPno);
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

  const hasPendingChange =
    pendingProvider !== settings.pdfProvider || pendingModel !== settings.pdfModel;

  // Áp dụng provider/model mới: chỉ các trang CHƯA dịch dùng model mới,
  // trang đã dịch giữ nguyên (cache key đã tách theo provider+model).
  const applyProviderModel = () => {
    const validModels = pendingProvider === 'zen' ? PDF_ZEN_MODELS : PDF_GEMINI_MODELS;
    const pdfModel = (validModels as readonly string[]).includes(pendingModel)
      ? pendingModel
      : DEFAULT_PDF_MODEL[pendingProvider];
    const next = { ...settings, pdfProvider: pendingProvider, pdfModel };
    setSettings(next);
    setPendingModel(pdfModel);
    void saveSettings(next);
  };

  const applySettingsModal = () => {
    const validModels = pendingProvider === 'zen' ? PDF_ZEN_MODELS : PDF_GEMINI_MODELS;
    const pdfModel = (validModels as readonly string[]).includes(pendingModel)
      ? pendingModel
      : DEFAULT_PDF_MODEL[pendingProvider];
    const next: Settings = {
      ...settings,
      pdfProvider: pendingProvider,
      pdfModel,
      apiKey: geminiKeyInput.trim(),
      zenApiKey: zenKeyInput.trim(),
    };
    setSettings(next);
    setPendingModel(pdfModel);
    void saveSettings(next);
    setIsSettingsOpen(false);
  };

  // Dịch lại toàn bộ các trang từ đầu với provider/model hiện tại.
  const retranslateAll = () => {
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

  // Reset bố cục component toàn tài liệu (toolbar).
  const [layoutResetSignal, setLayoutResetSignal] = useState<number>(0);
  const resetAllLayouts = () => {
    try {
      const doomed: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith('live_trans_layout_')) doomed.push(k);
      }
      for (const k of doomed) sessionStorage.removeItem(k);
    } catch {
      /* ignore */
    }
    setLayoutResetSignal((n) => n + 1);
  };

  // Jump to specific page
  const scrollToPage = (pageNumber: number) => {
    setCurrentPage(pageNumber);
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
            class="lt-btn"
            title={sidebarOpen ? 'Ẩn thanh trang' : 'Hiện thanh trang'}
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
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2"/>
                <path d="M12 3v18"/>
              </svg>
              Song ngữ
            </button>
            <button
              class={`lt-seg-btn ${viewMode === 'translated' ? 'active' : ''}`}
              onClick={() => setViewMode('translated')}
              title="Chỉ hiển thị bản dịch"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4"/>
                <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
                <path d="m3 15 2 2 4-4"/>
              </svg>
              Bản dịch
            </button>
            <button
              class={`lt-seg-btn ${viewMode === 'original' ? 'active' : ''}`}
              onClick={() => setViewMode('original')}
              title="Chỉ hiển thị bản gốc"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
              Bản gốc
            </button>
          </div>

          {/* Split Ratio Presets (Bilingual mode) */}
          {viewMode === 'bilingual' && (
            <div class="lt-segmented-group" title="Tỉ lệ chia màn hình (Gốc : Bảng dịch)">
              <button
                class={`lt-seg-btn ${Math.abs(splitRatio - 0.5) < 0.03 ? 'active' : ''}`}
                onClick={() => setSplitRatio(0.5)}
                title="Chia đều 50:50"
              >
                50:50
              </button>
              <button
                class={`lt-seg-btn ${Math.abs(splitRatio - 0.35) < 0.03 ? 'active' : ''}`}
                onClick={() => setSplitRatio(0.35)}
                title="Mở rộng 35:65 (Khuyên dùng cho tiếng Việt)"
              >
                35:65
              </button>
              <button
                class={`lt-seg-btn ${Math.abs(splitRatio - 0.3) < 0.03 ? 'active' : ''}`}
                onClick={() => setSplitRatio(0.3)}
                title="Tập trung bản dịch 30:70"
              >
                30:70
              </button>
            </div>
          )}

          {/* Segmented Reader Style */}
          <div class="lt-segmented-group" title="Phong cách hiển thị">
            <button
              class={`lt-seg-btn ${readerMode === 'whiteboard' ? 'active' : ''}`}
              onClick={() => setReaderMode('whiteboard')}
              title="Bảng trắng Canvas độc lập (Giữ nguyên tọa độ & công thức)"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect width="7" height="7" x="3" y="3" rx="1"/>
                <rect width="7" height="7" x="14" y="3" rx="1"/>
                <rect width="7" height="7" x="14" y="14" rx="1"/>
                <rect width="7" height="7" x="3" y="14" rx="1"/>
              </svg>
              Bảng trắng
            </button>
            <button
              class={`lt-seg-btn ${readerMode === 'overlay' ? 'active' : ''}`}
              onClick={() => setReaderMode('overlay')}
              title="Đè lớp chữ lên PDF gốc"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="12 2 2 7 12 12 22 7 12 2"/>
                <polyline points="2 17 12 22 22 17"/>
                <polyline points="2 12 12 17 22 12"/>
              </svg>
              Overlay
            </button>
            <button
              class={`lt-seg-btn ${readerMode === 'markdown' ? 'active' : ''}`}
              onClick={() => setReaderMode('markdown')}
              title="Dòng chảy tài liệu Markdown"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="21" y1="6" x2="3" y2="6"/>
                <line x1="15" y1="12" x2="3" y2="12"/>
                <line x1="17" y1="18" x2="3" y2="18"/>
              </svg>
              Markdown
            </button>
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
            onClick={() => setScale((s) => Math.max(0.5, Math.round((s - 0.15) * 100) / 100))}
          >
            −
          </button>
          <select
            class="lt-select"
            value={scale}
            onChange={(e) => setScale(parseFloat((e.target as HTMLSelectElement).value))}
          >
            <option value="0.75">75%</option>
            <option value="0.9">90%</option>
            <option value="1.0">100%</option>
            <option value="1.15">115%</option>
            <option value="1.25">125%</option>
            <option value="1.5">150%</option>
          </select>
          <button
            class="lt-btn"
            title="Phóng to"
            onClick={() => setScale((s) => Math.min(2.5, Math.round((s + 0.15) * 100) / 100))}
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
            class="lt-btn"
            onClick={resetAllLayouts}
            title="Đặt lại vị trí/kích thước tất cả components về y hệt paper"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="1 4 1 10 7 10"/>
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
            </svg>
            Bố cục
          </button>
          <button
            class="lt-btn"
            title="Tải về hoặc in trang"
            onClick={() => window.print()}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"/>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect width="12" height="8" x="6" y="14"/>
            </svg>
            In
          </button>
          <button
            class="lt-btn lt-btn-primary"
            title="Mở bảng Cài đặt (Model AI, API Key, Thinking mode)"
            onClick={() => setIsSettingsOpen(true)}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            Cài đặt
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
                <select
                  class="lt-setting-select"
                  value={pendingProvider}
                  onChange={(e) => {
                    const p = (e.target as HTMLSelectElement).value as PdfProvider;
                    setPendingProvider(p);
                    setPendingModel(DEFAULT_PDF_MODEL[p]);
                  }}
                >
                  <option value="gemini">Google Gemini (Mặc định, ổn định)</option>
                  <option value="zen">OpenCode Zen (Dự phòng SOTA)</option>
                </select>
              </div>

              {/* Model */}
              <div class="lt-setting-field">
                <label class="lt-setting-label">Mô hình AI (Model)</label>
                <div class="lt-setting-desc">
                  {pendingProvider === 'gemini'
                    ? 'Khuyên dùng gemini-2.5-flash-lite để dịch nhanh và mượt'
                    : 'Các model mã nguồn mở hoặc thương mại hỗ trợ qua Zen API'}
                </div>
                <select
                  class="lt-setting-select"
                  value={pendingModel}
                  onChange={(e) => setPendingModel((e.target as HTMLSelectElement).value)}
                >
                  {(pendingProvider === 'gemini' ? PDF_GEMINI_MODELS : PDF_ZEN_MODELS).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* API Keys */}
              <div class="lt-setting-field">
                <label class="lt-setting-label">
                  <span>Google Gemini API Key</span>
                  {geminiKeyInput ? <span style={{ color: '#4ade80', fontSize: '11px' }}>● Đã cấu hình</span> : null}
                </label>
                <input
                  type="password"
                  class="lt-setting-input"
                  placeholder="AIzaSy..."
                  value={geminiKeyInput}
                  onInput={(e) => setGeminiKeyInput((e.target as HTMLInputElement).value)}
                />
              </div>

              <div class="lt-setting-field">
                <label class="lt-setting-label">
                  <span>OpenCode Zen API Key</span>
                  {zenKeyInput ? <span style={{ color: '#4ade80', fontSize: '11px' }}>● Đã cấu hình</span> : null}
                </label>
                <input
                  type="password"
                  class="lt-setting-input"
                  placeholder="zen_..."
                  value={zenKeyInput}
                  onInput={(e) => setZenKeyInput((e.target as HTMLInputElement).value)}
                />
              </div>

              {/* Reset Layouts & Caches in settings */}
              <div class="lt-setting-field" style={{ borderTop: '1px solid #27272a', paddingTop: '14px' }}>
                <label class="lt-setting-label">Bố cục & Bộ nhớ tạm</label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <button
                    class="lt-btn"
                    style={{ flex: 1 }}
                    onClick={() => {
                      resetAllLayouts();
                      alert('Đã khôi phục bố cục tất cả components về vị trí gốc!');
                    }}
                  >
                    ⟲ Đặt lại bố cục
                  </button>
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

      {/* MAIN CONTENT AREA */}
      <div class="lt-main">
        {/* SIDEBAR THUMBNAILS */}
        <aside class={`lt-sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
          {Array.from({ length: numPages }).map((_, idx) => {
            const pno = idx + 1;
            return (
              <div
                key={pno}
                class={`lt-thumb-item ${currentPage === pno ? 'active' : ''}`}
                onClick={() => scrollToPage(pno)}
              >
                <div class="lt-thumb-number">Trang {pno}</div>
              </div>
            );
          })}
        </aside>

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
                  scale={scale}
                  type="original"
                  blocks={pageBlocks[idx + 1] || []}
                  hoveredSentenceId={hoveredSentenceId}
                  onHoverSentence={setHoveredSentenceId}
                  onVisible={triggerPageTranslation}
                  status={pageStatus[idx + 1]}
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
                const target = e.currentTarget as Element;
                try {
                  target.setPointerCapture?.(e.pointerId);
                } catch {}

                const onPointerMove = (ev: PointerEvent) => {
                  if (!isDraggingSplitter.current) return;
                  const workspace = target.parentElement;
                  if (!workspace) return;
                  const rect = workspace.getBoundingClientRect();
                  const rawRatio = (ev.clientX - rect.left) / rect.width;
                  const clamped = Math.max(0.2, Math.min(0.8, rawRatio));
                  setSplitRatio(clamped);
                };

                const onPointerUp = (ev: PointerEvent) => {
                  isDraggingSplitter.current = false;
                  try {
                    target.releasePointerCapture?.(ev.pointerId);
                  } catch {}
                  window.removeEventListener('pointermove', onPointerMove);
                  window.removeEventListener('pointerup', onPointerUp);
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
              {Array.from({ length: numPages }).map((_, idx) => {
                const pno = idx + 1;
                if (readerMode === 'whiteboard') {
                  return (
                    <WhiteboardPageRenderer
                      key={pno}
                      pdfDoc={pdfDoc}
                      pageNumber={pno}
                      scale={scale}
                      blocks={pageTranslations[pno] || []}
                      hoveredSentenceId={hoveredSentenceId}
                      onHoverSentence={setHoveredSentenceId}
                      onVisible={triggerPageTranslation}
                      status={pageStatus[pno]}
                      untranslatedCount={pageUntranslated[pno] || 0}
                      onRetry={retryPage}
                    />
                  );
                }
                if (readerMode === 'markdown') {
                  return (
                    <MarkdownPageRenderer
                      key={pno}
                      pageNumber={pno}
                      blocks={pageTranslations[pno] || []}
                      hoveredSentenceId={hoveredSentenceId}
                      onHoverSentence={setHoveredSentenceId}
                      onVisible={triggerPageTranslation}
                      status={pageStatus[pno]}
                      untranslatedCount={pageUntranslated[pno] || 0}
                      onRetry={retryPage}
                    />
                  );
                }
                return (
                  <PageRenderer
                    key={pno}
                    pdfDoc={pdfDoc}
                    pageNumber={pno}
                    scale={scale}
                    type="translated"
                    blocks={pageTranslations[pno] || []}
                    hoveredSentenceId={hoveredSentenceId}
                    onHoverSentence={setHoveredSentenceId}
                    onVisible={triggerPageTranslation}
                    status={pageStatus[pno]}
                    untranslatedCount={pageUntranslated[pno] || 0}
                    onRetry={retryPage}
                    docUrl={pdfUrl}
                    layoutResetSignal={layoutResetSignal}
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
  type: 'original' | 'translated';
  blocks: (TextBlock | TranslatedBlock)[];
  hoveredSentenceId: string | null;
  onHoverSentence: (id: string | null) => void;
  onVisible: (pageNumber: number) => void;
  status?: 'loading' | 'done' | 'error';
  untranslatedCount?: number;
  onRetry?: (pageNumber: number) => void;
  /** URL PDF (để lưu layout component) + tín hiệu reset bố cục. */
  docUrl?: string;
  layoutResetSignal?: number;
}

/** Ghi đè vị trí/kích thước component do user kéo-thả (cộng thêm sau reflow). */
export interface BlockLayoutOverride {
  dx: number;
  dy: number;
  /** Chiều rộng custom (px, css) — undefined = theo bbox gốc. */
  w?: number;
}

function loadPageLayout(docUrl: string, pageNumber: number): Record<string, BlockLayoutOverride> {
  try {
    const raw = sessionStorage.getItem(`live_trans_layout_${docUrl}_p${pageNumber}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, BlockLayoutOverride>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function PageRenderer({
  pdfDoc,
  pageNumber,
  scale,
  type,
  blocks,
  hoveredSentenceId,
  onHoverSentence,
  onVisible,
  status,
  untranslatedCount,
  onRetry,
  docUrl,
  layoutResetSignal,
}: PageRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 612,
    height: 792,
  });
  // P0: chỉ raster canvas khi trang vào viewport (tiết kiệm CPU/RAM trên PC mở nhiều trang)
  const [isVisible, setIsVisible] = useState<boolean>(false);
  // Reflow: chiều cao tự nhiên của từng block dịch (đo từ DOM) để push-down.
  const [natHeights, setNatHeights] = useState<Record<string, number>>({});

  const reportHeight = useCallback((id: string, h: number) => {
    setNatHeights((prev) => (prev[id] === h ? prev : { ...prev, [id]: h }));
  }, []);

  // Chỉ pane dịch mới reflow; pane gốc giữ khớp canvas tuyệt đối.
  const reflow = useMemo(
    () =>
      type === 'translated'
        ? computeReflowOffsets(blocks, scale, natHeights)
        : { offsets: {} as Record<string, number>, extraHeight: 0 },
    [type, blocks, scale, natHeights],
  );

  // Layout component do user kéo-thả (chỉ pane dịch) — cộng thêm sau reflow.
  const layoutEnabled = type === 'translated' && !!docUrl;
  const [layoutOv, setLayoutOv] = useState<Record<string, BlockLayoutOverride>>(() =>
    layoutEnabled && docUrl ? loadPageLayout(docUrl, pageNumber) : {},
  );
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);

  // Reset bố cục từ toolbar: xoá state + storage.
  useEffect(() => {
    if (!layoutEnabled || !docUrl || !layoutResetSignal) return;
    setLayoutOv({});
    setSelectedBlock(null);
    try {
      sessionStorage.removeItem(`live_trans_layout_${docUrl}_p${pageNumber}`);
    } catch {
      /* ignore */
    }
  }, [layoutResetSignal, layoutEnabled, docUrl, pageNumber]);

  const moveBlock = useCallback(
    (id: string, dx: number, dy: number) => {
      if (!layoutEnabled) return;
      setLayoutOv((prev) => {
        const cur = prev[id] || { dx: 0, dy: 0 };
        const next = { ...prev, [id]: { ...cur, dx: Math.round(dx), dy: Math.round(dy) } };
        if (docUrl) {
          try {
            sessionStorage.setItem(
              `live_trans_layout_${docUrl}_p${pageNumber}`,
              JSON.stringify(next),
            );
          } catch {
            /* ignore */
          }
        }
        return next;
      });
    },
    [layoutEnabled, docUrl, pageNumber],
  );

  const resizeBlock = useCallback(
    (id: string, w: number) => {
      if (!layoutEnabled) return;
      setLayoutOv((prev) => {
        const cur = prev[id] || { dx: 0, dy: 0 };
        const next = { ...prev, [id]: { ...cur, w: Math.max(60, Math.round(w)) } };
        if (docUrl) {
          try {
            sessionStorage.setItem(
              `live_trans_layout_${docUrl}_p${pageNumber}`,
              JSON.stringify(next),
            );
          } catch {
            /* ignore */
          }
        }
        return next;
      });
    },
    [layoutEnabled, docUrl, pageNumber],
  );

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
        height: `${dimensions.height + reflow.extraHeight}px`,
      }}
    >
      {/* Background canvas (images, vectors, math formulas) */}
      <canvas ref={canvasRef} class="lt-page-canvas" />

      {/* Translation loading status badge */}
      {type === 'translated' && (
        <div class="lt-page-status-wrap">
          {status === 'loading' && (
            <div class="lt-page-status lt-status-loading">
              <div class="lt-spinner" /> Đang dịch trang {pageNumber}...
            </div>
          )}
          {status === 'done' && (untranslatedCount || 0) === 0 && (
            <div class="lt-page-status lt-status-done">✓ Đã dịch trang {pageNumber}</div>
          )}
          {status === 'done' && (untranslatedCount || 0) > 0 && (
            <div class="lt-page-status lt-status-loading">
              ⚠ Trang {pageNumber}: còn {untranslatedCount} đoạn gốc
            </div>
          )}
          {status === 'error' && (
            <div class="lt-page-status lt-status-error">
              ⚠ Lỗi dịch trang {pageNumber}
              <button
                class="lt-retry-btn"
                style={{ pointerEvents: 'auto' }}
                onClick={() => onRetry?.(pageNumber)}
              >
                Thử lại
              </button>
            </div>
          )}
        </div>
      )}

      {/* Overlay text blocks with Precision Sentence-Level Hover Tracking (Ảnh 2 & 4) */}
      {/* Reflow + Component: block dịch là component kéo-thả/resize được, chữ re-wrap */}
      <div class="lt-overlay-layer">
        {blocks.map((b, order) => {
          const ov = layoutOv[b.id];
          return (
            <FlowBlock
              key={b.id}
              b={b}
              scale={scale}
              type={type}
              offsetY={reflow.offsets[b.id] || 0}
              dx={ov?.dx || 0}
              dy={ov?.dy || 0}
              customW={ov?.w}
              zOrder={order}
              selected={selectedBlock === b.id}
              movable={layoutEnabled && !b.isFormula}
              hoveredSentenceId={hoveredSentenceId}
              onHoverSentence={onHoverSentence}
              onMeasure={type === 'translated' ? reportHeight : undefined}
              onSelect={setSelectedBlock}
              onMove={moveBlock}
              onResizeW={resizeBlock}
            />
          );
        })}
      </div>
    </div>
  );
}

/* computeReflowOffsets nằm ở @/lib/pdf/reflow (pure, có unit test riêng). */

interface FlowBlockProps {
  b: TextBlock | TranslatedBlock;
  scale: number;
  type: 'original' | 'translated';
  /** Độ đẩy xuống do các block cùng cột phía trên nở ra (reflow). */
  offsetY: number;
  /** Ghi đè vị trí do user kéo (cộng thêm sau reflow). */
  dx: number;
  dy: number;
  /** Chiều rộng custom do user resize (undefined = theo bbox gốc). */
  customW?: number;
  /** Thứ tự vẽ (block sau đè block trước khi user cố tình chồng). */
  zOrder: number;
  selected: boolean;
  /** Chỉ pane dịch (trừ formula keep-out) mới kéo-thả được. */
  movable: boolean;
  hoveredSentenceId: string | null;
  onHoverSentence: (id: string | null) => void;
  /** Báo chiều cao tự nhiên về parent (chỉ pane dịch). */
  onMeasure?: (id: string, naturalHeight: number) => void;
  onSelect: (id: string | null) => void;
  onMove: (id: string, dx: number, dy: number) => void;
  onResizeW: (id: string, w: number) => void;
}

/**
 * Component dịch: mặc định xếp y hệt paper (bbox gốc + reflow push-down),
 * user kéo tay cầm ⠿ để di chuyển tự do, kéo góc ◢ để đổi rộng (chữ re-wrap,
 * reflow tự tính lại — không bao giờ tràn/đè mặc định).
 */
function FlowBlock({
  b,
  scale,
  type,
  offsetY,
  dx,
  dy,
  customW,
  zOrder,
  selected,
  movable,
  hoveredSentenceId,
  onHoverSentence,
  onMeasure,
  onSelect,
  onMove,
  onResizeW,
}: FlowBlockProps) {
  const ref = useRef<HTMLDivElement>(null);

  const [bx, by, bw, bh] = b.bbox;
  const left = bx * scale;
  const top = by * scale;
  const width = bw * scale;
  const height = bh * scale;

  const isTranslated = type === 'translated';
  const isFormula = b.isFormula;
  const isAlgorithm = b.isAlgorithm;
  const isHeader = b.isHeader;
  const isHeading = b.isHeading;
  const isFootnote = b.isFootnote;

  // Cỡ chữ gốc (không co): footnote/algo hơi nhỏ hơn như bản gốc.
  const baseFontSize = isFootnote
    ? Math.max(7.2, (b.fontSize || 7.5) * scale * 0.95)
    : isAlgorithm
      ? Math.max(7.5, (b.fontSize || 8.5) * scale * 0.92)
      : Math.max(7.2, (b.fontSize || 9.5) * scale);
  const computedLineHeight = isFootnote ? 1.2 : isAlgorithm ? 1.3 : 1.24;

  const isAbstract = b.text.trim().toLowerCase() === 'abstract';

  const sentenceItems =
    b.sentences && b.sentences.length > 0
      ? b.sentences
      : [{ id: b.id, text: b.text, translation: (b as TranslatedBlock).translation }];

  // B1: đo liên tục bằng ResizeObserver (thay effect đo 1 lần).
  // - Tự bắn lại khi layout đổi: font swap (Times fallback → font thật, KaTeX),
  //   zoom, bản dịch về muộn, trang vào viewport, user resize rộng.
  // - Quan sát content-box (kích thước), còn top/offsetY đổi không gây vòng lặp.
  const transText = (b as TranslatedBlock).translation || b.text;
  const boxWidth = customW ?? width;
  useEffect(() => {
    if (!onMeasure) return;
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    const report = () => {
      if (!cancelled) onMeasure(b.id, el.scrollHeight);
    };
    report();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(report);
      ro.observe(el);
    }
    if (document.fonts?.ready) {
      document.fonts.ready.then(report).catch(() => {});
    }
    return () => {
      cancelled = true;
      ro?.disconnect();
    };
  }, [b.id, transText, baseFontSize, boxWidth, onMeasure]);

  // Kéo-thả component bằng tay cầm (pointer capture, theo css px của trang).
  const startDrag = (e: PointerEvent) => {
    if (!movable) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect(b.id);
    const handle = e.currentTarget as Element;
    handle.setPointerCapture?.(e.pointerId);
    const sx = e.clientX;
    const sy = e.clientY;
    const ox = dx;
    const oy = dy;
    const move = (ev: PointerEvent) => {
      onMove(b.id, ox + (ev.clientX - sx), oy + (ev.clientY - sy));
    };
    const up = () => {
      handle.removeEventListener('pointermove', move as EventListener);
      handle.removeEventListener('pointerup', up as EventListener);
      handle.removeEventListener('pointercancel', up as EventListener);
    };
    handle.addEventListener('pointermove', move as EventListener);
    handle.addEventListener('pointerup', up as EventListener);
    handle.addEventListener('pointercancel', up as EventListener);
  };

  // Resize rộng: chữ re-wrap → ResizeObserver đo lại → reflow tự tính lại.
  const startResize = (e: PointerEvent) => {
    if (!movable) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect(b.id);
    const handle = e.currentTarget as Element;
    handle.setPointerCapture?.(e.pointerId);
    const sx = e.clientX;
    const startW = customW ?? width;
    const move = (ev: PointerEvent) => {
      onResizeW(b.id, startW + (ev.clientX - sx));
    };
    const up = () => {
      handle.removeEventListener('pointermove', move as EventListener);
      handle.removeEventListener('pointerup', up as EventListener);
      handle.removeEventListener('pointercancel', up as EventListener);
    };
    handle.addEventListener('pointermove', move as EventListener);
    handle.addEventListener('pointerup', up as EventListener);
    handle.addEventListener('pointercancel', up as EventListener);
  };

  return (
    <div
      ref={ref}
      data-block-id={b.id}
      class={`lt-block ${isTranslated ? 'lt-block-trans' : 'lt-block-orig'} ${
        isFormula ? 'lt-block-formula' : ''
      } ${isHeader ? 'lt-block-header' : ''} ${isHeading ? 'lt-block-heading' : ''} ${
        isFootnote ? 'lt-block-footnote' : ''
      } ${isAlgorithm ? 'lt-block-algo' : ''} ${selected ? 'lt-block-selected' : ''} ${
        movable ? 'lt-block-movable' : ''
      }`}
      style={{
        left: `${left + dx}px`,
        top: `${top + offsetY + dy}px`,
        width: `${boxWidth}px`,
        minHeight: isHeader || isFootnote ? undefined : `${Math.round(height)}px`,
        fontSize: `${baseFontSize}px`,
        lineHeight: computedLineHeight,
        fontWeight: isHeading ? 700 : b.bold ? 650 : 400,
        textAlign: isFormula
          ? 'center'
          : isAbstract
            ? 'center'
            : isHeading || isHeader || isFootnote || isAlgorithm
              ? 'left'
              : 'justify',
        overflow: 'visible',
        opacity: isFormula ? 0 : 1,
        pointerEvents: isFormula ? 'none' : 'auto',
        background: isFormula ? 'transparent' : undefined,
        zIndex: selected ? 30 : 10 + Math.min(zOrder, 18),
      }}
      onClick={() => {
        if (movable) onSelect(selected ? null : b.id);
      }}
    >
      {movable && (
        <span
          class="lt-drag-handle"
          title="Kéo để di chuyển component"
          onPointerDown={startDrag}
          onClick={(e) => e.stopPropagation()}
        >
          ⠿
        </span>
      )}
      {movable && (
        <span
          class="lt-resize-handle"
          title="Kéo để đổi rộng (chữ tự giãn dòng)"
          onPointerDown={startResize}
          onClick={(e) => e.stopPropagation()}
        >
          ◢
        </span>
      )}
      {isFormula && isTranslated ? (
        // Formula Keep-Out Zone: Transparent overlay lets canvas math vector show cleanly
        <span style={{ opacity: 0 }}>{b.text}</span>
      ) : isTranslated ? (
        // Render sentences with inline hover tracking on translated text
        sentenceItems.map((s) => {
          const isActive = hoveredSentenceId === s.id;
          const sText = s.translation || s.text;
          return (
            <span
              key={s.id}
              data-sentence-id={s.id}
              class={`lt-sentence ${isActive ? 'lt-sentence-active' : ''}`}
              onMouseEnter={() => onHoverSentence(s.id)}
              onMouseLeave={() => onHoverSentence(null)}
            >
              {sText}{' '}
            </span>
          );
        })
      ) : (
        // Render transparent sentence overlays on original canvas text to detect hover
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

/* renderTextWithMath + KatexFormula dùng chung cho Markdown/Overlay. */
function renderTextWithMath(text: string) {
  if (!text) return null;
  const parts = text.split(/(\$[^$]+\$)/g);
  return parts.map((part, i) => {
    if (part.startsWith('$') && part.endsWith('$')) {
      const mathContent = part.slice(1, -1);
      return (
        <span key={i} class="lt-inline-math">
          {mathContent}
        </span>
      );
    }
    return part;
  });
}

/**
 * P1 — KaTeX lazy cho display-equation (chỉ tải chunk ~280KB khi trang có công thức
 * vào viewport; throwOnError:false nên pseudo-LaTeX từ PDF vẫn hiện phần render được,
 * fallback text nghiêng khi KaTeX lỗi/offline).
 */
function KatexFormula({ latex }: { latex: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const katex = (await import('katex')).default;
        if (!active || !ref.current) return;
        katex.render(latex, ref.current, { displayMode: true, throwOnError: false, strict: false });
      } catch {
        if (active) setFailed(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [latex]);

  if (failed) {
    return <div class="lt-formula-content lt-formula-fallback">{latex}</div>;
  }
  return <div ref={ref} class="lt-formula-content" />;
}

interface MarkdownPageRendererProps {
  pageNumber: number;
  blocks: TranslatedBlock[];
  hoveredSentenceId: string | null;
  onHoverSentence: (id: string | null) => void;
  onVisible: (pageNumber: number) => void;
  status?: 'loading' | 'done' | 'error';
  untranslatedCount?: number;
  onRetry?: (pageNumber: number) => void;
}

function MarkdownPageRenderer({
  pageNumber,
  blocks,
  hoveredSentenceId,
  onHoverSentence,
  onVisible,
  status,
  untranslatedCount,
  onRetry,
}: MarkdownPageRendererProps) {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting) {
          onVisible(pageNumber);
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [pageNumber, onVisible]);

  const elements = blocksToMarkdownElements(blocks);

  return (
    <article ref={containerRef} class="lt-markdown-page" data-page-number={pageNumber}>
      <div class="lt-markdown-page-header">
        <span class="lt-page-tag">Trang {pageNumber}</span>
        {status === 'done' && (untranslatedCount || 0) === 0 && (
          <span class="lt-status-badge lt-status-done">✓ Bản dịch tiếng Việt</span>
        )}
        {status === 'done' && (untranslatedCount || 0) > 0 && (
          <span class="lt-status-badge lt-status-loading">⚠ Còn {untranslatedCount} đoạn gốc</span>
        )}
        {status === 'error' && (
          <span class="lt-status-badge lt-status-error">
            ⚠ Lỗi dịch{' '}
            <button class="lt-retry-btn" onClick={() => onRetry?.(pageNumber)}>
              Thử lại
            </button>
          </span>
        )}
        {status === 'loading' && <span class="lt-status-badge lt-status-loading">⏳ Đang dịch trang {pageNumber}...</span>}
      </div>

      <div class="lt-markdown-body">
        {elements.map((el) => {
          if (el.type === 'heading') {
            const HeadingTag = el.level === 1 ? 'h1' : el.level === 2 ? 'h2' : 'h3';
            const sentence = el.sentences?.[0];
            const sId = sentence?.id || el.id;
            const text = sentence?.translation || sentence?.text || el.text;
            const isActive = hoveredSentenceId === sId;

            return (
              <HeadingTag
                key={el.id}
                class={`lt-md-heading ${isActive ? 'lt-sentence-active' : ''}`}
                onMouseEnter={() => onHoverSentence(sId)}
                onMouseLeave={() => onHoverSentence(null)}
              >
                {renderTextWithMath(text)}
              </HeadingTag>
            );
          }

          if (el.type === 'formula') {
            return (
              <div key={el.id} class="lt-md-formula">
                <KatexFormula latex={el.text} />
                {el.equationNumber && <div class="lt-formula-number">{el.equationNumber}</div>}
              </div>
            );
          }

          if (el.type === 'algorithm') {
            return (
              <div key={el.id} class="lt-md-algorithm">
                <div class="lt-algo-header">⚙️ Hộp Thuật toán</div>
                <pre class="lt-algo-content">
                  {el.sentences?.map((s) => s.translation || s.text).join('\n') || el.text}
                </pre>
              </div>
            );
          }

          if (el.type === 'footnote') {
            return (
              <div key={el.id} class="lt-md-footnote">
                <hr class="lt-footnote-sep" />
                <p class="lt-footnote-text">
                  {el.sentences?.map((s) => s.translation || s.text).join(' ') || el.text}
                </p>
              </div>
            );
          }

          // Paragraph
          const sentences = el.sentences && el.sentences.length > 0 ? el.sentences : [{ id: el.id, text: el.text }];
          return (
            <p key={el.id} class="lt-md-paragraph">
              {sentences.map((s) => {
                const isActive = hoveredSentenceId === s.id;
                const sText = s.translation || s.text;
                return (
                  <span
                    key={s.id}
                    data-sentence-id={s.id}
                    class={`lt-sentence ${isActive ? 'lt-sentence-active' : ''}`}
                    onMouseEnter={() => onHoverSentence(s.id)}
                    onMouseLeave={() => onHoverSentence(null)}
                  >
                    {renderTextWithMath(sText)}{' '}
                  </span>
                );
              })}
            </p>
          );
        })}
      </div>
    </article>
  );
}

render(<ViewerApp />, document.getElementById('app')!);
