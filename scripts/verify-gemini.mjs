#!/usr/bin/env node
/**
 * Verify the Gemini API key + the exact endpoints Live-Trans relies on.
 * Run:  node scripts/verify-gemini.mjs
 * Reads GEMINI_API_KEY from ./.env (or process env). Never prints the key.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const key =
  process.env.GEMINI_API_KEY ??
  (() => {
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
console.log('key prefix:', key.slice(0, 6) + '…', 'length', key.length);

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

async function call(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-json */
  }
  return { status: res.status, text: text.slice(0, 400), json };
}

// 1) Flash generateContent — is the model id + key style valid?
console.log('\n[1] flash generateContent (translate path)');
{
  const r = await call(`${BASE}/models/gemini-3.5-flash:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: 'Translate "hello" to Vietnamese. Reply with one word only.' }] }],
    }),
  });
  console.log('  status', r.status);
  console.log('  body  ', r.status === 200 ? JSON.stringify(r.json) : r.text);
}

// 2) Files API upload of a small WAV.
console.log('\n[2] Files API upload (audio WAV)');
const wav = makeToneWav(16000, 1.2, 440);
const upRes = await call(
  `${BASE}/upload/v1beta/files?key=${key}`,
  {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'raw',
      'X-Goog-Upload-Command': 'start, upload, finalize',
      'X-Goog-Upload-Header-Content-Type': 'audio/wav',
      'Content-Type': 'audio/wav',
    },
    body: wav,
  },
);
console.log('  upload status', upRes.status);
console.log('  upload json  ', JSON.stringify(upRes.json).slice(0, 500));
const fileUri = upRes.json?.file?.uri ?? null;

// 3) Interactions API transcribe (pre-recorded + word timestamps).
if (fileUri) {
  console.log('\n[3] interactions transcribe (pre-recorded)');
  const r = await call(`${BASE}/models/gemini-3.5-transcribe:transcribe`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: [{ type: 'audio', uri: fileUri, mime_type: 'audio/wav' }],
      generation_config: {
        transcription_config: { punctuation: true, enable_word_time_offsets: true },
      },
    }),
  });
  console.log('  status', r.status);
  console.log('  body  ', r.text);

  // Alternate endpoint shape: /interactions with top-level model (per docs).
  if (r.status !== 200) {
    console.log('\n[3b] fallback: POST /interactions with {model, input}');
    const r2 = await call(`${BASE}/interactions`, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemini-3.5-transcribe',
        input: [{ type: 'audio', uri: fileUri, mime_type: 'audio/wav' }],
      }),
    });
    console.log('  status', r2.status);
    console.log('  body  ', r2.text);
  }
} else {
  console.log('  (skip transcribe — no file uri)');
}

// ---- helpers ----
function makeToneWav(sampleRate, seconds, freq) {
  const n = Math.floor(sampleRate * seconds);
  const dataSize = n * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); // fmt chunk size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < n; i++) {
    const s = Math.sin((2 * Math.PI * freq * i) / sampleRate) * 0.4;
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  return buf;
}
