import type { GlossaryDoc, GlossaryTerm } from './types';

/**
 * ParseJargon (CHI 2025) shows a small, relevant glossary beats a large one:
 * injecting only the terms actually present in the source raises usefulness.
 * We therefore select terms that appear in the source, capped at a budget
 * (plan §1.5: ≤15–25 terms).
 */
export const MAX_PROMPT_TERMS = 25;

export function selectTerms(
  source: string,
  glossary: GlossaryDoc,
  limit: number = MAX_PROMPT_TERMS,
): GlossaryTerm[] {
  const src = source.toLowerCase();
  const seen = new Set<string>();
  const selected: GlossaryTerm[] = [];
  for (const t of glossary.terms) {
    if (!t.term || seen.has(t.term.toLowerCase())) continue;
    if (!src.includes(t.term.toLowerCase())) continue;
    seen.add(t.term.toLowerCase());
    selected.push(t);
    if (selected.length >= limit) break;
  }
  return selected;
}
