import { useEffect, useRef, useState, useMemo } from 'preact/hooks';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { TranslatedBlock } from '@/lib/pdf/types';

import { wrapInlineMath } from '@/lib/pdf/markdown';
import katex from 'katex';
import { PdfSnippet } from './PdfSnippet';

interface InlineKatexProps {
  math: string;
  displayMode?: boolean;
}

function InlineKatex({ math, displayMode = false }: InlineKatexProps) {
  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!spanRef.current) return;
    try {
      katex.render(math, spanRef.current, {
        displayMode,
        throwOnError: false,
        strict: false,
      });
    } catch {
      if (spanRef.current) spanRef.current.textContent = math;
    }
  }, [math, displayMode]);

  return <span ref={spanRef} class={displayMode ? 'lt-wb-display-math' : 'lt-inline-math'} />;
}

function renderFormattedSentence(text: string): any {
  if (!text) return null;
  const withMath = wrapInlineMath(text);
  // Matches $$...$$, $...$, **...**, `...`, or *...*
  const parts = withMath.split(/(\$\$[\s\S]+?\$\$|\$[^$]+?\$|\*\*[^*]+?\*\*|`[^`]+?`|\*[^*]+?\*)/g);

  return parts.map((part, idx) => {
    if (!part) return null;
    if (part.startsWith('$$') && part.endsWith('$$')) {
      const math = part.slice(2, -2).trim();
      return <InlineKatex key={idx} math={math} displayMode={true} />;
    }
    if (part.startsWith('$') && part.endsWith('$')) {
      const math = part.slice(1, -1).trim();
      return <InlineKatex key={idx} math={math} displayMode={false} />;
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={idx}>{renderFormattedSentence(part.slice(2, -2))}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={idx} class="lt-code-inline">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={idx}>{renderFormattedSentence(part.slice(1, -1))}</em>;
    }
    return part;
  });
}

interface ExtractedEquation {
  math: string;
  num?: string;
}

function extractEquationsFromMarkdown(md: string): { byNum: Map<string, string>; list: ExtractedEquation[] } {
  const byNum = new Map<string, string>();
  const list: ExtractedEquation[] = [];
  if (!md) return { byNum, list };

  // Match $$ ... $$ blocks
  const displayRegex = /\$\$([\s\S]*?)\$\$/g;
  let match: RegExpExecArray | null;

  while ((match = displayRegex.exec(md)) !== null) {
    let content = (match[1] ?? '').trim();
    let num: string | undefined;

    // Check for \tag{...} inside the formula
    const tagMatch = content.match(/\\tag\{([^}]+)\}/);
    if (tagMatch && tagMatch[1]) {
      num = tagMatch[1].trim();
      content = content.replace(/\\tag\{[^}]+\}/g, '').trim();
    } else {
      // Check for (1) or (2) immediately following the $$ block in markdown
      const afterSlice = md.slice(match.index + match[0].length, match.index + match[0].length + 40);
      const numMatch = afterSlice.match(/^\s*(?:\r?\n)?\s*\(([0-9]+(?:\.[0-9]+)?)\)/);
      if (numMatch && numMatch[1]) {
        num = numMatch[1];
      }
    }

    if (num) {
      byNum.set(num, content);
    }
    list.push({ math: content, num });
  }

  return { byNum, list };
}

interface WhiteboardEquationProps {
  block: TranslatedBlock;
  pdfDoc: PDFDocumentProxy;
  pageNumber: number;
  visionEquations?: { byNum: Map<string, string>; list: ExtractedEquation[] };
  formulaIndex: number;
}

function WhiteboardEquation({
  block,
  pdfDoc,
  pageNumber,
  visionEquations,
  formulaIndex,
}: WhiteboardEquationProps) {
  const rawText = block.text.trim();
  const numMatch = rawText.match(/\(\s*([0-9]+(?:\.[0-9]+)?)\s*\)$/);
  const eqNum = numMatch ? numMatch[1] : undefined;

  let latexCandidate: string | null = null;
  let fromVision = false;

  if (visionEquations) {
    if (eqNum && visionEquations.byNum.has(eqNum)) {
      latexCandidate = visionEquations.byNum.get(eqNum)!;
      fromVision = true;
    } else if (visionEquations.list[formulaIndex]) {
      latexCandidate = visionEquations.list[formulaIndex].math;
      fromVision = true;
    }
  }

  // Only consider rawText if it contains well-formed LaTeX commands and NOT broken raw Unicode artifacts (√, □)
  if (!latexCandidate) {
    const candidate = (numMatch ? rawText.replace(/\(\s*[0-9]+(?:\.[0-9]+)?\s*\)$/, '') : rawText)
      .replace(/^(\$\$|\$)/, '')
      .replace(/(\$\$|\$)$/, '')
      .trim();

    const hasValidLatex = /\\[a-zA-Z]{2,}/.test(candidate) && !/[√□]/.test(candidate);
    if (hasValidLatex) {
      latexCandidate = candidate;
    }
  }

  const finalLatex = useMemo(() => {
    if (!latexCandidate || latexCandidate.length < 2) return null;
    try {
      katex.renderToString(latexCandidate, { displayMode: true, throwOnError: true });
      return latexCandidate;
    } catch {
      return null;
    }
  }, [latexCandidate]);

  const displayNum = eqNum || (fromVision ? visionEquations?.list[formulaIndex]?.num : undefined);

  if (finalLatex) {
    return (
      <div class="lt-wb-component lt-wb-equation-box">
        <div class="lt-wb-eq-math">
          <InlineKatex math={finalLatex} displayMode={true} />
        </div>
        {displayNum && <span class="lt-wb-eq-num">({displayNum})</span>}
      </div>
    );
  }

  // Fallback: Exact, original, crisp 2x HiDPI PDF snippet! (100% faithful to original paper)
  return (
    <div class="lt-wb-component lt-wb-equation">
      <PdfSnippet pdfDoc={pdfDoc} pageNumber={pageNumber} bbox={block.bbox} alt={`Công thức ${block.text}`} />
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
  visionMarkdown?: string;
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
  visionMarkdown,
}: WhiteboardPageRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 612 * scale,
    height: 792 * scale,
  });

  const visionEquations = useMemo(() => {
    return extractEquationsFromMarkdown(visionMarkdown || '');
  }, [visionMarkdown]);

  const equationBlocks = useMemo(() => {
    return blocks.filter((b) => b.isFormula || b.componentType === 'equation');
  }, [blocks]);

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

  const renderComponentBlock = (
    b: TranslatedBlock,
    idx: number = 0,
    allInCol: TranslatedBlock[] = [],
  ) => {
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
      const formulaIndex = equationBlocks.indexOf(b);
      return (
        <WhiteboardEquation
          key={b.id}
          block={b}
          pdfDoc={pdfDoc}
          pageNumber={pageNumber}
          visionEquations={visionEquations}
          formulaIndex={formulaIndex >= 0 ? formulaIndex : idx}
        />
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

    // Filter out sub-figure labels that appear before a top-of-column figure
    // (their text/graphics are captured directly inside the unified figure snippet)
    const hasTopFigureAfter = allInCol.slice(idx + 1).some(
      (nextB) =>
        (nextB.componentType === 'figure_caption' || /^(figure|table)\s+\d+[:.]/i.test(nextB.text.trim())) &&
        allInCol.slice(0, allInCol.indexOf(nextB)).every((prior) => !prior.isHeading && prior.text.length < 160)
    );
    if (hasTopFigureAfter && !b.isHeading && b.text.length < 160) {
      return null;
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
      const captionBbox = b.bbox;
      const colTop = pageNumber === 1 ? 165 : 48;

      // Check if all preceding blocks in this column are sub-figure labels
      const isTopFigure = allInCol
        .slice(0, idx)
        .every((prior) => !prior.isHeading && prior.text.length < 160);

      const prevBlock = idx > 0 ? allInCol[idx - 1] : null;

      // Determine top boundary of graphic dynamically based on previous block or column top
      let figTop = colTop;
      if (!isTopFigure && prevBlock) {
        figTop = Math.max(colTop, prevBlock.bbox[1] + prevBlock.bbox[3] + 4);
      }

      // Determine horizontal position by column to prevent clipping or leaking
      let figLeft: number;
      let figWidth: number;

      if (b.col === 1) {
        figLeft = 45;
        figWidth = 245;
      } else if (b.col === 2) {
        figLeft = 310;
        figWidth = 245;
      } else {
        figLeft = 45;
        figWidth = Math.max(dimensions.width - 90, 510);
      }

      // Height of graphic strictly above caption
      const figHeight = Math.max(60, captionBbox[1] - 4 - figTop);
      const figureImageBbox: [number, number, number, number] = [
        figLeft,
        figTop,
        figWidth,
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

    // 5. Reference bibliography item
    if (b.componentType === 'reference') {
      return (
        <div key={b.id} class="lt-wb-component lt-wb-reference-item">
          {renderSentences(b)}
        </div>
      );
    }

    // 6. Normal Body Paragraph
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
        overflowY: 'auto',
        overflowX: 'hidden',
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
          {fullWidthBlocks.map((b, idx) => renderComponentBlock(b, idx, fullWidthBlocks))}
        </div>
      )}

      {/* TWO-COLUMN ACADEMIC BODY */}
      <div class="lt-wb-columns-wrap">
        <div class="lt-wb-col lt-wb-col-left">
          {col1Blocks.map((b, idx) => renderComponentBlock(b, idx, col1Blocks))}
        </div>
        <div class="lt-wb-col lt-wb-col-right">
          {col2Blocks.map((b, idx) => renderComponentBlock(b, idx, col2Blocks))}
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
