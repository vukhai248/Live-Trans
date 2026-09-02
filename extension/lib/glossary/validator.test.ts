import { describe, expect, test } from 'vitest';
import { selectTerms } from './selector';
import { validateTranslation } from './validator';
import type { GlossaryTerm } from './types';

const terms: GlossaryTerm[] = [
  { term: 'gradient descent', type: 'jargon', vi: 'hạ gradient' },
  { term: 'GAN', type: 'acronym', vi: 'mạng đối sinh' },
];

describe('selectTerms', () => {
  test('selects only terms present in source', () => {
    const g = {
      version: 1 as const,
      terms: [
        { term: 'useEffect', type: 'code' as const },
        { term: 'gradient descent', type: 'jargon' as const, vi: 'hạ gradient' },
      ],
    };
    const r = selectTerms('The useEffect hook', g);
    expect(r).toHaveLength(1);
    expect(r[0]!.term).toBe('useEffect');
  });
});

describe('validateTranslation (TSR)', () => {
  test('passes when authoritative forms are present', () => {
    const r = validateTranslation(
      'We use gradient descent and a GAN.',
      'Chúng tôi dùng hạ gradient và GAN.',
      terms,
      0,
    );
    expect(r.termSuccessRate).toBe(1);
    expect(r.ok).toBe(true);
  });

  test('fails and complains when a jargon translation is missing', () => {
    const r = validateTranslation('gradient descent', 'hạ dốc', [
      { term: 'gradient descent', type: 'jargon', vi: 'hạ gradient' },
    ]);
    expect(r.missingTerms).toContain('hạ gradient');
    expect(r.ok).toBe(false);
    expect(r.complaint).toContain('hạ gradient');
  });

  test('placeholder roundtrip must have each placeholder exactly once', () => {
    const ok = validateTranslation('x ⟦0⟧', 'x ⟦0⟧', [], 1);
    expect(ok.placeholderOk).toBe(true);
    expect(ok.ok).toBe(true);

    const bad = validateTranslation('x ⟦0⟧', 'x', [], 1);
    expect(bad.placeholderOk).toBe(false);
    expect(bad.ok).toBe(false);
  });
});
