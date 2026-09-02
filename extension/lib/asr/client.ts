import type { GlossaryDoc } from '../glossary/types';
import type { Provider, TranscribeRequest } from '../providers/provider';
import type { Settings } from '../settings';
import type { AudioChunk, Transcript } from './types';

/**
 * Thin ASR client. It derives the custom vocabulary from the glossary (plan
 * §3 step 4: feed command/code/acronym contextual biasing into the ASR so
 * terms are captured correctly before they reach MT) and delegates the call.
 */

export class AsrClient {
  constructor(
    private provider: Provider,
    private settings: Settings,
  ) {}

  private customVocabulary(glossary: GlossaryDoc): string[] {
    return glossary.terms
      .filter((t) => t.type === 'command' || t.type === 'code' || t.type === 'acronym')
      .map((t) => t.term)
      .filter(Boolean)
      .slice(0, 100); // documented cap: ≤100 (recommended ≤100)
  }

  async transcribe(chunk: AudioChunk, glossary: GlossaryDoc): Promise<Transcript> {
    const req: TranscribeRequest = {
      pcmBase64: chunk.pcmBase64,
      language: this.settings.sourceLang,
      customVocabulary: this.customVocabulary(glossary),
    };
    return this.provider.transcribe(req, this.settings);
  }
}
