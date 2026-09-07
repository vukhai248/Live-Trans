import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { loadSettings, SETTINGS_KEY, type Settings } from '@/lib/settings';
import type { SubtitleUnit } from '@/lib/subtitles/segmenter';
import { debounce } from '@/lib/utils/debounce';

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

    initPdfTranslateButton();

    let lastTitle = '';

    const sendDetectedTitle = () => {
      const title = detectVideoTitle();
      if (title && title !== lastTitle) {
        lastTitle = title;
        void browser.runtime.sendMessage({ type: 'TITLE_DETECTED', title });
      }
    };

    sendDetectedTitle();
    const debouncedSendTitle = debounce(sendDetectedTitle, 400);
    const titleObserver = new MutationObserver(debouncedSendTitle);
    titleObserver.observe(document.documentElement, { subtree: true, childList: true });

    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!message || typeof message !== 'object') return;
      switch ((message as { type: string }).type) {
        case 'CHECK_MEDIA_PRESENCE': {
          const videos = document.querySelectorAll('video');
          const audios = document.querySelectorAll('audio');
          const title = detectVideoTitle();
          sendResponse({
            type: 'MEDIA_PRESENCE_RESPONSE',
            hasVideo: videos.length > 0,
            hasAudio: audios.length > 0,
            videoTitle: title,
            mediaCount: videos.length + audios.length,
          });
          return true;
        }
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
function detectVideoTitle(): string | undefined {
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
    font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  }
  .lt-title {
    position: absolute; left: 50%; transform: translateX(-50%);
    display: none; flex-direction: column; gap: 2px; max-width: min(760px, 90vw);
    background: rgba(9, 11, 18, .84); border: 1px solid rgba(255,255,255,.12);
    color: #fff; padding: 10px 16px 11px; border-radius: 14px;
    box-shadow: 0 18px 44px -14px rgba(0,0,0,.65);
    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  }
  .lt-title .lt-original { font-size: 12px; opacity: .66; font-weight: 500; letter-spacing: .01em; }
  .lt-title .lt-translated { font-size: 16px; font-weight: 650; line-height: 1.35; letter-spacing: -.01em; }
  .lt-sub {
    position: absolute; left: 50%; transform: translateX(-50%);
    display: none; flex-direction: column; gap: 3px; text-align: center;
    max-width: min(720px, 92vw); padding: 9px 16px 11px; border-radius: 13px;
    background: rgba(8, 10, 16, .8); border: 1px solid rgba(255,255,255,.1);
    color: #fff; box-shadow: 0 18px 44px -12px rgba(0,0,0,.65);
    backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  }
  .lt-sub .lt-translated { font-size: 22px; font-weight: 650; line-height: 1.4; letter-spacing: -.01em; text-shadow: 0 1px 2px rgba(0,0,0,.45); }
  .lt-sub .lt-original { font-size: 13.5px; opacity: .68; }
  .lt-badge {
    display: inline-block; background: rgba(245,180,68,.16); border: 1px solid rgba(245,180,68,.42);
    color: #fbd38d; font-size: 11px; font-weight: 700;
    border-radius: 999px; padding: 1.5px 8px; margin-left: 8px; vertical-align: middle;
    white-space: nowrap;
  }
  .lt-notice {
    position: absolute; right: 16px; top: 16px; display: none;
    max-width: 340px; background: rgba(64, 14, 26, .92); border: 1px solid rgba(244,84,122,.35);
    color: #ffe4e9; padding: 10px 13px; border-radius: 12px; font-size: 13px; line-height: 1.45;
    box-shadow: 0 14px 34px -10px rgba(0,0,0,.6);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
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

/** Detects if the current page is a PDF document or Arxiv paper */
function detectPdfPage(): string | null {
  const url = window.location.href;

  // 1. Arxiv abstract or PDF page
  const arxivAbsMatch = url.match(/arxiv\.org\/abs\/([0-9]+\.[0-9]+(v[0-9]+)?)/i);
  if (arxivAbsMatch && arxivAbsMatch[1]) {
    return `https://arxiv.org/pdf/${arxivAbsMatch[1]}.pdf`;
  }
  const arxivPdfMatch = url.match(/arxiv\.org\/pdf\/([0-9]+\.[0-9]+(v[0-9]+)?)/i);
  if (arxivPdfMatch && arxivPdfMatch[1]) {
    return url.endsWith('.pdf') ? url : `${url}.pdf`;
  }

  // 2. Direct .pdf URL
  if (/\.pdf(\?|#|$)/i.test(url)) {
    return url;
  }

  // 3. Embedded PDF element
  const embed = document.querySelector('embed[type="application/pdf"]') as HTMLEmbedElement | null;
  if (embed?.src) {
    return embed.src;
  }

  return null;
}

function mountTranslateButton(pdfUrl: string) {
  if (document.getElementById('lt-translate-now-btn')) return;

  const btn = document.createElement('button');
  btn.id = 'lt-translate-now-btn';
  btn.innerHTML = `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px"><path d="M5 8l6 6"/><path d="M4 14l6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="M22 22l-5-10-5 10"/><path d="M14 18h6"/></svg>
    Translate Now
  `;

  btn.style.cssText = `
    position: fixed;
    top: 12px;
    right: 75px;
    z-index: 2147483646;
    background: #2563eb;
    color: #ffffff;
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 9999px;
    padding: 7px 16px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.15);
    display: flex;
    align-items: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    transition: transform 0.15s, background-color 0.15s;
  `;

  btn.onmouseenter = () => {
    btn.style.background = '#1d4ed8';
    btn.style.transform = 'scale(1.03)';
  };
  btn.onmouseleave = () => {
    btn.style.background = '#2563eb';
    btn.style.transform = 'scale(1)';
  };

  btn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Mở qua background (tabs.create) — window.open trực tiếp từ page context
    // bị adblock/popup-blocker chặn (ERR_BLOCKED_BY_CLIENT).
    browser.runtime.sendMessage({ type: 'OPEN_VIEWER', pdfUrl }).catch(() => {
      // Fallback khi background chưa sẵn sàng (hiếm): mở trực tiếp.
      const viewerUrl = browser.runtime.getURL(`/viewer.html?url=${encodeURIComponent(pdfUrl)}`);
      window.open(viewerUrl, '_blank');
    });
  };

  document.body.appendChild(btn);
}

function initPdfTranslateButton() {
  const tryMount = () => {
    const pdfUrl = detectPdfPage();
    if (pdfUrl) {
      mountTranslateButton(pdfUrl);
    }
  };

  tryMount();
  // Check again when DOM mutations occur (e.g. SPAs, embeds) with 400ms debounce
  const debouncedTryMount = debounce(tryMount, 400);
  const obs = new MutationObserver(debouncedTryMount);
  obs.observe(document.documentElement, { childList: true, subtree: true });
}

