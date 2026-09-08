import { type Settings, getProviderKeys } from '../settings';
import type { TextBlock, TranslatedBlock, PageTranslationResult } from './types';
import { fetchWithRetry } from '../providers/fetch-retry';
import { getKeyRouter } from '../providers/key-router';
import { selectTerms } from '../glossary/selector';
import { wrapInlineMath } from './markdown';

const FLASH_LITE_MODEL = 'gemini-3.5-flash-lite';
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const ZEN_BASE_URL = 'https://opencode.ai/zen/v1';

/** Model Zen nào dùng Responses API (muse-spark-*), còn lại dùng chat/completions. */
export function isZenResponsesModel(model: string): boolean {
  return model.startsWith('muse-spark');
}

export function getZenKey(settings: Settings): string {
  const keys = getProviderKeys(settings, 'zen');
  return keys[0] || '';
}

/** Trích text dịch từ OpenAI Responses API (muse-spark-* qua Zen). */
export function parseZenResponsesText(json: unknown): string {
  try {
    const out = (json as { output?: Array<unknown> })?.output || [];
    for (const item of out) {
      const it = item as { type?: string; content?: Array<{ type?: string; text?: string }> };
      if (it?.type === 'message' && Array.isArray(it.content)) {
        for (const c of it.content) {
          if (c?.type === 'output_text' && c.text) return c.text;
        }
      }
    }
  } catch {
    /* fall through */
  }
  return '{}';
}

/** Trích text dịch từ OpenAI chat/completions (free models qua Zen). */
export function parseZenChatText(json: unknown): string {
  try {
    const choices = (json as { choices?: Array<{ message?: { content?: string } }> })?.choices;
    const text = choices?.[0]?.message?.content;
    if (typeof text === 'string' && text) return text;
  } catch {
    /* fall through */
  }
  return '{}';
}

/**
 * Builds prompt for translating sentences.
 * Strictly preserves LaTeX math, formulas, symbols, citations, URLs, and model names.
 */
function buildPageTranslatePrompt(
  items: Record<string, string>,
  targetLang: string,
  glossaryTerms: Array<{ term: string; vi?: string; type?: string }>,
): string {
  const rules: string[] = [];
  for (const t of glossaryTerms) {
    if (t.type === 'command' || t.type === 'code') {
      rules.push(`- "${t.term}": giữ NGUYÊN VĂN, không dịch`);
    } else if (t.vi) {
      rules.push(`- "${t.term}" luôn dịch là "${t.vi}"`);
    } else {
      rules.push(`- "${t.term}": giữ nguyên văn`);
    }
  }
  const glossaryBlock = rules.length > 0 ? rules.join('\n') : '(không có)';
  // P3: payload JSON compact (không indent) để tiết kiệm token mỗi batch.
  const payload = JSON.stringify(items);

  return `Bạn là dịch giả học thuật chuyên nghiệp cho các bài báo khoa học hàng đầu (Arxiv, CVPR, NeurIPS, ICML).
Nhiệm vụ: Dịch các câu trong danh sách sang ${targetLang}.

QUY TẮC BẮT BUỘC:
1. ÁNH XẠ 1:1 NGHIÊM NGẶT:
   - Đầu vào có bao nhiêu key ID (ví dụ: p1_b0_s0, p1_b1_s0, ...), đầu ra PHẢI có ĐỦ bấy nhiêu key ID tương ứng.
   - TUYỆT ĐỐI KHÔNG GỘP hai key thành một, mỗi key là một câu dịch độc lập.
2. BẢO TỒN NGUYÊN VẸN CÁC TOKEN ĐẶC BIỆT (⟦MATH_N⟧ & ⟦URL_N⟧):
   - Giữ NGUYÊN 100% tất cả các token giữ chỗ có dạng ⟦MATH_0⟧, ⟦MATH_1⟧,... và ⟦URL_0⟧, ⟦URL_1⟧,...
   - TUYỆT ĐỐI KHÔNG DỊCH, KHÔNG THAY ĐỔI, KHÔNG XÓA và KHÔNG THÊM BỚT các token này.
3. BẢO TỒN NGUYÊN VẸN CÔNG THỨC TOÁN HỌC, LATEX & KÝ HIỆU:
   - Giữ NGUYÊN 100% tất cả các công thức toán, biểu thức trong cặp $, $$, ký hiệu toán học (như x_n, y_{n,i,s}, D^S, D^T, z_t, α, β, σ, ∈, ∀, ∃, ∇, ∑, ∏, ∫, √, v.v.).
   - TUYỆT ĐỐI KHÔNG sửa hay thay thế ký hiệu toán thành ký tự rác (như @@@ hay đ0).
4. TRÍCH DẪN & TÊN RIÊNG:
   - Giữ nguyên trích dẫn học thuật: [1], [2, 3], (Song & Ermon, 2019; Ho et al., 2020).
   - Giữ nguyên tên mô hình, thuật toán, mã nguồn, tên biến (DDPM, LDM, GAN, DAFomer, v.v.).
5. QUY TẮC THUẬT NGỮ CHUYÊN NGÀNH:
${glossaryBlock}
6. VĂN PHONG HỌC THUẬT:
   - Tự nhiên, chính xác, súc tích, mạch lạc theo chuẩn văn phong khoa học tiếng Việt.
7. ĐỊNH DẠNG ĐẦU RA:
   - Trả về DUY NHẤT một JSON object có format: {"id": "câu đã dịch", ...} tương ứng đủ mọi id đầu vào. KHÔNG viết thêm bất kỳ lời dẫn hay markdown giải thích nào.

Dữ liệu các câu cần dịch:
${payload}`;
}

/**
 * P2+P3: cache key gồm hash URL + số trang + ngôn ngữ + hash glossary.
 * Key cũ (url+pN) gây đụng khi đổi ngôn ngữ/glossary hoặc arXiv update version.
 */
function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

function getCacheKey(
  pdfUrl: string,
  pageNumber: number,
  targetLang = '',
  glossaryHash = '',
  providerModel = '',
): string {
  const cleanUrl = pdfUrl.split('#')[0]?.split('?')[0] || pdfUrl;
  const urlHash = hashString(cleanUrl);
  const suffix = targetLang || glossaryHash ? `_l${targetLang}_g${glossaryHash}` : '';
  return `live_trans_pdf_${urlHash}_p${pageNumber}${suffix}${providerModel ? `_m${providerModel}` : ''}`;
}

function getGlossaryHash(settings: Settings): string {
  try {
    const terms = settings.glossary?.terms || [];
    return hashString(JSON.stringify(terms.map((t) => [t.term, t.vi || '', t.type || ''])));
  } catch {
    return '';
  }
}

/**
 * Loads cached page translation from session storage.
 * P2: validate theo id-set + text (thay vì chỉ length) để re-extract khác
 * không trả nhầm bản dịch cũ.
 */
export async function getCachedTranslation(
  pdfUrl: string,
  pageNumber: number,
  blocks?: TextBlock[],
  settings?: Settings,
): Promise<TranslatedBlock[] | null> {
  try {
    const key = settings
      ? getCacheKey(
          pdfUrl,
          pageNumber,
          settings.targetLang,
          getGlossaryHash(settings),
          `${settings.pdfProvider}:${settings.pdfModel}`,
        )
      : getCacheKey(pdfUrl, pageNumber);
    const stored = sessionStorage.getItem(key);
    if (!stored) {
      // Thử key cũ (tương thích bản trước) khi có blocks để validate.
      if (!settings || !blocks) return null;
      const legacy = sessionStorage.getItem(getCacheKey(pdfUrl, pageNumber));
      if (!legacy) return null;
      const parsed = JSON.parse(legacy) as TranslatedBlock[];
      return isCacheValid(parsed, blocks) ? parsed : null;
    }
    const parsed = JSON.parse(stored) as TranslatedBlock[];
    if (blocks && !isCacheValid(parsed, blocks)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isCacheValid(cached: TranslatedBlock[] | null, blocks: TextBlock[]): boolean {
  if (!cached || cached.length !== blocks.length) return false;
  for (let i = 0; i < blocks.length; i++) {
    const c = cached[i];
    const b = blocks[i];
    if (!c || !b || c.id !== b.id || c.text !== b.text) return false;
  }
  return true;
}

/**
 * Saves page translation to session storage.
 */
export async function setCachedTranslation(
  pdfUrl: string,
  pageNumber: number,
  blocks: TranslatedBlock[],
  settings?: Settings,
): Promise<void> {
  try {
    const key = settings
      ? getCacheKey(
          pdfUrl,
          pageNumber,
          settings.targetLang,
          getGlossaryHash(settings),
          `${settings.pdfProvider}:${settings.pdfModel}`,
        )
      : getCacheKey(pdfUrl, pageNumber);
    sessionStorage.setItem(key, JSON.stringify(blocks));
  } catch (err) {
    console.warn('[Live-Trans PDF] Failed to cache translation in sessionStorage:', err);
  }
}

/**
 * Resilient JSON parser that handles markdown formatting, truncated braces,
 * or unescaped characters from LLM responses without throwing.
 */
function resilientParseJson(
  rawText: string,
  originalItems: Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = { ...originalItems };
  if (!rawText) return result;

  let cleaned = rawText.trim();
  // Strip markdown code block wrappers
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  // Try standard JSON.parse first
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === 'object') {
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'string' && v.trim()) {
          result[k] = v.trim();
        }
      }
      return result;
    }
  } catch {
    // If standard parse fails due to truncated trailing brace, try repairing
    if (!cleaned.endsWith('}')) {
      try {
        const repaired = cleaned + (cleaned.endsWith('"') ? '\n}' : '"\n}');
        const parsed = JSON.parse(repaired);
        if (parsed && typeof parsed === 'object') {
          for (const [k, v] of Object.entries(parsed)) {
            if (typeof v === 'string' && v.trim()) {
              result[k] = v.trim();
            }
          }
          return result;
        }
      } catch {
        // Fall through to regex
      }
    }
  }

  // Resilient regex extractor: extracts "key": "value" pairs even from partially broken JSON
  const pairRegex = /"([^"\\]+)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  let match;
  while ((match = pairRegex.exec(cleaned)) !== null) {
    const key = match[1];
    let val = match[2];
    if (key && val !== undefined) {
      val = val.replace(/\\"/g, '"').replace(/\\n/g, ' ').replace(/\\\\/g, '\\');
      if (val.trim()) {
        result[key] = val.trim();
      }
    }
  }

  return result;
}

/**
 * Translates a batch of sentences via OpenCode Zen (dự phòng khi Gemini ốm).
 * Model responses-API (muse-spark-*) và chat/completions (big-pickle, ...) đều
 * trả JSON 1:1 như prompt Gemini nên tái dùng resilientParseJson nguyên văn.
 */
async function translateSentenceBatchZen(
  items: Record<string, string>,
  targetLang: string,
  settings: Settings,
): Promise<Record<string, string>> {
  const zenKey = getZenKey(settings);
  if (!zenKey) {
    throw new Error('Chưa cấu hình Zen API Key (nhập ở Cài đặt hoặc build kèm ZEN_API_KEY)');
  }
  const model = settings.pdfModel?.trim() || 'muse-spark-1.2-contributor-free';
  const glossaryTerms = selectTerms(
    Object.values(items).join('\n'),
    { version: 1, terms: settings.glossary?.terms || [] },
    15,
  );
  const prompt = buildPageTranslatePrompt(items, targetLang, glossaryTerms);
  const useResponses = isZenResponsesModel(model);
  const url = useResponses ? `${ZEN_BASE_URL}/responses` : `${ZEN_BASE_URL}/chat/completions`;
  const body = useResponses
    ? { model, input: prompt }
    : {
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      };

  const res = await fetchWithRetry(
    url,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${zenKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'OpenCode-Desktop/1.0.0',
        'x-session-id': `session-${Date.now()}`,
      },
      body: JSON.stringify(body),
    },
    { timeoutMs: 90_000 },
  );

  if (!res.ok) {
    const errBody = await res.text().catch(() => res.statusText);
    throw new Error(`Zen API ${res.status}: ${errBody.slice(0, 300)}`);
  }

  const json = await res.json();
  const rawText = useResponses ? parseZenResponsesText(json) : parseZenChatText(json);
  return resilientParseJson(rawText, items);
}

/**
 * Translates a batch of sentences directly via Gemini 3.5 Flash-Lite.
 */
async function translateSentenceBatchDirect(
  items: Record<string, string>,
  targetLang: string,
  settings: Settings,
): Promise<Record<string, string>> {
  // Nhánh Zen (chọn ở toolbar viewer) — cùng prompt/shield/parse với Gemini.
  if (settings.pdfProvider === 'zen') {
    return translateSentenceBatchZen(items, targetLang, settings);
  }

  const router = getKeyRouter(getProviderKeys(settings, 'gemini'));
  if (router.keyCount === 0) {
    throw new Error('Chưa cấu hình Gemini API Key');
  }

  const glossaryTerms = selectTerms(
    Object.values(items).join('\n'),
    { version: 1, terms: settings.glossary?.terms || [] },
    15,
  );
  const prompt = buildPageTranslatePrompt(items, targetLang, glossaryTerms);

  const url = `${BASE_URL}/models/${settings.pdfModel?.trim() || FLASH_LITE_MODEL}:generateContent`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    // P3: REST v1beta dùng camelCase (generationConfig/responseMimeType/thinkingConfig).
    // snake_case trước đây bị API bỏ qua → mất ép JSON + MINIMAL, tốn token/latency.
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingLevel: 'MINIMAL' },
    },
  };

  return router.execute(async (activeApiKey) => {
    // P3-quota: timeout 90s/call — model ốm (503/treo) thì fail nhanh để caller
    // fallback + hiện badge thử lại, thay vì treo spinner vô hạn.
    const res = await fetchWithRetry(
      url,
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': activeApiKey.trim(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
      { timeoutMs: 90_000 },
    );

    if (!res.ok) {
      const errBody = await res.text().catch(() => res.statusText);
      throw new Error(`Gemini API ${res.status}: ${errBody.slice(0, 300)}`);
    }

    const json = await res.json();
    const rawText: string = json?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    return resilientParseJson(rawText, items);
  });
}

/**
 * Shields URLs and Inline Math expressions (e.g. {\alpha_t}_{t=1}^T, {a_T}, z_0, \Delta z_0)
 * from LLM translation by replacing them with tokens like ⟦URL_0⟧ and ⟦MATH_0⟧.
 */
export function shieldTokens(items: Record<string, string>): {
  shieldedItems: Record<string, string>;
  tokenMap: Map<string, string>;
} {
  const shieldedItems: Record<string, string> = {};
  const tokenMap = new Map<string, string>();
  let tokenCounter = 0;

  const urlRegex = /(https?:\/\/[^\s]+|github\.com\/[^\s]+)/g;

  // Patterns for inline math formulas, variables, and LaTeX expressions
  // P1: sửa \b sau "}" / ")" (không bao giờ match vì "}" là non-word) → dùng (?!\w).
  // Thứ tự quan trọng: pattern dài/đặc thù (\\hat{...}, \\Delta ...) chạy TRƯỚC
  // pattern generic {...} để "\hat{z}_0" thành 1 token thay vì "{z}" lẻ.
  const mathPatterns = [
    /\$[^$]+\$/g, // LaTeX inline dollar sign $...$
    /(?:\\Delta\s*[a-zA-Z0-9_]+|\\hat\{[a-zA-Z0-9_]+\}(?:_[a-zA-Z0-9={}^\\α-ωΑ-Ω]+)?(?:\^[a-zA-Z0-9={}^\\α-ωΑ-Ω]+)?|\\tilde\{[a-zA-Z0-9_]+\}(?:_[a-zA-Z0-9={}^\\α-ωΑ-Ω]+)?(?:\^[a-zA-Z0-9={}^\\α-ωΑ-Ω]+)?|\\epsilon_\\theta(?:\([^)]*\))?|\\ell(?:\([^)]*\))?)(?!\w)/gi,
    /\{[a-zA-Z0-9_\\α-ωΑ-Ω]+\}(?:[_^]?[a-zA-Z0-9={}^\\α-ωΑ-Ω]+)*/g, // {\alpha_t}_{t=1}^T or {a_T}
    /(?<![\p{L}\p{N}])(?:z_0|z0|z_t|zt|x_0|x0|x_t|xt|y_n|w_t|z_\{t-1\}|z_\{0\}|x_\{t\}|x_\{0\}|D\^[ST]|q\(|p\(|N\([^)]*\))(?![\p{L}\p{N}])/gu,
    /(?<![\p{L}\p{N}])(?:[a-zA-Z]_[0-9a-zA-Z]+|[a-zA-Z]\^[0-9a-zA-Z]+)(?![\p{L}\p{N}])/gu, // z_0, x_t, D^S
    /(?:(?<![\p{L}\p{N}])[fgh]\([a-zA-Z0-9_\\]+\)(?![\p{L}\p{N}])|(?<![\p{L}\p{N}])[a-zA-Z]'(?![\p{L}\p{N}])|(?<![\p{L}\p{N}])\([fgh]\s*,\s*(?:1|l|\\ell)\)(?![\p{L}\p{N}]))/gu, // f(x), c', x', (f, \ell)
  ];

  for (const [id, text] of Object.entries(items)) {
    let shielded = text.replace(/`\s*\(/g, '\\ell(');

    // 1. Shield URLs first (tách dấu câu cuối .,;) khỏi URL để LLM không nuốt dấu câu)
    shielded = shielded.replace(urlRegex, (matchedUrl) => {
      // Tách dấu câu bám cuối URL: "...Diffusion.," → URL + ".,"
      const m = matchedUrl.match(/^(.+?)([.,;:!?)\]]+)$/);
      const clean = m?.[1] || matchedUrl;
      const trail = m?.[2] || '';
      if (!clean) return matchedUrl;
      const token = `⟦URL_${tokenCounter++}⟧`;
      tokenMap.set(token, clean);
      // Chêm 1 space trước token để không dính từ (dấu câu giữ dính sau token).
      return ` ${token}${trail}`;
    });

    // 2. Shield Inline Math expressions (chêm space 2 đầu token)
    for (const pattern of mathPatterns) {
      shielded = shielded.replace(pattern, (matchedMath) => {
        if (matchedMath.startsWith('⟦') && matchedMath.endsWith('⟧')) return matchedMath;
        const token = `⟦MATH_${tokenCounter++}⟧`;
        tokenMap.set(token, matchedMath);
        return ` ${token} `;
      });
    }

    shieldedItems[id] = shielded.replace(/\s{2,}/g, ' ');
  }

  return { shieldedItems, tokenMap };
}

/**
 * Unshields all tokens after translation, restoring original URLs and math notations.
 * P1: fuzzy-match khi LLM chèn space/bẻ dòng trong token (⟦ MATH_0 ⟧, ⟦MATH_0⟧...),
 * dọn space thừa quanh ký hiệu toán sau restore, trả kèm cảnh báo token còn sót.
 */
export function unshieldTokens(
  items: Record<string, string>,
  tokenMap: Map<string, string>,
): Record<string, string> {
  if (tokenMap.size === 0) return items;
  const result: Record<string, string> = {};

  // Regex fuzzy cho từng token: cho phép space/bẻ dòng giữa các ký tự ⟦ MATH_0 ⟧
  const fuzzyPatterns = new Map<string, RegExp>();
  for (const token of tokenMap.keys()) {
    const kind = token.includes('URL_') ? 'URL' : 'MATH';
    const num = token.match(/(\d+)/)?.[1] || '0';
    fuzzyPatterns.set(token, new RegExp(`⟦\\s*${kind}_\\s*${num}\\s*⟧`, 'g'));
  }

  for (const [id, text] of Object.entries(items)) {
    let unshielded = text;
    for (const [token, originalVal] of tokenMap.entries()) {
      const fuzzy = fuzzyPatterns.get(token);
      if (unshielded.includes(token)) {
        unshielded = unshielded.replaceAll(token, originalVal);
      } else if (fuzzy) {
        unshielded = unshielded.replace(fuzzy, originalVal);
      }
    }
    // Dọn space đôi sinh ra từ việc chêm space lúc shield (trim space cuối chuỗi).
    unshielded = unshielded
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+([.,;:!?)\]%])/g, '$1')
      .replace(/\s+$/g, '');
    if (/⟦\s*(MATH|URL)_/.test(unshielded)) {
      console.warn(`[Live-Trans PDF] Token còn sót sau unshield ở ${id}:`, unshielded.slice(0, 200));
    }
    result[id] = unshielded;
  }

  return result;
}

/**
 * Translates sentences in micro-batches (8-12 sentences each) in parallel.
 * This prevents single-request truncation, timeout, or silent fallback errors (Ảnh 4).
 */
async function translateMicroBatches(
  sentencePayload: Record<string, string>,
  targetLang: string,
  settings: Settings,
): Promise<Record<string, string>> {
  const entries = Object.entries(sentencePayload);
  if (entries.length === 0) return {};

  // P3-quota: batch 20 câu (thay vì 10) để giảm số call/trang khi model ốm.
  const BATCH_SIZE = 20;
  const batches: Record<string, string>[] = [];

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch: Record<string, string> = {};
    for (const [k, v] of entries.slice(i, i + BATCH_SIZE)) {
      batch[k] = v;
    }
    batches.push(batch);
  }

  // Execute micro-batches in parallel with KeyRouter rotating keys across threads
  const results = await Promise.all(
    batches.map((batch) => translateSentenceBatchDirect(batch, targetLang, settings)),
  );

  let merged: Record<string, string> = {};
  for (const r of results) {
    merged = { ...merged, ...r };
  }

  return merged;
}

/**
 * Translates all text blocks on a page using parallel Micro-Batches.
 * Accurately maps translations back to block-bounded sentence items and caches the result.
 */
export async function translatePageBlocks(
  blocks: TextBlock[],
  pageNumber: number,
  pdfUrl: string,
  settings: Settings,
): Promise<PageTranslationResult> {
  if (blocks.length === 0) {
    return { page: pageNumber, blocks: [] };
  }

  // 1. Check cache first (P2: validate id-set + text, key gồm lang + glossary)
  const cached = await getCachedTranslation(pdfUrl, pageNumber, blocks, settings);
  if (cached) {
    return { page: pageNumber, blocks: cached, fromCache: true };
  }

  // 2. Gather sentences for translation, bypassing math formulas
  const targetLang = settings.targetLang === 'vi' ? 'tiếng Việt' : settings.targetLang;
  const sentencePayload: Record<string, string> = {};
  const directFormulaMap: Record<string, string> = {};

  for (const b of blocks) {
    for (const s of b.sentences) {
      if (b.isFormula || s.isFormula) {
        // Formula blocks stay in original canvas form; never translated
        directFormulaMap[s.id] = s.text;
      } else {
        sentencePayload[s.id] = wrapInlineMath(s.text);
      }
    }
  }

  let translationMap: Record<string, string> = { ...directFormulaMap };

  // 3. Translate non-formula sentences with Math & URL shielding
  if (Object.keys(sentencePayload).length > 0) {
    try {
      const { shieldedItems, tokenMap } = shieldTokens(sentencePayload);
      const batchResult = await translateMicroBatches(shieldedItems, targetLang, settings);
      const unshielded = unshieldTokens(batchResult, tokenMap);
      translationMap = { ...translationMap, ...unshielded };
    } catch (err) {
      console.warn(`[Live-Trans PDF] Page translation failed for p${pageNumber}:`, err);
      // Fallback: keep original text
      for (const [sid, stext] of Object.entries(sentencePayload)) {
        translationMap[sid] = stext;
      }
    }
  }

  // 4. Assemble translated blocks with sentence items updated
  // P2: chuẩn hoá space khi nối câu; đếm UTB (câu giữ nguyên văn do rớt dịch).
  const attemptedSources = new Map<string, string>();
  for (const [sid, stext] of Object.entries(sentencePayload)) {
    attemptedSources.set(sid, normalizeForCompare(stext));
  }
  let untranslatedCount = 0;
  const translatedBlocks: TranslatedBlock[] = blocks.map((b) => {
    const updatedSentences = b.sentences.map((s) => ({
      ...s,
      translation: translationMap[s.id] || s.text,
    }));

    for (const s of updatedSentences) {
      if (b.componentType === 'authors' || b.componentType === 'title' || b.isHeader || b.isFormula) {
        continue;
      }
      const attempted = attemptedSources.get(s.id);
      if (
        attempted !== undefined &&
        attempted.length > 20 &&
        normalizeForCompare(s.translation || s.text) === attempted
      ) {
        // Expected to remain in English: URLs, emails, institution names, author affiliations
        if (/(github\.com|http|@|university|department|institute|equal contribution)/i.test(attempted)) {
          continue;
        }
        untranslatedCount++;
      }
    }

    const blockTranslation = updatedSentences
      .map((s) => s.translation || s.text)
      .join(' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    return {
      ...b,
      sentences: updatedSentences,
      translation: blockTranslation || b.text,
    };
  });

  // 5. Save to session cache — P2: không cache khi cả trang rớt (tránh khóa bản Anh).
  const attemptedCount = attemptedSources.size;
  const totalFailed = attemptedCount > 0 && untranslatedCount >= attemptedCount;
  if (!totalFailed) {
    await setCachedTranslation(pdfUrl, pageNumber, translatedBlocks, settings);
  } else {
    console.warn(`[Live-Trans PDF] Page p${pageNumber} failed entirely — skipped cache.`);
  }

  return { page: pageNumber, blocks: translatedBlocks, fromCache: false, untranslatedCount };
}

function normalizeForCompare(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}
