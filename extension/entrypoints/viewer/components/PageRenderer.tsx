import { useEffect, useRef, useState } from 'preact/hooks';
import type { PageRendererProps } from './types';
import { FlowBlock } from './FlowBlock';

export function PageRenderer({
  pdfDoc,
  pageNumber,
  scale,
  blocks = [],
  hoveredSentenceId = null,
  onHoverSentence = () => {},
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
          onVisible?.(pageNumber);
          observer.disconnect();
        }
      },
      { rootMargin: '200px 0px', threshold: 0.1 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [pageNumber, onVisible]);

  // Render PDF.js canvas with HiDPI / Retina super-sharp resolution (Khắc phục lỗi mờ ở Ảnh 3)
  // Giữ max(2.0, dpr) cho PC/máy tầm trung theo quyết định mới (bản mobile để sau).
  // Render PDF.js canvas — P0 lazy khi vào viewport.
  useEffect(() => {
    if (!isVisible || !pdfDoc) return;
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
