// Interactions + verbatim + word timestamps — dump full JSON để tìm vị trí annotations/words.
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
    generation_config: {
      transcription_config: {
        mode: { type: 'verbatim', timestamp_granularities: ['word'] },
      },
    },
  }),
});
console.log('status', res.status);
const text = await res.text();
const json = JSON.parse(text);
console.log('top-level keys:', Object.keys(json).join(', '));
const steps = json.steps ?? [];
for (const s of steps) {
  console.log('step type:', s.type, '| content items:', (s.content ?? []).length);
  for (const c of s.content ?? []) {
    console.log('  content type:', c.type, '| keys:', Object.keys(c).join(', '));
    if (c.text) console.log('  text:', c.text.slice(0, 120));
    if (c.annotations) {
      console.log('  annotations count:', c.annotations.length);
      console.log('  annotations[0]:', JSON.stringify(c.annotations[0]));
      console.log('  annotations[last]:', JSON.stringify(c.annotations[c.annotations.length - 1]));
    }
  }
}
console.log('\nfull JSON length:', text.length);
