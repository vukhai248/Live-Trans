import { useEffect, useRef } from 'preact/hooks';
import type { PDFDocumentProxy } from 'pdfjs-dist';

export interface PdfSnippetProps {
  pdfDoc: PDFDocumentProxy;
  pageNumber: number;
  bbox: [number, number, number, number];
  alt?: string;
  className?: string;
}

// Cached rendered PDF page canvases for ultra-fast snippet extraction
const pdfPageCanvasCache = new Map<string, HTMLCanvasElement>();

export function PdfSnippet({
  pdfDoc,
  pageNumber,
  bbox,
  alt = 'Equation or Figure',
  className = '',
}: PdfSnippetProps) {
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
    <div class={`lt-snippet-container ${className}`} title={alt}>
      <canvas ref={canvasRef} class="lt-snippet-canvas" />
    </div>
  );
}
