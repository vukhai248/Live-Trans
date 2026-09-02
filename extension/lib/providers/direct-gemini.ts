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
import { pcmBase64ToWavBytes, pcmBase64ToWavBase64 } from '../capture/wav';
import { buildTranslatePrompt, parseTranslateBatch } from '../translate/prompt';
import { fetchWithRetry } from './fetch-retry';

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

export async function testGeminiApiKey(apiKey: string): Promise<{ ok: boolean; model: string; error?: string }> {
  if (!apiKey || !apiKey.trim()) {
    return { ok: false, model: '', error: 'Chưa nhập Gemini API Key' };
  }

  const candidateModels = ['gemini-3.7-flash', 'gemini-3.5-flash', 'gemini-2.5-flash'];
  let lastError = '';

  for (const model of candidateModels) {
    try {
      const url = `${BASE}/models/${model}:generateContent`;
      const body = {
        contents: [{ role: 'user', parts: [{ text: 'Dịch từ "hello" sang tiếng Việt.' }] }],
        generation_config: { max_output_tokens: 10, temperature: 0.1 },
      };
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey.trim(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        return { ok: true, model };
      }
      const errText = await safeErrorText(res);
      lastError = `${res.status}: ${errText}`;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }

  return { ok: false, model: '', error: lastError || 'Không thể kết nối tới Gemini API' };
}

export class DirectGeminiProvider implements Provider {
  readonly mode = 'direct' as const;

  async transcribe(
    req: TranscribeRequest,
    settings: Settings,
  ): Promise<ReturnType<typeof parseTranscribeResult>> {
    const wavBase64 = pcmBase64ToWavBase64(req.pcmBase64);

    // Primary path: Direct Gemini Flash multimodal audio transcription with inline base64
    // (Extremely fast, reliable, zero CORS upload issues, supported by all standard Gemini keys)
    try {
      const url = `${BASE}/models/${FLASH_MODEL}:generateContent`;
      const prompt = `Transcribe the speech in this audio clip verbatim into text. Output only the exact transcribed speech text. Do not add explanations or commentary.`;
      const body = {
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: 'audio/wav',
                  data: wavBase64,
                },
              },
              { text: prompt },
            ],
          },
        ],
        generation_config: {
          temperature: 0.1,
        },
      };

      const data = await jsonFetch(url, {
        method: 'POST',
        headers: { 'x-goog-api-key': settings.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      if (text.trim()) {
        return parseTranscribeResult({ output_text: text.trim() });
      }
    } catch (flashErr) {
      console.warn('Direct inline transcribe attempt failed, trying Interactions API...', flashErr);
    }

    // Fallback path: Interactions API with Files API upload
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
