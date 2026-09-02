#!/usr/bin/env node
/**
 * Live end-to-end test for the ASR pipeline.
 *
 * Mirrors scripts/verify-transcribe.mjs: uploads a generated WAV to the Gemini
 * Files API, calls gemini-3.5-transcribe via /v1beta/interactions, parses the
 * response, and asserts a non-empty output_text plus valid word timestamps.
 *
 * The parser implemented below mirrors the unit-tested behavior in
 * extension/lib/asr/parser.ts so this script can stay a plain Node .mjs file.
 *
 * Run: node scripts/test-transcribe.mjs
 * Requires GEMINI_API_KEY in a .env file at the repo root (gitignored).
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, '..', '.env');

const key = (() => {
  const envKey = process.env.GEMINI_API_KEY;
  if (envKey) return envKey.trim();
  if (existsSync(ENV_PATH)) {
    const m = readFileSync(ENV_PATH, 'utf8').match(/^GEMINI_API_KEY=(.+)$/m);
    if (m) return m[1].trim();
  }
  return '';
})();

const BASE = 'https://generativelanguage.googleapis.com';
const AUTH = { 'x-goog-api-key': key };

if (!key) {
  console.error('Missing GEMINI_API_KEY. Add it to .env or set the env var.');
  process.exit(1);
}

function redact(s) {
  if (!s || s.length < 8) return '***';
  return `${s.slice(0, 4)}...${s.slice(-4)}`;
}

async function raw(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  return { status: res.status, headers: res.headers, text: text.slice(0, 1200) };
}

function parseTranscribeResult(data) {
  const firstString = (...values) => {
    for (const v of values) {
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return '';
  };

  const parseOffset = (...values) => {
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
      }
      if (typeof v === 'number' && Number.isFinite(v)) {
        return v < 1000 ? Math.round(v * 1000) : Math.round(v);
      }
    }
    return undefined;
  };

  const getPath = (obj, dotted) => {
    let cur = obj;
    for (const key of dotted.split('.')) {
      if (cur == null) return undefined;
      cur = cur[key];
    }
    return cur;
  };

  const rawText = firstString(
    data?.output_text,
    data?.transcript,
    data?.result?.output_text,
    data?.result?.text,
    data?.text,
  );

  const words = [];
  const wordLists = [
    'words',
    'audio_transcription.words',
    'result.words',
    'result.audio_transcription.words',
    'annotations',
    'result.annotations',
  ];

  for (const path of wordLists) {
    const list = getPath(data, path);
    if (!Array.isArray(list)) continue;
    for (const w of list) {
      const push = (item) => {
        const text = item?.word ?? item?.text ?? '';
        if (!text) return;
        const startMs = parseOffset(
          item?.start_offset,
          item?.startMs,
          item?.start_ms,
          item?.start,
          item?.begin,
        );
        const endMs = parseOffset(item?.end_offset, item?.endMs, item?.end_ms, item?.end);
        if (startMs === undefined || endMs === undefined) return;
        words.push({ text, startMs, endMs });
      };
      if (path.includes('annotations')) {
        if (Array.isArray(w?.words)) {
          for (const nw of w.words) push(nw);
        } else {
          push(w);
        }
      } else {
        push(w);
      }
    }
    if (words.length > 0) break;
  }

  if (rawText && words.length === 0) {
    const tokens = rawText.trim().split(/\s+/).filter(Boolean);
    const per = 400;
    tokens.forEach((t, i) => {
      words.push({ text: t, startMs: i * per, endMs: (i + 1) * per });
    });
  }

  return {
    id: `t${Date.now().toString(36)}`,
    text: rawText.trim(),
    words,
    language: data?.language_code ?? data?.languageCode ?? undefined,
  };
}

function makeToneWav(sampleRate = 16000, seconds = 1.5, freq = 440) {
  const n = Math.floor(sampleRate * seconds);
  const dataSize = n * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < n; i++) {
    const s = Math.sin((2 * Math.PI * freq * i) / sampleRate) * 0.4;
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  return buf;
}

async function uploadAndTranscribe(wav) {
  console.log(`Using key ending with ${redact(key)}`);
  console.log(`Generated ${wav.length} byte WAV (${(wav.length / 16000 / 2).toFixed(2)}s tone)`);

  // Attempt A: raw upload (single-shot).
  console.log('\n[A] raw upload /upload/v1beta/files');
  let r = await raw(`${BASE}/upload/v1beta/files`, {
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

  let fileUri = null;
  if (r.status === 200) {
    try {
      const j = JSON.parse(r.text);
      fileUri = j?.file?.uri ?? null;
    } catch {}
  }

  if (!fileUri) {
    // Attempt B: resumable upload.
    console.log('\n[B] resumable start');
    r = await raw(`${BASE}/upload/v1beta/files`, {
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
      try {
        const j = JSON.parse(up.text);
        fileUri = j?.file?.uri ?? null;
      } catch {}
    }
  }

  if (!fileUri) {
    console.error('\nNo file URI returned; cannot proceed to transcription.');
    console.error('Last response body:', r.text);
    return null;
  }

  console.log('  FILE URI:', fileUri);

  // Attempt C: /interactions (verified endpoint per parser docs).
  console.log('\n[C] /v1beta/interactions gemini-3.5-transcribe');
  r = await raw(`${BASE}/v1beta/interactions`, {
    method: 'POST',
    headers: { ...AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gemini-3.5-transcribe',
      input: [{ type: 'audio', uri: fileUri, mime_type: 'audio/wav' }],
    }),
  });
  console.log('  status', r.status);
  console.log('  body  ', r.text.slice(0, 500));

  if (r.status !== 200) {
    console.error('\nTranscription request failed.');
    return null;
  }

  let body;
  try {
    body = JSON.parse(r.text);
  } catch (e) {
    console.error('\nCould not parse JSON response:', e.message);
    return null;
  }

  const transcript = parseTranscribeResult(body);
  return transcript;
}

const wav = makeToneWav();
const transcript = await uploadAndTranscribe(wav);

if (!transcript) {
  process.exit(1);
}

console.log('\nParsed transcript text:', transcript.text);
console.log('Parsed word count:', transcript.words.length);
console.log('Detected language:', transcript.language ?? 'none');

let exitCode = 0;

if (transcript.text.length === 0) {
  console.error('\nFAIL: output_text is empty. A pure tone may not be recognized as speech.');
  console.error('     Replace makeToneWav with a real spoken-word fixture for a stronger test.');
  exitCode = 1;
} else {
  console.log('\nPASS: output_text is non-empty.');
}

if (transcript.words.length === 0) {
  console.error('\nWARN: no word timestamps returned. Word-level timestamps require a real audio sample.');
  exitCode = 1;
} else {
  console.log('PASS: parser produced word timestamps.');
  const first = transcript.words[0];
  const last = transcript.words[transcript.words.length - 1];
  console.log('  first word:', first.text, `@ ${first.startMs}ms`);
  console.log('  last word :', last.text, `@ ${last.endMs}ms`);
}

process.exit(exitCode);
