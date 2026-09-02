#!/usr/bin/env node
/** Verify Files upload + gemini-3.5-transcribe (pre-recorded, word timestamps). */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const key =
  process.env.GEMINI_API_KEY ??
  (() => {
    const p = join(__dirname, '..', '.env');
    if (existsSync(p)) {
      const m = readFileSync(p, 'utf8').match(/^GEMINI_API_KEY=(.+)$/m);
      if (m) return m[1].trim();
    }
    return '';
  })();

const BASE = 'https://generativelanguage.googleapis.com';
const AUTH = { 'x-goog-api-key': key };

async function raw(url, init) {
  const res = await fetch(url, init);
  return { status: res.status, headers: res.headers, text: (await res.text()).slice(0, 600) };
}

const wav = makeToneWav();
console.log('wav bytes:', wav.length);

// Attempt A: single-shot raw media upload.
console.log('\n[A] raw media upload /upload/v1beta/files');
{
  const r = await raw(`${BASE}/upload/v1beta/files`, {
    method: 'POST',
    headers: {
      ...AUTH,
      'X-Goog-Upload-Protocol': 'raw',
      'X-Goog-Upload-Command': 'start, upload, finalize',
      'X-Goog-Upload-Header-Content-Length': String(wav.length),
      'X-Goog-Upload-Header-Content-Type': 'audio/wav',
      'Content-Type': 'audio/wav',
    },
    body: wav,
  });
  console.log('  status', r.status);
  console.log('  body  ', r.text);
  if (r.status === 200) {
    const j = JSON.parse(r.text);
    console.log('  FILE URI:', j?.file?.uri);
    await tryTranscribe(j?.file?.uri);
    process.exit(0);
  }
}

// Attempt B: resumable flow.
console.log('\n[B] resumable start');
{
  const r = await raw(`${BASE}/upload/v1beta/files`, {
    method: 'POST',
    headers: {
      ...AUTH,
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(wav.length),
      'X-Goog-Upload-Header-Content-Type': 'audio/wav',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: 'tone.wav' } }),
  });
  console.log('  status', r.status);
  const uploadUrl = r.headers.get('x-goog-upload-url');
  console.log('  upload-url:', uploadUrl);
  if (uploadUrl) {
    const up = await raw(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': String(wav.length),
        'X-Goog-Upload-Offset': '0',
        'X-Goog-Upload-Command': 'upload, finalize',
      },
      body: wav,
    });
    console.log('  upload status', up.status);
    console.log('  upload body  ', up.text);
    const j = JSON.parse(up.text);
    await tryTranscribe(j?.file?.uri);
  }
}

async function tryTranscribe(uri) {
  if (!uri) { console.log('  (no file uri)'); return; }
  console.log('\n[C] transcribe via /models/gemini-3.5-transcribe:transcribe');
  let r = await raw(`${BASE}/v1beta/models/gemini-3.5-transcribe:transcribe`, {
    method: 'POST',
    headers: { ...AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: [{ type: 'audio', uri, mime_type: 'audio/wav' }],
      generation_config: { transcription_config: { punctuation: true, enable_word_time_offsets: true } },
    }),
  });
  console.log('  status', r.status);
  console.log('  body  ', r.text);
  if (r.status !== 200) {
    console.log('\n[D] fallback /interactions {model,input}');
    r = await raw(`${BASE}/v1beta/interactions`, {
      method: 'POST',
      headers: { ...AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemini-3.5-transcribe',
        input: [{ type: 'audio', uri, mime_type: 'audio/wav' }],
      }),
    });
    console.log('  status', r.status);
    console.log('  body  ', r.text);
  }
}

function makeToneWav(sampleRate = 16000, seconds = 1.5, freq = 440) {
  const n = Math.floor(sampleRate * seconds);
  const dataSize = n * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + dataSize, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < n; i++) {
    const s = Math.sin((2 * Math.PI * freq * i) / sampleRate) * 0.4;
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  return buf;
}
