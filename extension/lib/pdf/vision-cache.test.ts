import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  getCachedVisionTranslation,
  setCachedVisionTranslation,
  clearCachedVisionTranslation,
  clearAllVisionCache,
  getVisionCacheStats,
} from './vision-translate';

class MockStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

describe('Smart Persistent Vision Cache (50 papers LRU & 14-day TTL)', () => {
  beforeEach(() => {
    (globalThis as any).localStorage = new MockStorage();
    (globalThis as any).sessionStorage = new MockStorage();
    vi.restoreAllMocks();
  });

  it('stores and retrieves translation from persistent cache', () => {
    const pdfUrl = 'https://arxiv.org/pdf/2301.00001.pdf';
    const pageNumber = 1;
    const markdown = '# Trang 1: Dịch thuật thông minh';

    setCachedVisionTranslation(pdfUrl, pageNumber, markdown);

    const retrieved = getCachedVisionTranslation(pdfUrl, pageNumber);
    expect(retrieved).toBe(markdown);

    const stats = getVisionCacheStats();
    expect(stats.paperCount).toBe(1);
    expect(stats.maxPapers).toBe(50);
    expect(stats.ttlDays).toBe(14);
  });

  it('evicts paper when TTL (14 days) expires', () => {
    const pdfUrl = 'https://arxiv.org/pdf/2301.00002.pdf';
    const pageNumber = 2;
    const markdown = '# Nội dung trang 2';

    setCachedVisionTranslation(pdfUrl, pageNumber, markdown);

    // Mock Date.now to 15 days later
    const fifteenDaysInMs = 15 * 24 * 60 * 60 * 1000;
    const originalNow = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(originalNow + fifteenDaysInMs);

    const retrieved = getCachedVisionTranslation(pdfUrl, pageNumber);
    expect(retrieved).toBeNull();

    const stats = getVisionCacheStats();
    expect(stats.paperCount).toBe(0);
  });

  it('enforces LRU eviction when paper count exceeds MAX_CACHED_PAPERS (50)', () => {
    const baseTime = 1000000;

    // Simulate inserting 52 papers sequentially
    for (let i = 1; i <= 52; i++) {
      vi.spyOn(Date, 'now').mockReturnValue(baseTime + i * 1000);
      const url = `https://arxiv.org/pdf/paper_${i}.pdf`;
      setCachedVisionTranslation(url, 1, `# Nội dung bài ${i}`);
    }

    const stats = getVisionCacheStats();
    expect(stats.paperCount).toBe(50);

    // Oldest papers (1 and 2) should have been evicted by LRU
    expect(getCachedVisionTranslation('https://arxiv.org/pdf/paper_1.pdf', 1)).toBeNull();
    expect(getCachedVisionTranslation('https://arxiv.org/pdf/paper_2.pdf', 1)).toBeNull();

    // Newer papers (3 to 52) should be retained
    expect(getCachedVisionTranslation('https://arxiv.org/pdf/paper_3.pdf', 1)).toBe('# Nội dung bài 3');
    expect(getCachedVisionTranslation('https://arxiv.org/pdf/paper_52.pdf', 1)).toBe('# Nội dung bài 52');
  });

  it('refreshes LRU timestamp when reading cache so active papers are not evicted', () => {
    const baseTime = 1000000;

    // Insert paper 1 early
    vi.spyOn(Date, 'now').mockReturnValue(baseTime);
    setCachedVisionTranslation('https://arxiv.org/pdf/paper_1.pdf', 1, '# Bài 1');

    // Insert papers 2 to 50
    for (let i = 2; i <= 50; i++) {
      vi.spyOn(Date, 'now').mockReturnValue(baseTime + i * 1000);
      setCachedVisionTranslation(`https://arxiv.org/pdf/paper_${i}.pdf`, 1, `# Bài ${i}`);
    }

    // Now user reads paper 1 again at time baseTime + 60000 (making it most recently used)
    vi.spyOn(Date, 'now').mockReturnValue(baseTime + 60000);
    const read = getCachedVisionTranslation('https://arxiv.org/pdf/paper_1.pdf', 1);
    expect(read).toBe('# Bài 1');

    // Insert paper 51 at time baseTime + 70000
    vi.spyOn(Date, 'now').mockReturnValue(baseTime + 70000);
    setCachedVisionTranslation('https://arxiv.org/pdf/paper_51.pdf', 1, '# Bài 51');

    // Paper 2 should have been evicted (oldest untouched), but Paper 1 remains!
    expect(getCachedVisionTranslation('https://arxiv.org/pdf/paper_2.pdf', 1)).toBeNull();
    expect(getCachedVisionTranslation('https://arxiv.org/pdf/paper_1.pdf', 1)).toBe('# Bài 1');
  });

  it('clears specific page cache without affecting other pages', () => {
    const url = 'https://arxiv.org/pdf/multipage.pdf';
    setCachedVisionTranslation(url, 1, '# Page 1');
    setCachedVisionTranslation(url, 2, '# Page 2');

    clearCachedVisionTranslation(url, 1);

    expect(getCachedVisionTranslation(url, 1)).toBeNull();
    expect(getCachedVisionTranslation(url, 2)).toBe('# Page 2');
  });

  it('clears entire paper cache when pageNumber is omitted', () => {
    const url1 = 'https://arxiv.org/pdf/paper_a.pdf';
    const url2 = 'https://arxiv.org/pdf/paper_b.pdf';

    setCachedVisionTranslation(url1, 1, '# Paper A Page 1');
    setCachedVisionTranslation(url1, 2, '# Paper A Page 2');
    setCachedVisionTranslation(url2, 1, '# Paper B Page 1');

    clearCachedVisionTranslation(url1);

    expect(getCachedVisionTranslation(url1, 1)).toBeNull();
    expect(getCachedVisionTranslation(url1, 2)).toBeNull();
    expect(getCachedVisionTranslation(url2, 1)).toBe('# Paper B Page 1');
  });

  it('clears all vision cache via clearAllVisionCache', () => {
    setCachedVisionTranslation('https://arxiv.org/pdf/p1.pdf', 1, '# P1');
    setCachedVisionTranslation('https://arxiv.org/pdf/p2.pdf', 1, '# P2');

    clearAllVisionCache();

    expect(getCachedVisionTranslation('https://arxiv.org/pdf/p1.pdf', 1)).toBeNull();
    expect(getCachedVisionTranslation('https://arxiv.org/pdf/p2.pdf', 1)).toBeNull();
    expect(getVisionCacheStats().paperCount).toBe(0);
  });

  it('evicts oldest paper to free space when localStorage throws QuotaExceededError', () => {
    setCachedVisionTranslation('https://arxiv.org/pdf/old.pdf', 1, '# Old paper');

    // Simulate quota error on next write unless old paper is removed
    const originalSetItem = localStorage.setItem.bind(localStorage);
    let failOnce = true;
    localStorage.setItem = vi.fn((key: string, value: string) => {
      if (key.includes('new.pdf') && failOnce) {
        failOnce = false;
        throw new Error('QuotaExceededError');
      }
      return originalSetItem(key, value);
    });

    setCachedVisionTranslation('https://arxiv.org/pdf/new.pdf', 1, '# New paper');

    expect(getCachedVisionTranslation('https://arxiv.org/pdf/new.pdf', 1)).toBe('# New paper');
    expect(getCachedVisionTranslation('https://arxiv.org/pdf/old.pdf', 1)).toBeNull();
  });
});
