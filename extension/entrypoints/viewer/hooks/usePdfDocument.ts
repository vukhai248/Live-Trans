import { useCallback, useEffect, useState } from 'preact/hooks';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { UsePdfDocumentOptions, UsePdfDocumentReturn } from './types';

// Ensure PDF.js worker is configured in extension runtime context
if (!pdfjsLib.GlobalWorkerOptions.workerSrc && typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.mjs');
}

export function usePdfDocument(options?: UsePdfDocumentOptions): UsePdfDocumentReturn {
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [docTitle, setDocTitle] = useState<string>('Tài liệu PDF');
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [leftFitScale, setLeftFitScale] = useState<number>(1.0);
  const [rightFitScale, setRightFitScale] = useState<number>(1.0);

  // Tự động tính toán tỷ lệ zoom Fit màn hình riêng biệt cho từng khung xem
  const calculatePaneFitScale = useCallback((pane: HTMLElement | null): number => {
    if (!pane) return 1.0;
    const availableWidth = pane.clientWidth - 32;
    if (availableWidth <= 100) return 1.0;
    const baseWidth = 612; // Khổ ngang PDF chuẩn
    const computed = Math.round((availableWidth / baseWidth) * 100) / 100;
    return Math.max(0.35, Math.min(3.0, computed));
  }, []);

  // Hook theo dõi resize cửa sổ, kéo splitter, đóng/mở sidebar để auto-fit scale độc lập 2 bên
  useEffect(() => {
    const handleResize = () => {
      const leftEl = options?.leftPaneRef?.current || document.querySelector<HTMLElement>('.lt-pane-left');
      const rightEl = options?.rightPaneRef?.current || document.querySelector<HTMLElement>('.lt-pane-right');
      const ls = calculatePaneFitScale(leftEl);
      const rs = calculatePaneFitScale(rightEl);
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
  }, [
    calculatePaneFitScale,
    options?.leftPaneRef,
    options?.rightPaneRef,
    options?.splitRatio,
    options?.sidebarOpen,
    options?.isSidebarPinned,
    options?.viewMode,
    pdfDoc,
  ]);

  // Nạp tài liệu PDF từ URL parameter (?url=...)
  useEffect(() => {
    void (async () => {
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

        // Trích xuất tiêu đề bài báo từ metadata PDF nếu có
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

  return {
    pdfUrl,
    docTitle,
    pdfDoc,
    numPages,
    errorMsg,
    leftFitScale,
    rightFitScale,
    calculatePaneFitScale,
  };
}
