import type { Word } from '../asr/types';

/**
 * Segmentation into subtitle units (docs/plan.md §1.3, §1.4, §3 step 5).
 *
 *  - Break at sentence punctuation and at length/word caps.
 *  - Max 2 lines × 42 chars, max ~18 words/unit.
 *  - Merge units shorter than ~1s so captions don't flicker.
 */

export interface SubtitleUnit {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  translation?: string;
  /** Warning badges, e.g. a term that had to be spliced back. */
  badge?: string[];
}

export interface SegmentOptions {
  maxChars?: number;
  maxWords?: number;
  minDurationMs?: number;
}

const DEFAULT_MAX_CHARS = 84; // 2 lines x 42 chars (Netflix/BBC guidance)
const DEFAULT_MAX_WORDS = 18;
const DEFAULT_MIN_DURATION_MS = 1000;

let seq = 0;
function unitId(): string {
  seq += 1;
  return `u${Date.now().toString(36)}-${seq}`;
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function segment(words: Word[], options: SegmentOptions = {}): SubtitleUnit[] {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const maxWords = options.maxWords ?? DEFAULT_MAX_WORDS;
  const minDurationMs = options.minDurationMs ?? DEFAULT_MIN_DURATION_MS;

  if (words.length === 0) return [];

  const raw: SubtitleUnit[] = [];
  let buf: Word[] = [];
  let chars = 0;

  const flush = () => {
    if (buf.length === 0) return;
    const first = buf[0]!;
    const last = buf[buf.length - 1]!;
    raw.push({
      id: unitId(),
      startMs: first.startMs,
      endMs: last.endMs,
      text: normalize(buf.map((w) => w.text).join(' ')),
    });
    buf = [];
    chars = 0;
  };

  for (const w of words) {
    const piece = w.text;
    const endsSentence = /[.!?…]\s*$/.test(piece);
    const wouldOverflowChars = chars > 0 && chars + 1 + piece.length > maxChars;
    const wouldOverflowWords = buf.length >= maxWords;
    if (wouldOverflowChars || wouldOverflowWords) flush();
    buf.push(w);
    chars += (chars > 0 ? 1 : 0) + piece.length;
    if (endsSentence) flush();
  }
  flush();

  // Merge units shorter than the minimum duration into neighbours.
  const merged: SubtitleUnit[] = [];
  for (const u of raw) {
    const dur = u.endMs - u.startMs;
    if (dur < minDurationMs && merged.length > 0) {
      const prev = merged[merged.length - 1]!;
      prev.text = normalize(`${prev.text} ${u.text}`);
      prev.endMs = u.endMs;
    } else {
      merged.push(u);
    }
  }
  return merged.filter((u) => u.text.length > 0);
}

/** Display duration following CPS guidance: max(chars ÷ 17, 1s). */
export function displayDurationMs(charCount: number, cps = 17): number {
  return Math.max(Math.round((charCount / cps) * 1000), 1000);
}
