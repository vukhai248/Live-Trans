import type { GlossaryDoc, GlossaryTerm } from '../glossary/types';
import { selectTerms } from '../glossary/selector';
import { expectedSurface, validateTranslation } from '../glossary/validator';
import { mask, restore } from '../masker/masker';
import type { SubtitleUnit } from '../subtitles/segmenter';
import type { ContextPair, Provider, TranslateBatchRequest } from '../providers/provider';
import type { Settings } from '../settings';

/**
 * The glossary-preserving translation pipeline (docs/plan.md §4):
 *
 *   mask → translate(batch 3–5) → validate TSR/roundtrip → retry(1) → splice
 *
 * Everything local (mask, validate, splice) is free; only the translate itself
 * spends a model call. The provider is injected so demo/direct/gateway run the
 * identical pipeline.
 */

export const BATCH_SIZE = 4;

export interface PipelineStats {
  /** Term Success Rate across the batch (pre-splice model output quality). */
  tsr: number;
  retries: number;
  splices: number;
  calls: number;
}

export interface TranslatedBatch {
  units: SubtitleUnit[];
  stats: PipelineStats;
  contextPairs: ContextPair[];
}

export class Translator {
  private contextPairs: ContextPair[] = [];

  constructor(
    private provider: Provider,
    private settings: Settings,
  ) {}

  async translateBatch(
    units: SubtitleUnit[],
    glossary: GlossaryDoc,
  ): Promise<TranslatedBatch> {
    const requests = this.buildRequests(units, glossary);
    const stats: PipelineStats = { tsr: 1, retries: 0, splices: 0, calls: 0 };
    let totalExpected = 0;
    let totalFound = 0;

    for (let i = 0; i < requests.length; i++) {
      const r = requests[i]!;
      const base = i * BATCH_SIZE;
      const response = await this.provider.translate(r, this.settings);
      stats.calls += 1;

      for (let j = 0; j < r.units.length; j++) {
        const unitIdx = base + j;
        const unit = units[unitIdx];
        if (!unit) continue;
        const maskedUnit = r.units[j]!;
        const raw = response.translations[j]?.text ?? '';

        const localTerms = r.termSubsets[j] ?? [];
        totalExpected += localTerms.length;
        let result = validateTranslation(
          maskedUnit.masked,
          raw,
          localTerms,
          maskedUnit.maskMap ? Object.keys(maskedUnit.maskMap).length : 0,
        );
        totalFound += localTerms.length - result.missingTerms.length;

        // Retry once with the concrete critique (plan §4 step 4).
        let bestText = raw;
        if (!result.ok) {
          stats.retries += 1;
          const retryReq: TranslateBatchRequest = {
            ...r,
            units: [maskedUnit],
          };
          const retry = await this.provider.translate(retryReq, this.settings);
          stats.calls += 1;
          const retryRaw = retry.translations[0]?.text ?? '';
          const retryResult = validateTranslation(
            maskedUnit.masked,
            retryRaw,
            localTerms,
            Object.keys(maskedUnit.maskMap).length,
          );
          // Treat any placeholder mismatch as one error point so a retry that
          // fixes placeholders but keeps the same terms is still considered better.
          const firstErrors = result.missingTerms.length + (result.placeholderOk ? 0 : 1);
          const retryErrors =
            retryResult.missingTerms.length + (retryResult.placeholderOk ? 0 : 1);
          if (retryErrors < firstErrors) {
            totalFound += result.missingTerms.length - retryResult.missingTerms.length;
            result = retryResult;
            bestText = retryRaw;
          }
        }

        // Deterministic splice: restore placeholders + re-insert lost terms.
        let finalText = restore(bestText, maskedUnit.maskMap);
        const badges: string[] = [];
        if (!result.ok) {
          const spliced = spliceMissing(finalText, localTerms);
          finalText = spliced.text;
          badges.push(...spliced.badges);
          stats.splices += spliced.badges.length;
        }
        unit.translation = finalText.trim();
        if (badges.length > 0) unit.badge = badges;

        if (finalText) {
          this.contextPairs.push({ source: maskedUnit.source, target: finalText });
          if (this.contextPairs.length > 5) this.contextPairs.shift();
        }
      }
    }

    stats.tsr = totalExpected === 0 ? 1 : totalFound / totalExpected;
    return { units, stats, contextPairs: [...this.contextPairs] };
  }

  private buildRequests(
    units: SubtitleUnit[],
    glossary: GlossaryDoc,
  ): (TranslateBatchRequest & {
    termSubsets: GlossaryTerm[][];
    maskMap: Record<string, string>;
  })[] {
    const requests: (TranslateBatchRequest & {
      termSubsets: GlossaryTerm[][];
      maskMap: Record<string, string>;
    })[] = [];

    for (let base = 0; base < units.length; base += BATCH_SIZE) {
      const slice = units.slice(base, base + BATCH_SIZE);
      const maskedUnits = slice.map((u) => {
        const m = mask(u.text, glossary);
        return { source: u.text, masked: m.masked, maskMap: m.map };
      });
      const combined = maskedUnits.map((m) => m.masked).join(' ');
      const selectedTerms = selectTerms(combined, glossary);
      const termSubsets = maskedUnits.map((m) => selectTerms(m.masked, glossary));

      requests.push({
        units: maskedUnits,
        selectedTerms,
        contextPairs: [...this.contextPairs],
        targetLang: this.settings.targetLang,
        sourceLang: this.settings.sourceLang,
        termSubsets,
        maskMap: {},
      });
    }
    return requests;
  }
}

function spliceMissing(
  text: string,
  terms: GlossaryTerm[],
): { text: string; badges: string[] } {
  let out = text;
  const badges: string[] = [];
  for (const t of terms) {
    const expected = expectedSurface(t);
    if (!expected) continue;
    if (out.includes(expected)) continue;
    out = `${out} ${expected}`.trim();
    badges.push(`⚠ ${t.term}`);
  }
  return { text: out, badges };
}
