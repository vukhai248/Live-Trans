import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureTabPcm, int16ToBase64 } from './audio-capture';

describe('audio-capture', () => {
  describe('int16ToBase64', () => {
    it('encodes empty Int16Array to empty string', () => {
      const arr = new Int16Array(0);
      expect(int16ToBase64(arr)).toBe('');
    });

    it('encodes silence samples (0) correctly to base64', () => {
      const arr = new Int16Array([0, 0, 0, 0]);
      // 4 samples * 2 bytes = 8 bytes of zero
      expect(int16ToBase64(arr)).toBe(btoa('\0\0\0\0\0\0\0\0'));
    });

    it('handles large chunked buffers spanning beyond 0x8000 boundary', () => {
      const sampleCount = 40000; // > 32768 (0x8000)
      const arr = new Int16Array(sampleCount);
      for (let i = 0; i < sampleCount; i++) {
        arr[i] = i % 32767;
      }
      const encoded = int16ToBase64(arr);
      expect(typeof encoded).toBe('string');
      expect(encoded.length).toBeGreaterThan(0);
    });
  });

  describe('captureTabPcm teardown safety', () => {
    const originalAudioContext = globalThis.AudioContext;
    const originalAudio = globalThis.Audio;
    const originalMediaDevices = globalThis.navigator?.mediaDevices;

    let mockTrackStop: ReturnType<typeof vi.fn>;
    let mockStream: any;

    beforeEach(() => {
      mockTrackStop = vi.fn();
      mockStream = {
        getTracks: () => [{ stop: mockTrackStop }],
      };

      // Mock navigator.mediaDevices.getUserMedia safely
      Object.defineProperty(globalThis.navigator, 'mediaDevices', {
        value: {
          getUserMedia: vi.fn().mockResolvedValue(mockStream),
        },
        configurable: true,
        writable: true,
      });

      // Mock Audio element
      (globalThis as any).Audio = class {
        srcObject: any = null;
        play = vi.fn().mockResolvedValue(undefined);
      };
    });

    afterEach(() => {
      if (originalMediaDevices) {
        Object.defineProperty(globalThis.navigator, 'mediaDevices', {
          value: originalMediaDevices,
          configurable: true,
          writable: true,
        });
      }
      (globalThis as any).AudioContext = originalAudioContext;
      (globalThis as any).Audio = originalAudio;
    });

    it('guarantees media stream tracks are stopped when AudioContext fails during setup', async () => {
      // Mock AudioContext throwing error during initialization
      (globalThis as any).AudioContext = class {
        constructor() {
          throw new Error('AudioContext initialization failed');
        }
      };

      await expect(
        captureTabPcm({
          streamId: 'test-stream',
          chunkSeconds: 10,
          onChunk: vi.fn(),
        })
      ).rejects.toThrow('AudioContext initialization failed');

      // CRITICAL: The stream tracks MUST have been stopped so tab recording indicator turns off!
      expect(mockTrackStop).toHaveBeenCalledTimes(1);
    });

    it('stops stream tracks and disconnects nodes cleanly on handle.stop()', async () => {
      const mockDisconnectSource = vi.fn();
      const mockDisconnectProc = vi.fn();
      const mockCloseAudioCtx = vi.fn();

      (globalThis as any).AudioContext = class {
        state = 'running';
        destination = {};
        resume = vi.fn().mockResolvedValue(undefined);
        close = mockCloseAudioCtx;
        createMediaStreamSource() {
          return {
            connect: vi.fn(),
            disconnect: mockDisconnectSource,
          };
        }
        createScriptProcessor() {
          return {
            connect: vi.fn(),
            disconnect: mockDisconnectProc,
            onaudioprocess: null,
          };
        }
      };

      const handle = await captureTabPcm({
        streamId: 'test-stream-normal',
        chunkSeconds: 10,
        onChunk: vi.fn(),
      });

      expect(mockTrackStop).not.toHaveBeenCalled();

      handle.stop();

      expect(mockTrackStop).toHaveBeenCalledTimes(1);
      expect(mockDisconnectSource).toHaveBeenCalledTimes(1);
      expect(mockDisconnectProc).toHaveBeenCalledTimes(1);
      expect(mockCloseAudioCtx).toHaveBeenCalledTimes(1);
    });
  });
});
