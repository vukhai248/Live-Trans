import { describe, expect, it } from 'vitest';
import { normalizeEquationLatex } from './latex-cleaner';

describe('normalizeEquationLatex', () => {
  it('extracts equation number stuck inside fraction numerator (Equation 17)', () => {
    const raw = 's_\\theta(\\mathbf{x}_t, t) := -\\frac{\\epsilon_\\theta(\\mathbf{x}_t, t) (17)}{\\sqrt{1 - \\bar{\\alpha}_t}}';
    const normalized = normalizeEquationLatex(raw);
    expect(normalized).toBe(
      's_\\theta(\\mathbf{x}_t, t) := -\\frac{\\epsilon_\\theta(\\mathbf{x}_t, t)}{\\sqrt{1 - \\bar{\\alpha}_t}} \\tag{17}',
    );
  });

  it('extracts equation number stuck inside numerator with trailing variable (Equation 18)', () => {
    const raw =
      '\\tilde{\\mu}_t(\\mathbf{x}_t, \\mathbf{x}_0) := \\frac{\\sqrt{\\bar{\\alpha}_{t-1}}\\beta_t}{1 - \\bar{\\alpha}_t}\\mathbf{x}_0 + \\frac{\\sqrt{\\alpha_t}(1 - \\bar{\\alpha}_{t-1})(18)}{1 - \\bar{\\alpha}_t}\\mathbf{x}_t';
    const normalized = normalizeEquationLatex(raw);
    expect(normalized).toBe(
      '\\tilde{\\mu}_t(\\mathbf{x}_t, \\mathbf{x}_0) := \\frac{\\sqrt{\\bar{\\alpha}_{t-1}}\\beta_t}{1 - \\bar{\\alpha}_t}\\mathbf{x}_0 + \\frac{\\sqrt{\\alpha_t}(1 - \\bar{\\alpha}_{t-1})}{1 - \\bar{\\alpha}_t}\\mathbf{x}_t \\tag{18}',
    );
  });

  it('extracts equation number stuck inside function arguments parentheses (Equation 19)', () => {
    const raw = '\\mu_\\theta(\\mathbf{x}_t, t) = \\tilde{\\mu}_t(\\mathbf{x}_t, D_\\theta(\\mathbf{x}_t(19)))';
    const normalized = normalizeEquationLatex(raw);
    expect(normalized).toBe(
      '\\mu_\\theta(\\mathbf{x}_t, t) = \\tilde{\\mu}_t(\\mathbf{x}_t, D_\\theta(\\mathbf{x}_t)) \\tag{19}',
    );
  });

  it('converts trailing \\quad (N) into \\tag{N} (Equation 9)', () => {
    const raw =
      '\\ell_y(z_t) = \\sum_{j \\in S} \\text{sum}(\\bar{\\mathbf{m}}_j \\odot (A_t)_j) - \\text{sum}(\\mathbf{m}_j \\odot (A_t)_j), \\quad (9)';
    const normalized = normalizeEquationLatex(raw);
    expect(normalized).toBe(
      '\\ell_y(z_t) = \\sum_{j \\in S} \\text{sum}(\\bar{\\mathbf{m}}_j \\odot (A_t)_j) - \\text{sum}(\\mathbf{m}_j \\odot (A_t)_j), \\tag{9}',
    );
  });

  it('converts trailing , (22) or raw (22) into \\tag{22}', () => {
    const raw = 'dx = -\\frac{1}{2}\\beta(t)x dt + \\sqrt{\\beta(t)} dw, (22)';
    const normalized = normalizeEquationLatex(raw);
    expect(normalized).toBe('dx = -\\frac{1}{2}\\beta(t)x dt + \\sqrt{\\beta(t)} dw, \\tag{22}');
  });

  it('preserves existing \\tag{17}', () => {
    const raw = 'E = mc^2 \\tag{17}';
    expect(normalizeEquationLatex(raw)).toBe('E = mc^2 \\tag{17}');
  });

  it('does not tamper with legitimate math parentheses like f(x) = (x + 1)', () => {
    const raw = 'f(x) = (x + 1)';
    expect(normalizeEquationLatex(raw)).toBe('f(x) = (x + 1)');
  });
});
