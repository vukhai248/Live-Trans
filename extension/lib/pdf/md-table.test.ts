import { describe, expect, it } from 'vitest';
import {
  isTableDelimiter,
  isTableRow,
  parseMarkdownTable,
  splitTableRow,
} from './md-table';

const PAPER_TABLE = [
  '| Algorithm | PACS | OfficeHome | DomainNet | Avg |',
  '| :--- | :---: | ---: | :--- | :--- |',
  '| ERM | 86.7 ± 0.3 | 66.4 ± 0.5 | 41.3 ± 0.1 | 64.8 |',
  '| CDGA-PG* | 89.6 ± 0.3 | 68.8 ± 0.3 | 43.1 ± 0.0 | 67.2 |',
];

describe('md-table', () => {
  it('nhận diện dòng bảng và dòng phân cách', () => {
    expect(isTableRow('| A | B |')).toBe(true);
    expect(isTableRow('| A | B')).toBe(false);
    expect(isTableRow('câu văn thường')).toBe(false);
    expect(isTableDelimiter('| :--- | :---: | ---: |')).toBe(true);
    expect(isTableDelimiter('| A | B |')).toBe(false);
  });

  it('tách ô, hỗ trợ \\| thoát', () => {
    expect(splitTableRow('| A | B | C |')).toEqual(['A', 'B', 'C']);
    expect(splitTableRow('| a \\| b | c |')).toEqual(['a | b', 'c']);
  });

  it('parse bảng paper chuẩn (header + aligns + rows)', () => {
    const t = parseMarkdownTable(PAPER_TABLE);
    expect(t).not.toBeNull();
    expect(t!.headers).toEqual(['Algorithm', 'PACS', 'OfficeHome', 'DomainNet', 'Avg']);
    expect(t!.aligns).toEqual(['left', 'center', 'right', 'left', 'left']);
    expect(t!.rows).toHaveLength(2);
    expect(t!.rows[0]).toEqual(['ERM', '86.7 ± 0.3', '66.4 ± 0.5', '41.3 ± 0.1', '64.8']);
  });

  it('pad ô thiếu để không lệch cột', () => {
    const t = parseMarkdownTable(['| A | B | C |', '| --- | --- | --- |', '| x | y |']);
    expect(t!.rows[0]).toEqual(['x', 'y', '']);
  });

  it('trả null khi thiếu dòng phân cách (giữ hành vi paragraph cũ)', () => {
    expect(parseMarkdownTable(['| A | B |', '| x | y |'])).toBeNull();
    expect(parseMarkdownTable(['| A |'])).toBeNull();
  });

  it('giữ nguyên công thức $ trong ô để VisionInlineText render sau', () => {
    const t = parseMarkdownTable(['| Ký hiệu | Giá trị |', '| --- | --- |', '| $z_0$ | 5 |']);
    expect(t!.rows[0]![0]).toBe('$z_0$');
  });
});
