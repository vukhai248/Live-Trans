// Maximum number of full-page HiDPI canvases kept in memory simultaneously
export const MAX_CANVAS_CACHE_SIZE = 6;

export interface ResizableCanvas {
  width: number;
  height: number;
  [key: string]: any;
}

// Cached rendered PDF page canvases for ultra-fast snippet extraction (LRU bounded)
export const pdfPageCanvasCache = new Map<string, ResizableCanvas>();

/**
 * Lấy canvas từ bộ nhớ đệm và cập nhật thứ tự truy cập gần nhất (LRU).
 */
export function getCachedCanvas<T extends ResizableCanvas = HTMLCanvasElement>(key: string): T | undefined {
  const canvas = pdfPageCanvasCache.get(key) as T | undefined;
  if (canvas) {
    // Refresh LRU order: delete and re-insert at end
    pdfPageCanvasCache.delete(key);
    pdfPageCanvasCache.set(key, canvas);
  }
  return canvas;
}

/**
 * Lưu canvas vào cache với cơ chế giới hạn dung lượng LRU.
 * Tự động giải phóng kích thước canvas cũ (width=0, height=0) để giải phóng VRAM/GPU memory.
 */
export function setCachedCanvas(key: string, canvas: ResizableCanvas): void {
  if (pdfPageCanvasCache.has(key)) {
    pdfPageCanvasCache.delete(key);
  } else if (pdfPageCanvasCache.size >= MAX_CANVAS_CACHE_SIZE) {
    const oldestKey = pdfPageCanvasCache.keys().next().value;
    if (oldestKey) {
      const oldCanvas = pdfPageCanvasCache.get(oldestKey);
      if (oldCanvas) {
        // Explicitly release GPU backing store
        oldCanvas.width = 0;
        oldCanvas.height = 0;
      }
      pdfPageCanvasCache.delete(oldestKey);
    }
  }
  pdfPageCanvasCache.set(key, canvas);
}

/**
 * Xóa toàn bộ canvas cache và giải phóng bộ nhớ GPU.
 */
export function clearCanvasCache(): void {
  for (const canvas of pdfPageCanvasCache.values()) {
    canvas.width = 0;
    canvas.height = 0;
  }
  pdfPageCanvasCache.clear();
}
