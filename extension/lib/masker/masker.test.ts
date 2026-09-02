import { describe, expect, test } from 'vitest';
import { mask, placeholderIds, restore } from './masker';
import type { GlossaryDoc } from '../glossary/types';

const glossary: GlossaryDoc = {
  version: 1,
  terms: [
    { term: 'npm run start', type: 'command' },
    { term: 'useEffect', type: 'code' },
    { term: 'gradient descent', type: 'jargon', vi: 'hạ gradient' },
  ],
};

describe('masker', () => {
  test('masks command/code terms behind placeholders', () => {
    const r = mask('Run npm run start and check useEffect', glossary);
    expect(r.masked).not.toContain('npm run start');
    expect(r.masked).not.toContain('useEffect');
    expect(r.masked).toMatch(/⟦\d+⟧/);
  });

  test('restore reconstructs the original exactly', () => {
    const input = 'Run npm run start then useEffect';
    const r = mask(input, glossary);
    expect(restore(r.masked, r.map)).toBe(input);
  });

  test('does not mask jargon (it is translated, not verbatim)', () => {
    const r = mask('gradient descent is key', glossary);
    expect(r.masked).toContain('gradient descent');
  });

  test('masks URLs regardless of glossary', () => {
    const r = mask('See https://example.com/x now', { version: 1, terms: [] });
    expect(r.masked).not.toContain('https://example.com/x');
    expect(restore(r.masked, r.map)).toBe('See https://example.com/x now');
  });

  test('placeholderIds lists ids', () => {
    expect(placeholderIds('a ⟦0⟧ b ⟦2⟧')).toEqual(['0', '2']);
  });
});
