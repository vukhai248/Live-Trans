export type TableAlign = 'left' | 'center' | 'right' | 'default';

export interface MarkdownTable {
  headers: string[];
  aligns: TableAlign[];
  rows: string[][];
}

/** Dòng có phải hàng bảng markdown không (| ... |). */
export function isTableRow(line: string): boolean {
  const t = line.trim();
  return t.startsWith('|') && t.endsWith('|') && t.length > 2;
}

/** Dòng phân cách header (|---|:---:|...). */
export function isTableDelimiter(line: string): boolean {
  const cells = splitTableRow(line);
  return (
    cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c.trim()) && c.trim().length >= 3)
  );
}

/** Tách 1 dòng bảng thành các ô (hỗ trợ \| thoát, bỏ cột rỗng 2 đầu). */
export function splitTableRow(line: string): string[] {
  const t = line.trim();
  const cells: string[] = [];
  let cur = '';
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (ch === '\\' && t[i + 1] === '|') {
      cur += '|';
      i++;
    } else if (ch === '|') {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  // Bỏ ô rỗng do | ở đầu/cuối dòng.
  if (cells.length > 0 && cells[0]!.trim() === '') cells.shift();
  if (cells.length > 0 && cells[cells.length - 1]!.trim() === '') cells.pop();
  return cells.map((c) => c.trim());
}

function parseAlign(cell: string): TableAlign {
  const t = cell.trim();
  const left = t.startsWith(':');
  const right = t.endsWith(':');
  if (left && right) return 'center';
  if (right) return 'right';
  if (left) return 'left';
  return 'default';
}

/**
 * Parse 1 khối bảng markdown (đã gom các dòng | liên tiếp).
 * Trả null nếu không phải bảng hợp lệ (thiếu dòng phân cách) → caller giữ
 * hành vi cũ (paragraph).
 */
export function parseMarkdownTable(lines: string[]): MarkdownTable | null {
  const rows = lines.filter((l) => l.trim().length > 0);
  if (rows.length < 2) return null;
  const delimIdx = rows.findIndex(isTableDelimiter);
  if (delimIdx < 1) return null;

  const headers = splitTableRow(rows[0]!);
  const aligns = splitTableRow(rows[delimIdx]!).map(parseAlign);
  const body = rows
    .filter((_, i) => i !== delimIdx && i !== 0)
    .map(splitTableRow)
    .filter((r) => r.length > 0);
  if (headers.length === 0) return null;

  // Pad ô thiếu (Vision AI đôi khi bỏ ô cuối) để render không lệch cột.
  const width = Math.max(headers.length, ...body.map((r) => r.length));
  const pad = (r: string[]): string[] => {
    const out = [...r];
    while (out.length < width) out.push('');
    return out.slice(0, width);
  };
  return {
    headers: pad(headers),
    aligns: Array.from({ length: width }, (_, i) => aligns[i] || 'default'),
    rows: body.map(pad),
  };
}
