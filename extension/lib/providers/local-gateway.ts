import type { Settings } from '../settings';
import type {
  Provider,
  TranslateBatchRequest,
  TranslateBatchResponse,
  TranscribeRequest,
} from './provider';
import type { Transcript } from '../asr/types';
import { fetchWithRetry } from './fetch-retry';

/**
 * Escape-hatch transport: a small dependency-free Node gateway (`gateway.mjs`)
 * keeps the API key in `.env` and proxies to Gemini with CORS headers — the
 * official recommendation when the user wants the key off the client (plan §7).
 */

export class LocalGatewayProvider implements Provider {
  readonly mode = 'gateway' as const;

  private async post<T>(path: string, body: unknown, settings: Settings): Promise<T> {
    const base = settings.gatewayUrl.replace(/\/$/, '');
    const res = await fetchWithRetry(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`Gateway ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    return (await res.json()) as T;
  }

  transcribe(req: TranscribeRequest, settings: Settings): Promise<Transcript> {
    return this.post<Transcript>('/transcribe', req, settings);
  }

  translate(
    req: TranslateBatchRequest,
    settings: Settings,
  ): Promise<TranslateBatchResponse> {
    return this.post<TranslateBatchResponse>('/translate', req, settings);
  }

  async translateTitle(title: string, settings: Settings): Promise<string> {
    const res = await this.post<{ title: string }>(
      '/translate-title',
      { title },
      settings,
    );
    return res.title;
  }
}
