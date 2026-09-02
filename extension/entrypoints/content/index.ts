import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { loadSettings, SETTINGS_KEY, type Settings } from '@/lib/settings';
import type { SubtitleUnit } from '@/lib/subtitles/segmenter';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    const overlay = new OverlayHost();
    void overlay.mount();

    let settings: Settings | null = null;
    const refreshSettings = async () => {
      settings = await loadSettings();
      overlay.applySettings(settings);
    };
    void refreshSettings();
    browser.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && SETTINGS_KEY in changes) void refreshSettings();
    });

    let lastTitle = '';

    const sendDetectedTitle = () => {
      const title = detectVideoTitle();
      if (title && title !== lastTitle) {
        lastTitle = title;
        void browser.runtime.sendMessage({ type: 'TITLE_DETECTED', title });
      }
    };

    sendDetectedTitle();
    const titleObserver = new MutationObserver(sendDetectedTitle);
    titleObserver.observe(document.documentElement, { subtree: true, childList: true });

    browser.runtime.onMessage.addListener((message) => {
      if (!message || typeof message !== 'object') return;
      switch ((message as { type: string }).type) {
        case 'SUBTITLES':
          overlay.showSubtitles((message as { units: SubtitleUnit[] }).units, settings);
          break;
        case 'TRANSLATED_TITLE':
          overlay.showTitle(
            (message as { originalTitle: string }).originalTitle,
            (message as { translatedTitle: string }).translatedTitle,
            settings,
          );
          break;
        case 'CAPTURE_ERROR':
          overlay.showNotice((message as { error: string }).error);
          break;
        default:
          break;
      }
    });
  },
});

/** Best-effort title extraction across YouTube / Coursera / Udemy / generic. */
export function detectVideoTitle(): string | undefined {
  const candidates: (string | null | undefined)[] = [
    document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.textContent,
    document.querySelector('#title h1 yt-formatted-string')?.textContent,
    document.querySelector('h1[data-purpose="video-title"]')?.textContent,
    document.querySelector('h1.cds-1 [data-purpose="video-title"]')?.textContent,
    document.querySelector('meta[property="og:title"]')?.getAttribute('content'),
    document.querySelector('title')?.textContent,
  ];
  for (const c of candidates) {
    if (c && c.trim().length > 4) return cleanTitle(c.trim());
  }
  return undefined;
}

function cleanTitle(title: string): string {
  return title
    .replace(/\s+-\s*(YouTube|Coursera|Udemy)\s*$/i, '')
    .replace(/^\s*\(\d+\)\s*/, '')
    .trim();
}

const CSS = `
  :host { all: initial; }
  .lt-root {
    position: fixed; inset: 0; pointer-events: none; z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Inter, sans-serif;
  }
  .lt-title {
    position: absolute; left: 50%; transform: translateX(-50%);
    display: none; flex-direction: column; gap: 2px; max-width: min(760px, 90vw);
    background: linear-gradient(135deg, rgba(17,24,39,.96), rgba(31,41,55,.92));
    color: #fff; padding: 10px 16px; border-radius: 12px;
    box-shadow: 0 8px 28px rgba(0,0,0,.35); backdrop-filter: blur(6px);
  }
  .lt-title .lt-original { font-size: 12px; opacity: .72; font-weight: 500; }
  .lt-title .lt-translated { font-size: 16px; font-weight: 650; line-height: 1.3; }
  .lt-sub {
    position: absolute; left: 50%; transform: translateX(-50%);
    display: none; flex-direction: column; gap: 3px; text-align: center;
    max-width: min(720px, 92vw); padding: 10px 16px; border-radius: 10px;
    background: rgba(0,0,0,.62); color: #fff;
    box-shadow: 0 6px 20px rgba(0,0,0,.32);
  }
  .lt-sub .lt-translated { font-size: 22px; font-weight: 650; line-height: 1.35; }
  .lt-sub .lt-original { font-size: 14px; opacity: .78; }
  .lt-badge {
    display: inline-block; background:#f59e0b; color:#111; font-size:11px; font-weight:700;
    border-radius: 6px; padding: 1px 5px; margin-left: 6px; vertical-align: middle;
  }
  .lt-notice {
    position: absolute; right: 16px; top: 16px; display: none;
    max-width: 340px; background: rgba(127,29,29,.95); color:#fff;
    padding: 9px 12px; border-radius: 10px; font-size: 13px;
  }
`;

const FONT_SIZES: Record<Settings['fontSize'], string> = {
  small: '18px',
  medium: '22px',
  large: '27px',
};

class OverlayHost {
  private root: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private titleEl: HTMLElement | null = null;
  private subEl: HTMLElement | null = null;
  private subTranslatedEl: HTMLElement | null = null;
  private noticeEl: HTMLElement | null = null;
  private latest: SubtitleUnit | null = null;
  private clearTimer: ReturnType<typeof setTimeout> | undefined;
  private originalsVisible = true;
  private hasTitle = false;

  async mount(): Promise<void> {
    this.root = document.createElement('div');
    this.root.id = 'live-trans-root';
    this.shadow = this.root.attachShadow({ mode: 'open' });
    this.shadow.innerHTML = `<style>${CSS}</style>
      <div class="lt-root">
        <div class="lt-title">
          <span class="lt-original"></span>
          <span class="lt-translated"></span>
        </div>
        <div class="lt-sub">
          <span class="lt-translated"></span>
          <span class="lt-original"></span>
        </div>
        <div class="lt-notice"></div>
      </div>`;

    const rootEl = this.shadow.querySelector('.lt-root') as HTMLElement;
    this.titleEl = rootEl.querySelector('.lt-title') as HTMLElement;
    this.subEl = rootEl.querySelector('.lt-sub') as HTMLElement;
    this.subTranslatedEl = this.subEl.querySelector('.lt-translated') as HTMLElement;
    this.noticeEl = rootEl.querySelector('.lt-notice') as HTMLElement;

    document.documentElement.appendChild(this.root);

    window.addEventListener('resize', () => this.position());
    window.addEventListener('scroll', () => this.position(), { passive: true });
    setInterval(() => this.position(), 600);
  }

  applySettings(settings: Settings): void {
    this.originalsVisible = settings.showOriginal;
    if (this.subTranslatedEl) {
      this.subTranslatedEl.style.fontSize = FONT_SIZES[settings.fontSize];
    }
    if (!settings.showTranslatedTitle) {
      this.hasTitle = false;
      if (this.titleEl) this.titleEl.style.display = 'none';
    }
  }

  showTitle(original: string, translated: string, settings: Settings | null): void {
    if (!(settings?.showTranslatedTitle ?? true)) {
      this.hasTitle = false;
      if (this.titleEl) this.titleEl.style.display = 'none';
      return;
    }
    if (!this.titleEl) return;
    this.hasTitle = true;
    this.titleEl.style.display = 'flex';
    const o = this.titleEl.querySelector('.lt-original') as HTMLElement;
    const t = this.titleEl.querySelector('.lt-translated') as HTMLElement;
    o.textContent = original;
    t.textContent = translated;
    this.position();
  }

  showSubtitles(units: SubtitleUnit[], settings: Settings | null): void {
    if (!this.subEl) return;
    const unit = units[units.length - 1];
    if (!unit) return;
    this.latest = unit;
    if (settings) this.applySettings(settings);
    this.renderSubtitle();
  }

  private renderSubtitle(): void {
    if (!this.subEl || !this.latest) return;
    this.subEl.style.display = 'flex';
    const t = this.subEl.querySelector('.lt-translated') as HTMLElement;
    const o = this.subEl.querySelector('.lt-original') as HTMLElement;
    t.textContent = this.latest.translation ?? this.latest.text;
    if (this.latest.badge && this.latest.badge.length > 0) {
      const b = document.createElement('span');
      b.className = 'lt-badge';
      b.textContent = '⚠ thuật ngữ';
      t.appendChild(b);
    }
    o.textContent = this.latest.text;
    o.style.display = this.originalsVisible ? 'block' : 'none';
    this.position();

    const charCount = this.latest.translation?.length ?? this.latest.text.length;
    const dur = Math.max(Math.round((charCount / 17) * 1000), 2000);
    if (this.clearTimer) clearTimeout(this.clearTimer);
    this.clearTimer = setTimeout(() => {
      if (this.subEl) this.subEl.style.display = 'none';
    }, dur);
  }

  showNotice(text: string): void {
    if (!this.noticeEl) return;
    this.noticeEl.style.display = 'block';
    this.noticeEl.textContent = text;
    setTimeout(() => {
      if (this.noticeEl) this.noticeEl.style.display = 'none';
    }, 5000);
  }

  private findVideo(): HTMLVideoElement | null {
    const videos = Array.from(document.querySelectorAll('video'));
    if (videos.length === 0) return null;
    return (
      videos.sort((a, b) => {
        const aArea = a.clientWidth * a.clientHeight;
        const bArea = b.clientWidth * b.clientHeight;
        return bArea - aArea;
      })[0] ?? null
    );
  }

  private position(): void {
    const video = this.findVideo();
    if (!video) return;
    const rect = video.getBoundingClientRect();
    const visible = rect.width > 80 && rect.height > 80;

    if (this.titleEl) {
      this.titleEl.style.display = visible && this.hasTitle ? 'flex' : 'none';
      this.titleEl.style.top = `${Math.max(rect.top + 12, 12)}px`;
    }
    if (this.subEl) {
      if (visible) {
        this.subEl.style.top = `${Math.max(rect.bottom - 130, 12)}px`;
        if (!this.latest) this.subEl.style.display = 'none';
      } else {
        this.subEl.style.display = 'none';
      }
    }
  }
}
