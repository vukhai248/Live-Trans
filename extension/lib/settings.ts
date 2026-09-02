import { browser } from 'wxt/browser';
import { EMPTY_GLOSSARY, type GlossaryDoc } from './glossary/types';

export type ProviderMode = 'direct' | 'gateway' | 'demo';

export interface Settings {
  /** direct = call Gemini from offscreen with user key; gateway = local proxy;
   *  demo = offline mock so the UI works without a key. */
  mode: ProviderMode;
  /** User's own Gemini API key (stored local only, never committed). */
  apiKey: string;
  /** Local gateway base URL, e.g. http://localhost:8787 */
  gatewayUrl: string;
  /** Target language, default Vietnamese. */
  targetLang: string;
  /** Source language; 'auto' lets Gemini auto-detect. */
  sourceLang: string;
  /** ASR chunk length in seconds (plan §3: default 45, range 30–180). */
  chunkSeconds: number;
  showOriginal: boolean;
  showTranslatedTitle: boolean;
  fontSize: 'small' | 'medium' | 'large';
  glossary: GlossaryDoc;
}

export const DEFAULT_SETTINGS: Settings = {
  mode: 'demo',
  apiKey: '',
  gatewayUrl: 'http://localhost:8787',
  targetLang: 'vi',
  sourceLang: 'auto',
  chunkSeconds: 45,
  showOriginal: true,
  showTranslatedTitle: true,
  fontSize: 'medium',
  glossary: EMPTY_GLOSSARY,
};

export function clampChunk(seconds: number): number {
  if (!Number.isFinite(seconds)) return 45;
  return Math.min(180, Math.max(30, Math.round(seconds)));
}

export const SETTINGS_KEY = 'live-trans:settings';

export async function loadSettings(): Promise<Settings> {
  try {
    const stored = await browser.storage.local.get(SETTINGS_KEY);
    const raw = stored[SETTINGS_KEY] as Partial<Settings> | undefined;
    return {
      ...DEFAULT_SETTINGS,
      ...raw,
      chunkSeconds: clampChunk(raw?.chunkSeconds ?? 45),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await browser.storage.local.set({ [SETTINGS_KEY]: settings });
}
