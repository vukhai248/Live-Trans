import type { GlossaryDoc } from '../glossary/types';

/**
 * Step 1 of the translation pipeline (docs/plan.md §4).
 *
 * Replace non-translatable spans — code, commands, URLs, identifiers — with
 * `⟦n⟧` placeholders so the LLM can never mangle them. This is deliberately
 * local and free: no model call before masking.
 */

export interface MaskResult {
  masked: string;
  /** placeholder (without brackets) -> original span text */
  map: Record<string, string>;
  count: number;
}

const PH_RE = /⟦(\d+)⟧/g;

function buildPatterns(): RegExp[] {
  return [
    // inline code span / backticks
    /`[^`\n]+`/g,
    // URLs
    /(?:https?:\/\/|www\.)[^\s"'<>]+/gi,
    // shell/file-ish tokens with a dot-extension or a leading dash flag
    /\b(?:[a-z0-9_-]+\/[a-z0-9_./-]+|[a-z0-9-]+\.[a-z]{1,6}\b(?:[^\s]*)?)/g,
    // camelCase / PascalCase identifiers
    /\b[a-z][a-z0-9]*[A-Z][a-zA-Z0-9]*\b/g,
    // snake_case identifiers
    /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g,
  ];
}

interface Span {
  start: number;
  end: number;
  text: string;
}

function collectSpans(text: string, glossary: GlossaryDoc): Span[] {
  const spans: Span[] = [];

  // Glossary command/code terms are always verbatim-protected.
  for (const g of glossary.terms) {
    if (g.type !== 'command' && g.type !== 'code') continue;
    const needle = g.term;
    if (!needle) continue;
    let idx = text.toLowerCase().indexOf(needle.toLowerCase());
    while (idx !== -1) {
      spans.push({
        start: idx,
        end: idx + needle.length,
        text: text.slice(idx, idx + needle.length),
      });
      idx = text.toLowerCase().indexOf(needle.toLowerCase(), idx + 1);
    }
  }

  for (const re of buildPatterns()) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      spans.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
    }
  }

  return spans;
}

export function mask(text: string, glossary: GlossaryDoc): MaskResult {
  const spans = collectSpans(text, glossary)
    .filter((s) => s.text.trim().length > 0)
    .sort((a, b) => a.start - b.start || b.end - a.end);

  // Drop overlapping spans, keeping the first (leftmost/longest).
  const kept: Span[] = [];
  let coveredUntil = -1;
  for (const s of spans) {
    if (s.start < coveredUntil) continue;
    kept.push(s);
    coveredUntil = s.end;
  }

  const map: Record<string, string> = {};
  const parts: string[] = [];
  let cursor = 0;
  kept.forEach((s, i) => {
    parts.push(text.slice(cursor, s.start));
    const ph = `⟦${i}⟧`;
    map[String(i)] = s.text;
    parts.push(ph);
    cursor = s.end;
  });
  parts.push(text.slice(cursor));

  return { masked: parts.join(''), map, count: kept.length };
}

/** Replaces all placeholders with their original text. */
export function restore(text: string, map: Record<string, string>): string {
  return text.replace(PH_RE, (full, n: string) => map[n] ?? full);
}

/** Returns the set of placeholder ids present in `text`. */
export function placeholderIds(text: string): string[] {
  const ids: string[] = [];
  for (const m of text.matchAll(PH_RE)) {
    ids.push(m[1] as string);
  }
  return ids;
}
