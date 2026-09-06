import type { ComponentType, SentenceItem, TextBlock } from './types';

export interface RawTextItem {
  str: string;
  dir?: string;
  /** [scaleX, skewY, skewX, scaleY, tx, ty] */
  transform: number[];
  width: number;
  height: number;
  fontName?: string;
  hasEOL?: boolean;
}

interface NormalizedItem {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize: number;
  bold: boolean;
  col: number; // 0: full-width / header, 1: left column, 2: right column
}

interface LineItem {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize: number;
  bold: boolean;
  col: number;
}

/**
 * Maps TeX Math OML encoded control characters (0x0B-0x21) to standard Greek/math unicode
 * and cleans unprintable control characters to prevent tofu square boxes (□).
 */
export function sanitizeTeXMathCharacters(text: string): string {
  if (!text) return '';
  const omlMap: Record<number, string> = {
    0x0b: 'α', 0x0c: 'β', 0x0d: 'γ', 0x0e: 'δ',
    0x0f: 'ϵ', 0x10: 'ζ', 0x11: 'η', 0x12: 'θ',
    0x13: 'ι', 0x14: 'κ', 0x15: 'λ', 0x16: 'μ',
    0x17: 'ν', 0x18: 'ξ', 0x19: 'π', 0x1a: 'ρ',
    0x1b: 'σ', 0x1c: 'τ', 0x1d: 'υ', 0x1e: 'ϕ',
    0x1f: 'χ',
  };
  let s = text.replace(/[\u000b-\u001f]/g, (ch) => omlMap[ch.charCodeAt(0)] || '');
  // Handle combined hat with epsilon: ˆϵ, ϵˆ, ^ϵ, ˆ\u000f
  s = s.replace(/(?:[ˆ^]\s*ϵ|ϵ\s*[ˆ^])/g, 'ϵ̂');
  // Strip control chars except newline, tab, carriage return
  s = s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffd]/g, '');
  return s;
}

/**
 * Normalizes raw PDF.js TextItems into top-left coordinate space (scale = 1.0).
 * Filters out rotated margin watermarks (e.g. "arXiv:2302.07121v1 [cs.CV] 14 Feb 2023").
 */
export function normalizeTextItems(
  items: RawTextItem[],
  viewportWidth: number,
  viewportHeight: number,
): NormalizedItem[] {
  const result: NormalizedItem[] = [];

  for (const item of items) {
    const rawStr = sanitizeTeXMathCharacters(item.str || '');
    const text = rawStr.trim();
    if (!text) continue;

    // 0. Filter out arXiv stamps / watermarks unconditionally (Ảnh 4 & 5)
    if (/arxiv:\s*\d+\.\d+/i.test(text)) {
      continue;
    }

    const a = item.transform[0] ?? 1;
    const b = item.transform[1] ?? 0;
    const tx = item.transform[4] ?? 0;
    const ty = item.transform[5] ?? 0;
    const d = item.transform[3] ?? 1;

    // 1. Detect vertical / rotated text (e.g. arXiv stamp rotated 90° on left margin)
    // For 90° rotation, |b| is significant while |a| ~ 0
    if (Math.abs(b) > Math.abs(a) * 1.2) {
      continue; // Skip vertical watermark; original canvas already renders it
    }

    // 2. Detect outside-margin watermark stamps
    if ((tx < 35 || tx > viewportWidth - 35) && /doi:|copyright/i.test(text)) {
      continue;
    }

    const fontSize = Math.max(Math.hypot(b, d), Math.hypot(a, 0), item.height || 10);
    const x = tx;
    // PDF coordinates have (0,0) at bottom-left; convert to top-left
    const y = viewportHeight - ty - fontSize;
    const w = item.width > 0 ? item.width : text.length * fontSize * 0.5;
    const h = fontSize;

    const bold = Boolean(
      (item.fontName && /bold|black|heavy|medium/i.test(item.fontName)) ||
        Math.abs(a) > 1.2 * fontSize,
    );

    result.push({
      str: rawStr,
      x,
      y,
      w,
      h,
      fontSize,
      bold,
      col: 0,
    });
  }

  return result;
}

/**
 * Detects the divider line between left and right column in academic papers.
 */
function detectColumnDivider(items: NormalizedItem[], viewportWidth: number): number {
  const defaultDivider = viewportWidth / 2;
  if (items.length < 10) return defaultDivider;

  // Search for the gutter gap between 38% and 62% of viewport width
  const minX = viewportWidth * 0.38;
  const maxX = viewportWidth * 0.62;

  const binSize = 4;
  const binsCount = Math.ceil((maxX - minX) / binSize);
  const density = new Array(binsCount).fill(0);

  for (const item of items) {
    const start = Math.max(0, Math.floor((item.x - minX) / binSize));
    const end = Math.min(binsCount - 1, Math.floor((item.x + item.w - minX) / binSize));
    for (let b = start; b <= end; b++) {
      density[b]++;
    }
  }

  // Find bin with minimum density (widest gutter)
  let minDensity = Infinity;
  let bestBin = Math.floor(binsCount / 2);
  for (let b = 0; b < binsCount; b++) {
    if (density[b] < minDensity) {
      minDensity = density[b];
      bestBin = b;
    }
  }

  return minX + bestBin * binSize + binSize / 2;
}

/**
 * Splits normalized text items into coherent horizontal lines.
 */
export function groupIntoLines(items: NormalizedItem[], viewportWidth = 612): LineItem[] {
  if (items.length === 0) return [];

  const dividerX = detectColumnDivider(items, viewportWidth);

  // Group items into coherent horizontal lines using adaptive baseline clustering.
  // This preserves subscripts/superscripts (e.g. z_0, x_t, {\alpha_t}_{t=1}^T) without splitting.
  const ySorted = [...items].sort((a, b) => a.y - b.y);
  const clusters: NormalizedItem[][] = [];

  for (const it of ySorted) {
    let bestCluster: NormalizedItem[] | null = null;
    let minDiff = Infinity;

    for (const c of clusters) {
      const avgY = c.reduce((s, x) => s + x.y, 0) / c.length;
      const avgFs = c.reduce((s, x) => s + x.fontSize, 0) / c.length;
      // In academic papers, lines are spaced ~12pt apart. A tolerance of ~5.8pt
      // captures subscripts/superscripts (offsets 2-5pt) without merging adjacent lines.
      const tol = Math.max(5.8, Math.max(it.fontSize, avgFs) * 0.58);
      const diff = Math.abs(it.y - avgY);
      if (diff <= tol && diff < minDiff) {
        minDiff = diff;
        bestCluster = c;
      }
    }

    if (bestCluster) {
      bestCluster.push(it);
    } else {
      clusters.push([it]);
    }
  }

  const lines: LineItem[] = [];
  for (const cluster of clusters) {
    const sortedCluster = [...cluster].sort((a, b) => a.x - b.x);
    const startItem = sortedCluster[0];
    if (!startItem) continue;

    let subLine: NormalizedItem[] = [startItem];
    for (let j = 1; j < sortedCluster.length; j++) {
      const prev = subLine[subLine.length - 1];
      const curr = sortedCluster[j];
      if (!prev || !curr) continue;

      const gap = curr.x - (prev.x + prev.w);

      // Split line if crossing the column divider with significant gap
      if (gap > 12 && prev.x + prev.w <= dividerX + 8 && curr.x >= dividerX - 8) {
        lines.push(buildLine(subLine, dividerX, viewportWidth));
        subLine = [curr];
      } else {
        subLine.push(curr);
      }
    }
    if (subLine.length > 0) {
      lines.push(buildLine(subLine, dividerX, viewportWidth));
    }
  }

  // Academic reading order sorting:
  // 1. Running Header (y < 46pt) first
  // 2. Full-width title/abstract if top section
  // 3. Left column (col = 1) from top to bottom
  // 4. Right column (col = 2) from top to bottom
  // 5. Footer / Footnote (col = 0 at bottom)
  return lines.sort((l1, l2) => {
    const isL1Header = l1.y < 46;
    const isL2Header = l2.y < 46;
    if (isL1Header && !isL2Header) return -1;
    if (!isL1Header && isL2Header) return 1;
    if (isL1Header && isL2Header) return l1.x - l2.x;

    // Both in columns: column 1 first, then column 2
    if (l1.col !== l2.col && l1.col > 0 && l2.col > 0) {
      return l1.col - l2.col;
    }

    // Default by y-coordinate
    return l1.y - l2.y;
  });
}

function buildLine(items: NormalizedItem[], dividerX: number, viewportWidth: number): LineItem {
  const sorted = [...items].sort((a, b) => a.x - b.x);
  const first = sorted[0];
  if (!first) {
    return { text: '', x: 0, y: 0, w: 0, h: 0, fontSize: 10, bold: false, col: 0 };
  }

  let text = '';
  let minX = first.x;
  let minY = first.y;
  let maxX = first.x + first.w;
  let maxY = first.y + first.h;
  let totalFontSize = 0;
  let boldCount = 0;

  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i];
    if (!item) continue;
    if (i > 0) {
      const prev = sorted[i - 1];
      if (prev) {
        const gap = item.x - (prev.x + prev.w);
        // P2: ngưỡng space tương đối theo font (thay 1.2pt tuyệt đối) — width pdf.js
        // sai số lớn ở font nhỏ/to nên ngưỡng cứng gây dính từ hoặc thừa space.
        const spaceThreshold = Math.max(1.2, ((prev.fontSize + item.fontSize) / 2) * 0.15);
        if (gap > spaceThreshold && !text.endsWith(' ') && !item.str.startsWith(' ')) {
          text += ' ';
        }
      }
    }
    text += item.str;
    minX = Math.min(minX, item.x);
    minY = Math.min(minY, item.y);
    maxX = Math.max(maxX, item.x + item.w);
    maxY = Math.max(maxY, item.y + item.h);
    totalFontSize += item.fontSize;
    if (item.bold) boldCount++;
  }

  const w = maxX - minX;

  // Column determination
  const col = w > viewportWidth * 0.65 ? 0 : (minX + maxX) / 2 < dividerX ? 1 : 2;

  return {
    text: text.trim(),
    x: minX,
    y: minY,
    w,
    h: maxY - minY,
    fontSize: totalFontSize / sorted.length,
    bold: boldCount > sorted.length / 2,
    col,
  };
}

/**
 * Checks if a text line is a standalone section heading (e.g. "Abstract", "1. Introduction").
 */
export function isStandaloneHeading(text: string, bold = false): boolean {
  if (!text) return false;
  const t = text.trim();
  if (t.length > 80) return false;

  // Special academic standalone headings like "Abstract", "Keywords", "References"
  if (/^(abstract|keywords?|references?|acknowledgments?|appendix)\b/i.test(t)) {
    return true;
  }

  // Numbered headings like "1. Introduction", "2. Background", "2.1. Diffusion Models"
  // Section numbers must start from 1 (never 0, which arises from stray math subscripts like z_0)
  if (/^[1-9]\d*(?:\.\d+)*\.?\s+[A-Z]/.test(t)) {
    return true;
  }

  // Short bold title-like lines without sentence-ending periods and without math symbols
  if (bold && t.length < 50 && !/[.!?]$/.test(t) && !/[=<>±×÷_{}\\]/.test(t)) {
    return true;
  }

  return false;
}

/**
 * Checks if a line is a math fragment (e.g. numerator, denominator, equation label, or isolated math symbols).
 * Handles multi-line fractions and radical equations (e.g. (2), (3), (8), (9)).
 */
export function isMathFragment(text: string): boolean {
  if (!text) return false;
  const t = text.trim();

  // Strip LaTeX macros (e.g. \sqrt, \alpha, \epsilon) before counting prose words
  const withoutLatex = t.replace(/\\[a-zA-Z]+/g, ' ');
  // Split on spaces and hyphens so hyphenated words count as multiple words
  const words = withoutLatex
    .split(/[\s-]+/)
    .map((w) => w.replace(/[^a-zA-Z]/g, ''))
    .filter((w) => w.length >= 3);

  // If there are 3 or more English words, it is a prose sentence, NOT a standalone equation
  if (words.length >= 3) return false;

  // Lines that begin with subordinate sentence clauses ("where ", "with ", "and ", etc.)
  // without an equation tag "(1)" are inline prose continuations, NOT standalone equation blocks!
  const hasEquationNumber = /\(\s*\d+(\.\d+)?\s*\)$/.test(t);
  if (
    !hasEquationNumber &&
    /^(where|with|for|and|in\s+which|such\s+that|here|when|denoting|defining|wherever)\b/i.test(t)
  ) {
    return false;
  }

  // 1. Standalone equation number at end: e.g. "(1)", "(2)", "(3)"
  if (hasEquationNumber) {
    if (t.length < 80) return true;
    if (/[=≈∼≤≥±×÷∇∑∏∫√\\_{}^αβγδεθλμστωϕψ]/.test(t)) return true;
  }

  // 2. Strong mathematical operators
  if (/[≈∼≤≥±×÷∇∑∏∫√]/.test(t)) return true;
  if (/=/.test(t)) {
    const mathMarkers = (t.match(/[_{}^\\αβγδεθλμστωϕψ]/g) || []).length;
    if (words.length <= 2 || mathMarkers > 0) return true;
  }

  // 3. Mathematical variables and notations (only when words <= 1)
  if (words.length <= 1) {
    if (/\b(?:z_t|x_t|y_n|z_0|w_t|q\(|p\(|N\([^)]*\)|D\^[ST])(?!\w)/i.test(t)) {
      return true;
    }
    if (/[\^_{}\\αβγδεθλμστωϕψ]/.test(t)) {
      return true;
    }
    // Only match operator if it's not a hyphen between alphabetic characters (e.g. state-of-the-art)
    if (/(\+|\*|\/|(?<![a-zA-Z])-(?![a-zA-Z]))\s*[a-zA-Z0-9_\\]+/.test(t)) {
      return true;
    }
  }

  return false;
}

export function isDisplayEquation(text: string): boolean {
  return isMathFragment(text);
}

export function isMathFormula(text: string): boolean {
  return isMathFragment(text);
}

/**
 * Checks if a line belongs to an algorithm box (e.g. Algorithm 1 Universal Guidance, pseudocode steps).
 */
export function isAlgorithmLine(text: string): boolean {
  if (!text) return false;
  const t = text.trim();

  if (/^Algorithm\s+\d+/i.test(t)) return true;
  if (/^(Parameter|Required|Input|Output|Ensure|Require):/i.test(t)) return true;
  if (/^(for\s+[a-zA-Z0-9_\\]+\s*=\s*|while\s+.+\s+do\b|if\s+.+\s+then\b)/i.test(t)) return true;
  if (/^(end\s*(for|while|if|do)?\b)/i.test(t)) return true;
  if (/^(State|Output|Return)\s*:/i.test(t)) return true;
  if (/^(Calculate|Compute|Perform|Sample|Initialize|Update)\s+[a-zA-Z0-9_\\^]+/i.test(t)) return true;

  return false;
}

/**
 * Checks if a line belongs to the footnote section at the bottom of the page.
 */
export function isFootnoteItem(y: number, fontSize: number, text: string): boolean {
  if (y > 670 && fontSize <= 8.5) return true;
  if (
    y > 640 &&
    /^\s*(\*|†|‡|\d+)\s*(Equal|Department|University|Correspondence|This work|Email)/i.test(text)
  ) {
    return true;
  }
  return false;
}

/**
 * Merges consecutive lines handling word dehyphenation and broken URLs.
 */
export function joinLinesWithDehyphenation(lines: LineItem[]): string {
  let text = '';

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l) continue;
    const lineText = l.text.trim();
    if (!lineText) continue;

    if (i === 0) {
      text = lineText;
      continue;
    }

    // Check if previous line ended with hyphen for a split word or URL
    if (/(https?:\/\/[^\s]+|github\.com\/[^\s]+|[a-zA-Z]+)-$/.test(text)) {
      if (text.includes('github.com') || text.includes('http')) {
        // Keep hyphen in URL and attach next part
        text = text + lineText;
      } else {
        // Standard word dehyphenation: remove trailing '-'
        text = text.slice(0, -1) + lineText;
      }
    } else {
      text += ' ' + lineText;
    }
  }

  return text.trim();
}

/**
 * Splits text into individual sentences, carefully protecting abbreviations.
 */
export function splitTextIntoSentences(text: string): string[] {
  if (!text || text.length < 8) return [text];

  const clean = text.replace(/\s+/g, ' ').trim();

  // Protect common scientific abbreviations and decimals from being split
  // P2: mở rộng danh sách (etc., cf., Figs./Eqs./Refs./Secs., Ch., Vol., pp., ed., St.).
  const protectedText = clean
    .replace(
      /\b(e\.g|i\.e|et al|Figs?|Tabs?|Eqs?|Secs?|Refs?|vs|Prof|Dr|Mr|Ms|approx|no|etc|cf|Ch|Vol|pp|ed|St|Ph\.D|U\.S)\./gi,
      '$1⟦DOT⟧',
    )
    .replace(/(\d+)\.(\d+)/g, '$1⟦DOT⟧$2');

  // Split on sentence boundaries.
  // P2: chịu dấu đóng ngoặc/kép sau dấu câu (models." Next) và citation mở ngoặc
  // vuông đầu câu (models. [2] The...).
  const parts = protectedText.split(/(?<=[.?!]["'”’)\]]?)\s+(?=[A-Z0-9"“'‘([])/);

  const sentences: string[] = [];
  for (const p of parts) {
    const restored = p.replace(/⟦DOT⟧/g, '.').trim();
    if (!restored) continue;
    // P2: tách tiếp biên câu — biến toán viết thường sau dấu chấm
    // (distribution. z_t denotes...) mà lookahead hoa đã bỏ sót.
    const subParts = restored.split(/(?<=\.)\s+(?=[a-z]+_[a-zA-Z0-9]+\b)/);
    for (const sp of subParts) {
      const s = sp.trim();
      if (s) sentences.push(s);
    }
  }

  return sentences.length > 0 ? sentences : [clean];
}

function isCaptionStartLine(text: string): boolean {
  return /^(figure|table|fig\.)\s+\d+[:.]/i.test(text.trim());
}

function isReferenceStartLine(text: string): boolean {
  const t = text.trim();
  if (/^\[\d+\]\s+[A-Z]/.test(t)) return true;
  if (/^[A-Z][a-zA-Z'-]+,\s+[A-Z]\./.test(t)) return true;
  return false;
}

/**
 * Groups lines into coherent text blocks / paragraphs.
 * Strictly isolates multi-line fraction equations, algorithm boxes, headings, figure captions, references, and footnotes.
 */
export function groupIntoBlocks(lines: LineItem[], pageNumber: number): TextBlock[] {
  const first = lines[0];
  if (!first) return [];

  const blocks: TextBlock[] = [];
  let blockIndex = 0;

  let currentBlockLines: LineItem[] = [first];
  let inAlgorithm = isAlgorithmLine(first.text);
  let inCaption = isCaptionStartLine(first.text);
  let inReferences = false;

  for (let i = 1; i < lines.length; i++) {
    const prev = currentBlockLines[currentBlockLines.length - 1];
    const curr = lines[i];
    if (!prev || !curr) continue;

    // References section detection
    if (/^(references|tài liệu tham khảo)\b/i.test(curr.text.trim())) {
      inReferences = true;
    } else if (inReferences && /^\d+\.\s+[A-Z]/.test(curr.text.trim())) {
      // Numerical section heading exits references (e.g. "6. Appendix")
      inReferences = false;
    }

    // Algorithm box start: flush prior text block and begin isolated algorithm block
    if (/^Algorithm\s+\d+/i.test(curr.text)) {
      if (currentBlockLines.length > 0) {
        const b = createBlock(currentBlockLines, pageNumber, blockIndex++, inReferences);
        if (b) blocks.push(b);
      }
      currentBlockLines = [curr];
      inAlgorithm = true;
      inCaption = false;
      continue;
    }

    // Figure caption start: flush prior text block and begin isolated caption block
    if (isCaptionStartLine(curr.text)) {
      if (currentBlockLines.length > 0) {
        const b = createBlock(currentBlockLines, pageNumber, blockIndex++, inReferences);
        if (b) blocks.push(b);
      }
      currentBlockLines = [curr];
      inCaption = true;
      inAlgorithm = false;
      continue;
    }

    // Running Header isolation (y < 46pt on page 2+)
    const isPrevHeader = prev.y < 46;
    const isCurrHeader = curr.y < 46;
    const isHeaderBreak = isPrevHeader !== isCurrHeader;

    // Section Heading isolation (e.g. "Abstract", "1. Introduction")
    const isPrevHeading = isStandaloneHeading(prev.text, prev.bold);
    const isCurrHeading = isStandaloneHeading(curr.text, curr.bold);
    const isHeadingBreak = isPrevHeading || isCurrHeading;

    // Algorithm box isolation
    const isPrevAlgo = isAlgorithmLine(prev.text);
    const isCurrAlgo = isAlgorithmLine(curr.text);

    // Math formula line classification (handles multi-line fractions and display equations)
    const isPrevFormula = isMathFragment(prev.text);
    const isCurrFormula = isMathFragment(curr.text);

    // Footnote isolation
    const isPrevFootnote = isFootnoteItem(prev.y, prev.fontSize, prev.text);
    const isCurrFootnote = isFootnoteItem(curr.y, curr.fontSize, curr.text);
    const isFootnoteBreak = isPrevFootnote !== isCurrFootnote;

    const isSameCol = curr.col === prev.col;
    const lineSpacing = curr.y - (prev.y + prev.h);
    const fontDiff = Math.abs(curr.fontSize - prev.fontSize);

    let isConsecutive: boolean;

    if (inAlgorithm) {
      // While inside an algorithm box:
      const isBoxEnded =
        !isSameCol ||
        lineSpacing > 14 ||
        (prev.text.toLowerCase().includes('end for') && !isAlgorithmLine(curr.text)) ||
        isCurrHeading ||
        isCurrFootnote ||
        isCaptionStartLine(curr.text);
      if (isBoxEnded) {
        inAlgorithm = false;
        isConsecutive = false;
      } else {
        isConsecutive = true;
      }
    } else if (inCaption) {
      // While inside a figure caption: NEVER leak normal body prose into caption
      const prevTrimmed = prev.text.trim();
      const prevEnded = prevTrimmed.endsWith('.') || prevTrimmed.endsWith(':');
      const isParagraphStart =
        prevEnded &&
        (lineSpacing > Math.max(prev.h, curr.h) * 1.05 ||
          curr.x > prev.x + 6 ||
          /^(We|The|In|For|To|Our|However|Although|Finally|Moreover|Furthermore|OpenAI|Stable|CLIP|Diffusion|Specifically|Empirically)\b/.test(curr.text.trim()));

      const isCaptionEnded =
        !isSameCol ||
        lineSpacing > 12 ||
        isCurrHeading ||
        isCurrAlgo ||
        isCurrFormula ||
        isCurrFootnote ||
        isCaptionStartLine(curr.text) ||
        isParagraphStart;

      if (isCaptionEnded) {
        inCaption = false;
        isConsecutive = false;
      } else {
        isConsecutive = true;
      }
    } else if (inReferences) {
      // Inside references section: each citation starts with author / [num]
      if (isReferenceStartLine(curr.text)) {
        isConsecutive = false;
      } else {
        isConsecutive = isSameCol && !isCurrHeading && lineSpacing >= -4 && lineSpacing <= 14;
      }
    } else {
      const isAlgoBreak = isPrevAlgo !== isCurrAlgo;
      const isFormulaBreak = isPrevFormula !== isCurrFormula;
      const maxAllowedSpacing =
        isPrevFormula
          ? 24
          : Math.max(prev.h, curr.h) * 1.65;
      const minAllowedSpacing = isPrevFormula && isCurrFormula ? -20 : -4;

      // Academic Paragraph Break detection in body prose:
      // 1. Previous line ended a sentence with punctuation (. ? ! : or trailing quote/parenthesis)
      // 2. AND Current line starts with a capital letter, quote, or bullet
      // 3. AND either:
      //    (a) Current line has a distinct first-line indentation relative to column baseline
      //    (b) Previous line ended noticeably short before the column right margin
      //    (c) Extra vertical spacing between paragraphs
      const baseColX = Math.min(...currentBlockLines.map((l) => l.x));
      const maxColW = Math.max(...currentBlockLines.map((l) => l.w));
      const prevEndsSentence = /[.?!:]["'”’)]?$/.test(prev.text.trim());
      const isIndented = curr.x > baseColX + 4.5;
      const prevEndsShort = maxColW > 100 && prev.w < maxColW - 18;
      const hasExtraSpacing = lineSpacing >= Math.max(prev.h, curr.h) * 1.18 && lineSpacing <= maxAllowedSpacing;
      const currStartsSentence = /^[A-Z0-9"“'‘•-]/.test(curr.text.trim());

      const isParagraphBreak =
        !isPrevFormula &&
        !isCurrFormula &&
        prevEndsSentence &&
        currStartsSentence &&
        (isIndented || prevEndsShort || hasExtraSpacing);

      isConsecutive =
        isSameCol &&
        !isHeaderBreak &&
        !isHeadingBreak &&
        !isAlgoBreak &&
        !isFormulaBreak &&
        !isParagraphBreak &&
        !isFootnoteBreak &&
        lineSpacing >= minAllowedSpacing &&
        lineSpacing <= maxAllowedSpacing &&
        (isPrevFormula ? true : fontDiff <= 2.5);
    }

    if (isConsecutive) {
      currentBlockLines.push(curr);
    } else {
      const b = createBlock(currentBlockLines, pageNumber, blockIndex++, inReferences);
      if (b) {
        blocks.push(b);
      }
      currentBlockLines = [curr];
    }
  }

  if (currentBlockLines.length > 0) {
    const b = createBlock(currentBlockLines, pageNumber, blockIndex, inReferences);
    if (b) blocks.push(b);
  }

  return blocks;
}

function isAuthorBlock(text: string, minY: number): boolean {
  if (minY < 100 || minY > 230) return false;
  const t = text.trim();
  // Long continuous prose is never an author block
  if (t.length > 350) return false;
  if (/\b(diffusion|models?|algorithm|propose|trained|paper|framework|method)\b/i.test(t)) return false;
  // Authors have affiliation symbols (*, numbers), institution keywords, or emails
  if (/[*†‡§]/.test(t) || /@\w+\.\w+/.test(t) || /\b(university|department|institute|college|lab)\b/i.test(t)) {
    return true;
  }
  const authorNameMatch = t.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s*(?:\*|\d)/g);
  if (authorNameMatch && authorNameMatch.length >= 2) {
    return true;
  }
  return false;
}

function createBlock(
  lines: LineItem[],
  pageNumber: number,
  blockIdx: number,
  isReference: boolean = false,
): TextBlock | null {
  const first = lines[0];
  if (!first) return null;

  // Use de-hyphenation when joining lines
  const text = joinLinesWithDehyphenation(lines);

  // Ignore tiny artifacts
  if (text.length < 2) return null;

  let minX = first.x;
  let minY = first.y;
  let maxX = first.x + first.w;
  let maxY = first.y + first.h;
  let totalFontSize = 0;
  let boldCount = 0;

  for (const l of lines) {
    minX = Math.min(minX, l.x);
    minY = Math.min(minY, l.y);
    maxX = Math.max(maxX, l.x + l.w);
    maxY = Math.max(maxY, l.y + l.h);
    totalFontSize += l.fontSize;
    if (l.bold) boldCount++;
  }

  const isHeader = minY < 46;
  const isFooter = minY > 735;
  const proseWordCount = text.split(/\s+/).filter((w) => /^[a-zA-Z]{4,}$/.test(w)).length;
  const isFormula = proseWordCount <= 2 && lines.every((l) => isMathFragment(l.text));
  const isAlgorithm = lines.some((l) => isAlgorithmLine(l.text));
  const isHeading = isStandaloneHeading(text, boldCount > lines.length / 2);
  const isFootnote = isFootnoteItem(minY, totalFontSize / lines.length, text);

  // Standalone headings, headers, algorithm lines, references, and formulas must NOT be broken into sub-sentences
  const rawSentences =
    isFormula || isHeader || isHeading || isAlgorithm || isReference
      ? [text]
      : splitTextIntoSentences(text);

  const blockId = `p${pageNumber}_b${blockIdx}`;

  // Block-bounded sentence IDs (e.g. p1_b2_s0, p1_b2_s1)
  const sentences: SentenceItem[] = rawSentences.map((sText, sIdx) => ({
    id: `${blockId}_s${sIdx}`,
    text: sText,
    isFormula,
  }));

  // Safe bounding box with padding for formulas to prevent surrounding text backgrounds from overlapping
  const finalMinY = isFormula ? Math.max(0, minY - 3) : minY;
  const finalMaxY = isFormula ? maxY + 3 : maxY;
  const avgFontSize = totalFontSize / lines.length;

  let componentType: ComponentType = 'paragraph';
  if (isHeader) {
    componentType = 'header';
  } else if (isFooter) {
    componentType = 'footer';
  } else if (isFootnote) {
    componentType = 'footnote';
  } else if (isFormula) {
    componentType = 'equation';
  } else if (isAlgorithm) {
    componentType = 'algorithm';
  } else if (isReference && !isHeading) {
    componentType = 'reference';
  } else if (pageNumber === 1 && blockIdx === 0 && first.col === 0 && avgFontSize >= 13) {
    componentType = 'title';
  } else if (text.trim().toLowerCase() === 'abstract' || text.toLowerCase().startsWith('abstract')) {
    componentType = 'abstract';
  } else if (pageNumber === 1 && isAuthorBlock(text, minY)) {
    componentType = 'authors';
  } else if (
    pageNumber === 1 &&
    minY >= 160 &&
    minY < 320 &&
    (text.toLowerCase().includes('in this work') ||
      text.toLowerCase().includes('in this paper') ||
      text.toLowerCase().includes('we propose') ||
      text.toLowerCase().includes('we show') ||
      /^(typical|recent|diffusion|deep|large)\b/i.test(text.trim()))
  ) {
    componentType = 'abstract';
  } else if (isHeading) {
    componentType = 'heading';
  } else if (/^(figure|table)\s+\d+[:.]/i.test(text.trim())) {
    componentType = 'figure_caption';
  }

  return {
    id: blockId,
    page: pageNumber,
    bbox: [minX, finalMinY, Math.max(maxX - minX, 10), Math.max(finalMaxY - finalMinY, 10)],
    text,
    sentences,
    bold: boldCount > lines.length / 2,
    fontSize: Math.round(avgFontSize * 10) / 10,
    lineCount: lines.length,
    col: first.col,
    componentType,
    isFormula,
    isAlgorithm,
    isHeading,
    isHeader,
    isFooter,
    isFootnote,
  };
}

/**
 * End-to-end extraction from PDF.js raw items.
 */
export function extractTextBlocks(
  items: RawTextItem[],
  viewportWidth: number,
  viewportHeight: number,
  pageNumber: number,
): TextBlock[] {
  const normalized = normalizeTextItems(items, viewportWidth, viewportHeight);
  const lines = groupIntoLines(normalized, viewportWidth);
  return groupIntoBlocks(lines, pageNumber);
}

export interface DetectedFigure {
  figNum?: number;
  bbox: [number, number, number, number];
  captionText: string;
}

/**
 * Detects figures / tables and computes their graphic bounding box above the caption.
 */
export function extractPageFigures(
  blocks: TextBlock[],
  viewportWidth: number,
  pageNumber: number,
): DetectedFigure[] {
  const figures: DetectedFigure[] = [];

  // Group blocks by column to accurately establish layout context
  const col1: TextBlock[] = [];
  const col2: TextBlock[] = [];
  const col0: TextBlock[] = [];

  for (const b of blocks) {
    if (b.col === 1) col1.push(b);
    else if (b.col === 2) col2.push(b);
    else col0.push(b);
  }

  const checkColumn = (colBlocks: TextBlock[]) => {
    for (let idx = 0; idx < colBlocks.length; idx++) {
      const b = colBlocks[idx]!;
      const isCaption =
        b.componentType === 'figure_caption' ||
        /^(?:figure|fig\.|hình|table|bảng)\s*\d+[:.]/i.test(b.text.trim());

      if (!isCaption) continue;

      const numMatch = b.text.trim().match(/^(?:figure|fig\.|hình|table|bảng)\s*(\d+)/i);
      const figNum = numMatch ? parseInt(numMatch[1]!, 10) : undefined;

      const captionBbox = b.bbox;
      // Header clearance: ensure we never capture the running header or author line
      const headerBlocks = blocks.filter((item) => item.bbox[1] < 60);
      const headerBottom =
        headerBlocks.length > 0
          ? Math.max(...headerBlocks.map((item) => item.bbox[1] + item.bbox[3]))
          : 45;
      const colTop = pageNumber === 1 ? 175 : Math.max(60, headerBottom + 10);


      // Check if all preceding blocks in this column are non-body (e.g. sub-labels)
      const isTopFigure = colBlocks
        .slice(0, idx)
        .every((prior) => !prior.isHeading && prior.text.length < 160);

      const prevBlock = idx > 0 ? colBlocks[idx - 1] : null;

      let figTop = colTop;
      if (!isTopFigure && prevBlock) {
        figTop = Math.max(colTop, prevBlock.bbox[1] + prevBlock.bbox[3] + 4);
      }

      let figLeft: number;
      let figWidth: number;


      if (b.col === 1) {
        figLeft = 45;
        figWidth = Math.max(220, Math.min(260, viewportWidth * 0.45));
      } else if (b.col === 2) {
        figLeft = Math.max(300, viewportWidth * 0.5);
        figWidth = Math.max(220, Math.min(260, viewportWidth * 0.45));
      } else {
        figLeft = 45;
        figWidth = Math.max(viewportWidth - 90, 500);
      }

      // Special case for Page 1 where Figure 1 is a tall banner in Column 2
      if (pageNumber === 1 && (figNum === 1 || !figNum)) {
        figLeft = 307;
        figTop = 165;
        figWidth = 245;
      }

      const figHeight = Math.max(60, captionBbox[1] - 4 - figTop);
      const bbox: [number, number, number, number] = [
        Math.round(figLeft),
        Math.round(figTop),
        Math.round(figWidth),
        Math.round(figHeight),
      ];

      figures.push({
        figNum,
        bbox,
        captionText: b.text.trim(),
      });
    }
  };

  checkColumn(col1);
  checkColumn(col2);
  checkColumn(col0);

  // Sort figures by figNum if available, otherwise by Y coordinate
  figures.sort((a, b) => {
    if (a.figNum !== undefined && b.figNum !== undefined) {
      return a.figNum - b.figNum;
    }
    return a.bbox[1] - b.bbox[1];
  });

  return figures;
}

