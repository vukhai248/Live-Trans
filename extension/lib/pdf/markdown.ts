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

  // Normalize TeX Math control characters (0x0B-0x21) and tofu boxes (□)
  const omlMap: Record<number, string> = {
    0x0b: '\\alpha', 0x0c: '\\beta', 0x0d: '\\gamma', 0x0e: '\\delta',
    0x0f: '\\epsilon', 0x10: '\\zeta', 0x11: '\\eta', 0x12: '\\theta',
    0x13: '\\iota', 0x14: '\\kappa', 0x15: '\\lambda', 0x16: '\\mu',
    0x17: '\\nu', 0x18: '\\xi', 0x19: '\\pi', 0x1a: '\\rho',
    0x1b: '\\sigma', 0x1c: '\\tau', 0x1d: '\\upsilon', 0x1e: '\\phi',
    0x1f: '\\chi',
  };
  res = res.replace(/[\u000b-\u001f]/g, (ch) => omlMap[ch.charCodeAt(0)] || ch);
  res = res.replace(/(?:[ˆ^]\s*\\epsilon|\\epsilon\s*[ˆ^]|□\s*[\^ˆ]?'\s*t|□\s*['’]\s*t)/g, '\\hat{\\epsilon}_t');
  res = res.replace(/(?:\\epsilon\s*['’]|□\s*['’])/g, "\\epsilon'");
  res = res.replace(/□/g, '');

  // 0. Normalize Computer Modern backtick-encoded math symbol `(...) to \ell(...)
  res = res.replace(/`\s*\(/g, '\\ell(');

  // 0b. Normalize loss function pair (f, l), (f, 1), (f, \ell) -> $(f, \ell)$
  res = res.replace(
    /(?<![\p{L}\p{N}])\(\s*([fgh])\s*,\s*(?:1|l|\\ell)\s*\)(?![\p{L}\p{N}])/gu,
    '($1, \\ell)',
  );
  res = res.replace(
    /(?<![\p{L}\p{N}])([fgh])\s*,\s*(?:1|l)(?=\s*[.,;!?)]|\s+|$)/gu,
    '$1, \\ell',
  );

  // 1. Wrap Greek symbols and LaTeX commands like \Delta z_0, \epsilon_\theta, \ell(...), (f, \ell)
  // P1: bỏ \b sau "}" (không bao giờ match) → dùng (?!\w).
  res = res.replace(
    /(?:\\Delta\s*[a-zA-Z0-9_]+|\\hat\{[a-zA-Z0-9_]+\}(?:_[a-zA-Z0-9={}^\\α-ωΑ-Ω]+)?(?:\^[a-zA-Z0-9={}^\\α-ωΑ-Ω]+)?|\\tilde\{[a-zA-Z0-9_]+\}(?:_[a-zA-Z0-9={}^\\α-ωΑ-Ω]+)?(?:\^[a-zA-Z0-9={}^\\α-ωΑ-Ω]+)?|\\epsilon_\\theta(?:\([^)]*\))?|\\ell(?:\([^)]*\))?|\\epsilon'|\\hat\{\\epsilon\}_t|\(\s*[fgh]\s*,\s*\\ell\s*\)|[fgh]\s*,\s*\\ell)(?!\w)/gi,
    (m) => `$${m}$`,
  );

  res = res.replace(
    /(?:\{[\\α\s]*t?\}\s*T\s*t\s*=\s*1|\{\s*\\?alpha_?t?\s*\}\s*T\s*t\s*=\s*1|\{αt\}T\s*t=1|\\?alpha\s*t\s*T\s*t\s*=\s*1|α\s*t\s*T\s*t\s*=\s*1)/gi,
    () => '${\\{\\alpha_t\\}_{t=1}^T}$',
  );
  res = res.replace(
    /\{([α-ωΑ-Ωa-zA-Z0-9_\\]+)\}\s*([A-Z])\s*([a-z0-9]+=[0-9]+)/g,
    (_, p1, p2, p3) => '${\\{' + p1 + '\\}_{' + p3 + '}^{' + p2 + '}}$',
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
    /\{[a-zA-Z0-9_\\α-ωΑ-Ω]+\}(?:[_^]?[a-zA-Z0-9={}^\\α-ωΑ-Ω]+)*/g,
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
    /(?<![\p{L}\p{N}])(?:z_0|z0|z_t|zt|x_0|x0|x_t|xt|y_n|w_t|z_\{t-1\}|z_\{0\}|x_\{t\}|x_\{0\}|D\^[ST]|q\([^)]*\)|p\([^)]*\)|zt\s*-\s*1|z_t\s*-\s*1|zt'|z_t'|z_t\^'|N\(0,\s*I\)|S\([^)]+\))(?![\p{L}\p{N}])/gu,
    (m) => {
      let math = m;
      if (math === 'N(0, I)' || math === 'N(0,I)') math = '\\mathcal{N}(0, \\mathbf{I})';
      else if (/^z_?t\s*-\s*1$/.test(math)) math = 'z_{t-1}';
      else if (/^z_?t'?$/.test(math)) math = "z_t'";
      else if (math.startsWith('S(')) math = math.replace(/[·•]/g, '\\cdot');
      return `$${math}$`;
    },
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
