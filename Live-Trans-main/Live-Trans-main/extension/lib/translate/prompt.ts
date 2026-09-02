import type { GlossaryTerm } from '../glossary/types';
import type {
  TranslateBatchRequest,
  TranslateBatchResponse,
  TranslatedUnit,
} from '../providers/provider';

/**
 * Prompt construction for `gemini-3.5-flash` (docs/plan.md §4 step 2) and the
 * strict JSON parser for the model output.
 */

function glossaryRules(terms: GlossaryTerm[]): string {
  if (terms.length === 0) return '';
  const lines = terms.map((t) => {
    if (t.type === 'jargon' && t.vi) return `- "${t.term}" luôn dịch là "${t.vi}"`;
    if (t.type === 'acronym')
      return `- "${t.term}" giữ nguyên văn` + (t.vi ? ` (chú giải: ${t.vi})` : '');
    return `- "${t.term}" giữ nguyên văn, không dịch`;
  });
  return `\nQuy tắc thuật ngữ (bắt buộc):\n${lines.join('\n')}`;
}

function contextRules(pairs: { source: string; target: string }[]): string {
  if (pairs.length === 0) return '';
  const lines = pairs.map((p) => `- "${p.source}" → "${p.target}"`);
  return `\nCác cặp dịch liền trước để giữ nhất quán:\n${lines.join('\n')}`;
}

export function buildTranslatePrompt(req: TranslateBatchRequest): string {
  const units = req.units.map((u, i) => `[${i}] ${u.masked}`).join('\n');
  return `Bạn là dịch giả phụ đề video học thuật. Dịch từng câu sau sang ${req.targetLang}.

Ràng buộc bắt buộc:
- Giữ NGUYÊN VĂN mọi cụm giữ chỗ có dạng ⟦n⟧ (số, ngoặc vuông) — tuyệt đối không đổi, không thêm, không bớt.
- Không dịch mã nguồn, lệnh shell, URL, định danh.
- Dịch tự nhiên, phù hợp ngữ cảnh giáo dục.${glossaryRules(req.selectedTerms)}${contextRules(req.contextPairs)}

Câu cần dịch:
${units}

Trả về JSON hợp lệ với đúng ${req.units.length} phần tử:
{"translations":[{"text":"...","terms_used":[]},{"text":"...","terms_used":[]}]}`;
}

export function parseTranslateBatch(text: string, count: number): TranslateBatchResponse {
  const jsonText = extractJson(text);
  let parsed: any;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    // Last-resort: split on newlines rather than fail the whole batch.
    return fallbackFromText(text, count);
  }
  const arr = Array.isArray(parsed) ? parsed : parsed?.translations;
  if (!Array.isArray(arr)) return fallbackFromText(text, count);

  const translations: TranslatedUnit[] = arr.slice(0, count).map((item: any) => {
    const t = typeof item === 'string' ? item : (item?.text ?? item?.translation ?? '');
    const termsUsed: string[] = Array.isArray(item?.terms_used) ? item.terms_used : [];
    return { text: String(t).trim(), termsUsed };
  });

  // Pad if the model returned fewer entries than requested.
  while (translations.length < count) translations.push({ text: '', termsUsed: [] });
  return { translations: translations.slice(0, count) };
}

function extractJson(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) return text.slice(start, end + 1);
  const arrStart = text.indexOf('[');
  const arrEnd = text.lastIndexOf(']');
  if (arrStart !== -1 && arrEnd > arrStart) return text.slice(arrStart, arrEnd + 1);
  return text;
}

function fallbackFromText(text: string, count: number): TranslateBatchResponse {
  const cleaned = text
    .replace(/^```[a-z]*\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
  const lines = cleaned
    .split(/\n+/)
    .map((l) => l.replace(/^\s*-\s*/, '').trim())
    .filter(Boolean);
  const translations: TranslatedUnit[] = [];
  for (let i = 0; i < count; i++) {
    translations.push({ text: lines[i] ?? '', termsUsed: [] });
  }
  return { translations };
}
