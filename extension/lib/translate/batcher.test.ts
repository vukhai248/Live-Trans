import { describe, expect, test } from 'vitest';
import { Translator } from './batcher';
import type {
  Provider,
  TranslateBatchRequest,
  TranslateBatchResponse,
} from '../providers/provider';
import type { Transcript } from '../asr/types';
import type { Settings } from '../settings';
import type { GlossaryDoc } from '../glossary/types';
import type { SubtitleUnit } from '../subtitles/segmenter';

const settings: Settings = {
  mode: 'demo',
  apiKey: '',
  gatewayUrl: 'http://localhost:8787',
  targetLang: 'vi',
  sourceLang: 'en',
  chunkSeconds: 45,
  showOriginal: true,
  showTranslatedTitle: true,
  fontSize: 'medium',
  glossary: { version: 1, terms: [] },
};

class FakeProvider implements Provider {
  readonly mode = 'demo' as const;
  calls: TranslateBatchRequest[] = [];

  constructor(
    private handler: (
      req: TranslateBatchRequest,
      attempt: number,
    ) => TranslateBatchResponse,
  ) {}

  async translate(req: TranslateBatchRequest): Promise<TranslateBatchResponse> {
    this.calls.push(req);
    return this.handler(req, this.calls.length);
  }

  async transcribe(): Promise<Transcript> {
    return { id: 't', text: '', words: [] };
  }

  async translateTitle(title: string): Promise<string> {
    return title;
  }
}

function unit(text: string, startMs = 0, endMs = 1000): SubtitleUnit {
  return { id: 'u', startMs, endMs, text };
}

const commandGlossary: GlossaryDoc = {
  version: 1,
  terms: [{ term: 'npm run start', type: 'command' }],
};

const mixedGlossary: GlossaryDoc = {
  version: 1,
  terms: [
    { term: 'npm run start', type: 'command' },
    { term: 'gradient descent', type: 'jargon', vi: 'hạ gradient' },
  ],
};

describe('Translator', () => {
  test('translates a single unit without a glossary', async () => {
    const provider = new FakeProvider((req) => ({
      translations: req.units.map((u) => ({ text: `D:${u.masked}`, termsUsed: [] })),
    }));
    const translator = new Translator(provider, settings);
    const units = [unit('Hello world')];
    const r = await translator.translateBatch(units, { version: 1, terms: [] });

    expect(r.units[0]!.translation).toBe('D:Hello world');
    expect(r.stats.calls).toBe(1);
    expect(r.stats.retries).toBe(0);
    expect(r.stats.splices).toBe(0);
    expect(r.stats.tsr).toBe(1);
  });

  test('keeps command placeholders and restores them after translation', async () => {
    const provider = new FakeProvider((req) => ({
      translations: req.units.map((u) => ({
        text: u.masked.replace('Run', 'Chạy'),
        termsUsed: [],
      })),
    }));
    const translator = new Translator(provider, settings);
    const units = [unit('Run npm run start')];
    const r = await translator.translateBatch(units, commandGlossary);

    expect(r.units[0]!.translation).toBe('Chạy npm run start');
    expect(r.stats.calls).toBe(1);
    expect(r.stats.retries).toBe(0);
    expect(r.stats.splices).toBe(0);
  });

  test('terms survive (TSR = 1) when the provider follows the glossary', async () => {
    const provider = new FakeProvider((req) => ({
      translations: req.units.map((u) => ({
        text: u.masked.replace('gradient descent', 'hạ gradient'),
        termsUsed: [],
      })),
    }));
    const translator = new Translator(provider, settings);
    const units = [unit('Use gradient descent here')];
    const r = await translator.translateBatch(units, mixedGlossary);

    expect(r.units[0]!.translation).toBe('Use hạ gradient here');
    expect(r.stats.tsr).toBe(1);
    expect(r.stats.retries).toBe(0);
    expect(r.stats.splices).toBe(0);
  });

  test('retry(1) triggers on a first-fail then succeeds and updates stats', async () => {
    const provider = new FakeProvider((req, attempt) => {
      if (attempt === 1) {
        // First batch call drops the placeholder and the jargon term.
        return { translations: [{ text: 'Chạy', termsUsed: [] }] };
      }
      // Retry call returns both placeholder and jargon correctly.
      return {
        translations: [{ text: 'Chạy ⟦0⟧ để tối ưu hạ gradient', termsUsed: [] }],
      };
    });
    const translator = new Translator(provider, settings);
    const units = [unit('Run npm run start to optimize gradient descent')];
    const r = await translator.translateBatch(units, mixedGlossary);

    expect(r.units[0]!.translation).toBe('Chạy npm run start để tối ưu hạ gradient');
    expect(r.units[0]!.badge).toBeUndefined();
    expect(r.stats.retries).toBe(1);
    expect(r.stats.calls).toBe(2);
    expect(r.stats.splices).toBe(0);
    expect(r.stats.tsr).toBe(1);
  });

  test('splice/restore appends lost terms and restores placeholders when retry also fails', async () => {
    const provider = new FakeProvider(() => ({
      // Keeps the placeholder but translates the jargon wrong.
      translations: [{ text: 'Chạy ⟦0⟧ để tối ưu hạ dốc', termsUsed: [] }],
    }));
    const translator = new Translator(provider, settings);
    const units = [unit('Run npm run start to optimize gradient descent')];
    const r = await translator.translateBatch(units, mixedGlossary);

    const translation = r.units[0]!.translation;
    expect(translation).toContain('npm run start');
    expect(translation).toContain('hạ gradient');
    expect(r.units[0]!.badge).toContain('⚠ gradient descent');
    expect(r.stats.retries).toBe(1);
    expect(r.stats.calls).toBe(2);
    expect(r.stats.splices).toBe(1);
    expect(r.stats.tsr).toBeLessThan(1);
  });

  test('a term-loss case triggers the retry path with a single-unit retry request', async () => {
    const provider = new FakeProvider((req, attempt) => {
      if (attempt === 1) {
        return { translations: [{ text: 'Kết quả', termsUsed: [] }] };
      }
      return { translations: [{ text: 'Kết quả ⟦0⟧', termsUsed: [] }] };
    });
    const translator = new Translator(provider, settings);
    const units = [unit('The result is npm run start')];
    const r = await translator.translateBatch(units, commandGlossary);

    expect(r.units[0]!.translation).toBe('Kết quả npm run start');
    expect(r.stats.retries).toBe(1);
    expect(provider.calls.length).toBe(2);
    expect(provider.calls[1]!.units).toHaveLength(1);
  });

  test('accumulates context pairs across batches', async () => {
    const provider = new FakeProvider((req) => ({
      translations: req.units.map((u) => ({ text: `D:${u.masked}`, termsUsed: [] })),
    }));
    const translator = new Translator(provider, settings);
    await translator.translateBatch([unit('First')], { version: 1, terms: [] });
    const r = await translator.translateBatch([unit('Second')], {
      version: 1,
      terms: [],
    });

    expect(r.contextPairs).toHaveLength(2);
    expect(r.contextPairs[0]).toEqual({ source: 'First', target: 'D:First' });
    expect(r.contextPairs[1]).toEqual({ source: 'Second', target: 'D:Second' });
  });

  test('caps context pairs at 5', async () => {
    const provider = new FakeProvider((req) => ({
      translations: req.units.map((u) => ({ text: u.masked, termsUsed: [] })),
    }));
    const translator = new Translator(provider, settings);
    for (let i = 0; i < 7; i++) {
      await translator.translateBatch([unit(`u${i}`)], { version: 1, terms: [] });
    }
    const r = await translator.translateBatch([unit('last')], { version: 1, terms: [] });
    expect(r.contextPairs).toHaveLength(5);
    expect(r.contextPairs[0]).toEqual({ source: 'u3', target: 'u3' });
    expect(r.contextPairs[4]).toEqual({ source: 'last', target: 'last' });
  });
});
