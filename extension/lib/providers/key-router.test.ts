import { beforeEach, describe, expect, it } from 'vitest';
import { clearKeyRouters, getKeyRouter, KeyRouter } from './key-router';

describe('KeyRouter', () => {
  it('parses comma and newline separated keys', () => {
    const router = new KeyRouter('key1, key2\nkey3; key4');
    expect(router.keyCount).toBe(4);
    expect(router.getAllKeys()).toEqual(['key1', 'key2', 'key3', 'key4']);
    expect(router.getCurrentKey()).toBe('key1');
  });

  it('rotates to next key on demand', () => {
    const router = new KeyRouter('k1, k2, k3');
    expect(router.getCurrentKey()).toBe('k1');
    expect(router.rotate()).toBe('k2');
    expect(router.getCurrentKey()).toBe('k2');
    expect(router.rotate()).toBe('k3');
    expect(router.rotate()).toBe('k1');
  });

  it('automatically rotates and succeeds on 429 quota error', async () => {
    const router = new KeyRouter('k1, k2');
    const calls: string[] = [];

    const result = await router.execute(async (key) => {
      calls.push(key);
      if (key === 'k1') {
        throw new Error('429 Quota exceeded: Resource has been exhausted (e.g. check quota).');
      }
      return 'ok-from-' + key;
    });

    expect(result).toBe('ok-from-k2');
    expect(calls).toEqual(['k1', 'k2']);
    // k1 is in cooldown, subsequent calls use k2
    expect(router.getCurrentKey()).toBe('k2');
  });

  it('throws non-quota errors immediately without rotating', async () => {
    const router = new KeyRouter('k1, k2');
    const calls: string[] = [];

    await expect(
      router.execute(async (key) => {
        calls.push(key);
        throw new Error('400 Bad Request: Invalid JSON');
      }),
    ).rejects.toThrow('400 Bad Request');

    expect(calls).toEqual(['k1']);
  });

  it('accepts array of keys', () => {
    const router = new KeyRouter(['keyA', 'keyB', 'keyC']);
    expect(router.keyCount).toBe(3);
    expect(router.getAllKeys()).toEqual(['keyA', 'keyB', 'keyC']);
  });

  it('immediately throws rate limit error without rotating when only 1 key is present', async () => {
    const router = new KeyRouter(['single-key']);
    const calls: string[] = [];

    await expect(
      router.execute(async (key) => {
        calls.push(key);
        throw new Error('429 RESOURCE_EXHAUSTED: Rate limit exceeded');
      }),
    ).rejects.toThrow('Đã chạm hạn mức Rate Limit (429) hoặc Quota của API Key');

    expect(calls).toEqual(['single-key']);
  });

  describe('getKeyRouter Registry', () => {
    beforeEach(() => {
      clearKeyRouters();
    });

    it('returns the same instance for identical keys and namespace', () => {
      const r1 = getKeyRouter(['key1', 'key2'], 'gemini');
      const r2 = getKeyRouter(['key1', 'key2'], 'gemini');
      expect(r1).toBe(r2);
    });

    it('maintains separate instances and preserves cooldown across namespaces', () => {
      const geminiRouter = getKeyRouter(['gemini-k1', 'gemini-k2'], 'gemini');
      const zenRouter = getKeyRouter(['zen-k1', 'zen-k2'], 'zen');

      expect(geminiRouter).not.toBe(zenRouter);

      // Mark gemini-k1 as 429 limited
      geminiRouter.markRateLimited('gemini-k1', 120);
      expect(geminiRouter.getCurrentKey()).toBe('gemini-k2');

      // Access zenRouter, make sure it is unaffected
      expect(zenRouter.getCurrentKey()).toBe('zen-k1');

      // Re-fetch gemini router from registry: cooldown of gemini-k1 MUST be preserved!
      const geminiRouterRefetched = getKeyRouter(['gemini-k1', 'gemini-k2'], 'gemini');
      expect(geminiRouterRefetched).toBe(geminiRouter);
      expect(geminiRouterRefetched.getCurrentKey()).toBe('gemini-k2');
    });

    it('clears registry when clearKeyRouters is called', () => {
      const r1 = getKeyRouter(['k1', 'k2'], 'gemini');
      clearKeyRouters();
      const r2 = getKeyRouter(['k1', 'k2'], 'gemini');
      expect(r1).not.toBe(r2);
    });
  });
});
