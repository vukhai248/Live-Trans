/**
 * Bounded retry wrapper for transient provider failures (plan §6 durability).
 *
 * Retries on HTTP 429 and 5xx (and network errors where `fetch` throws).
 * Với 429: đọc thời gian chờ từ header `Retry-After` hoặc body
 * ("Please retry in 28.5s" của Gemini) và chờ ĐÚNG khoảng đó — free tier
 * `gemini-3.5-transcribe` giới hạn 25 request/phút, retry nhanh chỉ làm
 * phá thêm quota. Giới hạn chờ tối đa 65s. 4xx khác trả về ngay để caller
 * báo lỗi chính xác.
 */

const MAX_RETRIES = 5;
const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000];
const MAX_429_WAIT_MS = 65_000;

function isRetriableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readBody(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

/** Thời gian Google yêu cầu chờ (ms), hoặc null nếu không có thông tin. */
function parseRetryAfterMs(res: Response, body: string): number | null {
  const header = res.headers.get('retry-after');
  if (header) {
    const n = Number(header);
    if (Number.isFinite(n) && n >= 0) return n * 1000;
    const dateMs = Date.parse(header);
    if (!Number.isNaN(dateMs)) return Math.max(0, dateMs - Date.now());
  }
  const m = body.match(/retry in ([\d.]+)\s*(ms|s|seconds?)\b/i);
  if (m) {
    const value = Number(m[1]);
    if (Number.isFinite(value)) {
      return m[2]?.toLowerCase() === 'ms' ? value : value * 1000;
    }
  }
  return null;
}

export async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const isLast = attempt === MAX_RETRIES;
    try {
      const res = await fetch(url, init);
      if (res.ok || !isRetriableStatus(res.status) || isLast) return res;

      if (res.status === 429) {
        const waitMs = parseRetryAfterMs(res, await readBody(res));
        const wait = Math.min(Math.max(waitMs ?? 0, BACKOFF_MS[attempt] ?? 4000), MAX_429_WAIT_MS);
        await delay(wait);
        continue;
      }
      await delay(BACKOFF_MS[attempt] ?? 4000);
    } catch (err) {
      if (isLast) throw err;
      await delay(BACKOFF_MS[attempt] ?? 4000);
    }
  }
  // Unreachable: the loop always returns or throws on the final attempt.
  throw new Error('fetchWithRetry: exhausted retries');
}
