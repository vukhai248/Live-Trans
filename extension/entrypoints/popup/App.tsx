import { useEffect, useState } from 'preact/hooks';
import { browser } from 'wxt/browser';
import {
  STARTER_GLOSSARY,
  type GlossaryDoc,
  type GlossaryTerm,
  type TermType,
} from '@/lib/glossary/types';
import type { SessionState } from '@/lib/protocol/messages';
import {
  clampChunk,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type Settings,
} from '@/lib/settings';
import { testGeminiApiKey } from '@/lib/providers/direct-gemini';
import { toSrt, toText } from '@/lib/subtitles/srt';
import type { SubtitleUnit } from '@/lib/subtitles/segmenter';

type TabView = 'translate' | 'settings' | 'glossary';

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

interface MediaPresence {
  checked: boolean;
  hasVideo: boolean;
  hasAudio: boolean;
  videoTitle?: string;
  mediaCount: number;
}

export function App() {
  const [tab, setTab] = useState<TabView>('translate');
  const [state, setState] = useState<SessionState | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<{
    testing: boolean;
    result?: { ok: boolean; model: string; error?: string };
  }>({ testing: false });
  const [mediaInfo, setMediaInfo] = useState<MediaPresence>({
    checked: false,
    hasVideo: false,
    hasAudio: false,
    mediaCount: 0,
  });
  const [hasSubtitles, setHasSubtitles] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // Form for new term in Glossary tab
  const [newTerm, setNewTerm] = useState('');
  const [newType, setNewType] = useState<TermType>('code');
  const [newVi, setNewVi] = useState('');

  useEffect(() => {
    void refreshAll();
    void checkActiveTabMedia();

    const id = setInterval(() => {
      void browser.runtime
        .sendMessage({ type: 'GET_STATE' })
        .then((s) => {
          const session = s as SessionState | null;
          setState(session);
          if ((session?.units ?? 0) > 0) setHasSubtitles(true);
          if (session?.startedAt && (session.status === 'capturing' || session.status === 'starting')) {
            setElapsed(Math.floor((Date.now() - session.startedAt) / 1000));
          } else {
            setElapsed(0);
          }
        })
        .catch(() => {});
    }, 900);

    return () => clearInterval(id);
  }, []);

  async function refreshAll(): Promise<void> {
    const loaded = await loadSettings();
    setSettings(loaded);
    const s = (await browser.runtime
      .sendMessage({ type: 'GET_STATE' })
      .catch(() => null)) as SessionState | null;
    setState(s);
    if ((s?.units ?? 0) > 0) {
      setHasSubtitles(true);
    } else {
      try {
        const snap = (await browser.runtime.sendMessage({
          type: 'GET_SUBTITLES',
        })) as { units?: SubtitleUnit[] } | null;
        if ((snap?.units?.length ?? 0) > 0) setHasSubtitles(true);
      } catch {
        /* offscreen not active */
      }
    }
  }

  async function checkActiveTabMedia(): Promise<void> {
    try {
      const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!activeTab?.id) {
        setMediaInfo({ checked: true, hasVideo: false, hasAudio: false, mediaCount: 0 });
        return;
      }

      const url = activeTab.url || '';
      const isKnownVideoSite =
        url.includes('youtube.com/watch') ||
        url.includes('youtube.com/live') ||
        url.includes('youtu.be/') ||
        url.includes('coursera.org') ||
        url.includes('udemy.com') ||
        url.includes('vimeo.com') ||
        url.includes('bilibili.com');

      let hasVideo = isKnownVideoSite;
      let hasAudio = false;
      let mediaCount = isKnownVideoSite ? 1 : 0;
      let videoTitle = activeTab.title || '';

      if (videoTitle) {
        videoTitle = videoTitle.replace(/\s+-\s*(YouTube|Coursera|Udemy)\s*$/i, '').trim();
      }

      // 1. Direct Scripting Query on Active Tab
      try {
        const results = await browser.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: () => {
            const v = document.querySelectorAll('video');
            const a = document.querySelectorAll('audio');
            const ytTitle =
              document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.textContent ||
              document.querySelector('#title h1 yt-formatted-string')?.textContent ||
              document.querySelector('h1[data-purpose="video-title"]')?.textContent;
            return {
              videoCount: v.length,
              audioCount: a.length,
              title: ytTitle ? ytTitle.trim() : '',
            };
          },
        });

        const res = results?.[0]?.result;
        if (res) {
          if (res.videoCount > 0) hasVideo = true;
          if (res.audioCount > 0) hasAudio = true;
          mediaCount = res.videoCount + res.audioCount;
          if (res.title) videoTitle = res.title;
        }
      } catch {
        // 2. Fallback: try content script message if scripting fails
        try {
          const resp = (await browser.tabs
            .sendMessage(activeTab.id, { type: 'CHECK_MEDIA_PRESENCE' })
            .catch(() => null)) as any;
          if (resp && resp.type === 'MEDIA_PRESENCE_RESPONSE') {
            hasVideo = hasVideo || resp.hasVideo;
            hasAudio = hasAudio || resp.hasAudio;
            mediaCount = resp.mediaCount || mediaCount;
            if (resp.videoTitle) videoTitle = resp.videoTitle;
          }
        } catch {
          /* ignore */
        }
      }

      setMediaInfo({
        checked: true,
        hasVideo,
        hasAudio,
        videoTitle: videoTitle || activeTab.title,
        mediaCount,
      });
    } catch {
      setMediaInfo({ checked: true, hasVideo: false, hasAudio: false, mediaCount: 0 });
    }
  }

  const running = state?.status === 'starting' || state?.status === 'capturing';
  const paused = state?.paused ?? false;

  async function toggleSession(): Promise<void> {
    setBusy(true);
    try {
      if (running) {
        await browser.runtime.sendMessage({ type: 'STOP_SESSION' });
      } else {
        await startSession();
      }
      await refreshAll();
    } finally {
      setBusy(false);
    }
  }

  async function startSession(): Promise<void> {
    const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
    let streamId: string | undefined;
    if (activeTab?.id !== undefined) {
      try {
        streamId = await browser.tabCapture.getMediaStreamId({ targetTabId: activeTab.id });
      } catch (e) {
        console.warn('tabCapture getMediaStreamId failed', e);
        streamId = undefined;
      }
    }
    await browser.runtime.sendMessage({
      type: 'START_SESSION',
      tabId: activeTab?.id,
      streamId,
    });
    setHasSubtitles(true);
  }

  async function togglePause(): Promise<void> {
    setBusy(true);
    try {
      await browser.runtime.sendMessage({
        type: paused ? 'RESUME_SESSION' : 'PAUSE_SESSION',
      });
    } finally {
      setBusy(false);
    }
  }

  async function exportSubtitles(kind: 'srt' | 'txt'): Promise<void> {
    try {
      const res = await browser.runtime.sendMessage({ type: 'GET_SUBTITLES' });
      const snap = res as { type: 'SUBTITLES_SNAPSHOT'; units: SubtitleUnit[] } | null;
      const units = snap?.units ?? [];
      if (units.length === 0) return;
      const content = kind === 'srt' ? toSrt(units) : toText(units);
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `live-trans-${new Date().toISOString().slice(0, 10)}.${kind}`;
      document.body.append(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }

  async function patchSettings(partial: Partial<Settings>): Promise<void> {
    const next = { ...settings, ...partial };
    setSettings(next);
    await saveSettings(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function runApiTest(): Promise<void> {
    if (!settings.apiKey.trim()) return;
    setTestStatus({ testing: true });
    const result = await testGeminiApiKey(settings.apiKey.trim());
    setTestStatus({ testing: false, result });
  }

  function addGlossaryTerm(): void {
    if (!newTerm.trim()) return;
    const term: GlossaryTerm = {
      term: newTerm.trim(),
      type: newType,
      vi: newVi.trim() ? newVi.trim() : undefined,
    };
    const nextGlossary: GlossaryDoc = {
      version: 1,
      terms: [...settings.glossary.terms, term],
    };
    void patchSettings({ glossary: nextGlossary });
    setNewTerm('');
    setNewVi('');
  }

  function removeGlossaryTerm(index: number): void {
    const nextGlossary: GlossaryDoc = {
      version: 1,
      terms: settings.glossary.terms.filter((_, i) => i !== index),
    };
    void patchSettings({ glossary: nextGlossary });
  }

  function loadSampleGlossary(): void {
    void patchSettings({ glossary: STARTER_GLOSSARY });
  }

  const tsrPct = Math.round((state?.tsr ?? 1) * 100);
  const isDirectMissingKey = settings.mode === 'direct' && !settings.apiKey.trim();

  return (
    <div class="app">
      {/* Top Brand Bar */}
      <header>
        <div class="brand">
          <span class="logo">LT</span>
          <div>
            <h1>Live-Trans</h1>
            <p>Dịch live video · Bảo toàn thuật ngữ</p>
          </div>
        </div>
        <span class={`status ${running ? 'on' : ''}`}>
          <i class="dot" />
          <b>{running ? (paused ? 'Tạm dừng' : 'Đang dịch') : 'Sẵn sàng'}</b>
        </span>
      </header>

      {/* Tab Navigation */}
      <nav class="tabs-nav">
        <button
          class={`tab-btn ${tab === 'translate' ? 'active' : ''}`}
          onClick={() => setTab('translate')}
        >
          🎬 Dịch
        </button>
        <button
          class={`tab-btn ${tab === 'settings' ? 'active' : ''}`}
          onClick={() => setTab('settings')}
        >
          ⚙️ Cài đặt
          {isDirectMissingKey && <span class="tab-warn-dot" title="Chưa nhập key" />}
        </button>
        <button
          class={`tab-btn ${tab === 'glossary' ? 'active' : ''}`}
          onClick={() => setTab('glossary')}
        >
          📚 Glossary ({settings.glossary.terms.length})
        </button>
      </nav>

      {/* TAB 1: TRANSLATE */}
      {tab === 'translate' && (
        <div class="tab-content">
          {/* Media Presence Detection Box */}
          <div
            class={`media-card ${
              mediaInfo.hasVideo
                ? 'media-found'
                : mediaInfo.checked
                  ? 'media-empty'
                  : 'media-loading'
            }`}
          >
            <div class="media-icon">{mediaInfo.hasVideo ? '🎬' : '📄'}</div>
            <div class="media-details">
              <div class="media-title">
                {mediaInfo.hasVideo
                  ? 'Phát hiện Video trên trang này'
                  : 'Không tìm thấy video/audio trên tab này'}
              </div>
              <div class="media-desc">
                {mediaInfo.hasVideo
                  ? mediaInfo.videoTitle || 'Sẵn sàng bắt luồng âm thanh để dịch trực tiếp.'
                  : 'Tiện ích hiện hỗ trợ video (YouTube, Coursera...). Tính năng dịch tài liệu/PDF/Paper đang được phát triển.'}
              </div>
            </div>
          </div>

          {/* Mode Warning Bar */}
          {settings.mode === 'demo' && (
            <div class="demo-banner">
              <span>💡 Đang ở chế độ <b>Demo (Giả lập)</b> — Không tốn quota API.</span>
              <button class="text-link" onClick={() => setTab('settings')}>
                Đổi chế độ
              </button>
            </div>
          )}

          {isDirectMissingKey && (
            <div class="key-warn-banner">
              <div>
                <b>⚠️ Chưa có Gemini API Key!</b>
                <div style={{ fontSize: '11px', marginTop: '2px' }}>
                  Chế độ Direct yêu cầu API Key để gọi Gemini.
                </div>
              </div>
              <button class="key-warn-btn" onClick={() => setTab('settings')}>
                Nhập key ➔
              </button>
            </div>
          )}

          {/* Live Recording Progress Indicator */}
          {running && (
            <div class="live-progress-card">
              <div class="live-pulse-dot" />
              <div class="live-progress-text">
                {settings.mode === 'demo' ? (
                  <span>Đang chạy mô phỏng phụ đề live (cập nhật mỗi 4.5s)...</span>
                ) : (
                  <span>
                    Đang thu âm PCM 16kHz & dịch AI ({elapsed % settings.chunkSeconds}s / {settings.chunkSeconds}s chu kỳ chunk)
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Main Action Button */}
          <button
            class={`primary ${running ? 'danger' : ''}`}
            onClick={toggleSession}
            disabled={busy || (!running && isDirectMissingKey)}
          >
            {running
              ? 'Dừng dịch'
              : isDirectMissingKey
                ? 'Vui lòng nhập API Key để bắt đầu'
                : settings.mode === 'demo'
                  ? 'Chạy thử Demo (Giả lập)'
                  : mediaInfo.hasVideo
                    ? 'Bắt đầu dịch video này'
                    : 'Bắt đầu dịch tab này'}
          </button>

          {state?.status === 'error' && (
            <div class="error-box">
              <div class="error-title">⚠️ Lỗi phiên dịch:</div>
              <div class="error-msg">{state.error}</div>
            </div>
          )}

          {/* Control Actions: Pause / Export Subtitles */}
          {(running || hasSubtitles) && (
            <div class="actions">
              {running && (
                <button class="ghost" onClick={togglePause} disabled={busy}>
                  {paused ? 'Tiếp tục' : 'Tạm dừng'}
                </button>
              )}
              <button
                class="ghost"
                onClick={() => void exportSubtitles('srt')}
                disabled={busy}
                title="Tải phụ đề định dạng .srt"
              >
                📥 Tải .srt
              </button>
              <button
                class="ghost"
                onClick={() => void exportSubtitles('txt')}
                disabled={busy}
                title="Tải văn bản dịch .txt"
              >
                📄 Tải .txt
              </button>
            </div>
          )}

          {/* Live Metrics */}
          <section class="metrics">
            <div class="metric">
              <b>{tsrPct}%</b>
              <span>TSR (Giữ term)</span>
            </div>
            <div class="metric">
              <b>{state?.units ?? 0}</b>
              <span>Phụ đề</span>
            </div>
            <div class="metric">
              <b>{state?.calls ?? 0}</b>
              <span>Lời gọi AI</span>
            </div>
            <div class="metric">
              <b>{state?.splices ?? 0}</b>
              <span>Chèn ⚠</span>
            </div>
          </section>

          {/* Quick Display Preferences */}
          <section class="rows">
            <label class="row">
              <span>Ngôn ngữ đích</span>
              <select
                value={settings.targetLang}
                onChange={(e) =>
                  void patchSettings({
                    targetLang: (e.target as HTMLSelectElement).value,
                  })
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
              <span>Hiện phụ đề gốc (Song ngữ)</span>
              <input
                type="checkbox"
                checked={settings.showOriginal}
                onChange={(e) =>
                  void patchSettings({
                    showOriginal: (e.target as HTMLInputElement).checked,
                  })
                }
              />
            </label>

            <label class="row">
              <span>Dịch tiêu đề video</span>
              <input
                type="checkbox"
                checked={settings.showTranslatedTitle}
                onChange={(e) =>
                  void patchSettings({
                    showTranslatedTitle: (e.target as HTMLInputElement).checked,
                  })
                }
              />
            </label>
          </section>
        </div>
      )}

      {/* TAB 2: SETTINGS (KEY & MODE) */}
      {tab === 'settings' && (
        <div class="tab-content">
          <div class="section-title">Chế độ hoạt động</div>
          <div class="modes-grid">
            <button
              class={`mode-card ${settings.mode === 'demo' ? 'selected' : ''}`}
              onClick={() => void patchSettings({ mode: 'demo' })}
            >
              <div class="mode-head">
                <span class="mode-name">Demo</span>
                <span class="mode-badge">Offline</span>
              </div>
              <div class="mode-desc">Chạy thử nghiệm không tốn API key.</div>
            </button>

            <button
              class={`mode-card ${settings.mode === 'direct' ? 'selected' : ''}`}
              onClick={() => void patchSettings({ mode: 'direct' })}
            >
              <div class="mode-head">
                <span class="mode-name">Direct</span>
                <span class="mode-badge badge-free">Khuyên dùng</span>
              </div>
              <div class="mode-desc">Gọi Gemini bằng key cá nhân của bạn.</div>
            </button>

            <button
              class={`mode-card ${settings.mode === 'gateway' ? 'selected' : ''}`}
              onClick={() => void patchSettings({ mode: 'gateway' })}
            >
              <div class="mode-head">
                <span class="mode-name">Gateway</span>
                <span class="mode-badge">Local Proxy</span>
              </div>
              <div class="mode-desc">Proxy Node.js giữ key trong .env.</div>
            </button>
          </div>

          {/* Direct Key Configuration */}
          {settings.mode === 'direct' && (
            <div class="field-box">
              <div class="field-label">
                <span>Gemini API Key</span>
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noreferrer"
                  class="field-help"
                >
                  Lấy key miễn phí ↗
                </a>
              </div>
              <div class="input-with-action">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={settings.apiKey}
                  placeholder="Dán AIzaSy... vào đây"
                  onInput={(e) =>
                    void patchSettings({
                      apiKey: (e.target as HTMLInputElement).value.trim(),
                    })
                  }
                />
                <button
                  type="button"
                  class="input-action-btn"
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? 'Ẩn' : 'Hiện'}
                </button>
              </div>
              <div class="field-hint">
                Key được lưu cục bộ trên máy bạn (chrome.storage.local), không gửi đi đâu khác.
              </div>
              <div style={{ marginTop: '6px' }}>
                <button
                  type="button"
                  class="ghost"
                  style={{ width: '100%', padding: '7px', fontSize: '11.5px' }}
                  onClick={runApiTest}
                  disabled={testStatus.testing || !settings.apiKey.trim()}
                >
                  {testStatus.testing ? '⏳ Đang kiểm tra kết nối Google...' : '🧪 Kiểm tra kết nối API Key'}
                </button>
              </div>
              {testStatus.result && (
                <div
                  style={{
                    marginTop: '6px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    fontSize: '11.5px',
                    lineHeight: '1.4',
                    background: testStatus.result.ok ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                    border: `1px solid ${testStatus.result.ok ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)'}`,
                    color: testStatus.result.ok ? '#6ee7b7' : '#fda4af',
                  }}
                >
                  {testStatus.result.ok
                    ? `✅ API Key hoạt động hoàn hảo! Đã kết nối thành công với model [${testStatus.result.model}].`
                    : `❌ Lỗi kết nối Google: ${testStatus.result.error}`}
                </div>
              )}
            </div>
          )}

          {/* Gateway URL Configuration */}
          {settings.mode === 'gateway' && (
            <div class="field-box">
              <div class="field-label">
                <span>Gateway URL</span>
              </div>
              <input
                type="text"
                value={settings.gatewayUrl}
                placeholder="http://localhost:8787"
                onInput={(e) =>
                  void patchSettings({
                    gatewayUrl: (e.target as HTMLInputElement).value.trim(),
                  })
                }
              />
              <div class="field-hint">
                Chạy script local: <code>node gateway/gateway.mjs</code>
              </div>
            </div>
          )}

          {/* Visual preferences */}
          <div class="section-title">Tùy chỉnh phụ đề</div>
          <div class="rows">
            <label class="row">
              <span>Cỡ chữ phụ đề</span>
              <select
                value={settings.fontSize}
                onChange={(e) =>
                  void patchSettings({
                    fontSize: (e.target as HTMLSelectElement).value as any,
                  })
                }
              >
                <option value="small">Nhỏ (18px)</option>
                <option value="medium">Vừa (22px)</option>
                <option value="large">Lớn (27px)</option>
              </select>
            </label>

            <label class="row">
              <span>Độ dài Chunk audio: {settings.chunkSeconds}s</span>
              <input
                type="range"
                min="30"
                max="180"
                step="5"
                value={settings.chunkSeconds}
                onInput={(e) =>
                  void patchSettings({
                    chunkSeconds: clampChunk(Number((e.target as HTMLInputElement).value)),
                  })
                }
              />
            </label>
          </div>

          <div class="options-link-wrap">
            <button
              class="link-button"
              onClick={() => void browser.runtime.openOptionsPage()}
            >
              Mở trang Cài đặt toàn màn hình ↗
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: GLOSSARY */}
      {tab === 'glossary' && (
        <div class="tab-content">
          <div class="glossary-header">
            <div class="section-title">Bảo toàn thuật ngữ ({settings.glossary.terms.length})</div>
            <button class="text-link" onClick={loadSampleGlossary}>
              Nạp bộ mẫu
            </button>
          </div>

          {/* Quick Add Form */}
          <div class="glossary-add-box">
            <input
              type="text"
              placeholder="Thuật ngữ (vd: useEffect, npm run start...)"
              value={newTerm}
              onInput={(e) => setNewTerm((e.target as HTMLInputElement).value)}
            />
            <div class="glossary-row">
              <select
                value={newType}
                onChange={(e) => setNewType((e.target as HTMLSelectElement).value as TermType)}
              >
                <option value="code">Mã nguồn (code)</option>
                <option value="command">Lệnh shell (command)</option>
                <option value="jargon">Thuật ngữ dịch (jargon)</option>
                <option value="acronym">Từ viết tắt (acronym)</option>
              </select>
              <input
                type="text"
                placeholder={newType === 'jargon' ? 'Dịch là (vd: hạ gradient)' : 'Ghi chú (tuỳ chọn)'}
                value={newVi}
                onInput={(e) => setNewVi((e.target as HTMLInputElement).value)}
              />
            </div>
            <button
              class="ghost btn-add"
              onClick={addGlossaryTerm}
              disabled={!newTerm.trim()}
            >
              + Thêm thuật ngữ
            </button>
          </div>

          {/* Term List */}
          <div class="glossary-list">
            {settings.glossary.terms.length === 0 ? (
              <div class="empty-hint">Chưa có thuật ngữ nào. Hãy thêm thuật ngữ cần bảo toàn.</div>
            ) : (
              settings.glossary.terms.map((t, idx) => (
                <div class="glossary-item" key={t.term + idx}>
                  <div class="glossary-item-info">
                    <span class="glossary-item-term">{t.term}</span>
                    <span class={`type-tag type-${t.type}`}>{t.type}</span>
                    {t.vi && <span class="glossary-item-vi">➔ {t.vi}</span>}
                  </div>
                  <button
                    class="btn-delete"
                    onClick={() => removeGlossaryTerm(idx)}
                    title="Xóa thuật ngữ"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer>
        <div class="footer-left">
          {saved && <span class="save-toast">Đã lưu ✓</span>}
        </div>
        <span class={`mode-chip mode-${settings.mode}`}>
          {settings.mode === 'demo' ? 'DEMO' : settings.mode === 'direct' ? 'DIRECT' : 'GATEWAY'}
        </span>
      </footer>
    </div>
  );
}
