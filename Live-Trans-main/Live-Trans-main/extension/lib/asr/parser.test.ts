import { describe, expect, test } from 'vitest';
import { parseTranscribeResult } from './parser';
import type { Word } from './types';

describe('parseTranscribeResult', () => {
  test('extracts output_text from the top-level field', () => {
    const r = parseTranscribeResult({ output_text: 'hello world' });
    expect(r.text).toBe('hello world');
  });

  test('extracts output_text from result.output_text fallback', () => {
    const r = parseTranscribeResult({ result: { output_text: 'fallback text' } });
    expect(r.text).toBe('fallback text');
  });

  test('extracts text from legacy text fields', () => {
    const r = parseTranscribeResult({ text: 'legacy text' });
    expect(r.text).toBe('legacy text');
  });

  test('returns empty text and words for empty input', () => {
    const r = parseTranscribeResult({});
    expect(r.text).toBe('');
    expect(r.words).toEqual([]);
  });

  test('parses word timestamps from duration strings like 0.100s', () => {
    const r = parseTranscribeResult({
      output_text: 'hello world',
      words: [
        { word: 'hello', start_offset: '0.000s', end_offset: '0.300s' },
        { word: 'world', start_offset: '0.300s', end_offset: '0.600s' },
      ],
    });
    expect(r.words).toEqual<Word[]>([
      { text: 'hello', startMs: 0, endMs: 300 },
      { text: 'world', startMs: 300, endMs: 600 },
    ]);
  });

  test('parses word timestamps from alternative field names', () => {
    // Values >= 1000 are treated as milliseconds; values < 1000 are treated as seconds.
    const r = parseTranscribeResult({
      output_text: 'hello world',
      words: [
        { word: 'hello', startMs: 1000, endMs: 1400 },
        { word: 'world', start_ms: 1400, end_ms: 1700 },
      ],
    });
    expect(r.words[0]).toEqual({ text: 'hello', startMs: 1000, endMs: 1400 });
    expect(r.words[1]).toEqual({ text: 'world', startMs: 1400, endMs: 1700 });
  });

  test('walks nested word-list paths', () => {
    const r = parseTranscribeResult({
      result: {
        output_text: 'hello world',
        audio_transcription: {
          words: [{ word: 'hello', start_offset: '0.000s', end_offset: '0.300s' }],
        },
      },
    });
    expect(r.words).toHaveLength(1);
    expect(r.words[0]).toEqual({ text: 'hello', startMs: 0, endMs: 300 });
  });

  test('unwraps annotations entries with nested words arrays', () => {
    const r = parseTranscribeResult({
      output_text: 'hello world',
      annotations: [
        {
          words: [
            { word: 'hello', start_offset: '0.000s', end_offset: '0.300s' },
            { word: 'world', start_offset: '0.300s', end_offset: '0.600s' },
          ],
        },
      ],
    });
    expect(r.words).toHaveLength(2);
    expect(r.words[1]).toEqual({ text: 'world', startMs: 300, endMs: 600 });
  });

  test('falls back to evenly-spaced word synthesis when no word list is present', () => {
    const r = parseTranscribeResult({ output_text: 'one two three' });
    expect(r.words).toHaveLength(3);
    expect(r.words[0]).toEqual({ text: 'one', startMs: 0, endMs: 400 });
    expect(r.words[1]).toEqual({ text: 'two', startMs: 400, endMs: 800 });
    expect(r.words[2]).toEqual({ text: 'three', startMs: 800, endMs: 1200 });
  });

  test('prefers real word timestamps over synthesized fallback', () => {
    const r = parseTranscribeResult({
      output_text: 'one two',
      words: [{ word: 'one', start_offset: '0.000s', end_offset: '0.500s' }],
    });
    expect(r.words).toHaveLength(1);
    expect(r.words[0]).toEqual({ text: 'one', startMs: 0, endMs: 500 });
  });

  test('extracts language_code when present', () => {
    const r = parseTranscribeResult({ output_text: 'bonjour', language_code: 'fr-FR' });
    expect(r.language).toBe('fr-FR');
  });

  test('extracts languageCode camelCase variant', () => {
    const r = parseTranscribeResult({ output_text: 'hola', languageCode: 'es-ES' });
    expect(r.language).toBe('es-ES');
  });
});
