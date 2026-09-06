import { useEffect, useRef, useState, useMemo } from 'preact/hooks';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { TranslatedBlock, SentenceItem } from '@/lib/pdf/types';
import { wrapInlineMath } from '@/lib/pdf/markdown';
import katex from 'katex';

interface InlineKatexProps {
  math: string;
}

function InlineKatex({ math }: InlineKatexProps) {
  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!spanRef.current) return;
    try {
      katex.render(math, spanRef.current, {
        displayMode: false,
        throwOnError: false,
        strict: false,
      });
    } catch {
      if (spanRef.current) spanRef.current.textContent = math;
    }
  }, [math]);

  return <span ref={spanRef} class="lt-inline-math" />;
}

function renderFormattedSentence(text: string) {
  if (!text) return null;
  const withMath = wrapInlineMath(text);
  const parts = withMath.split(/(\$[^$]+\$)/g);

  return parts.map((part, idx) => {
    if (part.startsWith('$') && part.endsWith('$')) {
      const math = part.slice(1, -1);
      return <InlineKatex key={idx} math={math} />;
    }
    return part;
  });
}

interface PdfSnippetProps {
  pdfDoc: PDFDocumentProxy;
  pageNumber: number;
  bbox: [number, number, number, number];
  alt?: string;
}

// Cached rendered PDF page canvases for ultra-fast snippet extraction
const pdfPageCanvasCache = new Map<string, HTMLCanvasElement>();

function PdfSnippet({ pdfDoc, pageNumber, bbox, alt = 'Equation or Figure' }: PdfSnippetProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bboxKey = bbox.join(',');

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const scale = 2.0; // 2x HiDPI
        const cacheKey = `${(pdfDoc as any).fingerprint || 'doc'}_p${pageNumber}_s${scale}`;

        let offCanvas = pdfPageCanvasCache.get(cacheKey);
        if (!offCanvas) {
          const page = await pdfDoc.getPage(pageNumber);
          if (!active) return;
          const vp = page.getViewport({ scale });

          offCanvas = document.createElement('canvas');
          offCanvas.width = Math.floor(vp.width);
          offCanvas.height = Math.floor(vp.height);
          const ctx = offCanvas.getContext('2d');
          if (!ctx) return;

          await (page.render as any)({
            canvasContext: ctx,
            viewport: vp,
          }).promise;
          if (!active) return;

          pdfPageCanvasCache.set(cacheKey, offCanvas);
        }

        const targetCanvas = canvasRef.current;
        if (!targetCanvas) return;

        const [bx, by, bw, bh] = bbox;
        const pad = 4;
        const sx = Math.max(0, Math.floor((bx - pad) * scale));
        const sy = Math.max(0, Math.floor((by - pad) * scale));
        const sw = Math.min(offCanvas.width - sx, Math.floor((bw + pad * 2) * scale));
        const sh = Math.min(offCanvas.height - sy, Math.floor((bh + pad * 2) * scale));

        if (sw <= 0 || sh <= 0) return;

        targetCanvas.width = sw;
        targetCanvas.height = sh;
        targetCanvas.style.width = `${Math.round(sw / scale)}px`;
        targetCanvas.style.height = `${Math.round(sh / scale)}px`;

        const tCtx = targetCanvas.getContext('2d');
        if (tCtx) {
          tCtx.drawImage(offCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
        }
      } catch (e) {
        console.warn('Failed to render PDF snippet:', e);
      }
    })();

    return () => {
      active = false;
    };
  }, [pdfDoc, pageNumber, bboxKey]);

  return (
    <div class="lt-snippet-container" title={alt}>
      <canvas ref={canvasRef} class="lt-snippet-canvas" />
    </div>
  );
}

export interface WhiteboardPageRendererProps {
  pdfDoc: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  blocks: TranslatedBlock[];
  hoveredSentenceId: string | null;
  onHoverSentence: (id: string | null) => void;
  onVisible: (pageNumber: number) => void;
  status?: 'loading' | 'done' | 'error';
  untranslatedCount?: number;
  onRetry?: (pageNumber: number) => void;
}

export function WhiteboardPageRenderer({
  pdfDoc,
  pageNumber,
  scale = 1.0,
  blocks,
  hoveredSentenceId,
  onHoverSentence,
  onVisible,
  status,
  untranslatedCount,
  onRetry,
}: WhiteboardPageRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 612 * scale,
    height: 792 * scale,
  });

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (!active) return;
        const vp = page.getViewport({ scale });
        setDimensions({ width: vp.width, height: vp.height });
      } catch (e) {
        console.warn('Failed to load page viewport:', e);
      }
    })();
    return () => {
      active = false;
    };
  }, [pdfDoc, pageNumber, scale]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          onVisible(pageNumber);
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [pageNumber, onVisible]);

  // Group blocks by structural components
  const {
    headerBlock,
    titleBlocks,
    authorsBlocks,
    abstractBlock,
    col1Blocks,
    col2Blocks,
    fullWidthBlocks,
    footnoteBlocks,
  } = useMemo(() => {
    let header: TranslatedBlock | null = null;
    const titles: TranslatedBlock[] = [];
    const authors: TranslatedBlock[] = [];
    let abstract: TranslatedBlock | null = null;
    const col1: TranslatedBlock[] = [];
    const col2: TranslatedBlock[] = [];
    const fullWidth: TranslatedBlock[] = [];
    const footnotes: TranslatedBlock[] = [];

    for (const b of blocks) {
      if (b.isHeader || b.componentType === 'header') {
        header = b;
        continue;
      }
      if (b.isFootnote || b.componentType === 'footnote') {
        footnotes.push(b);
        continue;
      }

      if (pageNumber === 1) {
        if (b.componentType === 'title' || (b.bbox[1] < 140 && (b.fontSize || 0) >= 12)) {
          titles.push(b);
          continue;
        }
        if (b.componentType === 'authors') {
          authors.push(b);
          continue;
        }
        if (b.componentType === 'abstract' || b.text.trim().toLowerCase().startsWith('abstract')) {
          // Only pull to header if full-width single-column paper
          if ((b.col === 0 || b.bbox[2] > 320) && !abstract) {
            abstract = b;
            continue;
          }
        }
      }

      if (b.col === 1) {
        col1.push(b);
      } else if (b.col === 2) {
        col2.push(b);
      } else {
        fullWidth.push(b);
      }
    }

    return {
      headerBlock: header,
      titleBlocks: titles,
      authorsBlocks: authors,
      abstractBlock: abstract,
      col1Blocks: col1,
      col2Blocks: col2,
      fullWidthBlocks: fullWidth,
      footnoteBlocks: footnotes,
    };
  }, [blocks, pageNumber]);

  const renderSentences = (b: TranslatedBlock, stripAbstractPrefix = false) => {
    const sentences = b.sentences && b.sentences.length > 0 ? b.sentences : [{ id: b.id, text: b.text, translation: b.translation }];

    return sentences.map((s, idx) => {
      const isActive = hoveredSentenceId === s.id;
      let textToRender = s.translation || s.text;
      if (stripAbstractPrefix && idx === 0) {
        textToRender = textToRender.replace(/^(tóm tắt|abstract)[:.\s-]*/i, '').trim();
      }

      return (
        <span
          key={s.id}
          data-sentence-id={s.id}
          class={`lt-sentence ${isActive ? 'lt-sentence-active' : ''}`}
          onMouseEnter={() => onHoverSentence(s.id)}
          onMouseLeave={() => onHoverSentence(null)}
        >
          {renderFormattedSentence(textToRender)}{' '}
        </span>
      );
    });
  };

  const renderComponentBlock = (b: TranslatedBlock) => {
    // 0. Abstract in Column
    if (b.componentType === 'abstract' || /^(abstract|tóm tắt)\b/i.test(b.text.trim())) {
      if (b.text.trim().length <= 15 && /^(abstract|tóm tắt)$/i.test(b.text.trim())) {
        return null;
      }
      return (
        <div key={b.id} class="lt-wb-component lt-wb-abstract-box">
          <div class="lt-wb-abstract-title">Tóm tắt</div>
          <div class="lt-wb-abstract-content">{renderSentences(b, true)}</div>
        </div>
      );
    }
    // 1. Display Equations
    if (b.isFormula || b.componentType === 'equation') {
      return (
        <div key={b.id} class="lt-wb-component lt-wb-equation">
          <PdfSnippet pdfDoc={pdfDoc} pageNumber={pageNumber} bbox={b.bbox} alt={`Công thức ${b.text}`} />
        </div>
      );
    }

    // 2. Algorithm Box (Rendered as 2x HiDPI Snippet from original paper!)
    if (b.isAlgorithm || b.componentType === 'algorithm') {
      return (
        <div key={b.id} class="lt-wb-component lt-wb-algorithm-box">
          <div class="lt-algo-header-tag">
            <span class="lt-algo-icon">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="16 18 22 12 16 6"/>
                <polyline points="8 6 2 12 8 18"/>
              </svg>
            </span>
            Hộp Thuật toán (Nguyên bản)
          </div>
          <PdfSnippet
            pdfDoc={pdfDoc}
            pageNumber={pageNumber}
            bbox={b.bbox}
            alt={b.text.slice(0, 100)}
          />
        </div>
      );
    }

    // 3. Section Heading
    if (b.isHeading || b.componentType === 'heading') {
      return (
        <h3 key={b.id} class="lt-wb-component lt-wb-heading">
          {renderSentences(b)}
        </h3>
      );
    }

    // 4. Figure Caption & Image Area
    if (b.componentType === 'figure_caption' || /^(figure|table)\s+\d+[:.]/i.test(b.text.trim())) {
      // In academic papers, the figure graphic sits right above its caption
      // Estimate figure image bounding box dynamically to avoid cutting top images
      const captionBbox = b.bbox;
      const figTop = Math.max(140, Math.min(captionBbox[1] - 460, 190));
      const figHeight = Math.max(120, captionBbox[1] - figTop);
      const figureImageBbox: [number, number, number, number] = [
        Math.max(20, captionBbox[0] - 25),
        figTop,
        Math.max(captionBbox[2] + 40, 260),
        figHeight,
      ];

      return (
        <div key={b.id} class="lt-wb-figure-container">
          <PdfSnippet
            pdfDoc={pdfDoc}
            pageNumber={pageNumber}
            bbox={figureImageBbox}
            alt="Hình vẽ từ tài liệu gốc"
          />
          <div class="lt-wb-figure-caption">{renderSentences(b)}</div>
        </div>
      );
    }

    // 5. Normal Body Paragraph
    return (
      <p key={b.id} class="lt-wb-component lt-wb-paragraph">
        {renderSentences(b)}
      </p>
    );
  };

  return (
    <div
      ref={containerRef}
      class="lt-whiteboard-page"
      data-page-number={pageNumber}
      style={{
        width: `${Math.round(dimensions.width)}px`,
        minWidth: `${Math.round(dimensions.width)}px`,
        maxWidth: `${Math.round(dimensions.width)}px`,
        height: `${Math.round(dimensions.height)}px`,
        minHeight: `${Math.round(dimensions.height)}px`,
        maxHeight: `${Math.round(dimensions.height)}px`,
        flexShrink: 0,
      }}
    >
      {/* STATUS BADGE */}
      <div class="lt-whiteboard-status-bar">
        <span class="lt-page-tag">Trang {pageNumber}</span>
        {status === 'loading' && (
          <span class="lt-status-badge lt-status-loading">
            <span class="lt-spinner" /> Đang dịch trang {pageNumber}...
          </span>
        )}
        {status === 'done' && (untranslatedCount || 0) === 0 && (
          <span class="lt-status-badge lt-status-done">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Bản dịch Bảng trắng hoàn tất
          </span>
        )}
        {status === 'done' && (untranslatedCount || 0) > 0 && (
          <span class="lt-status-badge lt-status-loading">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            Còn {untranslatedCount} đoạn gốc
          </span>
        )}
        {status === 'error' && (
          <span class="lt-status-badge lt-status-error">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            Lỗi dịch{' '}
            <button class="lt-retry-btn" onClick={() => onRetry?.(pageNumber)}>
              Thử lại
            </button>
          </span>
        )}
      </div>

      {/* RUNNING HEADER (Page 2+) */}
      {headerBlock && (
        <div class="lt-wb-running-header">
          {renderSentences(headerBlock)}
        </div>
      )}

      {/* PAPER HEADER (Page 1: Title, Authors, Abstract) */}
      {pageNumber === 1 && (
        <div class="lt-wb-paper-header">
          {titleBlocks.map((tb) => (
            <h1 key={tb.id} class="lt-wb-title">
              {renderSentences(tb)}
            </h1>
          ))}
          {authorsBlocks.length > 0 && (
            <div class="lt-wb-authors">
              {authorsBlocks.map((ab) => (
                <div key={ab.id} class="lt-wb-author-line">
                  {renderSentences(ab)}
                </div>
              ))}
            </div>
          )}
          {abstractBlock && (
            <div class="lt-wb-abstract-box">
              <div class="lt-wb-abstract-title">Tóm tắt</div>
              <div class="lt-wb-abstract-content">
                {renderSentences(abstractBlock, true)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* FULL-WIDTH TOP BLOCKS (if any) */}
      {fullWidthBlocks.length > 0 && (
        <div class="lt-wb-full-width">
          {fullWidthBlocks.map(renderComponentBlock)}
        </div>
      )}

      {/* TWO-COLUMN ACADEMIC BODY */}
      <div class="lt-wb-columns-wrap">
        <div class="lt-wb-col lt-wb-col-left">
          {col1Blocks.map(renderComponentBlock)}
        </div>
        <div class="lt-wb-col lt-wb-col-right">
          {col2Blocks.map(renderComponentBlock)}
        </div>
      </div>

      {/* FOOTNOTE SECTION AT BOTTOM */}
      {footnoteBlocks.length > 0 && (
        <div class="lt-wb-footnote-area">
          <hr class="lt-wb-footnote-line" />
          {footnoteBlocks.map((fn) => (
            <div key={fn.id} class="lt-wb-footnote-item">
              {renderSentences(fn)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
