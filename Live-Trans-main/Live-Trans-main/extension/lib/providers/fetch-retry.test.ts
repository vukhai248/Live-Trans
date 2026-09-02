import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { fetchWithRetry } from './fetch-retry';

function res(status: number): Response {
  return { ok: status < 400, status } as Response;
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
    await vi.advanceTimersByTimeAsync(10_000);
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

  test('retries 5xx up to 3 times then returns the last response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(503));
    vi.stubGlobal('fetch', fetchMock);

    const p = fetchWithRetry('https://x', {});
    await vi.advanceTimersByTimeAsync(10_000);
    const r = await p;
    expect(r.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
  });

  test('retries on a network error then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(res(200));
    vi.stubGlobal('fetch', fetchMock);

    const p = fetchWithRetry('https://x', {});
    await vi.advanceTimersByTimeAsync(10_000);
    const r = await p;
    expect(r.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
