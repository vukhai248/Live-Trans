import { describe, expect, test } from 'vitest';
import { buildTranslatePrompt, parseTranslateBatch } from './prompt';

describe('translate prompt', () => {
  test('builds a prompt with placeholders and glossary rules', () => {
    const prompt = buildTranslatePrompt({
      units: [
        { source: 'npm run start', masked: '⟦0⟧ start', maskMap: { '0': 'npm run' } },
      ],
      selectedTerms: [{ term: 'gradient descent', type: 'jargon', vi: 'hạ gradient' }],
      contextPairs: [],
      targetLang: 'vi',
      sourceLang: 'en',
    });
    expect(prompt).toContain('⟦0⟧');
    expect(prompt).toContain('gradient descent');
    expect(prompt).toContain('hạ gradient');
  });

  test('parses a JSON object response', () => {
    const text =
      '{"translations":[{"text":"Xin chào","terms_used":[]},{"text":"Tạm biệt","terms_used":[]}]}';
    const r = parseTranslateBatch(text, 2);
    expect(r.translations.map((t) => t.text)).toEqual(['Xin chào', 'Tạm biệt']);
  });

  test('pads missing entries and strips markdown fences', () => {
    const text = '```json\n{"translations":[{"text":"a"}]}\n```';
    const r = parseTranslateBatch(text, 2);
    expect(r.translations).toHaveLength(2);
    expect(r.translations[0]!.text).toBe('a');
    expect(r.translations[1]!.text).toBe('');
  });
});
