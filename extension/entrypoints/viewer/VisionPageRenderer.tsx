import { useRef, useEffect, useState, useMemo } from 'preact/hooks';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import katex from 'katex';
import { extractPageFigures, extractTextBlocks, type DetectedFigure } from '@/lib/pdf/blocks';
import type { TextBlock } from '@/lib/pdf/types';
import { PdfSnippet } from './PdfSnippet';

export interface VisionPageRendererProps {
  pdfDoc?: PDFDocumentProxy;
  pageNumber: number;
  scale?: number;
  markdownText?: string;
  status?: 'loading' | 'done' | 'error' | 'queued';
  isPriority?: boolean;
  errorMsg?: string;
  blocks?: TextBlock[];
  onVisible: (pageNumber: number) => void;
  onRetry?: (pageNumber: number) => void;
}

export function VisionPageRenderer({
  pdfDoc,
  pageNumber,
  scale = 1.0,
  markdownText = '',
  status = 'loading',
  isPriority = false,
  errorMsg = '',
  blocks,
  onVisible,
  onRetry,
}: VisionPageRendererProps) {
  const containerRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Smooth Chained Wheel Scrolling: cuộn hết trong trang sẽ tự động cuộn sang trang kế tiếp mà không bị khựng
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
      if (maxScroll <= 0) {
        // Nội dung ngắn hơn khung trang: truyền thẳng sự kiện cuộn ra container cha
        const pane = el.closest<HTMLElement>('.lt-pane-right');
        if (pane) {
          pane.scrollTop += e.deltaY;
          e.preventDefault();
        }
        return;
      }

      if (e.deltaY > 0) {
        const remainingDown = maxScroll - el.scrollTop;
        if (remainingDown <= 1) {
          // Đã chạm đáy trang: cuộn tiếp container cha sang trang kế
          const pane = el.closest<HTMLElement>('.lt-pane-right');
          if (pane) {
            pane.scrollTop += e.deltaY;
            e.preventDefault();
          }
        } else if (e.deltaY > remainingDown) {
          // Cuộn hết phần còn lại của trang, phần dư chuyển tiếp sang container cha
          el.scrollTop = maxScroll;
          const pane = el.closest<HTMLElement>('.lt-pane-right');
          if (pane) {
            pane.scrollTop += (e.deltaY - remainingDown);
            e.preventDefault();
          }
        }
      } else if (e.deltaY < 0) {
        const remainingUp = el.scrollTop;
        if (remainingUp <= 1) {
          // Đã chạm đỉnh trang: cuộn ngược container cha lên trang trước
          const pane = el.closest<HTMLElement>('.lt-pane-right');
          if (pane) {
            pane.scrollTop += e.deltaY;
            e.preventDefault();
          }
        } else if (Math.abs(e.deltaY) > remainingUp) {
          el.scrollTop = 0;
          const pane = el.closest<HTMLElement>('.lt-pane-right');
          if (pane) {
            pane.scrollTop += (e.deltaY + remainingUp);
            e.preventDefault();
          }
        }
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Exact page dimensions to guarantee 1:1 vertical sync with left PDF page
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 612 * scale,
    height: 792 * scale,
  });
  const [detectedFigures, setDetectedFigures] = useState<DetectedFigure[]>([]);

  useEffect(() => {
    if (!pdfDoc) return;
    let active = true;

    void (async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (!active) return;
        const vp = page.getViewport({ scale });
        setDimensions({ width: vp.width, height: vp.height });

        // Extract layout figures from blocks or text content
        let pageBlocks = blocks;
        if (!pageBlocks || pageBlocks.length === 0) {
          const textContent = await page.getTextContent();
          if (!active) return;
          pageBlocks = extractTextBlocks(textContent.items as any, vp.width, vp.height, pageNumber);
        }

        const figs = extractPageFigures(pageBlocks, vp.width, pageNumber);
        if (active) {
          setDetectedFigures(figs);
        }
      } catch (err) {
        console.warn(`[VisionPageRenderer] Error calculating dimensions/figures for page ${pageNumber}:`, err);
      }
    })();

    return () => {
      active = false;
    };
  }, [pdfDoc, pageNumber, scale, blocks]);

  const figuresMap = useMemo(() => {
    const byNum = new Map<number, [number, number, number, number]>();
    for (const f of detectedFigures) {
      if (f.figNum !== undefined) {
        byNum.set(f.figNum, f.bbox);
      }
    }
    return byNum;
  }, [detectedFigures]);

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

  const handleCopy = async () => {
    if (!markdownText) return;
    try {
      await navigator.clipboard.writeText(markdownText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy markdown:', err);
    }
  };

  return (
    <article
      ref={containerRef}
      class="lt-vision-page"
      data-page-number={pageNumber}
      style={{
        width: `${Math.round(dimensions.width)}px`,
        minHeight: `${Math.round(dimensions.height)}px`,
        maxHeight: `${Math.round(dimensions.height)}px`,
      }}
    >
      {/* HEADER WITH STATUS & QUICK ACTIONS - PINNED */}
      <div class="lt-vision-header">
        <div class="lt-vision-header-left">
          <span class="lt-page-tag">Trang {pageNumber}</span>
          {status === 'loading' && (
            <span class="lt-status-badge lt-status-loading">
              <div class="lt-spinner" style={{ width: '11px', height: '11px', borderTopColor: '#38bdf8' }} />
              {isPriority ? `⚡ Đang ưu tiên dịch Trang ${pageNumber}...` : `Đang trích xuất & dịch Trang ${pageNumber}...`}
            </span>
          )}
          {status === 'queued' && isPriority && (
            <span class="lt-status-badge lt-status-priority" style={{ background: 'rgba(245, 158, 11, 0.18)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.35)' }}>
              <div class="lt-spinner" style={{ width: '11px', height: '11px', borderTopColor: '#d97706' }} />
              ⚡ Đã ưu tiên! Sẽ dịch ngay khi tiến trình hiện tại xong...
            </span>
          )}
          {status === 'queued' && !isPriority && (
            <span class="lt-status-badge lt-status-queued">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              Trong hàng đợi dịch ngầm...
            </span>
          )}
          {status === 'error' && (
            <span class="lt-status-badge lt-status-error">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Lỗi dịch trang{' '}
              <button class="lt-retry-btn" onClick={() => onRetry?.(pageNumber)}>
                Thử lại
              </button>
            </span>
          )}
          {status === 'done' && (
            <span class="lt-status-badge lt-status-done">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              Vision AI (LaTeX)
            </span>
          )}
        </div>

        <div class="lt-vision-header-actions">
          {!!markdownText && (
            <button
              class="lt-vision-btn"
              onClick={handleCopy}
              title="Sao chép toàn bộ văn bản Markdown & LaTeX trang này"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
              </svg>
              {copied ? 'Đã chép!' : 'Chép MD'}
            </button>
          )}
          <button
            class="lt-vision-btn"
            disabled={status === 'loading'}
            onClick={() => onRetry?.(pageNumber)}
            title="Dịch lại trang này (xóa bộ nhớ tạm và gọi lại AI)"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
            </svg>
            Dịch lại
          </button>
        </div>
      </div>

      {/* CONTENT BODY - INDEPENDENT INTERNAL SCROLL */}
      <div ref={bodyRef} class="lt-vision-body">
        {status === 'loading' || status === 'queued' ? (
          <div class="lt-vision-skeleton">
            {status === 'queued' && isPriority && (
              <div style={{ color: '#d97706', fontSize: '12px', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>⚡ Bạn đang xem trang này: Đã được đưa lên vị trí ưu tiên số 1, API sẽ bắt đầu xử lý ngay lập tức.</span>
              </div>
            )}
            {status === 'queued' && !isPriority && (
              <div style={{ color: '#6366f1', fontSize: '12px', fontWeight: 500, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>⏳ Đang chờ lượt dịch ngầm... Khi bạn dừng xem trang này, hệ thống sẽ lập tức ưu tiên dịch ngay.</span>
              </div>
            )}
            <div class="lt-vision-skeleton-line" style={{ width: '80%', height: '24px' }} />
            <div class="lt-vision-skeleton-line" style={{ width: '100%' }} />
            <div class="lt-vision-skeleton-line" style={{ width: '95%' }} />
            <div class="lt-vision-skeleton-line" style={{ width: '90%' }} />
            <div class="lt-vision-skeleton-line" style={{ width: '60%', height: '40px' }} />
            <div class="lt-vision-skeleton-line" style={{ width: '100%' }} />
          </div>
        ) : status === 'error' ? (
          <div class="lt-vision-error-box">
            <div class="lt-vision-error-icon">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <div class="lt-vision-error-title">Không thể dịch Trang {pageNumber}</div>
            <div class="lt-vision-error-desc">
              {errorMsg || 'Đã xảy ra lỗi khi gọi dịch vụ Multimodal Vision AI. Vui lòng kiểm tra lại cấu hình Gemini API Key hoặc hạn mức Quota.'}
            </div>
            <div class="lt-vision-error-actions">
              <button class="lt-btn lt-btn-primary" onClick={() => onRetry?.(pageNumber)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
                  <path d="M21 3v5h-5"/>
                </svg>
                Thử dịch lại trang này
              </button>
            </div>
          </div>
        ) : markdownText ? (
          <VisionMarkdownContent
            content={markdownText}
            pdfDoc={pdfDoc}
            pageNumber={pageNumber}
            figuresMap={figuresMap}
            detectedFigures={detectedFigures}
          />
        ) : null}
      </div>
    </article>
  );
}

interface VisionMarkdownContentProps {
  content: string;
  pdfDoc?: PDFDocumentProxy;
  pageNumber: number;
  figuresMap: Map<number, [number, number, number, number]>;
  detectedFigures: DetectedFigure[];
}

function VisionMarkdownContent({
  content,
  pdfDoc,
  pageNumber,
  figuresMap,
  detectedFigures,
}: VisionMarkdownContentProps) {
  const blocks = parseMarkdownIntoBlocks(content);
  let figureCount = 0;

  return (
    <div class="lt-vision-content-wrap">
      {blocks.map((b, idx) => {
        if (b.type === 'equation') {
          return <VisionDisplayEquation key={idx} latex={b.content} />;
        }
        if (b.type === 'algorithm') {
          return <VisionAlgorithmCard key={idx} block={b} />;
        }
        if (b.type === 'figure') {
          const currentFigIdx = figureCount++;
          return (
            <VisionFigureCard
              key={idx}
              block={b}
              pdfDoc={pdfDoc}
              pageNumber={pageNumber}
              figuresMap={figuresMap}
              detectedFigures={detectedFigures}
              figureIndex={currentFigIdx}
            />
          );
        }
        if (b.type === 'heading') {
          if (b.level === 1) return <h1 key={idx} class="lt-vision-h1"><VisionInlineText text={b.content} /></h1>;
          if (b.level === 2) return <h2 key={idx} class="lt-vision-h2"><VisionInlineText text={b.content} /></h2>;
          return <h3 key={idx} class="lt-vision-h3"><VisionInlineText text={b.content} /></h3>;
        }
        if (b.type === 'quote') {
          return (
            <blockquote key={idx} class="lt-vision-quote">
              <VisionInlineText text={b.content} />
            </blockquote>
          );
        }
        if (b.type === 'list') {
          return (
            <ul key={idx} class="lt-vision-list">
              {b.items?.map((item, iIdx) => (
                <li key={iIdx}><VisionInlineText text={item} /></li>
              ))}
            </ul>
          );
        }
        return (
          <p key={idx} class="lt-vision-paragraph">
            <VisionInlineText text={b.content} />
          </p>
        );
      })}
    </div>
  );
}

function VisionFigureCard({
  block,
  pdfDoc,
  pageNumber,
  figuresMap,
  detectedFigures,
  figureIndex,
}: {
  block: ParsedBlock;
  pdfDoc?: PDFDocumentProxy;
  pageNumber: number;
  figuresMap: Map<number, [number, number, number, number]>;
  detectedFigures: DetectedFigure[];
  figureIndex: number;
}) {
  const figNum = block.figNum;
  let figBbox: [number, number, number, number] | undefined;

  if (figNum !== undefined && figuresMap.has(figNum)) {
    figBbox = figuresMap.get(figNum);
  } else if (detectedFigures[figureIndex]) {
    figBbox = detectedFigures[figureIndex]?.bbox;
  } else if (detectedFigures.length > 0) {
    figBbox = detectedFigures[0]?.bbox;
  }


  return (
    <div class="lt-vision-figure-card">
      {figBbox && pdfDoc && (
        <div class="lt-vision-figure-media">
          <PdfSnippet
            pdfDoc={pdfDoc}
            pageNumber={pageNumber}
            bbox={figBbox}
            alt={`Hình ${figNum || ''}`}
          />
        </div>
      )}
      <div class="lt-vision-figure-meta">
        <div class="lt-vision-fig-header">
          <span class="lt-vision-fig-tag">FIGURE {figNum || ''}</span>
          {figBbox && <span class="lt-vision-fig-orig-note">(Trích từ bản gốc PDF)</span>}
        </div>
        <div class="lt-vision-figure-caption">
          <VisionInlineText text={block.caption || block.content} />
        </div>
        {block.sublines && block.sublines.length > 0 && (
          <div class="lt-vision-fig-sublines">
            {block.sublines.map((sub, sIdx) => (
              <div key={sIdx} class="lt-vision-fig-subline">
                <VisionInlineText text={sub} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function VisionDisplayEquation({ latex }: { latex: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    try {
      katex.render(latex, ref.current, {
        displayMode: true,
        throwOnError: false,
        strict: false,
      });
    } catch {
      if (ref.current) ref.current.textContent = `$$${latex}$$`;
    }
  }, [latex]);

  return <div ref={ref} class="lt-vision-display-eq" />;
}

export interface ParsedAlgorithmLine {
  indent: number;
  text: string;
}

function VisionAlgorithmCard({ block }: { block: ParsedBlock }) {
  const { algTitle, algParams, algLines } = block;

  return (
    <div class="lt-vision-algorithm-box">
      <div class="lt-alg-header">
        <span class="lt-alg-badge">THUẬT TOÁN</span>
        <span class="lt-alg-title">
          <VisionInlineText text={algTitle || block.content} />
        </span>
      </div>

      {algParams && algParams.length > 0 && (
        <div class="lt-alg-params">
          {algParams.map((param, pIdx) => (
            <div key={pIdx} class="lt-alg-param-line">
              <VisionInlineText text={param} />
            </div>
          ))}
        </div>
      )}

      {algLines && algLines.length > 0 && (
        <div class="lt-alg-body">
          {algLines.map((l, lIdx) => (
            <div
              key={lIdx}
              class="lt-alg-line"
              style={{
                paddingLeft: `${Math.max(0, l.indent) * 20 + 4}px`,
              }}
            >
              {l.indent > 0 && (
                <span
                  class="lt-alg-indent-guide"
                  style={{ left: `${(l.indent - 1) * 20 + 4}px` }}
                />
              )}
              <span class="lt-alg-line-content">
                <VisionInlineText text={l.text} />
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function parseAlgorithmLine(rawLine: string): ParsedAlgorithmLine {
  let line = rawLine.trim();
  let indent = 0;

  // 1. Strip and count leading indentation tokens (quad, qquad, &emsp;)
  let changed = true;
  while (changed) {
    changed = false;
    if (line.startsWith('\\qquad')) {
      indent += 2;
      line = line.slice(6).trim();
      changed = true;
    } else if (line.startsWith('qquad')) {
      indent += 2;
      line = line.slice(5).trim();
      changed = true;
    } else if (line.startsWith('\\quad')) {
      indent += 1;
      line = line.slice(5).trim();
      changed = true;
    } else if (line.startsWith('quad')) {
      indent += 1;
      line = line.slice(4).trim();
      changed = true;
    } else if (line.startsWith('&emsp;')) {
      indent += 1;
      line = line.slice(6).trim();
      changed = true;
    }
  }

  // 2. If no quad tokens, measure raw leading spaces
  if (indent === 0) {
    const spaceMatch = rawLine.match(/^(\s+)/);
    if (spaceMatch) {
      const numSpaces = spaceMatch[1].replace(/\t/g, '    ').length;
      indent = Math.floor(numSpaces / 4) || (numSpaces >= 2 ? 1 : 0);
    }
  }

  // 3. Highlight control keywords if not already wrapped in **
  if (!/\*\*(for|do|if|then|else|while|repeat|until|end\s+for|end\s+if|end\s+while|return)\*\*/i.test(line)) {
    line = line
      .replace(/^for\b/i, '**for**')
      .replace(/\bdo$/i, '**do**')
      .replace(/^if\b/i, '**if**')
      .replace(/\bthen$/i, '**then**')
      .replace(/^else\b/i, '**else**')
      .replace(/^while\b/i, '**while**')
      .replace(/^repeat\b/i, '**repeat**')
      .replace(/^until\b/i, '**until**')
      .replace(/^end\s+for\b/i, '**end for**')
      .replace(/^end\s+if\b/i, '**end if**')
      .replace(/^end\s+while\b/i, '**end while**')
      .replace(/^return\b/i, '**return**');
  }

  return { indent, text: line };
}

function VisionInlineText({ text }: { text: string }) {
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = renderMarkdownInlineWithKatex(text);
  }, [text]);

  return <span ref={containerRef} />;
}

function renderMarkdownInlineWithKatex(text: string): string {
  if (!text) return '';

  // 1. Math formulas $...$
  let rendered = text.replace(/\$([^$]+)\$/g, (_match, math) => {
    try {
      return katex.renderToString(math, {
        displayMode: false,
        throwOnError: false,
        strict: false,
      });
    } catch {
      return `<code>${math}</code>`;
    }
  });

  // 2. Stray LaTeX symbols and spacing outside of math
  rendered = rendered
    .replace(/\\leftarrow\b/g, '←')
    .replace(/\\rightarrow\b/g, '→')
    .replace(/\\qquad\b/g, '&emsp;&emsp;')
    .replace(/\\quad\b/g, '&emsp;');

  // 3. Bold **text**
  rendered = rendered.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // 4. Italic *text*
  rendered = rendered.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // 5. Code `code`
  rendered = rendered.replace(/`([^`]+)`/g, '<code class="lt-inline-code">$1</code>');

  return rendered;
}

interface ParsedBlock {
  type: 'heading' | 'equation' | 'figure' | 'quote' | 'list' | 'paragraph' | 'algorithm';
  level?: number;
  content: string;
  items?: string[];
  figNum?: number;
  caption?: string;
  sublines?: string[];
  algTitle?: string;
  algParams?: string[];
  algLines?: ParsedAlgorithmLine[];
}

function parseMarkdownIntoBlocks(text: string): ParsedBlock[] {
  const lines = text.split('\n');
  const blocks: ParsedBlock[] = [];

  let inEq = false;
  let eqBuffer: string[] = [];

  let inQuote = false;
  let quoteBuffer: string[] = [];

  let inFigure = false;
  let figureNum: number | undefined;
  let figureCaption = '';
  let figureSublines: string[] = [];

  let inList = false;
  let listBuffer: string[] = [];

  let inAlgorithm = false;
  let algTitle = '';
  let algParams: string[] = [];
  let algLines: ParsedAlgorithmLine[] = [];
  let loopDepth = 0;

  const flushQuote = () => {
    if (quoteBuffer.length > 0) {
      blocks.push({ type: 'quote', content: quoteBuffer.join(' ') });
      quoteBuffer = [];
      inQuote = false;
    }
  };

  const flushFigure = () => {
    if (inFigure) {
      blocks.push({
        type: 'figure',
        figNum: figureNum,
        content: figureCaption,
        caption: figureCaption,
        sublines: figureSublines.length > 0 ? [...figureSublines] : undefined,
      });
      inFigure = false;
      figureNum = undefined;
      figureCaption = '';
      figureSublines = [];
    }
  };

  const flushList = () => {
    if (listBuffer.length > 0) {
      blocks.push({ type: 'list', content: '', items: [...listBuffer] });
      listBuffer = [];
      inList = false;
    }
  };

  const flushAlgorithm = () => {
    if (inAlgorithm) {
      if (algTitle || algParams.length > 0 || algLines.length > 0) {
        blocks.push({
          type: 'algorithm',
          content: algTitle,
          algTitle,
          algParams: [...algParams],
          algLines: [...algLines],
        });
      }
      inAlgorithm = false;
      algTitle = '';
      algParams = [];
      algLines = [];
      loopDepth = 0;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i] || '';
    const line = rawLine.trim();

    // 1. Display equation $$...$$
    if (line.startsWith('$$') && line.endsWith('$$') && line.length > 4) {
      flushQuote();
      flushFigure();
      flushList();
      flushAlgorithm();
      blocks.push({ type: 'equation', content: line.slice(2, -2).trim() });
      continue;
    }
    if (line.startsWith('$$')) {
      flushQuote();
      flushFigure();
      flushList();
      flushAlgorithm();
      inEq = true;
      eqBuffer = [line.slice(2)];
      continue;
    }
    if (inEq) {
      if (line.endsWith('$$')) {
        eqBuffer.push(line.slice(0, -2));
        blocks.push({ type: 'equation', content: eqBuffer.join('\n').trim() });
        inEq = false;
        eqBuffer = [];
      } else {
        eqBuffer.push(line);
      }
      continue;
    }

    // 2. Check for Figure Block: > **Figure 1**: ... or **[Hình 1]**: ... or Figure 1: ...
    const figMatch = line.match(/^>?\s*\*?\*?\[?(Hình|Figure|Bảng|Table)\s*(\d+)\]?\*?\*?[:.]?\s*(.*)$/i);
    if (figMatch) {
      flushQuote();
      flushFigure();
      flushList();
      flushAlgorithm();
      inFigure = true;
      figureNum = parseInt(figMatch[2]!, 10);
      figureCaption = (figMatch[3] || '').replace(/^\*+|\*+$/g, '').trim();
      continue;
    }

    // If currently inside figure block and line is quote-wrapped or subtitle:
    if (inFigure) {
      if (line.startsWith('>') || (line.startsWith('*') && line.endsWith('*'))) {
        const cleaned = line.replace(/^>\s?/, '').trim();
        if (cleaned.length > 0) {
          figureSublines.push(cleaned);
        }
        continue;
      } else if (line.length === 0) {
        const nextLine = (lines[i + 1] || '').trim();
        if (nextLine.startsWith('>')) {
          continue;
        }
        flushFigure();
        continue;
      } else {
        flushFigure();
      }
    }

    // 3. Check for Algorithm Block: **Algorithm 1 ...** or Algorithm 1: ... or ### Algorithm 1
    const isAlgHeader = /^(?:#{1,4}\s+)?\*{0,2}(?:Algorithm|Thuật\s*toán)\s*\d+.*$/i.test(line);
    if (!inAlgorithm && isAlgHeader) {
      flushQuote();
      flushFigure();
      flushList();
      inAlgorithm = true;
      algTitle = line.replace(/^#{1,4}\s+/, '').replace(/^\*\*|\*\*$/g, '').trim();
      algParams = [];
      algLines = [];
      loopDepth = 0;
      continue;
    }

    if (inAlgorithm) {
      if (line.length === 0) {
        // Peek ahead for next non-empty line
        let nextNonEmpty = '';
        for (let j = i + 1; j < lines.length; j++) {
          const nl = (lines[j] || '').trim();
          if (nl.length > 0) {
            nextNonEmpty = nl;
            break;
          }
        }
        if (nextNonEmpty) {
          const isNextParam = /^\*{0,2}(?:Parameter|Parameters|Required|Require|Input|Inputs|Output|Outputs|Ensure|Tham\s*số|Yêu\s*cầu|Đầu\s*vào|Đầu\s*ra)\s*:?/i.test(nextNonEmpty);
          const isNextAlgLine = isNextParam ||
            /^(\\quad|\\qquad|quad|qquad|&emsp;)/i.test(nextNonEmpty) ||
            /^\*{0,2}(for|while|if|else|repeat|until|end\s+for|end\s+if|end\s+while|end|return)\b/i.test(nextNonEmpty) ||
            /^\*{0,2}(Calculate|Tính|Perform|Thực\s*hiện|Lấy\s*mẫu|Sample|Khởi\s*tạo|Initialize|Update|Cập\s*nhật)\b/i.test(nextNonEmpty) ||
            /^\$[a-zA-Z0-9_\\^'{}]+\s*(\\leftarrow|←|=|:=|\\sim|~)/.test(nextNonEmpty);

          if (isNextAlgLine || loopDepth > 0) {
            continue;
          }
        }
        flushAlgorithm();
        continue;
      }

      if (line.startsWith('#') || line.startsWith('$$') || figMatch) {
        flushAlgorithm();
      } else {
        const isParam = /^\*{0,2}(?:Parameter|Parameters|Required|Require|Input|Inputs|Output|Outputs|Ensure|Tham\s*số|Yêu\s*cầu|Đầu\s*vào|Đầu\s*ra)\s*:?/i.test(line);
        if (isParam) {
          algParams.push(line);
          continue;
        }

        const hasIndentOrQuad = /^(\\quad|\\qquad|quad|qquad|&emsp;)/i.test(line) || rawLine.startsWith('  ') || rawLine.startsWith('\t');
        const isAlgKeyword = /^\*{0,2}(for|while|if|else|repeat|until|end\s+for|end\s+if|end\s+while|end|return)\b/i.test(line);
        const isAlgAction = /^\*{0,2}(Calculate|Tính|Perform|Thực\s*hiện|Lấy\s*mẫu|Sample|Khởi\s*tạo|Initialize|Update|Cập\s*nhật)\b/i.test(line);
        const isMathStep = /^\$[a-zA-Z0-9_\\^'{}]+\s*(\\leftarrow|←|=|:=|\\sim|~)/.test(line);

        if (hasIndentOrQuad || isAlgKeyword || isAlgAction || isMathStep || loopDepth > 0) {
          if (/\b(for|while|if)\b/i.test(line) && !/\b(end\s+for|end\s+if|end\s+while)\b/i.test(line)) {
            loopDepth++;
          }
          if (/\b(end\s+for|end\s+if|end\s+while)\b/i.test(line)) {
            loopDepth = Math.max(0, loopDepth - 1);
          }

          algLines.push(parseAlgorithmLine(rawLine));
          continue;
        } else {
          flushAlgorithm();
        }
      }
    }

    // 4. Headings
    if (line.startsWith('#')) {
      flushQuote();
      flushFigure();
      flushList();
      flushAlgorithm();
      const m = line.match(/^(#{1,4})\s+(.*)$/);
      if (m && m[1] && m[2]) {
        blocks.push({ type: 'heading', level: m[1].length, content: m[2] });
        continue;
      }
    }

    // 5. Blockquote
    if (line.startsWith('>')) {
      flushList();
      flushFigure();
      flushAlgorithm();
      inQuote = true;
      quoteBuffer.push(line.replace(/^>\s?/, ''));
      continue;
    } else if (inQuote) {
      flushQuote();
    }

    // 6. Bullet list
    if (line.startsWith('- ') || line.startsWith('* ')) {
      flushQuote();
      flushFigure();
      flushAlgorithm();
      inList = true;
      listBuffer.push(line.slice(2));
      continue;
    } else if (inList) {
      flushList();
    }

    if (line.length === 0) continue;

    blocks.push({ type: 'paragraph', content: line });
  }

  flushQuote();
  flushFigure();
  flushList();
  flushAlgorithm();
  if (inEq && eqBuffer.length > 0) {
    blocks.push({ type: 'equation', content: eqBuffer.join('\n').trim() });
  }

  return blocks;
}
