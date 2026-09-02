/**
 * Glossary is a user-owned, user-editable layer (never hardcoded).
 * It is shared by the ASR (custom vocabulary) and translation (prompt +
 * term-success-rate validation) stages. See docs/plan.md §4.
 */

export type TermType = 'command' | 'code' | 'jargon' | 'acronym';

export interface GlossaryTerm {
  /** Exact source-language string that must be preserved. */
  term: string;
  type: TermType;
  /** Authoritative translation, used to bias MT. Optional for command/code. */
  vi?: string;
  /** Free-form note shown in the editor. */
  note?: string;
}

export interface GlossaryDoc {
  version: 1;
  terms: GlossaryTerm[];
}

export const EMPTY_GLOSSARY: GlossaryDoc = { version: 1, terms: [] };

/** A ready-to-use starter glossary so the import/export UI has real content. */
export const STARTER_GLOSSARY: GlossaryDoc = {
  version: 1,
  terms: [
    { term: 'npm run start', type: 'command', note: 'Giữ nguyên văn tuyệt đối' },
    { term: 'useEffect', type: 'code' },
    { term: 'useState', type: 'code' },
    { term: 'gradient descent', type: 'jargon', vi: 'hạ gradient' },
    { term: 'backpropagation', type: 'jargon', vi: 'lan truyền ngược' },
    { term: 'overfitting', type: 'jargon', vi: 'quá khớp' },
    { term: 'GAN', type: 'acronym', vi: 'mạng đối sinh' },
    { term: 'LLM', type: 'acronym', vi: 'mô hình ngôn ngữ lớn' },
    { term: 'transformer', type: 'jargon', note: 'Giữ nguyên trong ngữ cảnh ML' },
  ],
};
