import { describe, expect, test } from 'vitest';
import { selectTerms, MAX_PROMPT_TERMS } from './selector';
import type { GlossaryDoc } from './types';

describe('selectTerms', () => {
  test('returns only terms that actually appear in the source', () => {
    const g: GlossaryDoc = {
      version: 1,
      terms: [
        { term: 'npm run start', type: 'command' },
        { term: 'useEffect', type: 'code' },
        { term: 'gradient descent', type: 'jargon', vi: 'hạ gradient' },
      ],
    };
    const r = selectTerms('Run npm run start to check the hook', g);
    expect(r.map((t) => t.term)).toEqual(['npm run start']);
  });

  test('caps the result at the provided limit', () => {
    const g: GlossaryDoc = {
      version: 1,
      terms: Array.from({ length: MAX_PROMPT_TERMS + 5 }, (_, i) => ({
        term: `term${i}`,
        type: 'jargon' as const,
        vi: `vi${i}`,
      })),
    };
    const source = g.terms.map((t) => t.term).join(' ');
    const r = selectTerms(source, g);
    expect(r.length).toBe(MAX_PROMPT_TERMS);
  });

  test('respects a custom limit smaller than the default', () => {
    const g: GlossaryDoc = {
      version: 1,
      terms: [
        { term: 'a', type: 'jargon', vi: '1' },
        { term: 'b', type: 'jargon', vi: '2' },
        { term: 'c', type: 'jargon', vi: '3' },
      ],
    };
    const r = selectTerms('a b c', g, 2);
    expect(r.length).toBe(2);
    expect(r.map((t) => t.term)).toEqual(['a', 'b']);
  });

  test('prioritizes terms in glossary order when the source contains all of them', () => {
    const g: GlossaryDoc = {
      version: 1,
      terms: [
        { term: 'alpha', type: 'jargon', vi: 'a' },
        { term: 'beta', type: 'jargon', vi: 'b' },
        { term: 'gamma', type: 'jargon', vi: 'c' },
      ],
    };
    const r = selectTerms('gamma beta alpha', g, 2);
    expect(r.map((t) => t.term)).toEqual(['alpha', 'beta']);
  });

  test('matches case-insensitively', () => {
    const g: GlossaryDoc = {
      version: 1,
      terms: [
        { term: 'useEffect', type: 'code' },
        { term: 'gradient descent', type: 'jargon', vi: 'hạ gradient' },
      ],
    };
    const r = selectTerms('UseEffect is used here. Gradient Descent is the topic.', g);
    expect(r.map((t) => t.term)).toEqual(['useEffect', 'gradient descent']);
  });

  test('deduplicates terms that appear multiple times in the glossary', () => {
    const g: GlossaryDoc = {
      version: 1,
      terms: [
        { term: 'npm run start', type: 'command' },
        { term: 'npm run start', type: 'command' },
        { term: 'useEffect', type: 'code' },
      ],
    };
    const r = selectTerms('npm run start and useEffect', g);
    expect(r.length).toBe(2);
    expect(r.map((t) => t.term)).toEqual(['npm run start', 'useEffect']);
  });

  test('returns an empty list for an empty glossary or empty source', () => {
    const g: GlossaryDoc = { version: 1, terms: [] };
    expect(selectTerms('any text', g)).toEqual([]);

    const fullG: GlossaryDoc = {
      version: 1,
      terms: [{ term: 'useEffect', type: 'code' }],
    };
    expect(selectTerms('', fullG)).toEqual([]);
  });

  test('does not treat a substring as a match', () => {
    const g: GlossaryDoc = {
      version: 1,
      terms: [{ term: 'npm', type: 'command' }],
    };
    const r = selectTerms('npm run start', g);
    expect(r.map((t) => t.term)).toEqual(['npm']);
    expect(r).toHaveLength(1);
  });
});
