import { describe, expect, it } from 'vitest';
import { computeReflowOffsets } from './reflow';
import type { TextBlock } from './types';

function block(id: string, y: number, h: number, col: 0 | 1 | 2): TextBlock {
  return {
    id,
    page: 1,
    bbox: [50, y, 200, h],
    text: id,
    sentences: [{ id: `${id}_s0`, text: id }],
    col,
  };
}

describe('computeReflowOffsets', () => {
  it('không đẩy gì khi bản dịch vừa khung', () => {
    const blocks = [block('p1_b0', 10, 100, 1), block('p1_b1', 120, 100, 1)];
    const r = computeReflowOffsets(blocks, 1, { p1_b0: 100, p1_b1: 100 });
    expect(r.offsets).toEqual({ p1_b0: 0, p1_b1: 0 });
    expect(r.extraHeight).toBe(0);
  });

  it('đẩy block cùng cột phía dưới, không đụng cột bên', () => {
    const blocks = [block('p1_b0', 10, 100, 1), block('p1_b1', 20, 100, 2)];
    // Cột trái nở thêm 30px.
    const r = computeReflowOffsets(blocks, 1, { p1_b0: 130, p1_b1: 100 });
    expect(r.offsets.p1_b0).toBe(0);
    expect(r.offsets.p1_b1).toBe(0);
    expect(r.extraHeight).toBe(30);
  });

  it('block dưới cùng cột bị đẩy đúng bằng overflow phía trên', () => {
    const blocks = [
      block('p1_b0', 10, 100, 1),
      block('p1_b1', 120, 100, 1),
      block('p1_b2', 230, 100, 1),
    ];
    const r = computeReflowOffsets(blocks, 1, { p1_b0: 150, p1_b1: 100, p1_b2: 100 });
    expect(r.offsets).toEqual({ p1_b0: 0, p1_b1: 50, p1_b2: 50 });
    expect(r.extraHeight).toBe(50);
  });

  it('block full-width đồng bộ lại các cột', () => {
    const blocks = [
      block('p1_b0', 10, 50, 1),
      block('p1_b1', 70, 60, 0),
      block('p1_b2', 140, 100, 2),
    ];
    // Cột trái nở 40, heading full-width nở 20.
    const r = computeReflowOffsets(blocks, 1, { p1_b0: 90, p1_b1: 80, p1_b2: 100 });
    expect(r.offsets.p1_b0).toBe(0);
    expect(r.offsets.p1_b1).toBe(40);
    // Heading đẩy max(40,0,0)=40 rồi nở thêm 20 → cột phải bắt đầu từ 60.
    expect(r.offsets.p1_b2).toBe(60);
    expect(r.extraHeight).toBe(60);
  });

  it('bỏ qua khi thiếu số đo (dùng chiều cao gốc)', () => {
    const blocks = [block('p1_b0', 10, 100, 1)];
    const r = computeReflowOffsets(blocks, 1, {});
    expect(r.offsets.p1_b0).toBe(0);
    expect(r.extraHeight).toBe(0);
  });
});
