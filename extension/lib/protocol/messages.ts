import type { SubtitleUnit } from '../subtitles/segmenter';
import type { Settings } from '../settings';

export type SessionStatus = 'idle' | 'starting' | 'capturing' | 'stopping' | 'error';

export interface SessionState {
  status: SessionStatus;
  error?: string;
  tabId?: number;
  /** True while a capturing session is paused (loop alive but not emitting). */
  paused: boolean;
  units: number;
  tsr: number;
  retries: number;
  splices: number;
  calls: number;
  startedAt?: number;
}

/**
 * All runtime messages between popup/options, background, offscreen and the
 * content script. `browser.runtime.sendMessage` delivers background/offscreen
 * traffic; `tabs.sendMessage` delivers to a tab's content script.
 */
export type RuntimeMessage =
  | { type: 'START_SESSION'; tabId?: number; streamId?: string }
  | { type: 'STOP_SESSION' }
  | { type: 'PAUSE_SESSION' }
  | { type: 'RESUME_SESSION' }
  | { type: 'GET_STATE' }
  | { type: 'GET_SUBTITLES' }
  | { type: 'STATE_UPDATE'; state: SessionState }
  | { type: 'START_CAPTURE'; streamId: string; tabId: number; settings: Settings }
  | { type: 'STOP_CAPTURE' }
  | { type: 'OFFSCREEN_READY' }
  | { type: 'CAPTURE_ERROR'; error: string }
  | { type: 'SUBTITLES'; units: SubtitleUnit[] }
  | { type: 'SUBTITLES_SNAPSHOT'; units: SubtitleUnit[] }
  | { type: 'TITLE_DETECTED'; title: string }
  | { type: 'TRANSLATED_TITLE'; originalTitle: string; translatedTitle: string }
  | { type: 'CHECK_MEDIA_PRESENCE' }
  | {
      type: 'MEDIA_PRESENCE_RESPONSE';
      hasVideo: boolean;
      hasAudio: boolean;
      videoTitle?: string;
      mediaCount: number;
    }
  | { type: 'FORWARD_TO_TAB'; tabId: number; message: RuntimeMessage };

export const INITIAL_STATE: SessionState = {
  status: 'idle',
  paused: false,
  units: 0,
  tsr: 1,
  retries: 0,
  splices: 0,
  calls: 0,
};
