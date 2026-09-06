import { describe, expect, it } from 'vitest';
import { KeyRouter } from './key-router';

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
});
