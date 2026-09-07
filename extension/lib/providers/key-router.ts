export class KeyRouter {
  private keys: string[] = [];
  private currentIndex = 0;
  private cooldownMap: Map<string, number> = new Map();

  constructor(userKey?: string | string[]) {
    const pool = new Set<string>();

    if (Array.isArray(userKey)) {
      for (const k of userKey) {
        const trimmed = typeof k === 'string' ? k.trim() : '';
        if (trimmed) pool.add(trimmed);
      }
    } else if (userKey && typeof userKey === 'string' && userKey.trim()) {
      for (const k of userKey.split(/[\n,;]+/)) {
        const trimmed = k.trim();
        if (trimmed) pool.add(trimmed);
      }
    }

    this.keys = Array.from(pool);
  }

  get keyCount(): number {
    return this.keys.length;
  }

  getAllKeys(): string[] {
    return [...this.keys];
  }

  /**
   * Returns the current active key that is not in cooldown.
   */
  getCurrentKey(): string {
    if (this.keys.length === 0) return '';

    const now = Date.now();
    // Try to find the next key that is not in cooldown
    for (let i = 0; i < this.keys.length; i++) {
      const idx = (this.currentIndex + i) % this.keys.length;
      const key = this.keys[idx] ?? '';
      const cooldownUntil = this.cooldownMap.get(key) || 0;
      if (now >= cooldownUntil) {
        this.currentIndex = idx;
        return key;
      }
    }

    // If all keys are in cooldown, pick the one with earliest cooldown expiry
    let earliestKey = this.keys[0] ?? '';
    let minCooldown = Infinity;
    for (const key of this.keys) {
      const exp = this.cooldownMap.get(key) || 0;
      if (exp < minCooldown) {
        minCooldown = exp;
        earliestKey = key;
      }
    }
    return earliestKey;
  }

  /**
   * Switches to the next available key.
   */
  rotate(): string {
    if (this.keys.length <= 1) return this.getCurrentKey();
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    return this.getCurrentKey();
  }

  /**
   * Marks a key as rate-limited (HTTP 429) for `cooldownSec` seconds and rotates.
   */
  markRateLimited(key: string, cooldownSec = 60): string {
    if (key) {
      this.cooldownMap.set(key, Date.now() + cooldownSec * 1000);
      console.warn(
        `[Live-Trans KeyRouter] API Key ...${key.slice(-6)} bị limit 429. Đang chuyển sang key tiếp theo trong pool ${this.keys.length} keys...`,
      );
    }
    return this.rotate();
  }

  /**
   * Executes an asynchronous API call with automatic key rotation on HTTP 429 / Quota limits.
   * - If > 1 keys: automatically rotates to the next available key.
   * - If <= 1 key: immediately throws user-friendly rate limit error without retrying.
   */
  async execute<T>(fn: (activeKey: string) => Promise<T>): Promise<T> {
    if (this.keys.length === 0) {
      throw new Error('Chưa có API Key nào được cấu hình. Vui lòng vào Cài đặt để thêm API Key.');
    }

    // Nếu chỉ có 1 key và bị lỗi quota: không rotate, báo lỗi ngay lập tức
    if (this.keys.length === 1) {
      const singleKey = this.keys[0]!;
      try {
        return await fn(singleKey);
      } catch (err: unknown) {
        const msg = String((err as { message?: string })?.message || err);
        const isQuota =
          msg.includes('429') ||
          msg.includes('quota') ||
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('rate_limit') ||
          msg.includes('Quota exceeded');
        if (isQuota) {
          throw new Error('Đã chạm hạn mức Rate Limit (429) hoặc Quota của API Key. Vui lòng thử lại sau hoặc thêm API Key dự phòng trong Cài đặt.', { cause: err });
        }
        throw err;
      }
    }

    // Nếu có >= 2 keys: Smart Router tự động xoay tua qua các key
    const attempts = this.keys.length;
    let lastError: unknown = null;

    for (let i = 0; i < attempts; i++) {
      const key = this.getCurrentKey();
      try {
        return await fn(key);
      } catch (err: unknown) {
        lastError = err;
        const msg = String((err as { message?: string })?.message || err);

        const isQuota =
          msg.includes('429') ||
          msg.includes('quota') ||
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('rate_limit') ||
          msg.includes('Quota exceeded');

        if (isQuota) {
          const waitMatch = msg.match(/retry in ([\d.]+)\s*s/i);
          const cooldown = waitMatch && waitMatch[1] ? Math.ceil(parseFloat(waitMatch[1])) : 60;
          this.markRateLimited(key, cooldown);
          continue; // Try next key immediately!
        }

        // Non-quota error, rethrow
        throw err;
      }
    }

    throw lastError;
  }
}

function areKeyListsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((val, idx) => val === b[idx]);
}

let globalRouter: KeyRouter | null = null;

export function getKeyRouter(userKey?: string | string[]): KeyRouter {
  const inputKeys: string[] = Array.isArray(userKey)
    ? userKey.filter((k) => typeof k === 'string' && k.trim().length > 0)
    : userKey
    ? userKey.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean)
    : [];

  if (globalRouter && areKeyListsEqual(globalRouter.getAllKeys(), inputKeys)) {
    return globalRouter;
  }
  globalRouter = new KeyRouter(inputKeys);
  return globalRouter;
}
