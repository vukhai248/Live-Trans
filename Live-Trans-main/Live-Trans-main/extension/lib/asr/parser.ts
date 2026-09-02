import type { Transcript, Word } from './types';

/**
 * Parser for `gemini-3.5-transcribe` (Interactions API) responses, isolated in
 * its own module because the endpoint is still in public preview (plan §5) and
 * its response shape may drift. Only this file needs updating if it does.
 *
 * Verified live (2026-09-02): the transcript text is in `interaction.output_text`;
 * word-level timestamps come back as `start_offset`/`end_offset` duration strings
 * (e.g. "0.100s") on word objects under a `words`/`annotations` list. We accept
 * several field spellings and units to stay resilient.
 */

const WORD_LISTS = [
  'words',
  'audio_transcription.words',
  'result.words',
  'result.audio_transcription.words',
  'annotations',
  'result.annotations',
];

export function parseTranscribeResult(data: any): Transcript {
  const rawText: string = firstString(
    data?.output_text,
    data?.transcript,
    data?.result?.output_text,
    data?.result?.text,
    data?.text,
  );

  const words: Word[] = [];
  for (const path of WORD_LISTS) {
    const list = getPath(data, path);
    if (!Array.isArray(list)) continue;
    for (const w of list) {
      if (path.includes('annotations')) {
        // Annotations entries are { words: [...] } containers.
        const nested = w?.words;
        if (Array.isArray(nested)) {
          for (const nw of nested) pushWord(words, nw);
        } else {
          pushWord(words, w);
        }
      } else {
        pushWord(words, w);
      }
    }
    if (words.length > 0) break; // first non-empty list wins
  }

  // Fallback: text without word timestamps → synthesize evenly.
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

function pushWord(target: Word[], w: any): void {
  const text: string = w?.word ?? w?.text ?? '';
  if (!text) return;
  const startMs = parseOffset(
    w?.start_offset,
    w?.startMs,
    w?.start_ms,
    w?.start,
    w?.begin,
  );
  const endMs = parseOffset(w?.end_offset, w?.endMs, w?.end_ms, w?.end);
  if (startMs === undefined || endMs === undefined) return;
  target.push({ text, startMs, endMs });
}

/** Parse a timestamp that may be a duration string ("0.100s"), or ms/seconds number. */
function parseOffset(...values: unknown[]): number | undefined {
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
    if (typeof v === 'number' && Number.isFinite(v)) {
      return v < 1000 ? Math.round(v * 1000) : Math.round(v);
    }
  }
  return undefined;
}

function firstString(...values: unknown[]): string {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

function getPath(obj: any, dotted: string): any {
  let cur = obj;
  for (const key of dotted.split('.')) {
    if (cur == null) return undefined;
    cur = cur[key];
  }
  return cur;
}
