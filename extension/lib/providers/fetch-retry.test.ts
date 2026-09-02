import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { fetchWithRetry } from './fetch-retry';

function res(status: number, body = '', headers?: Record<string, string>): Response {
  return {
    ok: status < 400,
    status,
    text: async () => body,
    headers: new Headers(headers),
  } as unknown as Response;
}

describe('fetchWithRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test('retries on 429 then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(429))
      .mockResolvedValueOnce(res(200));
    vi.stubGlobal('fetch', fetchMock);

    const p = fetchWithRetry('https://x', {});
    await vi.advanceTimersByTimeAsync(20_000);
    const r = await p;
    expect(r.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('waits the Retry-After delay Google returns with 429', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(429, '{"error":{"message":"Quota exceeded... Please retry in 28.548373435s"}}'))
      .mockResolvedValueOnce(res(200));
    vi.stubGlobal('fetch', fetchMock);

    const p = fetchWithRetry('https://x', {});
    // Chưa đủ 29s: chưa retry.
    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30_000);
    const r = await p;
    expect(r.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('does not retry 4xx other than 429', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(403));
    vi.stubGlobal('fetch', fetchMock);

    const r = await fetchWithRetry('https://x', {});
    expect(r.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('retries 5xx up to 5 times then returns the last response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(503));
    vi.stubGlobal('fetch', fetchMock);

    const p = fetchWithRetry('https://x', {});
    await vi.advanceTimersByTimeAsync(40_000);
    const r = await p;
    expect(r.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(6); // 1 initial + 5 retries
  });

  test('retries on a network error then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(res(200));
    vi.stubGlobal('fetch', fetchMock);

    const p = fetchWithRetry('https://x', {});
    await vi.advanceTimersByTimeAsync(20_000);
    const r = await p;
    expect(r.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
