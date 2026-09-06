import { browser } from 'wxt/browser';
import { EMPTY_GLOSSARY, type GlossaryDoc } from './glossary/types';

export type ProviderMode = 'direct' | 'gateway' | 'demo';

/** Provider dịch PDF/paper: gemini (direct) hoặc zen (OpenCode Zen gateway). */
export type PdfProvider = 'gemini' | 'zen';

export const PDF_GEMINI_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.5-flash'] as const;
export const PDF_ZEN_MODELS = [
  'muse-spark-1.2-contributor-free',
  'muse-spark-1.3-contributor-free',
  'big-pickle',
  'deepseek-v4-flash-free',
] as const;

export const DEFAULT_PDF_MODEL: Record<PdfProvider, string> = {
  gemini: 'gemini-3.5-flash-lite',
  zen: 'muse-spark-1.2-contributor-free',
};

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
  /** Provider dịch PDF/paper (toolbar viewer). */
  pdfProvider: PdfProvider;
  /** Model dịch PDF/paper tương ứng provider. */
  pdfModel: string;
  /** User's own OpenCode Zen API key (dự phòng khi Gemini ốm). */
  zenApiKey: string;
  /** Số trang PDF dịch song song cùng lúc (Worker pool concurrency: 2-7, mặc định 5). */
  pdfConcurrency: number;
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
  pdfProvider: 'gemini',
  pdfModel: DEFAULT_PDF_MODEL.gemini,
  zenApiKey: '',
  pdfConcurrency: 5,
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
      pdfConcurrency: Math.min(7, Math.max(2, raw?.pdfConcurrency ?? 5)),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await browser.storage.local.set({ [SETTINGS_KEY]: settings });
}
