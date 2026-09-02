#!/usr/bin/env node
/**
 * Live-Trans local gateway — dependency-free Node proxy (docs/plan.md §2, §7).
 *
 * Run:  GEMINI_API_KEY=... node gateway.mjs   (or put the key in `.env`)
 * The extension's "Gateway" mode POSTs here instead of calling Gemini from the
 * browser, so the API key never lives in the extension. Escape hatch for the
 * CORS/key-exposure caveats of Direct mode.
 *
 * NOTE: this is a preview (full hardening lands in M3 per docs/roadmap.md).
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const PORT = Number(process.env.PORT ?? 8787);
const FLASH_MODEL = 'gemini-3.5-flash';
const TRANSCRIBE_MODEL = 'gemini-3.5-transcribe';
const BASE = 'https://generativelanguage.googleapis.com/v1beta';

async function apiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  try {
    const env = await readFile(new URL('./.env', import.meta.url), 'utf8');
    const m = env.match(/^GEMINI_API_KEY=(.+)$/m);
    if (m) return m[1].trim();
  } catch {
    /* no .env */
  }
  return '';
}

async function gemini(path, body, key) {
  const url = `${BASE}/models/${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemini ${res.status}: ${t.slice(0, 300)}`);
  }
  return res.json();
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true }));
  }

  try {
    const key = await apiKey();
    if (!key) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'GEMINI_API_KEY chưa được cấu hình' }));
    }
    const body = await readJson(req);

    if (req.url === '/transcribe' && req.method === 'POST') {
      // Inline base64 audio thẳng vào Interactions API (đã xác minh 2026-09-02:
      // 200 OK + word timestamps ở steps[].content[].annotations[]) — không cần
      // Files upload, không vướng CORS.
      const data = await gemini(
        `interactions`,
        {
          model: TRANSCRIBE_MODEL,
          input: [{ type: 'audio', data: body.pcmBase64 ? pcmToWavBase64(body.pcmBase64) : '', mime_type: 'audio/wav' }],
          generation_config: {
            transcription_config: {
              language_codes: body.language === 'auto' ? [] : [body.language ?? ''],
              mode: { type: 'verbatim', timestamp_granularities: ['word'] },
            },
          },
        },
        key,
      );
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(shapeTranscript(data)));
    }

    if (req.url === '/translate' && req.method === 'POST') {
      const data = await gemini(`${FLASH_MODEL}:generateContent`, {
        contents: [{ role: 'user', parts: [{ text: buildTranslatePrompt(body) }] }],
        generation_config: { temperature: 0.2, response_mime_type: 'application/json' },
      }, key);
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(parseTranslateBatch(raw, body?.units?.length ?? 0)));
    }

    if (req.url === '/translate-title' && req.method === 'POST') {
      const prompt = `Dịch tiêu đề video sau sang tiếng Việt cho tự nhiên, giữ tên riêng và mã. Chỉ trả về tiêu đề đã dịch.\n\nTiêu đề: ${body.title ?? ''}`;
      const data = await gemini(`${FLASH_MODEL}:generateContent`, {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generation_config: { temperature: 0.2 },
      }, key);
      const title = (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ title }));
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
});

server.listen(PORT, () => {
  console.log(`Live-Trans gateway on http://localhost:${PORT}`);
});

function shapeTranscript(data) {
  const words = [];
  // Shape đã xác minh thật (2026-09-02): steps[].content[].annotations[] là
  // word_info { text, start_offset: "0.100s", end_offset: "0.600s" }.
  const stepContents = (data?.steps ?? []).flatMap((s) => (Array.isArray(s?.content) ? s.content : []));
  for (const c of stepContents) {
    if (!Array.isArray(c?.annotations)) continue;
    for (const w of c.annotations) {
      const text = w?.word ?? w?.text ?? '';
      if (!text) continue;
      const s = parseOffset(w?.start_offset, w?.startMs, w?.start);
      const e = parseOffset(w?.end_offset, w?.endMs, w?.end);
      if (s === undefined || e === undefined) continue;
      words.push({ text, startMs: s, endMs: e });
    }
    if (words.length) break;
  }
  if (words.length === 0) {
    const lists = [
      data?.words,
      data?.result?.words,
      data?.audio_transcription?.words,
      ...(data?.annotations ?? []).map((a) => a?.words),
      ...(data?.result?.annotations ?? []).map((a) => a?.words),
    ];
    for (const list of lists) {
      if (!Array.isArray(list)) continue;
      for (const w of list) {
        const text = w?.word ?? w?.text ?? '';
        if (!text) continue;
        const s = parseOffset(w?.start_offset, w?.startMs, w?.start);
        const e = parseOffset(w?.end_offset, w?.endMs, w?.end);
        if (s === undefined || e === undefined) continue;
        words.push({ text, startMs: s, endMs: e });
      }
      if (words.length) break;
    }
  }
  const stepText = stepContents.map((c) => c?.text ?? '').find((t) => t && t.trim());
  const text =
    data?.output_text ?? data?.result?.output_text ?? stepText ?? data?.text ?? '';
  return { id: `gw-${Date.now().toString(36)}`, text, words, language: data?.language_code };
}

function parseOffset(...values) {
  for (const v of values) {
    if (typeof v === 'string') {
      const s = v.trim();
      if (!s) continue;
      if (/s$/i.test(s)) {
        const n = Number(s.slice(0, -1));
        if (Number.isFinite(n)) return Math.round(n * 1000);
      }
      const n = Number(s);
      if (Number.isFinite(n)) return n < 1000 ? Math.round(n * 1000) : Math.round(n);
      continue;
    }
    if (typeof v === 'number' && Number.isFinite(v)) return v < 1000 ? Math.round(v * 1000) : Math.round(v);
  }
  return undefined;
}

/** PCM base64 → WAV base64 (thêm 44-byte header) để gửi inline vào Interactions API. */
function pcmToWavBase64(pcmBase64, sampleRate = 16000, channels = 1, bits = 16) {
  const wav = pcmToWav(Buffer.from(pcmBase64, 'base64'), sampleRate, channels, bits);
  return wav.toString('base64');
}

function pcmToWav(pcm, sampleRate = 16000, channels = 1, bits = 16) {
  const header = Buffer.alloc(44);
  const byteRate = (sampleRate * channels * bits) / 8;
  const blockAlign = (channels * bits) / 8;
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bits, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function buildTranslatePrompt(body) {
  const units = (body?.units ?? []).map((u, i) => `[${i}] ${u.masked}`).join('\n');
  const rules = (body?.selectedTerms ?? []).map((t) => {
    if (t.type === 'jargon' && t.vi) return `- "${t.term}" luôn dịch là "${t.vi}"`;
    if (t.type === 'acronym') return `- "${t.term}" giữ nguyên văn`;
    return `- "${t.term}" giữ nguyên văn`;
  }).join('\n');
  return `Bạn là dịch giả phụ đề video học thuật. Dịch từng câu sau sang ${body.targetLang ?? 'vi'}.
Ràng buộc: giữ NGUYÊN VĂN mọi cụm ⟦n⟧; không dịch mã, lệnh, URL.
${rules ? `Quy tắc thuật ngữ:\n${rules}` : ''}
Câu cần dịch:
${units}
Trả về JSON: {"translations":[{"text":"...","terms_used":[]},...]}`;
}

function parseTranslateBatch(text, count) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  let arr = [];
  try {
    const parsed = JSON.parse(start !== -1 && end > start ? text.slice(start, end + 1) : text);
    arr = Array.isArray(parsed) ? parsed : parsed?.translations ?? [];
  } catch {
    arr = [];
  }
  const translations = Array.from({ length: count }, (_, i) => {
    const item = arr[i];
    return {
      text: typeof item === 'string' ? item : (item?.text ?? ''),
      termsUsed: Array.isArray(item?.terms_used) ? item.terms_used : [],
    };
  });
  return { translations };
}
