import { describe, expect, it } from 'vitest';
import { blocksToMarkdownElements, wrapInlineMath } from './markdown';
import type { TextBlock } from './types';

describe('PDF to Markdown elements conversion', () => {
  it('wraps inline math like {\\alpha_t}_{t=1}^T and z_0 with $', () => {
    const text =
      'given an array of scalars representing noise scales {\\alpha_t}_{t=1}^T and an initial clean data point z_0';
    const wrapped = wrapInlineMath(text);
    expect(wrapped).toContain('${\\alpha_t}_{t=1}^T$');
    expect(wrapped).toContain('$z_0$');
  });

  it('P1: wraps \\hat{z}_0 as one unit instead of splitting {z}', () => {
    const wrapped = wrapInlineMath('Update with \\hat{z}_0 at each step.');
    expect(wrapped).toContain('$\\hat{z}_0$');
    expect(wrapped).not.toContain('\\hat ${z}$');
  });

  it('converts TextBlocks to structured Markdown elements', () => {
    const blocks: TextBlock[] = [
      {
        id: 'p1_b0',
        page: 1,
        bbox: [54, 400, 100, 20],
        text: '1. Introduction',
        sentences: [{ id: 'p1_b0_s0', text: '1. Introduction' }],
        isHeading: true,
      },
      {
        id: 'p1_b1',
        page: 1,
        bbox: [54, 430, 250, 40],
        text: 'Diffusion models are powerful tools for digital art.',
        sentences: [{ id: 'p1_b1_s0', text: 'Diffusion models are powerful tools for digital art.' }],
      },
      {
        id: 'p1_b2',
        page: 1,
        bbox: [54, 480, 200, 20],
        text: 'z_t = \\sqrt{\\alpha_t} z_0 + \\epsilon (1)',
        sentences: [{ id: 'p1_b2_s0', text: 'z_t = \\sqrt{\\alpha_t} z_0 + \\epsilon (1)', isFormula: true }],
        isFormula: true,
      },
    ];

    const elements = blocksToMarkdownElements(blocks);
    expect(elements).toHaveLength(3);
    expect(elements[0]!.type).toBe('heading');
    expect(elements[0]!.text).toBe('1. Introduction');
    expect(elements[1]!.type).toBe('paragraph');
    expect(elements[2]!.type).toBe('formula');
    expect(elements[2]!.equationNumber).toBe('(1)');
  });
});
