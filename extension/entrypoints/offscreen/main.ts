import { browser } from 'wxt/browser';
import { AsrClient } from '@/lib/asr/client';
import type { AudioChunk } from '@/lib/asr/types';
import { captureTabPcm, type CaptureHandle } from '@/lib/capture/audio-capture';
import { Translator } from '@/lib/translate/batcher';
import type { RuntimeMessage } from '@/lib/protocol/messages';
import { createProvider } from '@/lib/providers';
import { loadSettings, type Settings } from '@/lib/settings';
import { segment, type SubtitleUnit } from '@/lib/subtitles/segmenter';

import { ConcurrencyQueue } from '@/lib/protocol/queue';

let activeTabId: number | undefined;
let capture: CaptureHandle | undefined;
let sessionRunning = false;
let sessionPaused = false;
let sessionSettings: Settings | undefined;
const liveTaskQueue = new ConcurrencyQueue(2);

const sessionStats = { units: 0, tsr: 1, retries: 0, splices: 0, calls: 0 };

/** In-memory ring of recently published units, capped to keep export light. */
const MAX_STORED_UNITS = 500;
const subtitleStore: SubtitleUnit[] = [];

function pushUnits(units: SubtitleUnit[]): void {
  if (units.length === 0) return;
  subtitleStore.push(...units);
  if (subtitleStore.length > MAX_STORED_UNITS) {
    subtitleStore.splice(0, subtitleStore.length - MAX_STORED_UNITS);
  }
}

function getSubtitleSnapshot(): SubtitleUnit[] {
  return subtitleStore.slice();
}

function sendToTab(message: RuntimeMessage): void {
  if (activeTabId === undefined) return;
  // Offscreen document KHÔNG có chrome.tabs (MV3 chỉ cấp API hạn chế) —
  // forward qua service worker, worker sẽ dùng tabs.sendMessage tới tab.
  void chrome.runtime
    .sendMessage({ type: 'FORWARD_TO_TAB', tabId: activeTabId, message })
    .catch(() => {});
}

function reportState(): void {
  const state = {
    status: sessionRunning ? ('capturing' as const) : ('idle' as const),
    paused: sessionPaused,
    units: sessionStats.units,
    tsr: sessionStats.tsr,
    retries: sessionStats.retries,
    splices: sessionStats.splices,
    calls: sessionStats.calls,
    tabId: activeTabId,
  };
  browser.runtime.sendMessage({ type: 'STATE_UPDATE', state }).catch(() => {});
}

async function translateTitle(title: string): Promise<void> {
  const settings = sessionSettings ?? (await loadSettings());
  const provider = createProvider(settings.mode);
  try {
    const translated = await provider.translateTitle(title, settings);
    sendToTab({
      type: 'TRANSLATED_TITLE',
      originalTitle: title,
      translatedTitle: translated,
    });
  } catch (err) {
    sendToTab({
      type: 'TRANSLATED_TITLE',
      originalTitle: title,
      translatedTitle: `⚠ ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}

function publishUnits(units: SubtitleUnit[]): void {
  if (units.length === 0 || sessionPaused) return;
  pushUnits(units);
  sessionStats.units += units.length;
  sendToTab({ type: 'SUBTITLES', units });
  reportState();
}

/** Offline/demo path: drive the full pipeline on a timer, no audio needed. */
async function runDemoSession(settings: Settings): Promise<void> {
  const provider = createProvider('demo');
  const asr = new AsrClient(provider, settings);
  const translator = new Translator(provider, settings);

  // Feeds a fresh mock transcript while the loop is alive.
  let i = 0;
  while (sessionRunning) {
    if (!sessionPaused) {
      const chunk: AudioChunk = {
        id: `demo-${i}`,
        pcmBase64: '',
        startMs: i * settings.chunkSeconds * 1000,
        durationMs: settings.chunkSeconds * 1000,
      };
      const transcript = await asr.transcribe(chunk, settings.glossary);
      const units = segment(transcript.words);
      const result = await translator.translateBatch(units, settings.glossary);
      sessionStats.retries += result.stats.retries;
      sessionStats.splices += result.stats.splices;
      sessionStats.calls += result.stats.calls;
      sessionStats.tsr = result.stats.tsr;
      publishUnits(result.units);
      i += 1;
    }
    await new Promise((r) => setTimeout(r, 4500));
  }
}

/** Real path: capture tab PCM and transcribe each chunk as it fills. */
async function runLiveSession(streamId: string, settings: Settings): Promise<void> {
  const provider = createProvider(settings.mode);
  const asr = new AsrClient(provider, settings);
  const translator = new Translator(provider, settings);

  let chunkIndex = 0;

  try {
    capture = await captureTabPcm({
      streamId,
      chunkSeconds: settings.chunkSeconds,
      onChunk: (pcmBase64, startMs, durationMs) => {
        if (sessionPaused || !sessionRunning) return;
        const chunk: AudioChunk = {
          id: `c${chunkIndex++}`,
          pcmBase64,
          startMs,
          durationMs,
        };
        void liveTaskQueue.run(async () => {
          if (!sessionRunning || sessionPaused) return;
          try {
            const transcript = await asr.transcribe(chunk, settings.glossary);
            const units = segment(transcript.words);
            const result = await translator.translateBatch(units, settings.glossary);
            sessionStats.retries += result.stats.retries;
            sessionStats.splices += result.stats.splices;
            sessionStats.calls += result.stats.calls;
            sessionStats.tsr = result.stats.tsr;
            publishUnits(result.units);
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            sendToTab({ type: 'CAPTURE_ERROR', error: errMsg });
            browser.runtime.sendMessage({
              type: 'STATE_UPDATE',
              state: {
                status: 'error',
                error: `Lỗi Gemini API: ${errMsg}`,
                paused: false,
                units: sessionStats.units,
                tsr: sessionStats.tsr,
                retries: sessionStats.retries,
                splices: sessionStats.splices,
                calls: sessionStats.calls,
                tabId: activeTabId,
              },
            }).catch(() => {});
          }
        });
      },
      onSilence: () => {
        sendToTab({
          type: 'CAPTURE_ERROR',
          error: 'Không nhận được âm thanh (tab im lặng hoặc DRM).',
        });
      },
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    browser.runtime.sendMessage({
      type: 'STATE_UPDATE',
      state: {
        status: 'error',
        error: `Không thể bắt âm thanh tab: ${errMsg}`,
        paused: false,
        units: sessionStats.units,
        tsr: sessionStats.tsr,
        retries: sessionStats.retries,
        splices: sessionStats.splices,
        calls: sessionStats.calls,
        tabId: activeTabId,
      },
    }).catch(() => {});
  }
}

async function startSession(
  streamId: string,
  tabId: number,
  settings: Settings,
): Promise<void> {
  if (sessionRunning) {
    capture?.stop();
    capture = undefined;
  }
  liveTaskQueue.clear();
  activeTabId = tabId;
  sessionSettings = settings;
  sessionRunning = true;
  sessionPaused = false;
  sessionStats.units = 0;
  sessionStats.tsr = 1;
  sessionStats.retries = 0;
  sessionStats.splices = 0;
  sessionStats.calls = 0;
  subtitleStore.length = 0; // fresh start for new session

  if (settings.mode === 'demo') {
    await runDemoSession(settings);
  } else {
    await runLiveSession(streamId, settings);
  }
}

function stopSession(): void {
  sessionRunning = false;
  sessionPaused = false;
  liveTaskQueue.clear();
  capture?.stop();
  capture = undefined;
  // NOTE: Keep subtitleStore populated so users can export .srt / .txt after stopping!
  reportState();
}

browser.runtime.onMessage.addListener(
  (message: RuntimeMessage, _sender, sendResponse) => {
    switch (message.type) {
      case 'GET_SUBTITLES':
        // Synchronous snapshot — no need to keep the channel open.
        sendResponse({
          type: 'SUBTITLES_SNAPSHOT',
          units: getSubtitleSnapshot(),
        } satisfies RuntimeMessage);
        return;
      case 'START_CAPTURE':
        void startSession(message.streamId, message.tabId, message.settings);
        break;
      case 'STOP_CAPTURE':
        stopSession();
        break;
      case 'PAUSE_SESSION':
        sessionPaused = true;
        reportState();
        break;
      case 'RESUME_SESSION':
        sessionPaused = false;
        reportState();
        break;
      case 'TITLE_DETECTED':
        void translateTitle(message.title);
        break;
      default:
        break;
    }
  },
);

// Announce readiness so background knows it can hand over the streamId.
browser.runtime
  .sendMessage({ type: 'OFFSCREEN_READY' } satisfies RuntimeMessage)
  .catch(() => {});
