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

export type ViewerFontFamily = 'system' | 'times' | 'palatino' | 'segoe' | 'arial';
export type ViewerTheme = 'white' | 'sepia' | 'dark' | 'midnight' | 'oceanic';

export const TARGET_LANGUAGE_MAP: Record<string, { promptName: string; nativeName: string }> = {
  vi: { promptName: 'Tiếng Việt (Vietnamese)', nativeName: 'Tiếng Việt' },
  ko: { promptName: '한국어 (Korean)', nativeName: '한국어' },
  ja: { promptName: '日本語 (Japanese)', nativeName: '日本語' },
  zh: { promptName: '中文 (Chinese)', nativeName: '中文' },
  en: { promptName: 'English', nativeName: 'English' },
  fr: { promptName: 'Français (French)', nativeName: 'Français' },
  de: { promptName: 'Deutsch (German)', nativeName: 'Deutsch' },
};

export function getTargetLanguagePromptName(code: string): string {
  const trimmed = (code || 'vi').trim();
  return TARGET_LANGUAGE_MAP[trimmed]?.promptName || trimmed;
}

export interface ApiKeyItem {
  id: string;
  provider: PdfProvider;
  key: string;
  createdAt: number;
}

export interface Settings {
  /** direct = call Gemini from offscreen with user key; gateway = local proxy;
   *  demo = offline mock so the UI works without a key. */
  mode: ProviderMode;
  /** User's primary Gemini API key (stored local only, never committed). */
  apiKey: string;
  /** Danh sách đa API Key người dùng đã thêm (Gemini & OpenCode Zen). */
  apiKeys?: ApiKeyItem[];
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
  /** User's primary OpenCode Zen API key (dự phòng khi Gemini ốm). */
  zenApiKey: string;
  /** Số trang PDF dịch song song cùng lúc (Worker pool concurrency: 2-7, mặc định 5). */
  pdfConcurrency: number;
  /** Kiểu font chữ hiển thị bản dịch paper */
  viewerFontFamily?: ViewerFontFamily;
  /** Cỡ chữ hiển thị bản dịch paper (px: 13-19, mặc định 15) - giữ tương thích ngược */
  viewerFontSize?: number;
  /** Tỷ lệ thu phóng nội dung hiển thị bản dịch paper (%: 75-180, mặc định 100) */
  viewerFontScale?: number;
  /** Màu nền và chủ đề hiển thị bản dịch paper: white | sepia | dark */
  viewerTheme?: ViewerTheme;
}

export const DEFAULT_SETTINGS: Settings = {
  mode: 'demo',
  apiKey: '',
  apiKeys: [],
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
  viewerFontFamily: 'system',
  viewerFontSize: 15,
  viewerFontScale: 100,
  viewerTheme: 'white',
};

export function clampChunk(seconds: number): number {
  if (!Number.isFinite(seconds)) return 45;
  return Math.min(180, Math.max(30, Math.round(seconds)));
}

export function maskApiKey(key: string): string {
  if (!key) return '';
  const trimmed = key.trim();
  if (trimmed.length <= 10) return '••••••••';
  return `${trimmed.slice(0, 6)}••••••••${trimmed.slice(-4)}`;
}

export function getProviderKeys(settings: Settings, provider: PdfProvider): string[] {
  if (Array.isArray(settings.apiKeys) && settings.apiKeys.length > 0) {
    const matched = settings.apiKeys
      .filter((k) => k.provider === provider && k.key && k.key.trim().length > 0)
      .map((k) => k.key.trim());
    if (matched.length > 0) return matched;
  }
  if (provider === 'gemini' && settings.apiKey?.trim()) {
    return [settings.apiKey.trim()];
  }
  if (provider === 'zen' && settings.zenApiKey?.trim()) {
    return [settings.zenApiKey.trim()];
  }
  return [];
}

export const SETTINGS_KEY = 'live-trans:settings';

export async function loadSettings(): Promise<Settings> {
  try {
    const stored = await browser.storage.local.get(SETTINGS_KEY);
    const raw = stored[SETTINGS_KEY] as Partial<Settings> | undefined;

    const apiKeys: ApiKeyItem[] = Array.isArray(raw?.apiKeys) ? [...raw.apiKeys] : [];
    if (apiKeys.length === 0) {
      if (raw?.apiKey?.trim()) {
        apiKeys.push({
          id: `gemini-${Date.now()}-1`,
          provider: 'gemini',
          key: raw.apiKey.trim(),
          createdAt: Date.now(),
        });
      }
      if (raw?.zenApiKey?.trim()) {
        apiKeys.push({
          id: `zen-${Date.now()}-2`,
          provider: 'zen',
          key: raw.zenApiKey.trim(),
          createdAt: Date.now(),
        });
      }
    }

    const primaryGemini = apiKeys.find((k) => k.provider === 'gemini')?.key || raw?.apiKey || '';
    const primaryZen = apiKeys.find((k) => k.provider === 'zen')?.key || raw?.zenApiKey || '';

    return {
      ...DEFAULT_SETTINGS,
      ...raw,
      apiKey: primaryGemini,
      zenApiKey: primaryZen,
      apiKeys,
      chunkSeconds: clampChunk(raw?.chunkSeconds ?? 45),
      pdfConcurrency: Math.min(7, Math.max(2, raw?.pdfConcurrency ?? 5)),
      viewerFontFamily: (() => {
        const font = (raw as Record<string, unknown> | undefined)?.viewerFontFamily;
        if (font === 'inter' || font === 'georgia' || font === 'merriweather') return 'system';
        if (typeof font === 'string' && ['system', 'times', 'palatino', 'segoe', 'arial'].includes(font)) {
          return font as ViewerFontFamily;
        }
        return 'system';
      })(),
      viewerFontSize: typeof raw?.viewerFontSize === 'number' ? raw.viewerFontSize : 15,
      viewerFontScale: typeof raw?.viewerFontScale === 'number'
        ? raw.viewerFontScale
        : typeof raw?.viewerFontSize === 'number'
          ? Math.round((raw.viewerFontSize / 15) * 100)
          : 100,
      viewerTheme: (() => {
        const theme = (raw as Record<string, unknown> | undefined)?.viewerTheme;
        if (typeof theme === 'string' && ['white', 'sepia', 'dark', 'midnight', 'oceanic'].includes(theme)) {
          return theme as ViewerTheme;
        }
        return 'white';
      })(),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  const geminiKeys = getProviderKeys(settings, 'gemini');
  const zenKeys = getProviderKeys(settings, 'zen');
  const normalized: Settings = {
    ...settings,
    apiKey: geminiKeys[0] || settings.apiKey || '',
    zenApiKey: zenKeys[0] || settings.zenApiKey || '',
  };
  await browser.storage.local.set({ [SETTINGS_KEY]: normalized });
}
