/**
 * Chuẩn hóa biểu thức LaTeX của phương trình toán độc lập ($$...$$).
 * Tự động bóc tách số thứ tự phương trình (equation numbers như (17), (18), (19), (9))
 * bị kẹt vào bên trong tử số phân số \frac{... (17)}{...}, bên trong ngoặc hàm D(x(19)),
 * hoặc dạng text thô \quad (17), \qquad (17), , (17) ở cuối công thức,
 * chuyển đổi thành chuẩn KaTeX \tag{N} để hiển thị căn lề phải chuẩn xác 100%.
 */
export function normalizeEquationLatex(raw: string): string {
  const latex = raw.trim();
  if (!latex) return '';

  // Nếu đã có \tag{...} hoặc \tag*{...} thì giữ nguyên
  if (/\\tag\*?\{/.test(latex)) {
    return latex;
  }

  // 1. Dạng \quad (17), \qquad (17), hoặc (17) ở cuối công thức
  const trailingTagRegex =
    /(?:\\(?:q?quad|hspace\{[^}]+\})|\s)*\(([0-9]+[a-zA-Z]?(?:\.[0-9]+[a-zA-Z]?)?)\)\s*([,.]?)\s*$/;
  const matchTrailing = latex.match(trailingTagRegex);
  if (matchTrailing && matchTrailing.index !== undefined) {
    const num = matchTrailing[1];
    const punct = matchTrailing[2] || '';
    let formula = latex.slice(0, matchTrailing.index).trim();
    if (formula.length > 0) {
      if (punct && !formula.endsWith(punct)) {
        formula += punct;
      }
      return `${formula} \\tag{${num}}`;
    }
  }

  // 2. Dạng số bị kẹt trong ngoặc hàm ở cuối: e.g. D_\theta(\mathbf{x}_t(19)) hoặc func(a, b (19))
  const insideParensRegex = /\s*\(([0-9]+[a-zA-Z]?)\)\s*(\)+)\s*([,.]?)\s*$/;
  const matchParens = latex.match(insideParensRegex);
  if (matchParens && matchParens.index !== undefined) {
    const num = matchParens[1];
    const closing = matchParens[2];
    const punct = matchParens[3] || '';
    const formula = latex.slice(0, matchParens.index) + closing;
    return `${formula}${punct} \\tag{${num}}`;
  }

  // 3. Dạng số bị kẹt trong tử số của \frac (ví dụ: \frac{A (17)}{B} hoặc \frac{A(18)}{B}\mathbf{x}_t)
  // Tìm số (NUM) đứng ngay trước dấu đóng ngoặc nhọn } của tử số trong \frac
  const fracNumRegex = /\\frac\{([\s\S]*?)\s*\(([0-9]+[a-zA-Z]?)\)\s*\}([\s\S]*)$/;
  const matchFrac = latex.match(fracNumRegex);
  if (matchFrac && matchFrac.index !== undefined) {
    const num = matchFrac[2];
    const beforeTagInNum = matchFrac[1];
    const afterNum = matchFrac[3];
    const prefix = latex.slice(0, matchFrac.index);
    let cleaned = `${prefix}\\frac{${beforeTagInNum}}${afterNum}`.trim();
    let punct = '';
    if (cleaned.endsWith(',')) {
      punct = ',';
      cleaned = cleaned.slice(0, -1).trim();
    } else if (cleaned.endsWith('.')) {
      punct = '.';
      cleaned = cleaned.slice(0, -1).trim();
    }
    return `${cleaned}${punct} \\tag{${num}}`;
  }

  return latex;
}
