import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import {
  INITIAL_STATE,
  type RuntimeMessage,
  type SessionState,
} from '@/lib/protocol/messages';

export default defineBackground(() => {
  let state: SessionState = { ...INITIAL_STATE };
  let offscreenReady = false;

  async function ensureOffscreen(): Promise<void> {
    try {
      const contexts = await browser.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
      });
      if (contexts.length > 0) {
        offscreenReady = true;
        return;
      }
    } catch {
      // getContexts unsupported on older Chrome — fall through to create.
    }
    await browser.offscreen.createDocument({
      url: browser.runtime.getURL('/offscreen.html'),
      reasons: ['USER_MEDIA', 'AUDIO_PLAYBACK'],
      justification: 'Capture the active tab audio and render live translated subtitles',
    });
  }

  async function waitForOffscreen(timeoutMs = 4000): Promise<void> {
    if (offscreenReady) return;
    const deadline = Date.now() + timeoutMs;
    while (!offscreenReady && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  async function closeOffscreen(): Promise<void> {
    try {
      await browser.offscreen.closeDocument();
    } catch {
      /* already closed */
    }
    offscreenReady = false;
  }

  async function handleStart(msg: Extract<RuntimeMessage, { type: 'START_SESSION' }>) {
    // Multi-tab guard: only one tab may be translated at a time. If a session
    // is already capturing/starting, stop it before starting the new one so we
    // never run two captures concurrently.
    if (state.status === 'capturing' || state.status === 'starting') {
      await handleStop();
    }
    const tab = msg.tabId
      ? await browser.tabs.get(msg.tabId).catch(() => undefined)
      : (await browser.tabs.query({ active: true, currentWindow: true }))[0];
    if (!tab?.id) {
      state = { ...state, status: 'error', error: 'Không tìm thấy tab để dịch' };
      return;
    }
    state = {
      ...INITIAL_STATE,
      status: 'starting',
      tabId: tab.id,
      startedAt: Date.now(),
    };

    try {
      await ensureOffscreen();
      await waitForOffscreen();
      // The streamId is normally obtained in the popup (which holds the user
      // gesture). Fall back to requesting it here for programmatic starts;
      // Chrome may reject this without an activeTab gesture.
      const streamId =
        msg.streamId ??
        (await browser.tabCapture.getMediaStreamId({ targetTabId: tab.id }));
      const { loadSettings } = await import('@/lib/settings');
      const settings = await loadSettings();
      const captureMsg: RuntimeMessage = {
        type: 'START_CAPTURE',
        streamId,
        tabId: tab.id,
        settings,
      };
      // Fire-and-forget: offscreen handles it; we don't await a response.
      browser.runtime.sendMessage(captureMsg).catch(() => {});
      state = { ...state, status: 'capturing' };
    } catch (err) {
      state = {
        ...state,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async function handleStop() {
    state = { ...state, status: 'stopping' };
    try {
      browser.runtime
        .sendMessage({ type: 'STOP_CAPTURE' } satisfies RuntimeMessage)
        .catch(() => {});
    } catch {
      /* offscreen may already be gone */
    }
    await closeOffscreen();
    state = { ...INITIAL_STATE, status: 'idle' };
  }

  browser.runtime.onMessage.addListener(
    (message: RuntimeMessage, _sender, sendResponse) => {
      void (async () => {
        switch (message.type) {
          case 'START_SESSION':
            await handleStart(message);
            sendResponse(state);
            break;
          case 'STOP_SESSION':
            await handleStop();
            sendResponse(state);
            break;
          case 'PAUSE_SESSION':
          case 'RESUME_SESSION':
            // Forward to the offscreen session loop (idempotent flag toggle).
            browser.runtime.sendMessage(message).catch(() => {});
            sendResponse(state);
            break;
          case 'GET_STATE':
            sendResponse(state);
            break;
          case 'GET_SUBTITLES':
            // Forward to the offscreen (which holds the subtitle store) and
            // relay its snapshot back; answer with an empty snapshot if the
            // offscreen isn't running.
            try {
              const snap = await browser.runtime.sendMessage(
                { type: 'GET_SUBTITLES' } satisfies RuntimeMessage,
              );
              sendResponse(snap);
            } catch {
              sendResponse({ type: 'SUBTITLES_SNAPSHOT', units: [] } satisfies RuntimeMessage);
            }
            break;
          case 'OFFSCREEN_READY':
            offscreenReady = true;
            break;
          case 'STATE_UPDATE':
            state = { ...state, ...message.state };
            break;
          default:
            break;
        }
      })();
      return true; // keep the channel open for async sendResponse
    },
  );
});
