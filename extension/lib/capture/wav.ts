/**
 * Convert raw PCM (Int16 LE, 16 kHz mono — what the offscreen capture emits)
 * into a valid WAV byte container. Gemini's Files API requires a real audio
 * container (WAV/MP3/FLAC...), so we prepend a 44-byte WAV header before upload.
 */

export function pcmBase64ToWavBase64(pcmBase64: string): string {
  const bytes = pcmBase64ToWavBytes(pcmBase64);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function pcmBase64ToWavBytes(
  pcmBase64: string,
  sampleRate = 16000,
  channels = 1,
  bitsPerSample = 16,
): Uint8Array {
  const pcmBytes = base64ToBytes(pcmBase64);
  const dataSize = pcmBytes.length;
  const header = buildWavHeader(dataSize, sampleRate, channels, bitsPerSample);

  const out = new Uint8Array(header.length + dataSize);
  out.set(header, 0);
  out.set(pcmBytes, header.length);
  return out;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function buildWavHeader(
  dataSize: number,
  sampleRate: number,
  channels: number,
  bitsPerSample: number,
): Uint8Array {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const buf = new ArrayBuffer(44);
  const v = new DataView(buf);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  v.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  v.setUint32(16, 16, true); // PCM chunk size
  v.setUint16(20, 1, true); // audio format = PCM
  v.setUint16(22, channels, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, byteRate, true);
  v.setUint16(32, blockAlign, true);
  v.setUint16(34, bitsPerSample, true);
  writeStr(36, 'data');
  v.setUint32(40, dataSize, true);

  return new Uint8Array(buf);
}
