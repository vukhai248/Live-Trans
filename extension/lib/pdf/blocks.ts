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
    const text = (item.str || '').trim();
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
      str: item.str,
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
  let col = 0;
  if (w > viewportWidth * 0.65) {
    col = 0; // Full-width
  } else {
    const centerX = (minX + maxX) / 2;
    col = centerX < dividerX ? 1 : 2;
  }

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

  // 1. Standalone equation number at end: e.g. "(1)", "(2)", "(3)"
  if (/\(\s*\d+(\.\d+)?\s*\)$/.test(t)) {
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

/**
 * Groups lines into coherent text blocks / paragraphs.
 * Strictly isolates multi-line fraction equations, algorithm boxes, headings, and footnotes.
 */
export function groupIntoBlocks(lines: LineItem[], pageNumber: number): TextBlock[] {
  const first = lines[0];
  if (!first) return [];

  const blocks: TextBlock[] = [];
  let blockIndex = 0;

  let currentBlockLines: LineItem[] = [first];
  let inAlgorithm = isAlgorithmLine(first.text);

  for (let i = 1; i < lines.length; i++) {
    const prev = currentBlockLines[currentBlockLines.length - 1];
    const curr = lines[i];
    if (!prev || !curr) continue;

    // Algorithm box start: flush prior text block and begin isolated algorithm block
    if (/^Algorithm\s+\d+/i.test(curr.text)) {
      if (currentBlockLines.length > 0) {
        const b = createBlock(currentBlockLines, pageNumber, blockIndex++);
        if (b) blocks.push(b);
      }
      currentBlockLines = [curr];
      inAlgorithm = true;
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

    let isConsecutive = false;

    if (inAlgorithm) {
      // While inside an algorithm box:
      // Inside an algorithm lineSpacing <= 6pt. A gap > 14pt or an "end for" followed by prose terminates the box.
      const isBoxEnded =
        !isSameCol ||
        lineSpacing > 14 ||
        (prev.text.toLowerCase().includes('end for') && !isAlgorithmLine(curr.text)) ||
        isCurrHeading ||
        isCurrFootnote;
      if (isBoxEnded) {
        inAlgorithm = false;
        isConsecutive = false;
      } else {
        isConsecutive = true;
      }
    } else {
      const isAlgoBreak = isPrevAlgo !== isCurrAlgo;
      const isFormulaBreak = isPrevFormula !== isCurrFormula;
      const maxAllowedSpacing =
        isPrevFormula
          ? 24
          : Math.max(prev.h, curr.h) * 1.65;
      const minAllowedSpacing = isPrevFormula && isCurrFormula ? -20 : -4;

      isConsecutive =
        isSameCol &&
        !isHeaderBreak &&
        !isHeadingBreak &&
        !isAlgoBreak &&
        !isFormulaBreak &&
        !isFootnoteBreak &&
        lineSpacing >= minAllowedSpacing &&
        lineSpacing <= maxAllowedSpacing &&
        (isPrevFormula ? true : fontDiff <= 2.5);
    }

    if (isConsecutive) {
      currentBlockLines.push(curr);
    } else {
      const b = createBlock(currentBlockLines, pageNumber, blockIndex++);
      if (b) {
        blocks.push(b);
      }
      currentBlockLines = [curr];
    }
  }

  if (currentBlockLines.length > 0) {
    const b = createBlock(currentBlockLines, pageNumber, blockIndex);
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

  // Standalone headings, headers, algorithm lines, and formulas must NOT be broken into sub-sentences
  const rawSentences =
    isFormula || isHeader || isHeading || isAlgorithm
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
