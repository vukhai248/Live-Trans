import { describe, expect, it } from 'vitest';
import { extractPageFigures, extractTextBlocks, isMathFormula, joinLinesWithDehyphenation, type RawTextItem } from './blocks';


describe('PDF text blocks extractor', () => {
  it('combines text spans on the same line', () => {
    const rawItems: RawTextItem[] = [
      {
        str: 'Universal Guidance',
        transform: [14, 0, 0, 14, 150, 700],
        width: 120,
        height: 14,
        fontName: 'Times-Bold',
      },
      {
        str: 'for Diffusion Models',
        transform: [14, 0, 0, 14, 275, 700],
        width: 140,
        height: 14,
        fontName: 'Times-Bold',
      },
    ];

    // Page 612 x 792 pt
    const blocks = extractTextBlocks(rawItems, 612, 792, 1);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.id).toBe('p1_b0');
    expect(blocks[0]!.text).toBe('Universal Guidance for Diffusion Models');
    expect(blocks[0]!.bold).toBe(true);
  });

  it('filters out rotated vertical margin watermark like arXiv stamp', () => {
    const rawItems: RawTextItem[] = [
      // Rotated 90° watermark text: transform = [0, 9, -9, 0, 18, 400]
      {
        str: 'arXiv:2302.07121v1 [cs.CV] 14 Feb 2023',
        transform: [0, 9, -9, 0, 18, 400],
        width: 150,
        height: 9,
      },
      // Normal body text line
      {
        str: '1. Introduction',
        transform: [12, 0, 0, 12, 54, 400],
        width: 100,
        height: 12,
        fontName: 'Times-Bold',
      },
    ];

    const blocks = extractTextBlocks(rawItems, 612, 792, 1);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.text).toBe('1. Introduction');
    // Ensure arXiv stamp was skipped completely
    const allText = blocks.map((b) => b.text).join(' ');
    expect(allText).not.toContain('arXiv:2302.07121v1');
  });

  it('handles de-hyphenation for split URLs and words', () => {
    const lines = [
      {
        text: 'Code is available at github.com/arpitbansal297/Universal-Guided-',
        x: 54,
        y: 600,
        w: 250,
        h: 10,
        fontSize: 10,
        bold: false,
        col: 1,
      },
      {
        text: 'Diffusion.',
        x: 54,
        y: 588,
        w: 50,
        h: 10,
        fontSize: 10,
        bold: false,
        col: 1,
      },
    ];

    const joined = joinLinesWithDehyphenation(lines);
    expect(joined).toBe(
      'Code is available at github.com/arpitbansal297/Universal-Guided-Diffusion.',
    );
  });

  it('isolates running header at top of page', () => {
    const rawItems: RawTextItem[] = [
      // Running header at y ≈ 760 (ty = 760 -> converted y = 792 - 760 - 9 = 23pt < 46pt)
      {
        str: 'Universal Guidance for Diffusion Models',
        transform: [9, 0, 0, 9, 54, 760],
        width: 200,
        height: 9,
      },
      {
        str: '2',
        transform: [9, 0, 0, 9, 550, 760],
        width: 10,
        height: 9,
      },
      // Body paragraph line at ty = 710 -> y ≈ 72pt
      {
        str: 'We first briefly review the recent literature on diffusion models.',
        transform: [10, 0, 0, 10, 54, 710],
        width: 250,
        height: 10,
      },
    ];

    const blocks = extractTextBlocks(rawItems, 612, 792, 2);
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    expect(blocks[0]!.isHeader).toBe(true);
    expect(blocks[0]!.text).toContain('Universal Guidance for Diffusion Models');
    // Body paragraph is in a separate block, NOT merged with header
    expect(blocks[1]!.isHeader).toBeFalsy();
    expect(blocks[1]!.text).toContain('We first briefly review');
  });

  it('separates two academic columns with interleaved y coordinates', () => {
    const rawItems: RawTextItem[] = [
      {
        str: 'Left line 1.',
        transform: [10, 0, 0, 10, 50, 600],
        width: 100,
        height: 10,
      },
      {
        str: 'Right line 1.',
        transform: [10, 0, 0, 10, 330, 600],
        width: 100,
        height: 10,
      },
      {
        str: 'Left line 2.',
        transform: [10, 0, 0, 10, 50, 585],
        width: 100,
        height: 10,
      },
      {
        str: 'Right line 2.',
        transform: [10, 0, 0, 10, 330, 585],
        width: 100,
        height: 10,
      },
    ];

    const blocks = extractTextBlocks(rawItems, 612, 792, 1);
    expect(blocks.length).toBe(2);
    expect(blocks[0]!.text).toContain('Left line 1.');
    expect(blocks[0]!.text).toContain('Left line 2.');
    expect(blocks[1]!.text).toContain('Right line 1.');
    expect(blocks[1]!.text).toContain('Right line 2.');
  });

  it('detects standalone math equations and labels', () => {
    expect(isMathFormula('(1)')).toBe(true);
    expect(isMathFormula('(2.3)')).toBe(true);
    expect(isMathFormula('z_t = \\sqrt{\\alpha_t} z_0 + \\epsilon')).toBe(true);
    expect(isMathFormula('This is standard text describing the experiment.')).toBe(false);
  });

  it('P1: does not mark prose ending with a year citation as formula', () => {
    expect(
      isMathFormula('As shown by previous work on diffusion models (Song & Ermon, 2020)'),
    ).toBe(false);
    expect(isMathFormula('The results were first reported in the year 2020')).toBe(false);
  });

  it('P1: does not mark hyphenated compounds as math fractions', () => {
    expect(isMathFormula('state-of-the-art')).toBe(false);
    expect(isMathFormula('deep-learning')).toBe(false);
    expect(isMathFormula('learning-based')).toBe(false);
  });

  it('P1: does not mark prose with a single inline equals as formula', () => {
    expect(
      isMathFormula('The configuration sets the value where alpha equals beta in this context here today'),
    ).toBe(false);
  });

  it('isolates standalone headings like Abstract and 1. Introduction into separate blocks', () => {
    const rawItems: RawTextItem[] = [
      // Abstract heading
      {
        str: 'Abstract',
        transform: [11, 0, 0, 11, 280, 500],
        width: 50,
        height: 11,
        fontName: 'Times-Bold',
      },
      // Paragraph below Abstract
      {
        str: 'Typical diffusion models are trained to accept conditioning.',
        transform: [10, 0, 0, 10, 54, 480],
        width: 250,
        height: 10,
      },
      // Section 1 heading
      {
        str: '1. Introduction',
        transform: [12, 0, 0, 12, 54, 400],
        width: 80,
        height: 12,
        fontName: 'Times-Bold',
      },
      // Paragraph below 1. Introduction
      {
        str: 'Diffusion models are powerful tools for digital art.',
        transform: [10, 0, 0, 10, 54, 385],
        width: 250,
        height: 10,
      },
    ];

    const blocks = extractTextBlocks(rawItems, 612, 792, 1);
    expect(blocks).toHaveLength(4);
    expect(blocks[0]!.text).toBe('Abstract');
    expect(blocks[0]!.isHeading).toBe(true);
    expect(blocks[1]!.text).toBe('Typical diffusion models are trained to accept conditioning.');
    expect(blocks[1]!.isHeading).toBeFalsy();
    expect(blocks[2]!.text).toBe('1. Introduction');
    expect(blocks[2]!.isHeading).toBe(true);
    expect(blocks[3]!.text).toBe('Diffusion models are powerful tools for digital art.');
    expect(blocks[3]!.isHeading).toBeFalsy();
  });

  it('isolates display equations from surrounding prose paragraphs', () => {
    const rawItems: RawTextItem[] = [
      // Preceding paragraph line
      {
        str: 'A diffusion model is a learned denoising network.',
        transform: [10, 0, 0, 10, 54, 500],
        width: 250,
        height: 10,
      },
      // Standalone Display equation (1)
      {
        str: 'z_t = \\sqrt{\\alpha_t} z_0 + \\epsilon (1)',
        transform: [10, 0, 0, 10, 100, 470],
        width: 150,
        height: 10,
      },
      // Following paragraph line
      {
        str: 'The reverse process takes the form of Gaussian distribution.',
        transform: [10, 0, 0, 10, 54, 440],
        width: 250,
        height: 10,
      },
    ];

    const blocks = extractTextBlocks(rawItems, 612, 792, 1);
    expect(blocks).toHaveLength(3);
    expect(blocks[0]!.isFormula).toBeFalsy();
    expect(blocks[1]!.isFormula).toBe(true);
    expect(blocks[1]!.text).toContain('(1)');
    expect(blocks[2]!.isFormula).toBeFalsy();
  });

  it('detects footnotes at page bottom and sets isFootnote', () => {
    const rawItems: RawTextItem[] = [
      // Footnote text at bottom
      {
        str: '* Equal contribution 1 Department of Computer Science, UMD.',
        transform: [8, 0, 0, 8, 54, 70],
        width: 250,
        height: 8,
      },
    ];

    const blocks = extractTextBlocks(rawItems, 612, 792, 1);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.isFootnote).toBe(true);
  });

  it('clusters multi-line fractions into a single unified formula block', () => {
    const rawItems: RawTextItem[] = [
      // Prose before formula (2)
      {
        str: 'A diffusion model is a learned denoising network.',
        transform: [10, 0, 0, 10, 54, 520],
        width: 250,
        height: 10,
      },
      // Fraction Numerator line
      {
        str: 'z_t - \\sqrt{\\alpha_t} z_0',
        transform: [9, 0, 0, 9, 120, 485],
        width: 80,
        height: 9,
      },
      // Center baseline with equation label (2)
      {
        str: '\\epsilon_\\theta(z_t, t) \\approx \\epsilon = (2)',
        transform: [10, 0, 0, 10, 60, 475],
        width: 180,
        height: 10,
      },
      // Fraction Denominator line
      {
        str: '\\sqrt{1 - \\alpha_t}',
        transform: [9, 0, 0, 9, 130, 465],
        width: 60,
        height: 9,
      },
      // Prose after formula (2)
      {
        str: 'The reverse process takes the form of Gaussian distribution.',
        transform: [10, 0, 0, 10, 54, 430],
        width: 250,
        height: 10,
      },
    ];

    const blocks = extractTextBlocks(rawItems, 612, 792, 1);
    expect(blocks).toHaveLength(3);
    // Block 0: prose before
    expect(blocks[0]!.isFormula).toBeFalsy();
    expect(blocks[0]!.text).toContain('learned denoising network');
    // Block 1: unified formula block holding numerator + label + denominator
    expect(blocks[1]!.isFormula).toBe(true);
    expect(blocks[1]!.text).toContain('(2)');
    expect(blocks[1]!.text).toContain('z_t');
    // Block 2: prose after
    expect(blocks[2]!.isFormula).toBeFalsy();
    expect(blocks[2]!.text).toContain('reverse process');
  });

  it('isolates algorithm pseudocode boxes into an algorithm block', () => {
    const rawItems: RawTextItem[] = [
      {
        str: 'Algorithm 1 Universal Guidance',
        transform: [11, 0, 0, 11, 54, 550],
        width: 180,
        height: 11,
      },
      {
        str: 'Parameter: Recurrent steps k, gradient steps m',
        transform: [9, 0, 0, 9, 54, 535],
        width: 220,
        height: 9,
      },
      {
        str: 'for t = T, T-1, ..., 1 do',
        transform: [9, 0, 0, 9, 65, 520],
        width: 150,
        height: 9,
      },
      {
        str: 'end for',
        transform: [9, 0, 0, 9, 54, 505],
        width: 50,
        height: 9,
      },
    ];

    const blocks = extractTextBlocks(rawItems, 612, 792, 1);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.isAlgorithm).toBe(true);
    expect(blocks[0]!.text).toContain('Algorithm 1');
    expect(blocks[0]!.text).toContain('end for');
  });

  it('extracts Page 2 blocks and identifies equations', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

    const pdfPath = path.resolve(__dirname, '../../../backend/samples/2302.07121.pdf');
    if (!fs.existsSync(pdfPath)) return;

    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const doc = await pdfjsLib.getDocument({ data }).promise;
    const page = await doc.getPage(2);
    const textContent = await page.getTextContent();
    const vp = page.getViewport({ scale: 1.0 });

    const blocks = extractTextBlocks(textContent.items as any, vp.width, vp.height, 2);
    expect(blocks.length).toBeGreaterThan(5);

    const equations = blocks.filter((b) => b.isFormula || b.componentType === 'equation');
    expect(equations.length).toBeGreaterThanOrEqual(3);
    const eqTexts = equations.map((e) => e.text).join(' ');
    expect(eqTexts).toContain('(1)');
    expect(eqTexts).toContain('(2)');
    expect(eqTexts).toContain('(3)');

    // Ensure inline clause "where z_t-1 = S(...)" is NOT separated into an isolated equation block
    for (const eq of equations) {
      expect(eq.text.trim().startsWith('where ')).toBe(false);
    }
  });

  it('does not treat inline subordinate clause starting with where/with as standalone formula', () => {
    const rawItems: RawTextItem[] = [
      {
        str: 'we define a function as an abstraction of the sampling method,',
        transform: [10, 0, 0, 10, 54, 500],
        width: 250,
        height: 10,
      },
      {
        str: 'where z_{t-1} = S(z_t, \\epsilon, t).',
        transform: [10, 0, 0, 10, 54, 485],
        width: 160,
        height: 10,
      },
    ];

    const blocks = extractTextBlocks(rawItems, 612, 792, 2);
    // Should be unified into 1 prose paragraph block, NOT split into a formula block
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.isFormula).toBeFalsy();
    expect(blocks[0]!.text).toContain('where z_{t-1} = S(z_t, \\epsilon, t).');
  });

  it('splits distinct paragraphs with first-line indent into separate blocks', () => {
    const rawItems: RawTextItem[] = [
      // Paragraph 1 line 1 (indented)
      {
        str: 'First paragraph begins with an indented first line in the column.',
        transform: [10, 0, 0, 10, 66, 600],
        width: 240,
        height: 10,
      },
      // Paragraph 1 line 2 (unindented, ends with period)
      {
        str: 'And here is the conclusion of the first paragraph.',
        transform: [10, 0, 0, 10, 54, 585],
        width: 210,
        height: 10,
      },
      // Paragraph 2 line 1 (indented, starts new sentence)
      {
        str: 'Second paragraph begins with another indentation after a period.',
        transform: [10, 0, 0, 10, 66, 570],
        width: 240,
        height: 10,
      },
      // Paragraph 2 line 2 (unindented)
      {
        str: 'Continuing the second paragraph content seamlessly.',
        transform: [10, 0, 0, 10, 54, 555],
        width: 220,
        height: 10,
      },
    ];

    const blocks = extractTextBlocks(rawItems, 612, 792, 2);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]!.text).toContain('First paragraph');
    expect(blocks[1]!.text).toContain('Second paragraph');
  });

  it('extractPageFigures detects figure captions and calculates graphic bounding boxes', () => {
    const rawItems: RawTextItem[] = [
      // Caption for Figure 2 in column 1
      {
        str: 'Figure 2: An example of how self-recurrence helps segmentation-guided generation.',
        transform: [10, 0, 0, 10, 55, 650], // y in PDF coordinates -> top in screen coords = 792 - 650 - 10 = 132
        width: 230,
        height: 10,
        fontName: 'Times-Bold',
      },
      // Caption for Figure 3 in column 2
      {
        str: 'Figure 3: We compare the ability to match given text prompts.',
        transform: [10, 0, 0, 10, 310, 440], // y in PDF coordinates -> top in screen coords = 792 - 440 - 10 = 342
        width: 230,
        height: 10,
        fontName: 'Times-Bold',
      },
    ];

    const blocks = extractTextBlocks(rawItems, 612, 792, 5);
    const figures = extractPageFigures(blocks, 612, 5);

    expect(figures).toHaveLength(2);

    const fig2 = figures.find((f) => f.figNum === 2);
    expect(fig2).toBeDefined();
    expect(fig2!.bbox[0]).toBe(45); // Left col x
    expect(fig2!.bbox[1]).toBe(60); // colTop (clears running header)
    expect(fig2!.bbox[3]).toBeGreaterThan(60); // figHeight


    const fig3 = figures.find((f) => f.figNum === 3);
    expect(fig3).toBeDefined();
    expect(fig3!.bbox[0]).toBeGreaterThanOrEqual(300); // Right col x
  });
});

