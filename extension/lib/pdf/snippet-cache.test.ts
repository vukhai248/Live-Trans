import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearCanvasCache,
  getCachedCanvas,
  MAX_CANVAS_CACHE_SIZE,
  pdfPageCanvasCache,
  setCachedCanvas,
} from './snippet-cache';

describe('PdfSnippet LRU Canvas Cache', () => {
  beforeEach(() => {
    clearCanvasCache();
  });

  it('stores and retrieves canvas from cache', () => {
    const mockCanvas = { width: 800, height: 1200 };
    setCachedCanvas('doc_p1_s2', mockCanvas as any);

    const retrieved = getCachedCanvas('doc_p1_s2');
    expect(retrieved).toBe(mockCanvas);
    expect(pdfPageCanvasCache.size).toBe(1);
  });

  it('updates LRU order upon getCachedCanvas access', () => {
    const canvas1 = { width: 100, height: 100 };
    const canvas2 = { width: 200, height: 200 };
    const canvas3 = { width: 300, height: 300 };

    setCachedCanvas('p1', canvas1 as any);
    setCachedCanvas('p2', canvas2 as any);
    setCachedCanvas('p3', canvas3 as any);

    // Initial order of keys: p1, p2, p3
    expect(Array.from(pdfPageCanvasCache.keys())).toEqual(['p1', 'p2', 'p3']);

    // Access p1 -> should move p1 to the end (most recently used)
    getCachedCanvas('p1');
    expect(Array.from(pdfPageCanvasCache.keys())).toEqual(['p2', 'p3', 'p1']);
  });

  it('evicts the oldest canvas when exceeding MAX_CANVAS_CACHE_SIZE (6 items)', () => {
    expect(MAX_CANVAS_CACHE_SIZE).toBe(6);

    const canvases: Array<{ width: number; height: number }> = [];
    for (let i = 1; i <= 6; i++) {
      const c = { width: 1000, height: 1400 };
      canvases.push(c);
      setCachedCanvas(`p${i}`, c as any);
    }

    expect(pdfPageCanvasCache.size).toBe(6);

    // Access p1 so it becomes recent
    getCachedCanvas('p1');
    // Keys order now: p2, p3, p4, p5, p6, p1
    expect(Array.from(pdfPageCanvasCache.keys())[0]).toBe('p2');

    // Add 7th canvas -> p2 must be evicted!
    const canvas7 = { width: 1000, height: 1400 };
    setCachedCanvas('p7', canvas7 as any);

    expect(pdfPageCanvasCache.size).toBe(6);
    expect(pdfPageCanvasCache.has('p2')).toBe(false);
    // Verified that evicted canvas had its dimensions set to 0 to free GPU memory
    expect(canvases[1]!.width).toBe(0);
    expect(canvases[1]!.height).toBe(0);

    // p1 was kept because it was recently accessed
    expect(pdfPageCanvasCache.has('p1')).toBe(true);
    expect(pdfPageCanvasCache.has('p7')).toBe(true);
  });

  it('clears all canvases and releases their dimensions upon clearCanvasCache()', () => {
    const c1 = { width: 500, height: 500 };
    const c2 = { width: 600, height: 600 };

    setCachedCanvas('a', c1 as any);
    setCachedCanvas('b', c2 as any);
    expect(pdfPageCanvasCache.size).toBe(2);

    clearCanvasCache();

    expect(pdfPageCanvasCache.size).toBe(0);
    expect(c1.width).toBe(0);
    expect(c1.height).toBe(0);
    expect(c2.width).toBe(0);
    expect(c2.height).toBe(0);
  });
});
