import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DirectGeminiProvider } from './direct-gemini';
import { clearKeyRouters } from './key-router';
import { DEFAULT_SETTINGS, type Settings } from '../settings';
import * as fetchRetryModule from './fetch-retry';

describe('DirectGeminiProvider', () => {
  let provider: DirectGeminiProvider;

  beforeEach(() => {
    provider = new DirectGeminiProvider();
    clearKeyRouters();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rotates to next API key on 429 quota limit when multiple keys are configured', async () => {
    const usedKeys: string[] = [];

    vi.spyOn(fetchRetryModule, 'fetchWithRetry').mockImplementation(async (_url: string, init?: RequestInit) => {
      const apiKey = (init?.headers as Record<string, string>)?.['x-goog-api-key'] || '';
      usedKeys.push(apiKey);

      if (apiKey === 'key-gemini-1') {
        return {
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          json: async () => ({ error: { message: '429 Quota exceeded: RESOURCE_EXHAUSTED' } }),
          text: async () => '429 Quota exceeded',
          headers: new Headers(),
        } as unknown as Response;
      }

      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: 'Tiêu đề tiếng Việt' }],
              },
            },
          ],
        }),
        text: async () => '',
        headers: new Headers(),
      } as unknown as Response;
    });

    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      apiKey: 'key-gemini-1',
      apiKeys: [
        { id: '1', provider: 'gemini', key: 'key-gemini-1', createdAt: 1 },
        { id: '2', provider: 'gemini', key: 'key-gemini-2', createdAt: 2 },
      ],
    };

    const translated = await provider.translateTitle('English Title', settings);

    expect(translated).toBe('Tiêu đề tiếng Việt');
    expect(usedKeys).toEqual(['key-gemini-1', 'key-gemini-2']);
  });

  it('immediately throws user friendly rate limit error when only 1 key is configured and gets 429', async () => {
    vi.spyOn(fetchRetryModule, 'fetchWithRetry').mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      json: async () => ({ error: { message: '429 Quota exceeded: RESOURCE_EXHAUSTED' } }),
      text: async () => '429 Quota exceeded',
      headers: new Headers(),
    } as unknown as Response);

    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      apiKey: 'single-key',
      apiKeys: [{ id: '1', provider: 'gemini', key: 'single-key', createdAt: 1 }],
    };

    await expect(provider.translateTitle('Title', settings)).rejects.toThrow(
      'Đã chạm hạn mức Rate Limit (429) hoặc Quota của API Key',
    );
  });
});
