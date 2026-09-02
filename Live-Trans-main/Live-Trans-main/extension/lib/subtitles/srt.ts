import type { SubtitleUnit } from './segmenter';

function ts(ms: number): string {
  const total = Math.max(0, Math.round(ms));
  const h = Math.floor(total / 3_600_000);
  const m = Math.floor((total % 3_600_000) / 60_000);
  const s = Math.floor((total % 60_000) / 1000);
  const milli = total % 1000;
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(milli, 3)}`;
}

/** Bilingual .srt: translated line first (if present), original second. */
export function toSrt(units: SubtitleUnit[]): string {
  return units
    .map((u, i) => {
      const lines: string[] = [];
      if (u.translation) lines.push(u.translation);
      lines.push(u.text);
      return `${i + 1}\n${ts(u.startMs)} --> ${ts(u.endMs)}\n${lines.join('\n')}`;
    })
    .join('\n\n');
}

/** Plain-text transcript (translation only when available, else source). */
export function toText(units: SubtitleUnit[]): string {
  return units.map((u) => u.translation ?? u.text).join('\n');
}
