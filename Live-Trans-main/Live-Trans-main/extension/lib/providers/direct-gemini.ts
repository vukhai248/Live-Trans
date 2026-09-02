import type { Settings } from '../settings';
import type {
  ContextPair,
  Provider,
  TranslateBatchRequest,
  TranslateBatchResponse,
  TranscribeRequest,
  TranslatedUnit,
} from './provider';
import { parseTranscribeResult } from '../asr/parser';
import { pcmBase64ToWavBytes } from '../capture/wav';
import { buildTranslatePrompt, parseTranslateBatch } from '../translate/prompt';
import { fetchWithRetry } from './fetch-retry';

/**
 * Direct calls to Gemini native REST endpoints from the offscreen document.
 *
 * plan §5: use raw `fetch` + native endpoints — NOT the JS SDK (403 in the
 * browser) and NOT the OpenAI-compat endpoint (CORS). plan §7: the key belongs
 * to the user and is read from storage, never hardcoded.
 *
 * NOTE: Google does not officially commit to browser CORS for these endpoints,
 * which is exactly why the Gateway mode exists as an escape hatch (plan §2).
 */

const TRANSCRIBE_MODEL = 'gemini-3.5-transcribe';
const FLASH_MODEL = 'gemini-3.5-flash';
const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const UPLOAD_BASE = 'https://generativelanguage.googleapis.com/upload/v1beta';

async function jsonFetch(url: string, init: RequestInit): Promise<any> {
  const res = await fetchWithRetry(url, init);
  if (!res.ok) {
    throw new Error(`Gemini API ${res.status}: ${await safeErrorText(res)}`);
  }
  return res.json();
}

async function safeErrorText(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return JSON.stringify(body).slice(0, 500);
  } catch {
    try {
      return (await res.text()).slice(0, 200);
    } catch {
      return res.statusText;
    }
  }
}

export class DirectGeminiProvider implements Provider {
  readonly mode = 'direct' as const;

  async transcribe(
    req: TranscribeRequest,
    settings: Settings,
  ): Promise<ReturnType<typeof parseTranscribeResult>> {
    // gemini-3.5-transcribe (pre-recorded) is exposed through the Interactions
    // API: upload the audio via the Files API, then POST /interactions.
    // Word-level timestamps are requested via transcription_config.mode.
    // NOTE: custom vocabulary (`speech_context`) is NOT sent — Gemini does not
    // support it together with word timestamps, and word timestamps are
    // required for the subtitle overlay to stay in sync (M1 acceptance).
    const wav = pcmBase64ToWavBytes(req.pcmBase64);
    const fileUri = await jsonFetch(`${UPLOAD_BASE}/files`, {
      method: 'POST',
      headers: {
        'x-goog-api-key': settings.apiKey,
        'X-Goog-Upload-Protocol': 'raw',
        'X-Goog-Upload-Command': 'start, upload, finalize',
        'X-Goog-Upload-Header-Content-Length': String(wav.length),
        'X-Goog-Upload-Header-Content-Type': 'audio/wav',
        'Content-Type': 'audio/wav',
      },
      body: wav as unknown as BodyInit,
    }).then((j) => j?.file?.uri as string | undefined);

    if (!fileUri) throw new Error('Files API không trả về file.uri');

    const body: Record<string, any> = {
      model: TRANSCRIBE_MODEL,
      input: [{ type: 'audio', uri: fileUri, mime_type: 'audio/wav' }],
      generation_config: {
        transcription_config: {
          language_codes: req.language === 'auto' ? [] : [req.language],
          mode: { type: 'verbatim', timestamp_granularities: ['word'] },
        },
      },
    };
    const data = await jsonFetch(`${BASE}/interactions`, {
      method: 'POST',
      headers: { 'x-goog-api-key': settings.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return parseTranscribeResult(data);
  }

  async translate(
    req: TranslateBatchRequest,
    settings: Settings,
  ): Promise<TranslateBatchResponse> {
    return this.translateImpl(req, settings, buildTranslatePrompt);
  }

  private async translateImpl(
    req: TranslateBatchRequest,
    settings: Settings,
    buildPrompt: (r: TranslateBatchRequest) => string,
  ): Promise<TranslateBatchResponse> {
    const url = `${BASE}/models/${FLASH_MODEL}:generateContent`;
    const body = {
      contents: [{ role: 'user', parts: [{ text: buildPrompt(req) }] }],
      generation_config: {
        temperature: 0.2,
        response_mime_type: 'application/json',
      },
    };
    const data = await jsonFetch(url, {
      method: 'POST',
      headers: { 'x-goog-api-key': settings.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return parseTranslateBatch(text, req.units.length);
  }

  async translateTitle(title: string, settings: Settings): Promise<string> {
    const url = `${BASE}/models/${FLASH_MODEL}:generateContent`;
    const prompt = `Dịch tiêu đề video sau sang tiếng Việt cho tự nhiên, giữ nguyên tên riêng, tên thương hiệu và mã/định danh. Chỉ trả về tiêu đề đã dịch, không giải thích.\n\nTiêu đề: ${title}`;
    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generation_config: { temperature: 0.2 },
    };
    const data = await jsonFetch(url, {
      method: 'POST',
      headers: { 'x-goog-api-key': settings.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return text.trim();
  }
}

export type { Provider, ContextPair, TranslatedUnit, TranslateBatchRequest };
