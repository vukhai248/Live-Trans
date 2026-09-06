import { describe, expect, it } from 'vitest';
import {
  shieldTokens,
  unshieldTokens,
  isZenResponsesModel,
  parseZenResponsesText,
  parseZenChatText,
} from './translate';

describe('PDF translate math and URL shielding', () => {
  it('shields inline math like {\\alpha_t}_{t=1}^T and z_0 without altering context', () => {
    const input = {
      p1_b0_s0:
        'More concretely, given an array of scalars representing noise scales {\\alpha_t}_{t=1}^T and an initial, clean data point z_0, applying t steps.',
    };

    const { shieldedItems, tokenMap } = shieldTokens(input);

    expect(shieldedItems.p1_b0_s0).toContain('⟦MATH_');
    expect(shieldedItems.p1_b0_s0).not.toContain('{\\alpha_t}_{t=1}^T');
    expect(shieldedItems.p1_b0_s0).not.toContain('z_0');

    // Simulate LLM returning translated text preserving tokens
    const translatedWithTokens = {
      p1_b0_s0: shieldedItems.p1_b0_s0!
        .replace('More concretely', 'Cụ thể hơn')
        .replace('given an array of scalars representing noise scales', 'cho một mảng các đại lượng vô hướng đại diện cho thang đo nhiễu'),
    };

    const unshielded = unshieldTokens(translatedWithTokens, tokenMap);
    expect(unshielded.p1_b0_s0).toContain('{\\alpha_t}_{t=1}^T');
    expect(unshielded.p1_b0_s0).toContain('z_0');
  });

  it('shields URLs like github.com repositories', () => {
    const input = {
      p1_b1_s0: 'Code is available at github.com/user/Universal-Guided-Diffusion.',
    };

    const { shieldedItems, tokenMap } = shieldTokens(input);
    expect(shieldedItems.p1_b1_s0).toContain('⟦URL_');

    const unshielded = unshieldTokens(shieldedItems, tokenMap);
    expect(unshielded.p1_b1_s0).toBe('Code is available at github.com/user/Universal-Guided-Diffusion.');
  });

  it('shields LaTeX commands like \\hat and \\Delta (P1 trailing-\\b fix)', () => {
    const input = {
      p1_b2_s0: 'Update with \\hat{z}_0 and \\Delta z_0 at each step.',
    };
    const { shieldedItems, tokenMap } = shieldTokens(input);
    expect(shieldedItems.p1_b2_s0).toContain('⟦MATH_');
    expect(shieldedItems.p1_b2_s0).not.toContain('\\hat{z}_0');
    const unshielded = unshieldTokens(shieldedItems, tokenMap);
    expect(unshielded.p1_b2_s0).toBe(input.p1_b2_s0);
  });

  it('restores tokens even when LLM inserts spaces inside them (P1 fuzzy unshield)', () => {
    const input = { p1_b3_s0: 'Scales z_0 and data.' };
    const { shieldedItems, tokenMap } = shieldTokens(input);
    // Mô phỏng LLM bẻ token: ⟦MATH_0⟧ → ⟦ MATH_0 ⟧
    const broken: Record<string, string> = {};
    for (const [k, v] of Object.entries(shieldedItems)) {
      broken[k] = (v || '').replace(/⟦MATH_(\d+)⟧/g, '⟦ MATH_$1 ⟧');
    }
    const unshielded = unshieldTokens(broken, tokenMap);
    expect(unshielded.p1_b3_s0).toContain('z_0');
    expect(unshielded.p1_b3_s0).not.toMatch(/⟦\s*MATH_/);
  });

  it('keeps trailing punctuation outside URL token (P1 mất dấu câu)', () => {
    const input = { p1_b4_s0: 'See https://example.com/paper, and more.' };
    const { shieldedItems, tokenMap } = shieldTokens(input);
    const unshielded = unshieldTokens(shieldedItems, tokenMap);
    expect(unshielded.p1_b4_s0).toBe('See https://example.com/paper, and more.');
  });
});

describe('Zen provider helpers', () => {
  it('routes muse-spark to Responses API, others to chat/completions', () => {
    expect(isZenResponsesModel('muse-spark-1.2-contributor-free')).toBe(true);
    expect(isZenResponsesModel('muse-spark-1.3-contributor-free')).toBe(true);
    expect(isZenResponsesModel('big-pickle')).toBe(false);
    expect(isZenResponsesModel('deepseek-v4-flash-free')).toBe(false);
  });

  it('extracts text from Responses API output (reasoning + message)', () => {
    const json = {
      output: [
        { type: 'reasoning', status: 'completed', encrypted_content: 'xxx' },
        {
          type: 'message',
          status: 'completed',
          role: 'assistant',
          content: [{ type: 'output_text', text: '{"p1_b0_s0":"Xin chào"}' }],
        },
      ],
    };
    expect(parseZenResponsesText(json)).toBe('{"p1_b0_s0":"Xin chào"}');
  });

  it('returns {} when Responses output has no message', () => {
    expect(parseZenResponsesText({ output: [] })).toBe('{}');
    expect(parseZenResponsesText({})).toBe('{}');
  });

  it('extracts text from chat/completions choices', () => {
    const json = {
      choices: [{ message: { role: 'assistant', content: '{"p1_b0_s0":"Xin chào"}' } }],
    };
    expect(parseZenChatText(json)).toBe('{"p1_b0_s0":"Xin chào"}');
    expect(parseZenChatText({ choices: [] })).toBe('{}');
  });
});
