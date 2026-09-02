import { useEffect, useState } from 'preact/hooks';
import { browser } from 'wxt/browser';
import type { SessionState } from '@/lib/protocol/messages';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type Settings,
} from '@/lib/settings';
import { toSrt, toText } from '@/lib/subtitles/srt';
import type { SubtitleUnit } from '@/lib/subtitles/segmenter';

const LANGS: { code: string; label: string }[] = [
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'zh', label: '中文' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
];

export function App() {
  const [state, setState] = useState<SessionState | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => {
      void browser.runtime
        .sendMessage({ type: 'GET_STATE' })
        .then((s) => setState(s as SessionState));
    }, 900);
    return () => clearInterval(id);
  }, []);

  async function refresh(): Promise<void> {
    setSettings(await loadSettings());
    const s = await browser.runtime.sendMessage({ type: 'GET_STATE' });
    setState(s as SessionState | null);
  }

  const running = state?.status === 'starting' || state?.status === 'capturing';

  async function toggle(): Promise<void> {
    setBusy(true);
    try {
      if (running) {
        await browser.runtime.sendMessage({ type: 'STOP_SESSION' });
      } else {
        await start();
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function start(): Promise<void> {
    // Obtain the streamId here (the popup holds the user gesture) then delegate.
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    let streamId: string | undefined;
    if (tab?.id !== undefined) {
      try {
        streamId = await browser.tabCapture.getMediaStreamId({ targetTabId: tab.id });
      } catch {
        // Demo mode performs no real capture; proceed without a streamId.
        streamId = undefined;
      }
    }
    await browser.runtime.sendMessage({
      type: 'START_SESSION',
      tabId: tab?.id,
      streamId,
    });
  }

  async function patch(partial: Partial<Settings>): Promise<void> {
    const next = { ...settings, ...partial };
    setSettings(next);
    await saveSettings(next);
  }

  const paused = state?.paused ?? false;

  async function togglePause(): Promise<void> {
    setBusy(true);
    try {
      await browser.runtime.sendMessage({ type: paused ? 'RESUME_SESSION' : 'PAUSE_SESSION' });
    } finally {
      setBusy(false);
    }
  }

  async function exportSubtitles(kind: 'srt' | 'txt'): Promise<void> {
    try {
      const res = await browser.runtime.sendMessage({ type: 'GET_SUBTITLES' });
      const snap = res as { type: 'SUBTITLES_SNAPSHOT'; units: SubtitleUnit[] } | null;
      const units = snap?.units ?? [];
      const content = kind === 'srt' ? toSrt(units) : toText(units);
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `live-trans.${kind}`;
      document.body.append(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      /* offscreen not running or no subtitles yet */
    }
  }

  const tsrPct = Math.round((state?.tsr ?? 1) * 100);

  return (
    <div class="app">
      <header>
        <div class="brand">
          <span class="logo">LT</span>
          <div>
            <h1>Live-Trans</h1>
            <p>Dịch live · giữ thuật ngữ</p>
          </div>
        </div>
        <span class={`status ${running ? 'on' : ''}`}>
          <i class="dot" />
          <b>{running ? (paused ? 'Tạm dừng' : 'Đang dịch') : 'Sẵn sàng'}</b>
        </span>
      </header>

      <button
        class={`primary ${running ? 'danger' : ''}`}
        onClick={toggle}
        disabled={busy}
      >
        {running ? 'Dừng dịch' : 'Dịch tab này'}
      </button>

      {state?.status === 'error' && <p class="error">{state.error}</p>}

      {running && (
        <div class="actions">
          <button class="ghost" onClick={togglePause} disabled={busy}>
            {paused ? 'Tiếp tục' : 'Tạm dừng'}
          </button>
          <button class="ghost" onClick={() => void exportSubtitles('srt')} disabled={busy}>
            Tải .srt
          </button>
          <button class="ghost" onClick={() => void exportSubtitles('txt')} disabled={busy}>
            Tải .txt
          </button>
        </div>
      )}

      <section class="metrics">
        <div class="metric">
          <b>{tsrPct}%</b>
          <span>TSR</span>
        </div>
        <div class="metric">
          <b>{state?.units ?? 0}</b>
          <span>phụ đề</span>
        </div>
        <div class="metric">
          <b>{state?.calls ?? 0}</b>
          <span>lời gọi</span>
        </div>
        <div class="metric">
          <b>{state?.splices ?? 0}</b>
          <span>chèn ⚠</span>
        </div>
      </section>

      <section class="rows">
        <label class="row">
          <span>Ngôn ngữ đích</span>
          <select
            value={settings.targetLang}
            onChange={(e) =>
              void patch({ targetLang: (e.target as HTMLSelectElement).value })
            }
          >
            {LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </label>

        <label class="row">
          <span>Hiện bản gốc</span>
          <input
            type="checkbox"
            checked={settings.showOriginal}
            onChange={(e) =>
              void patch({ showOriginal: (e.target as HTMLInputElement).checked })
            }
          />
        </label>

        <label class="row">
          <span>Dịch tiêu đề video</span>
          <input
            type="checkbox"
            checked={settings.showTranslatedTitle}
            onChange={(e) =>
              void patch({ showTranslatedTitle: (e.target as HTMLInputElement).checked })
            }
          />
        </label>
      </section>

      <footer>
        <button class="link" onClick={() => void browser.runtime.openOptionsPage()}>
          Cài đặt (key, mode, glossary)
        </button>
        <span class={`mode-chip mode-${settings.mode}`}>
          {settings.mode === 'demo' ? 'Demo' : settings.mode === 'direct' ? 'Direct' : 'Gateway'}
        </span>
      </footer>
    </div>
  );
}
