#!/usr/bin/env node
/**
 * API probe — xác minh chính xác các endpoint Live-Trans phụ thuộc (2026-09-02).
 * Dùng audio LỜI NÓI THẬT (tạo bằng Windows SAPI, xem tests/fixtures/speech.wav)
 * để đánh giá được transcript + word timestamps thật.
 *
 * Kiểm tra:
 *   [1] Danh sách model — gemini-3.7-flash có tồn tại? transcribe-live?
 *   [2] Files API upload (URL đúng: /upload/v1beta/files)
 *   [3] Interactions API transcribe verbatim + word timestamps
 *   [4] Interactions với audio INLINE base64 (không cần upload)?
 *
 * Chạy: node scripts/api-probe.mjs   (đọc GEMINI_API_KEY từ .env)
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const key = (() => {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  for (const p of [join(__dirname, '..', '.env'), join(__dirname, '..', 'gateway', '.env')]) {
    if (existsSync(p)) {
      const m = readFileSync(p, 'utf8').match(/^GEMINI_API_KEY=(.+)$/m);
      if (m) return m[1].trim();
    }
  }
  return '';
})();
if (!key) {
  console.error('NO KEY: put GEMINI_API_KEY in ./.env');
  process.exit(2);
}
console.log('key prefix:', key.slice(0, 6) + '…');

const ORIGIN = 'https://generativelanguage.googleapis.com';

async function call(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-json */
  }
  return { status: res.status, text: text.slice(0, 600), json };
}

// ---- [1] models list ----
console.log('\n[1] Danh sách model (lọc theo tên)');
{
  const r = await call(`${ORIGIN}/v1beta/models?pageSize=1000`, {
    headers: { 'x-goog-api-key': key },
  });
  console.log('  status', r.status);
  const names = (r.json?.models ?? []).map((m) => m.name?.replace('models/', '') ?? '');
  const interesting = names.filter((n) =>
    /transcribe|3\.5|3\.7|flash-live|live-translate/i.test(n),
  );
  for (const n of interesting) console.log('   -', n);
  console.log('  gemini-3.7-flash tồn tại?', names.includes('gemini-3.7-flash'));
  console.log('  gemini-3.5-flash tồn tại?', names.includes('gemini-3.5-flash'));
  console.log('  gemini-3.5-transcribe tồn tại?', names.includes('gemini-3.5-transcribe'));
  console.log(
    '  gemini-3.5-transcribe-live tồn tại?',
    names.includes('gemini-3.5-transcribe-live'),
  );
  if (names.length === 0) console.log('  (raw)', r.text);
}

// ---- load speech wav ----
const wavPath = join(__dirname, '..', 'tests', 'fixtures', 'speech.wav');
if (!existsSync(wavPath)) {
  console.error('\nKHÔNG TÌM THẤY tests/fixtures/speech.wav — tạo trước bằng scripts/make-speech-fixture.ps1');
  process.exit(3);
}
const wav = readFileSync(wavPath);
console.log('\nspeech.wav:', wav.length, 'bytes');

// ---- [2] Files API upload (đúng URL) ----
let fileUri = null;
console.log('\n[2] Files API upload → /upload/v1beta/files');
{
  const r = await call(`${ORIGIN}/upload/v1beta/files`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': key,
      'X-Goog-Upload-Protocol': 'raw',
      'X-Goog-Upload-Command': 'start, upload, finalize',
      'X-Goog-Upload-Header-Content-Length': String(wav.length),
      'X-Goog-Upload-Header-Content-Type': 'audio/wav',
      'Content-Type': 'audio/wav',
    },
    body: wav,
  });
  console.log('  status', r.status);
  fileUri = r.json?.file?.uri ?? null;
  console.log('  file.uri:', fileUri ?? '(thất bại) ' + r.text.slice(0, 300));
}

// ---- [3] Interactions transcribe (verbatim + word timestamps) ----
if (fileUri) {
  console.log('\n[3] POST /v1beta/interactions — verbatim + word timestamps');
  const r = await call(`${ORIGIN}/v1beta/interactions`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gemini-3.5-transcribe',
      input: [{ type: 'audio', uri: fileUri, mime_type: 'audio/wav' }],
      generation_config: {
        transcription_config: {
          mode: { type: 'verbatim', timestamp_granularities: ['word'] },
        },
      },
    }),
  });
  console.log('  status', r.status);
  const out = r.json?.output_text ?? r.json?.result?.output_text ?? '';
  const words =
    r.json?.words ??
    r.json?.result?.words ??
    (r.json?.annotations ?? r.json?.result?.annotations ?? []).flatMap((a) => a?.words ?? []);
  console.log('  output_text:', JSON.stringify(out.slice(0, 200)));
  console.log('  số words có timestamp:', Array.isArray(words) ? words.length : 0);
  if (Array.isArray(words) && words.length > 0) {
    console.log('  word[0]:', JSON.stringify(words[0]));
    console.log('  word[last]:', JSON.stringify(words[words.length - 1]));
  }
  if (r.status !== 200) console.log('  body:', r.text);
}

// ---- [4] Interactions với audio INLINE (không upload) ----
console.log('\n[4] POST /v1beta/interactions — inline base64 audio');
{
  const r = await call(`${ORIGIN}/v1beta/interactions`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gemini-3.5-transcribe',
      input: [{ type: 'audio', data: wav.toString('base64'), mime_type: 'audio/wav' }],
      generation_config: {
        transcription_config: {
          mode: { type: 'verbatim', timestamp_granularities: ['word'] },
        },
      },
    }),
  });
  console.log('  status', r.status);
  const out = r.json?.output_text ?? r.json?.result?.output_text ?? '';
  const words =
    r.json?.words ??
    r.json?.result?.words ??
    (r.json?.annotations ?? r.json?.result?.annotations ?? []).flatMap((a) => a?.words ?? []);
  console.log('  output_text:', JSON.stringify(String(out).slice(0, 200)));
  console.log('  số words có timestamp:', Array.isArray(words) ? words.length : 0);
  if (r.status !== 200) console.log('  body:', r.text);
}
