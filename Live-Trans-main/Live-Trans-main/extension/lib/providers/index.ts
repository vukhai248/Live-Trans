import type { ProviderMode } from '../settings';
import type { Provider } from './provider';
import { DirectGeminiProvider } from './direct-gemini';
import { LocalGatewayProvider } from './local-gateway';
import { MockProvider } from './mock';

export function createProvider(mode: ProviderMode): Provider {
  switch (mode) {
    case 'direct':
      return new DirectGeminiProvider();
    case 'gateway':
      return new LocalGatewayProvider();
    case 'demo':
    default:
      return new MockProvider();
  }
}

export type {
  Provider,
  TranscribeRequest,
  TranslateBatchRequest,
  TranslateBatchResponse,
  MaskedUnit,
  ContextPair,
  TranslatedUnit,
} from './provider';
