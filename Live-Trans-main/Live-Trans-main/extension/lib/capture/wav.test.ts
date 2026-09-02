import { describe, expect, test } from 'vitest';
import { pcmBase64ToWavBytes } from './wav';

function int16ToBase64(samples: Int16Array): string {
  const bytes = new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function readAscii(view: DataView, offset: number, length: number): string {
  let s = '';
  for (let i = 0; i < length; i++) {
    s += String.fromCharCode(view.getUint8(offset + i));
  }
  return s;
}

describe('pcmBase64ToWavBytes', () => {
  test('produces a 44-byte RIFF header followed by PCM data', () => {
    const samples = new Int16Array([0, 16000, -16000, 32000, -32000]);
    const wav = pcmBase64ToWavBytes(int16ToBase64(samples));
    expect(wav.length).toBe(44 + samples.length * 2);
  });

  test('writes the canonical RIFF/WAVE/fmt/data markers', () => {
    const samples = new Int16Array(8);
    const wav = pcmBase64ToWavBytes(int16ToBase64(samples));
    const dv = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
    expect(readAscii(dv, 0, 4)).toBe('RIFF');
    expect(readAscii(dv, 8, 4)).toBe('WAVE');
    expect(readAscii(dv, 12, 4)).toBe('fmt ');
    expect(readAscii(dv, 36, 4)).toBe('data');
  });

  test('sets PCM format and mono 16-bit fields', () => {
    const samples = new Int16Array(10);
    const wav = pcmBase64ToWavBytes(int16ToBase64(samples), 16000, 1, 16);
    const dv = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
    expect(dv.getUint16(20, true)).toBe(1); // PCM format
    expect(dv.getUint16(22, true)).toBe(1); // mono
    expect(dv.getUint16(32, true)).toBe(2); // block align: 1 channel * 16 bits / 8
    expect(dv.getUint16(34, true)).toBe(16); // bits per sample
    expect(dv.getUint32(24, true)).toBe(16000); // sample rate
    expect(dv.getUint32(28, true)).toBe((16000 * 1 * 16) / 8); // byte rate
  });

  test('sets the data chunk size and RIFF file size correctly', () => {
    const samples = new Int16Array(123);
    const wav = pcmBase64ToWavBytes(int16ToBase64(samples));
    const dv = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
    const dataSize = samples.length * 2;
    expect(dv.getUint32(40, true)).toBe(dataSize);
    expect(dv.getUint32(4, true)).toBe(36 + dataSize);
  });

  test('preserves the original PCM samples after the header', () => {
    const samples = new Int16Array([42, -42, 1000, -1000]);
    const wav = pcmBase64ToWavBytes(int16ToBase64(samples));
    const dv = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
    for (let i = 0; i < samples.length; i++) {
      expect(dv.getInt16(44 + i * 2, true)).toBe(samples[i]!);
    }
  });
});
