import type { TextBlock, TranslatedBlock } from './types';

export interface MarkdownElement {
  id: string;
  type: 'heading' | 'paragraph' | 'formula' | 'algorithm' | 'footnote' | 'header';
  level?: number;
  text: string;
  sentences?: Array<{
    id: string;
    text: string;
    translation?: string;
  }>;
  equationNumber?: string;
}

/**
 * Normalizes inline math in text by wrapping isolated math notations with $...$.
 * e.g. "noise scales {\alpha_t}_{t=1}^T and initial data point z_0"
 *   -> "noise scales ${\\alpha_t}_{t=1}^T$ and initial data point $z_0$"
 */
export function wrapInlineMath(text: string): string {
  if (!text) return '';

  let res = text;

  // Protect expressions already inside $...$
  const protectedSegments: string[] = [];
  res = res.replace(/\$[^$]+\$/g, (m) => {
    const idx = protectedSegments.length;
    protectedSegments.push(m);
    return `⟦PROT_${idx}⟧`;
  });

  // 0. Normalize Computer Modern backtick-encoded math symbol `(...) to \ell(...)
  res = res.replace(/`\s*\(/g, '\\ell(');

  // 1. Wrap Greek symbols and LaTeX commands like \Delta z_0, \epsilon_\theta, \ell(...)
  // P1: bỏ \b sau "}" (không bao giờ match) → dùng (?!\w).
  res = res.replace(
    /(?:\\Delta\s*[a-zA-Z0-9_]+|\\hat\{[a-zA-Z0-9_]+\}(?:_[a-zA-Z0-9={}^\\α-ωΑ-Ω]+)?(?:\^[a-zA-Z0-9={}^\\α-ωΑ-Ω]+)?|\\tilde\{[a-zA-Z0-9_]+\}(?:_[a-zA-Z0-9={}^\\α-ωΑ-Ω]+)?(?:\^[a-zA-Z0-9={}^\\α-ωΑ-Ω]+)?|\\epsilon_\\theta(?:\([^)]*\))?|\\ell(?:\([^)]*\))?)(?!\w)/gi,
    (m) => `$${m}$`,
  );

  // 2. Wrap bracketed sets: {\alpha_t}_{t=1}^T or {a_T}
  // P1: bỏ qua nội dung đã nằm trong $...$ (vừa bọc ở bước 1) bằng cách
  // protect tạm các đoạn $...$ mới sinh trước khi chạy pattern generic.
  res = res.replace(/\$[^$]+\$/g, (m) => {
    const idx = protectedSegments.length;
    protectedSegments.push(m);
    return `⟦PROT_${idx}⟧`;
  });
  res = res.replace(
    /\{[a-zA-Z0-9_\\α-ωΑ-Ω]+\}(?:[_\^]?[a-zA-Z0-9={}^\\α-ωΑ-Ω]+)*/g,
    (m) => `$${m}$`,
  );

  // 3. Wrap function calls and prime variables: f(x), f(z), c', x'
  res = res.replace(/\$[^$]+\$/g, (m) => {
    const idx = protectedSegments.length;
    protectedSegments.push(m);
    return `⟦PROT_${idx}⟧`;
  });
  res = res.replace(
    /(?:(?<![\p{L}\p{N}])[fgh]\([a-zA-Z0-9_\\]+\)(?![\p{L}\p{N}])|(?<![\p{L}\p{N}])[a-zA-Z]'(?![\p{L}\p{N}]))/gu,
    (m) => `$${m}$`,
  );

  // 4. Wrap variable with sub/superscripts: z_0, z0, z_t, zt, x_0, x0, x_t, xt, y_n, w_t, D^S, D^T
  // P1: protect lại các $...$ vừa sinh ở bước 3 để không bọc lồng nhau.
  res = res.replace(/\$[^$]+\$/g, (m) => {
    const idx = protectedSegments.length;
    protectedSegments.push(m);
    return `⟦PROT_${idx}⟧`;
  });
  res = res.replace(
    /(?<![\p{L}\p{N}])(?:z_0|z0|z_t|zt|x_0|x0|x_t|xt|y_n|w_t|z_\{t-1\}|z_\{0\}|x_\{t\}|x_\{0\}|D\^[ST]|q\([^)]*\)|p\([^)]*\))(?![\p{L}\p{N}])/gu,
    (m) => `$${m}$`,
  );

  // Restore protected segments
  for (let i = 0; i < protectedSegments.length; i++) {
    const seg = protectedSegments[i];
    if (seg !== undefined) {
      res = res.replaceAll(`⟦PROT_${i}⟧`, seg);
    }
  }

  return res;
}

/**
 * Converts a list of PDF TextBlocks into structured Markdown elements for reading.
 */
export function blocksToMarkdownElements(blocks: Array<TextBlock | TranslatedBlock>): MarkdownElement[] {
  const elements: MarkdownElement[] = [];

  for (const b of blocks) {
    // Ignore running headers at top of page
    if (b.isHeader) continue;

    if (b.isFormula) {
      // Extract equation number if present, e.g. "(1)", "(2)"
      const numMatch = b.text.match(/\(\s*\d+(\.\d+)?\s*\)$/);
      const eqNum = numMatch ? numMatch[0] : undefined;
      const cleanFormula = b.text.replace(/\(\s*\d+(\.\d+)?\s*\)$/, '').trim();

      elements.push({
        id: b.id,
        type: 'formula',
        text: cleanFormula || b.text,
        equationNumber: eqNum,
      });
      continue;
    }

    if (b.isAlgorithm) {
      elements.push({
        id: b.id,
        type: 'algorithm',
        text: b.text,
        sentences: b.sentences?.map((s) => ({
          id: s.id,
          text: s.text,
          translation: (s as { translation?: string }).translation,
        })),
      });
      continue;
    }

    if (b.isFootnote) {
      elements.push({
        id: b.id,
        type: 'footnote',
        text: b.text,
        sentences: b.sentences?.map((s) => ({
          id: s.id,
          text: s.text,
          translation: (s as { translation?: string }).translation,
        })),
      });
      continue;
    }

    if (b.isHeading) {
      const level = /^[0-9]+\.[0-9]+/i.test(b.text) ? 3 : /^[0-9]+\./i.test(b.text) ? 2 : 1;
      elements.push({
        id: b.id,
        type: 'heading',
        level,
        text: b.text,
        sentences: b.sentences?.map((s) => ({
          id: s.id,
          text: s.text,
          translation: (s as { translation?: string }).translation,
        })),
      });
      continue;
    }

    // Standard body paragraph
    elements.push({
      id: b.id,
      type: 'paragraph',
      text: b.text,
      sentences: b.sentences?.map((s) => ({
        id: s.id,
        text: s.text,
        translation: (s as { translation?: string }).translation,
      })),
    });
  }

  return elements;
}
