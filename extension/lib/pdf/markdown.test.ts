import { describe, expect, it } from 'vitest';
import { wrapInlineMath } from './markdown';

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

  it('normalizes (f, 1) and (f, l) loss function pairs to $(f, \\ell)$', () => {
    expect(wrapInlineMath('We define guidance with pair (f, 1) in diffusion.')).toContain('$(f, \\ell)$');
    expect(wrapInlineMath('We define guidance with pair (f, l) in diffusion.')).toContain('$(f, \\ell)$');
  });

  it('normalizes S(·, ·, ·) math notation into LaTeX cdot', () => {
    const wrapped = wrapInlineMath('Define abstraction function S(·, ·, ·) for sampling.');
    expect(wrapped).toContain('$S(\\cdot, \\cdot, \\cdot)$');
  });
});
