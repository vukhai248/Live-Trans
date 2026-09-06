import type { TextBlock, TranslatedBlock } from './types';

/**
 * Tính độ đẩy xuống cho từng block để bản dịch dài không đè nhau (thay co chữ).
 * - Block full-width (col 0: tiêu đề/abstract/heading) đồng bộ lại các cột.
 * - Block cột 1/2 chỉ đẩy các block cùng cột phía dưới.
 * - Trang giãn thêm đúng bằng độ đẩy lớn nhất; canvas giữ nguyên ở đầu trang.
 */
export function computeReflowOffsets(
  blocks: Array<TextBlock | TranslatedBlock>,
  scale: number,
  natHeights: Record<string, number>,
): { offsets: Record<string, number>; extraHeight: number } {
  const sorted = [...blocks].sort((a, b) => a.bbox[1] - b.bbox[1]);
  const shifts: Record<number, number> = { 0: 0, 1: 0, 2: 0 };
  const offsets: Record<string, number> = {};
  for (const blk of sorted) {
    const origH = blk.bbox[3] * scale;
    const natH = natHeights[blk.id] ?? origH;
    const overflow = Math.max(0, natH - origH);
    const col = blk.col ?? 0;
    if (col === 0) {
      const off = Math.max(shifts[0] || 0, shifts[1] || 0, shifts[2] || 0);
      const ns = off + overflow;
      shifts[0] = ns;
      shifts[1] = ns;
      shifts[2] = ns;
      offsets[blk.id] = off;
    } else {
      const off = shifts[col] || 0;
      shifts[col] = off + overflow;
      offsets[blk.id] = off;
    }
  }
  return {
    offsets,
    extraHeight: Math.max(shifts[0] || 0, shifts[1] || 0, shifts[2] || 0),
  };
}
