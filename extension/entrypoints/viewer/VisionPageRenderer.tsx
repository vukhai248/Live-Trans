import { useRef, useEffect, useState } from 'preact/hooks';
import katex from 'katex';

interface VisionPageRendererProps {
  pageNumber: number;
  markdownText?: string;
  status?: 'loading' | 'done' | 'error';
  onVisible: (pageNumber: number) => void;
  onRetry?: (pageNumber: number) => void;
}

export function VisionPageRenderer({
  pageNumber,
  markdownText = '',
  status = 'loading',
  onVisible,
  onRetry,
}: VisionPageRendererProps) {
  const containerRef = useRef<HTMLElement>(null);
  const [copied, setCopied] = useState<boolean>(false);

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
    } catch {
      /* ignore */
    }
  };

  return (
    <article ref={containerRef} class="lt-vision-page" data-page-number={pageNumber}>
      {/* HEADER WITH STATUS & QUICK ACTIONS */}
      <div class="lt-vision-header">
        <div class="lt-vision-header-left">
          <span class="lt-page-tag">Trang {pageNumber}</span>
          {(status === 'done' || !!markdownText) && (
            <span class="lt-status-badge lt-status-done">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              Vision AI (LaTeX)
            </span>
          )}
          {!markdownText && status === 'loading' && (
            <span class="lt-status-badge lt-status-loading">
              ⏳ Đang trích xuất & dịch Trang {pageNumber}...
            </span>
          )}
          {!markdownText && status === 'error' && (
            <span class="lt-status-badge lt-status-error">
              ⚠ Lỗi dịch thị giác{' '}
              <button class="lt-retry-btn" onClick={() => onRetry?.(pageNumber)}>
                Thử lại
              </button>
            </span>
          )}
        </div>

        {(status === 'done' || !!markdownText) && (
          <div class="lt-vision-header-actions">
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
            <button
              class="lt-vision-btn"
              onClick={() => onRetry?.(pageNumber)}
              title="Dịch lại trang này"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
                <path d="M21 3v5h-5"/>
              </svg>
              Dịch lại
            </button>
          </div>
        )}
      </div>

      {/* CONTENT BODY */}
      <div class="lt-vision-body">
        {markdownText ? (
          <VisionMarkdownContent content={markdownText} />
        ) : status === 'loading' ? (
          <div class="lt-vision-skeleton">
            <div class="lt-vision-skeleton-line" style={{ width: '80%', height: '24px' }} />
            <div class="lt-vision-skeleton-line" style={{ width: '100%' }} />
            <div class="lt-vision-skeleton-line" style={{ width: '95%' }} />
            <div class="lt-vision-skeleton-line" style={{ width: '90%' }} />
            <div class="lt-vision-skeleton-line" style={{ width: '60%', height: '40px' }} />
            <div class="lt-vision-skeleton-line" style={{ width: '100%' }} />
          </div>
        ) : null}
      </div>
    </article>
  );
}

function VisionMarkdownContent({ content }: { content: string }) {
  // Parse markdown content by paragraphs and display equations
  const blocks = parseMarkdownIntoBlocks(content);

  return (
    <div class="lt-vision-content-wrap">
      {blocks.map((b, idx) => {
        if (b.type === 'equation') {
          return <VisionDisplayEquation key={idx} latex={b.content} />;
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

  // 2. Bold **text**
  rendered = rendered.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // 3. Italic *text*
  rendered = rendered.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // 4. Code `code`
  rendered = rendered.replace(/`([^`]+)`/g, '<code class="lt-inline-code">$1</code>');

  return rendered;
}

interface ParsedBlock {
  type: 'heading' | 'equation' | 'quote' | 'list' | 'paragraph';
  level?: number;
  content: string;
  items?: string[];
}

function parseMarkdownIntoBlocks(text: string): ParsedBlock[] {
  const lines = text.split('\n');
  const blocks: ParsedBlock[] = [];

  let inEq = false;
  let eqBuffer: string[] = [];

  let inQuote = false;
  let quoteBuffer: string[] = [];

  let inList = false;
  let listBuffer: string[] = [];

  const flushQuote = () => {
    if (quoteBuffer.length > 0) {
      blocks.push({ type: 'quote', content: quoteBuffer.join(' ') });
      quoteBuffer = [];
      inQuote = false;
    }
  };

  const flushList = () => {
    if (listBuffer.length > 0) {
      blocks.push({ type: 'list', content: '', items: [...listBuffer] });
      listBuffer = [];
      inList = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i] || '';
    const line = rawLine.trim();

    // Display equation $$...$$
    if (line.startsWith('$$') && line.endsWith('$$') && line.length > 4) {
      flushQuote();
      flushList();
      blocks.push({ type: 'equation', content: line.slice(2, -2).trim() });
      continue;
    }
    if (line.startsWith('$$')) {
      flushQuote();
      flushList();
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

    // Headings
    if (line.startsWith('#')) {
      flushQuote();
      flushList();
      const m = line.match(/^(#{1,4})\s+(.*)$/);
      if (m && m[1] && m[2]) {
        blocks.push({ type: 'heading', level: m[1].length, content: m[2] });
        continue;
      }
    }

    // Blockquote
    if (line.startsWith('>')) {
      flushList();
      inQuote = true;
      quoteBuffer.push(line.replace(/^>\s?/, ''));
      continue;
    } else if (inQuote) {
      flushQuote();
    }

    // Bullet list
    if (line.startsWith('- ') || line.startsWith('* ')) {
      flushQuote();
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
  flushList();
  if (inEq && eqBuffer.length > 0) {
    blocks.push({ type: 'equation', content: eqBuffer.join('\n').trim() });
  }

  return blocks;
}
