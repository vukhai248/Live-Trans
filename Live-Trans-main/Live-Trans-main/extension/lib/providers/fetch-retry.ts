/**
 * Bounded retry wrapper for transient provider failures (plan §6 durability).
 *
 * Retries on HTTP 429 and 5xx (and network errors where `fetch` throws) up to
 * `maxRetries` times with exponential backoff. 4xx responses (other than 429)
 * are returned immediately so the caller can surface a precise error.
 */

const MAX_RETRIES = 3;
const BACKOFF_MS = [1000, 2000, 4000];

function isRetriableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const isLast = attempt === MAX_RETRIES;
    try {
      const res = await fetch(url, init);
      if (res.ok || !isRetriableStatus(res.status) || isLast) return res;
      await delay(BACKOFF_MS[attempt] ?? 4000);
    } catch (err) {
      if (isLast) throw err;
      await delay(BACKOFF_MS[attempt] ?? 4000);
    }
  }
  // Unreachable: the loop always returns or throws on the final attempt.
  throw new Error('fetchWithRetry: exhausted retries');
}
