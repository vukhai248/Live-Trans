import { describe, expect, test } from 'vitest';
import { toSrt, toText } from './srt';
import type { SubtitleUnit } from './segmenter';

function unit(
  text: string,
  translation: string | undefined,
  startMs: number,
  endMs: number,
): SubtitleUnit {
  return { id: 'u', startMs, endMs, text, translation };
}

describe('toSrt', () => {
  test('formats a single bilingual entry with translation first', () => {
    const srt = toSrt([unit('Hello', 'Xin chào', 0, 2000)]);
    expect(srt).toBe('1\n00:00:00,000 --> 00:00:02,000\nXin chào\nHello');
  });

  test('separates multiple entries with a blank line', () => {
    const srt = toSrt([unit('A', '1', 0, 1000), unit('B', '2', 1000, 2500)]);
    expect(srt).toContain('\n\n2\n');
    expect(srt).toContain('00:00:00,000 --> 00:00:01,000');
    expect(srt).toContain('00:00:01,000 --> 00:00:02,500');
  });

  test('falls back to the original line when no translation exists', () => {
    const srt = toSrt([unit('Hello', undefined, 0, 1000)]);
    expect(srt).toBe('1\n00:00:00,000 --> 00:00:01,000\nHello');
  });

  test('returns an empty string for no units', () => {
    expect(toSrt([])).toBe('');
  });

  test('formats timestamps past one hour correctly', () => {
    const srt = toSrt([unit('A', '1', 3_660_000, 3_661_000)]);
    expect(srt).toContain('01:01:00,000 --> 01:01:01,000');
  });

  test('pads milliseconds to three digits', () => {
    const srt = toSrt([unit('A', '1', 0, 5)]);
    expect(srt).toContain('00:00:00,000 --> 00:00:00,005');
  });
});

describe('toText', () => {
  test('prefers the translation when available', () => {
    expect(toText([unit('A', '1', 0, 1000)])).toBe('1');
  });

  test('falls back to the original when no translation exists', () => {
    expect(toText([unit('A', undefined, 0, 1000)])).toBe('A');
  });

  test('joins multiple units with newlines', () => {
    expect(toText([unit('A', '1', 0, 1000), unit('B', '2', 1000, 2000)])).toBe('1\n2');
  });

  test('returns an empty string for no units', () => {
    expect(toText([])).toBe('');
  });
});
