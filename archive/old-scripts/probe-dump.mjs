// Dump FULL response của /v1beta/interactions (inline audio) để xem shape thật.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const key = readFileSync(join(__dirname, '..', '.env'), 'utf8').match(/^GEMINI_API_KEY=(.+)$/m)[1].trim();
const wav = readFileSync(join(__dirname, '..', 'tests', 'fixtures', 'speech.wav'));

const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
  method: 'POST',
  headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'gemini-3.5-transcribe',
    input: [{ type: 'audio', data: wav.toString('base64'), mime_type: 'audio/wav' }],
  }),
});
console.log('status', res.status);
const text = await res.text();
console.log(text.slice(0, 3500));
