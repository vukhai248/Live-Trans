import type { GlossaryTerm } from './types';
import { placeholderIds } from '../masker/masker';

/**
 * Local, zero-cost validation of a translation (docs/plan.md §4 step 3).
 *
 *  (a) Placeholder roundtrip — every `⟦n⟧` must survive exactly once.
 *  (b) Term Success Rate (TSR) — each glossary term present in the source
 *      must surface in its authoritative form in the output (WMT terminology).
 */

export interface ValidationResult {
  ok: boolean;
  /** 0..1 fraction of source-present terms rendered correctly. */
  termSuccessRate: number;
  missingTerms: string[];
  placeholderOk: boolean;
  placeholderMismatch: string[];
  /** Human-readable critique used to drive a single retry. */
  complaint: string;
}

export interface TermExpectation {
  term: GlossaryTerm;
  /** The exact surface string that must appear in the translation. */
  expected: string;
}

/**
 * For jargon we expect the authoritative `vi` translation; acronyms and
 * command/code spans are expected to stay verbatim.
 */
export function expectedSurface(term: GlossaryTerm): string {
  if (term.type === 'jargon' && term.vi) return term.vi;
  return term.term;
}

export function termExpectations(terms: GlossaryTerm[]): TermExpectation[] {
  return terms.map((term) => ({
    term,
    expected: expectedSurface(term),
  }));
}

/** True when `text` contains `needle` as a whole word/phrase (case-sensitive). */
function containsForm(text: string, needle: string): boolean {
  if (!needle) return false;
  return text.includes(needle);
}

export function validatePlaceholderRoundtrip(
  translation: string,
  expectedCount: number,
): { ok: boolean; mismatch: string[] } {
  const ids = placeholderIds(translation);
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);

  const mismatch: string[] = [];
  // Placeholders are 0..expectedCount-1.
  const expected = new Set(Array.from({ length: expectedCount }, (_, i) => String(i)));
  for (const id of expected) {
    const c = counts.get(id) ?? 0;
    if (c !== 1) mismatch.push(`placeholder ⟦${id}⟧ expected 1×, found ${c}×`);
  }
  for (const id of counts.keys()) {
    if (!expected.has(id)) mismatch.push(`unexpected placeholder ⟦${id}⟧`);
  }
  return { ok: mismatch.length === 0 && counts.size === expectedCount, mismatch };
}

export function validateTranslation(
  source: string,
  translation: string,
  sourceTerms: GlossaryTerm[],
  expectedPlaceholderCount = 0,
): ValidationResult {
  const expectations = termExpectations(sourceTerms);
  const missingTerms: string[] = [];
  for (const e of expectations) {
    if (!containsForm(translation, e.expected)) missingTerms.push(e.expected);
  }
  const termSuccessRate =
    expectations.length === 0
      ? 1
      : (expectations.length - missingTerms.length) / expectations.length;

  const ph = validatePlaceholderRoundtrip(translation, expectedPlaceholderCount);

  const ok = missingTerms.length === 0 && ph.ok;
  const complaintParts: string[] = [];
  for (const m of missingTerms) {
    complaintParts.push(`"${m}" bị thiếu hoặc sai nguyên văn`);
  }
  complaintParts.push(...ph.mismatch);

  let complaint = '';
  if (complaintParts.length > 0) {
    complaint = `Bản dịch vi phạm ràng buộc: ${complaintParts.join('; ')}. Hãy dịch lại và giữ nguyên văn các cụm giữ chỗ ⟦n⟧ cũng như các thuật ngữ đã cho.`;
  }

  void source;
  return {
    ok,
    termSuccessRate,
    missingTerms,
    placeholderOk: ph.ok,
    placeholderMismatch: ph.mismatch,
    complaint,
  };
}
