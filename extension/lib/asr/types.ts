/** A single token produced by ASR with word-level timing. */
export interface Word {
  text: string;
  startMs: number;
  endMs: number;
}

/** A chunk of audio roughly `chunkSeconds` long, sent to the ASR provider. */
export interface AudioChunk {
  id: string;
  /** Base64 PCM 16-bit 16kHz mono LE. */
  pcmBase64: string;
  startMs: number;
  durationMs: number;
}

export interface Transcript {
  id: string;
  text: string;
  words: Word[];
  language?: string;
}
