import { describe, expect, test } from 'vitest';
import { displayDurationMs, segment } from './segmenter';
import { toSrt, toText } from './srt';
import type { Word } from '../asr/types';

describe('segment', () => {
  test('breaks at sentence punctuation', () => {
    const words: Word[] = [
      { text: 'Hello', startMs: 0, endMs: 500 },
      { text: 'world.', startMs: 500, endMs: 1200 },
      { text: 'Next', startMs: 1600, endMs: 2100 },
      { text: 'line.', startMs: 2100, endMs: 3300 },
    ];
    const units = segment(words);
    expect(units.map((u) => u.text)).toEqual(['Hello world.', 'Next line.']);
  });

  test('caps length at maxChars', () => {
    const words: Word[] = Array.from({ length: 30 }, (_, i) => ({
      text: `word${i}`,
      startMs: i * 300,
      endMs: i * 300 + 250,
    }));
    const units = segment(words, { maxChars: 42, maxWords: 6 });
    for (const u of units) {
      expect(u.text.length).toBeLessThanOrEqual(42 + 1);
    }
    expect(units.length).toBeGreaterThan(1);
  });

  test('merges very short units', () => {
    const words: Word[] = [
      { text: 'Hi.', startMs: 0, endMs: 200 },
      { text: 'There', startMs: 500, endMs: 900 },
    ];
    const units = segment(words, { minDurationMs: 600 });
    expect(units).toHaveLength(1);
  });

  test('returns empty for no words', () => {
    expect(segment([])).toEqual([]);
  });
});

describe('displayDurationMs', () => {
  test('respects CPS and minimum 1s', () => {
    expect(displayDurationMs(0)).toBe(1000);
    expect(displayDurationMs(17)).toBe(1000);
    expect(displayDurationMs(34)).toBe(2000);
  });
});

describe('srt/text export', () => {
  test('formats timestamps and bilingual lines', () => {
    const units = [
      { id: '1', startMs: 0, endMs: 2000, text: 'Hi', translation: 'Xin chào' },
    ];
    const srt = toSrt(units);
    expect(srt).toContain('00:00:00,000 --> 00:00:02,000');
    expect(srt).toContain('Xin chào');
    expect(srt).toContain('Hi');
  });

  test('plain text prefers translation', () => {
    const units = [
      { id: '1', startMs: 0, endMs: 2000, text: 'Hi', translation: 'Xin chào' },
    ];
    expect(toText(units)).toBe('Xin chào');
  });
});
