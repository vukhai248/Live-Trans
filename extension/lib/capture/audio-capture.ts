/**
 * Tab-audio capture in the offscreen document (docs/plan.md §3 step 2).
 *
 * Currently uses ScriptProcessorNode (stable) as the PCM bridge; the plan's
 * primary choice is AudioWorklet and is a drop-in upgrade via the same
 * `CaptureHandle` contract. kami-subs (surveyed reference) likewise notes
 * ScriptProcessorNode is deprecated but more stable in practice.
 */

export interface CaptureHandle {
  stop(): void;
}

export interface CaptureOptions {
  streamId: string;
  chunkSeconds: number;
  onChunk: (pcmBase64: string, startMs: number, durationMs: number) => void;
  /** Called when RMS stays ~0 for a while (silence / DRM tab). */
  onSilence?: () => void;
}

const TARGET_SAMPLE_RATE = 16000;
const CHUNK_SAMPLES = (seconds: number) => seconds * TARGET_SAMPLE_RATE;

export async function captureTabPcm(options: CaptureOptions): Promise<CaptureHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: options.streamId,
      },
    } as any,
  } as any);

  // Loopback: keep playing the tab audio so the user still hears it.
  const audioEl = new Audio();
  audioEl.srcObject = stream;
  void audioEl.play().catch(() => {});

  const audioCtx = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
  const source = audioCtx.createMediaStreamSource(stream);
  const processor = audioCtx.createScriptProcessor(4096, 1, 1);

  const targetPerChunk = CHUNK_SAMPLES(options.chunkSeconds);
  let buffer = new Int16Array(targetPerChunk);
  let filled = 0;
  let startedAt = 0;
  let lastRms = 0;
  const silenceWindow = 8_000; // ms

  processor.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0);
    // Compute RMS for silence/DRM detection.
    let sum = 0;
    for (let i = 0; i < input.length; i++) sum += input[i]! * input[i]!;
    const rms = Math.sqrt(sum / input.length);
    lastRms = rms;
    if (startedAt === 0) startedAt = performance.now();

    for (let i = 0; i < input.length; i++) {
      if (filled >= buffer.length) {
        const base64 = int16ToBase64(buffer);
        options.onChunk(base64, startedAt, options.chunkSeconds * 1000);
        buffer = new Int16Array(targetPerChunk);
        filled = 0;
        startedAt = performance.now();
      }
      const s = Math.max(-1, Math.min(1, input[i]!));
      buffer[filled++] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
  };

  source.connect(processor);
  processor.connect(audioCtx.destination);

  let silenceTimer: ReturnType<typeof setInterval> | undefined;
  if (options.onSilence) {
    silenceTimer = setInterval(() => {
      if (performance.now() - startedAt > silenceWindow && lastRms < 0.001) {
        options.onSilence?.();
      }
    }, 2000);
  }

  return {
    stop() {
      if (silenceTimer) clearInterval(silenceTimer);
      try {
        processor.disconnect();
        source.disconnect();
        void audioCtx.close();
        audioEl.srcObject = null;
        stream.getTracks().forEach((t) => t.stop());
      } catch {
        /* ignore teardown errors */
      }
    },
  };
}

/** Efficient Int16 → base64 (binary string via chunked btoa). */
export function int16ToBase64(samples: Int16Array): string {
  const bytes = new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
