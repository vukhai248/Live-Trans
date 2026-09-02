import type { Settings, ProviderMode } from '../settings';
import type { GlossaryTerm } from '../glossary/types';
import type { Transcript } from '../asr/types';

/**
 * Provider interface (docs/plan.md §2). Every AI call goes through this so the
 * transport (direct fetch vs local gateway vs offline mock) is swappable.
 */

export interface TranscribeRequest {
  pcmBase64: string;
  language: string;
  /** Custom vocabulary (≤100 terms) — command/code/acronym from glossary. */
  customVocabulary: string[];
}

export interface MaskedUnit {
  source: string;
  masked: string;
  maskMap: Record<string, string>;
}

export interface ContextPair {
  source: string;
  target: string;
}

export interface TranslateBatchRequest {
  units: MaskedUnit[];
  selectedTerms: GlossaryTerm[];
  contextPairs: ContextPair[];
  targetLang: string;
  sourceLang: string;
}

export interface TranslatedUnit {
  text: string;
  termsUsed: string[];
}

export interface TranslateBatchResponse {
  translations: TranslatedUnit[];
}

export interface Provider {
  readonly mode: ProviderMode;
  transcribe(req: TranscribeRequest, settings: Settings): Promise<Transcript>;
  translate(
    req: TranslateBatchRequest,
    settings: Settings,
  ): Promise<TranslateBatchResponse>;
  translateTitle(title: string, settings: Settings): Promise<string>;
}
