import type { PDFDocumentProxy } from 'pdfjs-dist';
import { type Settings, getProviderKeys } from '../settings';
import { fetchWithRetry } from '../providers/fetch-retry';
import { getKeyRouter } from '../providers/key-router';
import {
  getZenKey,
  isZenResponsesModel,
  parseZenResponsesText,
  parseZenChatText,
} from './translate';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const ZEN_BASE_URL = 'https://opencode.ai/zen/v1';
const VISION_CANDIDATE_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.5-flash'];

/**
 * Builds the specialized Academic Multimodal Paper Translation Prompt
 */
function buildVisionPrompt(targetLang: string): string {
  return `Bạn là một chuyên gia dịch thuật tài liệu khoa học máy tính AI xuất sắc (Arxiv, CVPR, NeurIPS, ICML).
Nhiệm vụ duy nhất của bạn là ĐỌC ẢNH VÀ DỊCH TOÀN BỘ NỘI DUNG CỦA TRANG SANG ${targetLang} dưới định dạng MARKDOWN HỌC THUẬT CHUẨN XÁC CAO.

CẢNH BÁO TỐI THƯỢNG (CHỐNG BẪY CHÉP NGUYÊN VĂN OCR & TRÔI NGÔN NGỮ):
- Đây là tác vụ DỊCH THUẬT HỌC THUẬT (TRANSLATION), TUYỆT ĐỐI KHÔNG ĐƯỢC chạy chế độ chép lại nguyên văn tiếng Anh (OCR Transcription).
- Nghiêm cấm trả về toàn bộ trang bằng tiếng Anh hoặc bỏ sót không dịch các đoạn văn.
- Dù sau các khối phương trình toán hay sau các Hình ảnh/Biểu đồ, bạn PHẢI TIẾP TỤC DỊCH SANG ${targetLang}, TUYỆT ĐỐI KHÔNG được chuyển đột ngột sang tiếng Anh.

QUY TẮC PHÂN ĐỊNH RANH GIỚI BẮT BUỘC:
1. ĐOẠN VĂN THẢO LUẬN (PARAGRAPHS) — BẮT BUỘC 100% PHẢI DỊCH SANG ${targetLang}:
   - Toàn bộ các đoạn văn phân tích, diễn giải, phương pháp luận từ đầu đến cuối trang BẮT BUỘC PHẢI DỊCH SANG ${targetLang}.
   - Kể cả khi đoạn văn có nhắc đến Figure (ví dụ: "In Figure 6, we see...", "As shown in Figure 7..."), có chứa dày đặc tên mô hình viết hoa (MTCNN, Stable Diffusion, Faster-RCNN, ResNet), hay nằm ngay dưới Hình ảnh, bạn VẪN PHẢI DỊCH TOÀN BỘ NỘI DUNG ĐOẠN VĂN SANG ${targetLang} (chỉ giữ nguyên các danh từ riêng viết hoa).
2. DUY NHẤT NHỮNG THÀNH PHẦN SAU ĐƯỢC GIỮ NGUYÊN TIẾNG ANH GỐC:
   - Dòng tiêu đề bài báo (# Paper Title) ở trang đầu tiên.
   - Dòng trích dẫn caption trực tiếp của hình ảnh: > **Figure X**: <English Caption>
   - Các nhãn ngắn minh họa đồ họa bên trong hình (ví dụ: > *Masked Image* | *Clf. Guided*).
   - Tên riêng mô hình, framework viết hoa (ví dụ: Diffusion Models, Stable Diffusion, DDIM, CLIP, LoRA, MTCNN, Faster-RCNN).
   - Tên riêng tác giả, trường đại học, liên kết GitHub/URL.
   - Biến số và biểu thức toán học LaTeX trong cặp dấu $...$ hoặc $$...$$.

QUY TẮC CÔNG THỨC TOÁN & LATEX:
- Mọi công thức toán học, biến số nội dòng PHẢI được viết bằng mã LaTeX chuẩn trong cặp dấu $: $z_{t-1} = S(z_t, \\hat{\\epsilon}_t, t)$, $\\epsilon' \\sim \\mathcal{N}(0, \\mathbf{I})$, $z_t'$, $z_0$, $\\alpha_t$.
- Phương trình độc lập đặt trong cặp dấu $$...$$ và giữ nguyên số thứ tự phương trình nếu có:
  $$z_t' = \\sqrt{\\alpha_t / \\alpha_{t-1}} \\cdot z_{t-1} + \\sqrt{1 - \\alpha_t / \\alpha_{t-1}} \\cdot \\epsilon' \\quad (10)$$

QUY TẮC BỐ CỤC & THỨ TỰ ĐỌC TRANG:
3. NHẬN DIỆN BỐ CỤC & THỨ TỰ ĐỌC:
   Trước khi đọc nội dung, bạn PHẢI quan sát cấu trúc không gian của trang để xác định đúng loại bố cục:
   - NẾU TRANG LÀ 1 CỘT (SINGLE-COLUMN): Đọc tuần tự từng dòng từ trên xuống dưới bình thường (từ lề trái sang lề phải của trang). TUYỆT ĐỐI KHÔNG tự ý chia đôi trang nếu trang là bài báo 1 cột.
   - NẾU TRANG LÀ 2 CỘT (TWO-COLUMN HOẶC BỐ CỤC HỖN HỢP):
     + Nhận diện rãnh khoảng trắng phân cách Cột Trái (Cột 1) và Cột Phải (Cột 2).
     + Phần trải rộng toàn trang (Full-width như Tiêu đề bài báo, Abstract, hoặc Hình ảnh/Bảng biểu trải rộng cả 2 cột): Đọc toàn bộ theo thứ tự từ trên xuống dưới.
     + Phần chia 2 cột: BẮT BUỘC ĐỌC VÀ DỊCH TOÀN BỘ CỘT TRÁI (Cột 1) TỪ TRÊN XUỐNG DƯỚI TRƯỚC, rồi mới chuyển sang đọc CỘT PHẢI (Cột 2) từ trên xuống dưới.
     + TUYỆT ĐỐI KHÔNG ĐƯỢC NHẢY CỘT: Dù ở đầu Cột 1 có Hình ảnh (ví dụ Figure 10), Bảng biểu hay phương trình, bạn PHẢI dịch Hình ảnh đó và TẤT CẢ các đoạn văn, tiểu mục thảo luận bên dưới hình ở Cột 1 (ví dụ: tiểu mục thí nghiệm "Segmentation-Guided Inpainting...") TRƯỚC!
     + Không được thấy đề mục lớn ở Cột 2 (như "5. Limitations", "6. Conclusion") mà nhảy sang dịch Cột 2 trước.
     + Không được gom Hình ảnh hoặc các đoạn văn ở Cột 1 ném xuống sau mục Conclusion hay References của Cột 2.
   - TÍNH LIÊN TỤC VỀ MẠCH VĂN VÀ ĐỀ MỤC (LOGICAL FLOW):
     + Luôn kiểm tra tính liên tục logic của các đề mục: Nội dung của Mục 4 PHẢI nằm trước Mục 5, Mục 5 trước Mục 6, Mục 6 trước Mục 7, và Mục 7 trước References.
     + Nối dòng giữa 2 cột: Nếu dòng cuối cùng của Cột Trái kết thúc ngắt dở một câu hoặc một từ (ví dụ "...individual guid-"), hãy ghép liền với phần tiếp theo ở đầu Cột Phải (ví dụ "ance functions." -> "guidance functions.") để tạo thành câu hoàn chỉnh trước khi sang đề mục mới.
4. ĐỀ MỤC & ĐOẠN VĂN:
   - Dùng # cho Tiêu đề bài báo (tiếng Anh gốc), ## cho Section Heading (ví dụ: ## 1. Giới thiệu, ## 4.1. Kết quả cho Stable Diffusion, ## 5. Hạn chế, ## 6. Kết luận), ### cho Sub-section.
   - Dịch văn phong học thuật, tự nhiên, chính xác, liên kết chặt chẽ.
5. HÌNH ẢNH & BIỂU ĐỒ:
   - Khi gặp Hình ảnh hoặc Biểu đồ trong trang, hãy tạo block trích dẫn Markdown theo đúng vị trí xuất hiện của nó:
     > **Figure X**: <Tiêu đề caption tiếng Anh gốc của Figure X>
   - Nếu có các nhãn mô tả minh họa bên trong đồ họa, hãy liệt kê tương ứng (ví dụ: > *Masked Image* | *Clf. Guided*).
6. THUẬT TOÁN & MÃ GIẢ (ALGORITHMS):
   - Khi gặp khung thuật toán (Algorithm):
     + Dòng tiêu đề: **Algorithm X: <Tên thuật toán>**
     + Dòng tham số/yêu cầu: **Parameter:** ..., **Required:** ..., **Input:** ..., **Output:** ...
     + Khối mã giả (Pseudocode): Giữ từng dòng mã giả rõ ràng, thụt lề cấp lặp/rẽ nhánh bằng 4 khoảng trắng mỗi cấp.
     + TUYỆT ĐỐI KHÔNG xuất các lệnh LaTeX thô như \\quad, \\qquad ngoài cặp dấu $.
     + Mọi biểu thức toán, biến và phép gán PHẢI đặt trong cặp dấu $...$ (ví dụ: $z_{t-1} \\leftarrow S(z_t, \\hat{\\epsilon}_0, t)$).
     + In đậm các từ khóa điều khiển: **for**, **do**, **if**, **then**, **end if**, **end for**, **while**, **return**.

NHẮC LẠI BẮT BUỘC TRƯỚC KHI XUẤT KẾT QUẢ:
- Kiểm tra lại toàn bộ: TẤT CẢ các đoạn văn bản (ngoại trừ dòng caption Figure và danh từ riêng viết hoa) BẮT BUỘC ĐÃ ĐƯỢC DỊCH SANG ${targetLang}.
- Hãy trả về TRỰC TIẾP nội dung Markdown hoàn chỉnh bằng ${targetLang}, không bọc ngoài bằng \`\`\`markdown.`;
}

/**
 * Renders a PDF page to a high-resolution base64 JPEG string (scale = 2.0).
 */
export async function renderPageToBase64Jpeg(
  pdfDoc: PDFDocumentProxy,
  pageNumber: number,
  scale: number = 2.0,
): Promise<string> {
  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to create canvas 2D context for page render');
  }

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await (page.render as any)({
    canvasContext: ctx,
    viewport,
    canvas,
  }).promise;

  const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
  const base64 = dataUrl.split(',')[1];
  if (!base64) {
    throw new Error('Failed to encode rendered canvas to base64 JPEG');
  }
  return base64;
}

export const MAX_CACHED_PAPERS = 50;
export const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 ngày
export const VISION_REGISTRY_KEY = 'live_trans_vision_cache_registry';

export interface PaperRegistryEntry {
  url: string;
  lastAccessed: number;
  keys: string[];
}

export interface VisionCacheRegistry {
  version: 1;
  papers: Record<string, PaperRegistryEntry>;
}

function getSafeStorage(type: 'local' | 'session'): Storage | null {
  try {
    if (type === 'local' && typeof localStorage !== 'undefined') return localStorage;
    if (type === 'session' && typeof sessionStorage !== 'undefined') return sessionStorage;
  } catch {
    return null;
  }
  return null;
}

function loadRegistry(): VisionCacheRegistry {
  const ls = getSafeStorage('local');
  if (!ls) return { version: 1, papers: {} };
  try {
    const raw = ls.getItem(VISION_REGISTRY_KEY);
    if (!raw) return { version: 1, papers: {} };
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.papers === 'object') {
      return parsed;
    }
  } catch {
    // corrupted or unavailable
  }
  return { version: 1, papers: {} };
}

function saveRegistry(registry: VisionCacheRegistry): void {
  const ls = getSafeStorage('local');
  if (!ls) return;
  try {
    ls.setItem(VISION_REGISTRY_KEY, JSON.stringify(registry));
  } catch {
    // quota exceeded or blocked
  }
}

function removePaperKeys(entry: PaperRegistryEntry): void {
  const ls = getSafeStorage('local');
  const ss = getSafeStorage('session');
  for (const key of entry.keys) {
    if (ls) {
      try { ls.removeItem(key); } catch {}
    }
    if (ss) {
      try { ss.removeItem(key); } catch {}
    }
  }
}

/**
 * Quét dọn bộ nhớ đệm:
 * 1. Xóa các bài báo đã hết hạn TTL (14 ngày không truy cập).
 * 2. Thuật toán LRU: Giới hạn lưu trữ tối đa 50 bài báo gần nhất.
 */
export function pruneVisionCacheRegistry(registry?: VisionCacheRegistry): VisionCacheRegistry {
  const reg = registry || loadRegistry();
  const now = Date.now();

  // 1. Dọn dẹp các bài quá hạn 14 ngày
  for (const url of Object.keys(reg.papers)) {
    const entry = reg.papers[url];
    if (entry && now - entry.lastAccessed > CACHE_TTL_MS) {
      removePaperKeys(entry);
      delete reg.papers[url];
    }
  }

  // 2. Giới hạn LRU tối đa 50 bài báo gần nhất
  const paperList = Object.values(reg.papers).sort((a, b) => a.lastAccessed - b.lastAccessed);
  while (paperList.length > MAX_CACHED_PAPERS) {
    const oldest = paperList.shift();
    if (oldest) {
      removePaperKeys(oldest);
      delete reg.papers[oldest.url];
    }
  }

  saveRegistry(reg);
  return reg;
}

function getVisionCacheKey(pdfUrl: string, pageNumber: number, model: string): string {
  return `live_trans_pdf_vision_${encodeURIComponent(pdfUrl)}_p${pageNumber}_${model}`;
}

/**
 * Lấy bản dịch Vision AI từ bộ nhớ đệm bền vững (localStorage).
 * Hỗ trợ fallback nạp từ sessionStorage cũ nếu có và cập nhật LRU timestamp.
 */
export function getCachedVisionTranslation(
  pdfUrl: string,
  pageNumber: number,
  model: string = 'gemini-3.5-flash-lite',
): string | null {
  try {
    const key = getVisionCacheKey(pdfUrl, pageNumber, model);
    const ls = getSafeStorage('local');
    const ss = getSafeStorage('session');

    let val: string | null = null;
    if (ls) {
      val = ls.getItem(key);
    }
    if (!val && ss) {
      // Fallback kiểm tra sessionStorage
      val = ss.getItem(key);
      if (val && ls) {
        try {
          ls.setItem(key, val);
        } catch {}
      }
    }

    if (!val) return null;

    // Kiểm tra TTL theo registry
    const registry = loadRegistry();
    const entry = registry.papers[pdfUrl];
    if (entry) {
      if (Date.now() - entry.lastAccessed > CACHE_TTL_MS) {
        // Đã quá hạn 14 ngày
        removePaperKeys(entry);
        delete registry.papers[pdfUrl];
        saveRegistry(registry);
        return null;
      }
      // Gia hạn timestamp truy cập gần nhất (LRU freshening)
      entry.lastAccessed = Date.now();
      if (!entry.keys.includes(key)) {
        entry.keys.push(key);
      }
      saveRegistry(registry);
    } else {
      registry.papers[pdfUrl] = {
        url: pdfUrl,
        lastAccessed: Date.now(),
        keys: [key],
      };
      saveRegistry(registry);
    }

    return val;
  } catch {
    return null;
  }
}

/**
 * Lưu trữ bản dịch Vision AI vào bộ nhớ đệm bền vững (localStorage).
 * Tự động giải phóng dung lượng theo thuật toán LRU nếu bộ nhớ gần đầy.
 */
export function setCachedVisionTranslation(
  pdfUrl: string,
  pageNumber: number,
  markdown: string,
  model: string = 'gemini-3.5-flash-lite',
): void {
  const key = getVisionCacheKey(pdfUrl, pageNumber, model);
  const ls = getSafeStorage('local');
  const ss = getSafeStorage('session');

  const registry = loadRegistry();

  let stored = false;
  if (ls) {
    try {
      ls.setItem(key, markdown);
      stored = true;
    } catch {
      // QuotaExceededError -> Kích hoạt dọn dẹp LRU khẩn cấp
      const paperList = Object.values(registry.papers).sort((a, b) => a.lastAccessed - b.lastAccessed);
      while (paperList.length > 0 && !stored) {
        const oldest = paperList.shift();
        if (oldest && oldest.url !== pdfUrl) {
          removePaperKeys(oldest);
          delete registry.papers[oldest.url];
          try {
            ls.setItem(key, markdown);
            stored = true;
          } catch {}
        } else {
          break;
        }
      }
    }
  }

  // Fallback sang sessionStorage nếu localStorage vẫn đầy hoặc không khả dụng
  if (!stored && ss) {
    try {
      ss.setItem(key, markdown);
    } catch {}
  }

  // Cập nhật Registry
  let entry = registry.papers[pdfUrl];
  if (!entry) {
    entry = {
      url: pdfUrl,
      lastAccessed: Date.now(),
      keys: [],
    };
    registry.papers[pdfUrl] = entry;
  }
  entry.lastAccessed = Date.now();
  if (!entry.keys.includes(key)) {
    entry.keys.push(key);
  }

  // Cắt gọt theo định mức 50 bài & TTL 14 ngày
  pruneVisionCacheRegistry(registry);
}

/**
 * Xóa bản dịch Vision AI đã lưu trong bộ nhớ đệm bền vững.
 * Nếu truyền pageNumber: chỉ xóa các model của trang đó.
 * Nếu không truyền pageNumber: xóa toàn bộ bản dịch của tài liệu PDF đó.
 */
export function clearCachedVisionTranslation(pdfUrl: string, pageNumber?: number): void {
  try {
    const ls = getSafeStorage('local');
    const ss = getSafeStorage('session');
    const registry = loadRegistry();
    const entry = registry.papers[pdfUrl];

    if (pageNumber !== undefined) {
      const prefix = `live_trans_pdf_vision_${encodeURIComponent(pdfUrl)}_p${pageNumber}_`;

      if (ls) {
        const keysToRemove: string[] = [];
        for (let i = 0; i < ls.length; i++) {
          const k = ls.key(i);
          if (k && k.startsWith(prefix)) keysToRemove.push(k);
        }
        for (const k of keysToRemove) ls.removeItem(k);
      }

      if (ss) {
        const keysToRemove: string[] = [];
        for (let i = 0; i < ss.length; i++) {
          const k = ss.key(i);
          if (k && k.startsWith(prefix)) keysToRemove.push(k);
        }
        for (const k of keysToRemove) ss.removeItem(k);
      }

      if (entry) {
        entry.keys = entry.keys.filter((k) => !k.startsWith(prefix));
        if (entry.keys.length === 0) {
          delete registry.papers[pdfUrl];
        }
        saveRegistry(registry);
      }
    } else {
      const prefix = `live_trans_pdf_vision_${encodeURIComponent(pdfUrl)}_`;

      if (entry) {
        removePaperKeys(entry);
        delete registry.papers[pdfUrl];
      }

      if (ls) {
        const keysToRemove: string[] = [];
        for (let i = 0; i < ls.length; i++) {
          const k = ls.key(i);
          if (k && k.startsWith(prefix)) keysToRemove.push(k);
        }
        for (const k of keysToRemove) ls.removeItem(k);
      }

      if (ss) {
        const keysToRemove: string[] = [];
        for (let i = 0; i < ss.length; i++) {
          const k = ss.key(i);
          if (k && k.startsWith(prefix)) keysToRemove.push(k);
        }
        for (const k of keysToRemove) ss.removeItem(k);
      }

      saveRegistry(registry);
    }
  } catch {
    // storage unavailable
  }
}

/**
 * Xóa sạch toàn bộ cache Vision AI của tất cả các bài báo.
 */
export function clearAllVisionCache(): void {
  try {
    const ls = getSafeStorage('local');
    const ss = getSafeStorage('session');
    const registry = loadRegistry();

    for (const entry of Object.values(registry.papers)) {
      removePaperKeys(entry);
    }

    if (ls) {
      const doomed: string[] = [];
      for (let i = 0; i < ls.length; i++) {
        const k = ls.key(i);
        if (k && (k.startsWith('live_trans_pdf_vision_') || k === VISION_REGISTRY_KEY)) {
          doomed.push(k);
        }
      }
      for (const k of doomed) ls.removeItem(k);
    }

    if (ss) {
      const doomed: string[] = [];
      for (let i = 0; i < ss.length; i++) {
        const k = ss.key(i);
        if (k && k.startsWith('live_trans_pdf_vision_')) {
          doomed.push(k);
        }
      }
      for (const k of doomed) ss.removeItem(k);
    }
  } catch {}
}

/**
 * Lấy số liệu thống kê cache hiện tại.
 */
export function getVisionCacheStats(): { paperCount: number; maxPapers: number; ttlDays: number } {
  try {
    const registry = pruneVisionCacheRegistry();
    return {
      paperCount: Object.keys(registry.papers).length,
      maxPapers: MAX_CACHED_PAPERS,
      ttlDays: Math.round(CACHE_TTL_MS / (24 * 60 * 60 * 1000)),
    };
  } catch {
    return { paperCount: 0, maxPapers: MAX_CACHED_PAPERS, ttlDays: 14 };
  }
}

/**
 * Detects whether markdown contains untranslated English paragraphs or headings.
 * Ignores:
 * - LaTeX display equations ($$...$$) and inline math ($...$)
 * - Figure caption quote blocks (> **Figure X**: ...)
 * - Algorithm structure lines
 * - Bibliography / References entries
 */
export function detectEnglishInMarkdown(markdown: string): boolean {
  const lines = markdown.split('\n');
  let englishBlockCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Ignore display equations, blockquotes / figure captions, horizontal rules
    if (
      trimmed.startsWith('$$') ||
      trimmed.startsWith('>') ||
      trimmed.startsWith('---') ||
      trimmed.startsWith('***') ||
      /^[A-Z][a-z]+,\s+[A-Z]\./.test(trimmed) // Author citations: "Austin, J. D."
    ) {
      continue;
    }

    // Ignore algorithm headers or parameters
    if (/^\*{0,2}(Algorithm|Thuật\s*toán|Parameter|Required|Input|Output)/i.test(trimmed)) {
      continue;
    }

    // Strip inline math $...$ and markdown formatting
    const cleanText = trimmed
      .replace(/\$[^$]+\$/g, '')
      .replace(/[*#_`]/g, '')
      .trim();
    if (cleanText.length < 25) continue;

    // Check for Vietnamese diacritics
    const hasVietnameseDiacritics = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i.test(cleanText);

    // Common English words frequently present in scientific papers
    const englishWordMatches = cleanText.match(
      /\b(the|and|in|of|to|is|that|with|for|we|our|as|are|this|from|by|on|be|an|was|which|can|show|shows|using|algorithm|guidance|generation|results|demonstrate|method|proposed|paper|loss|models|diffusion|gradient|empirically|solve|equation|equations|table|figure)\b/gi,
    );

    if (!hasVietnameseDiacritics && (englishWordMatches?.length || 0) >= 2) {
      englishBlockCount++;
    }
  }

  return englishBlockCount >= 1;
}

/**
 * Verification Agent: Checks whether the output contains any untranslated English.
 * If detected, invokes a pure text translation pass (with no visual anchor) to repair
 * the paragraphs into academic Vietnamese while strictly preserving LaTeX math and figures.
 */
export async function verifyAndRepairTranslation(
  markdown: string,
  settings: Settings,
): Promise<string> {
  if (!detectEnglishInMarkdown(markdown)) {
    return markdown;
  }

  console.info('[Live-Trans Vision] Verification Agent: Untranslated English detected. Running text repair pass...');

  const targetLang = settings.targetLang === 'vi' || !settings.targetLang ? 'tiếng Việt' : settings.targetLang;
  const prompt = `Bạn là chuyên gia dịch thuật bài báo khoa học AI/Deep Learning.
Nhiệm vụ: Bản dịch Markdown dưới đây bị sót/chưa dịch các đoạn văn tiếng Anh. Hãy dịch toàn bộ các đoạn văn bản, tiêu đề đề mục (#, ##, ###) tiếng Anh sang ${targetLang} học thuật chuẩn xác, lưu loát và tự nhiên.

QUY TẮC BẮT BUỘC:
1. Dịch toàn bộ các đoạn văn và tiêu đề đề mục (#, ##, ###) sang ${targetLang}.
2. Giữ NGUYÊN 100% mọi công thức toán học $...$ và $$...$$ cùng các nhãn số thứ tự phương trình (ví dụ \\quad (6)).
3. Giữ NGUYÊN dòng trích dẫn caption hình ảnh: > **Figure X**: ... (giữ nguyên tiếng Anh cho caption hình).
4. Giữ NGUYÊN khối thuật toán nếu có: **Algorithm X: ...**, **Parameter:** ..., **Required:** ..., các từ khóa **for**, **do**, **if**, **then**, **end if**, v.v.
5. Giữ nguyên tên mô hình, thuật ngữ viết hoa: Diffusion Models, Stable Diffusion, ResNet, Faster-RCNN, MTCNN, Facenet, DDIM, CLIP.
6. Trả về TRỰC TIẾP định dạng Markdown hoàn chỉnh bằng ${targetLang}, TUYỆT ĐỐI không bọc ngoài bằng \`\`\`markdown.

Nội dung Markdown cần hoàn thiện:
${markdown}`;

  // 1. If user configured Zen (OpenCode Zen), try Zen first
  if (settings.pdfProvider === 'zen') {
    const zenKey = getZenKey(settings);
    if (zenKey) {
      const model = settings.pdfModel?.trim() || 'muse-spark-1.2-contributor-free';
      const useResponses = isZenResponsesModel(model);
      const url = useResponses ? `${ZEN_BASE_URL}/responses` : `${ZEN_BASE_URL}/chat/completions`;
      const body = useResponses
        ? { model, input: prompt }
        : {
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
          };

      try {
        const res = await fetchWithRetry(
          url,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${zenKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          },
          { timeoutMs: 90_000 },
        );

        if (res.ok) {
          const json = await res.json();
          let text = useResponses ? parseZenResponsesText(json) : parseZenChatText(json);
          text = text.replace(/^```(?:markdown)?\s*/i, '').replace(/\s*```$/, '').trim();
          if (text && text.length > 50) {
            return text;
          }
        }
      } catch (zenErr) {
        console.warn('[Live-Trans Vision] Zen repair failed, falling back to Gemini:', zenErr);
      }
    }
  }

  // 2. Fallback / Default: Gemini text translation pass
  const router = getKeyRouter(getProviderKeys(settings, 'gemini'));
  if (router.keyCount > 0) {
    try {
      const repaired = await router.execute(async (activeApiKey) => {
        const url = `${BASE_URL}/models/gemini-3.5-flash-lite:generateContent`;
        const res = await fetchWithRetry(
          url,
          {
            method: 'POST',
            headers: {
              'x-goog-api-key': activeApiKey.trim(),
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generation_config: { temperature: 0.1, max_output_tokens: 8192 },
            }),
          },
          { timeoutMs: 90_000 },
        );

        if (!res.ok) {
          throw new Error(`Gemini Text API error: ${res.status}`);
        }

        const json = await res.json();
        let text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        text = text.replace(/^```(?:markdown)?\s*/i, '').replace(/\s*```$/, '').trim();
        return text;
      });

      if (repaired && repaired.length > 50) {
        return repaired;
      }
    } catch (geminiErr) {
      console.warn('[Live-Trans Vision] Gemini repair failed:', geminiErr);
    }
  }

  return markdown;
}

/**
 * Translates a PDF page using Multimodal Vision AI into Markdown + LaTeX.
 */
export async function translatePageVision(
  pageNumber: number,
  pdfDoc: PDFDocumentProxy,
  pdfUrl: string,
  settings: Settings,
  force: boolean = false,
): Promise<string> {
  const modelToUse = settings.pdfModel?.includes('flash')
    ? settings.pdfModel
    : 'gemini-3.5-flash-lite';

  if (!force) {
    const cached = getCachedVisionTranslation(pdfUrl, pageNumber, modelToUse);
    if (cached) {
      return cached;
    }
  }

  const router = getKeyRouter(getProviderKeys(settings, 'gemini'));
  if (router.keyCount === 0) {
    throw new Error('Chưa cấu hình Gemini API Key. Vui lòng vào Cài đặt để nhập API Key.');
  }

  // 1. Render page to sharp 2x JPEG image
  const base64Image = await renderPageToBase64Jpeg(pdfDoc, pageNumber, 2.0);
  const prompt = buildVisionPrompt(settings.targetLang || 'Tiếng Việt');

  const modelsToTry = [modelToUse, ...VISION_CANDIDATE_MODELS.filter((m) => m !== modelToUse)];
  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      const result = await router.execute(async (activeApiKey) => {
        const url = `${BASE_URL}/models/${model}:generateContent`;
        const payload = {
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inline_data: {
                    mime_type: 'image/jpeg',
                    data: base64Image,
                  },
                },
                {
                  text: prompt,
                },
              ],
            },
          ],
          generation_config: {
            temperature: force ? 0.45 : 0.2,
            max_output_tokens: 8192,
          },
        };

        const res = await fetchWithRetry(
          url,
          {
            method: 'POST',
            headers: {
              'x-goog-api-key': activeApiKey.trim(),
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          },
          { timeoutMs: 90_000 },
        );

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Gemini API ${res.status}: ${errText.slice(0, 300)}`);
        }

        const json = await res.json();
        let text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        text = text.replace(/^```(?:markdown)?\s*/i, '').replace(/\s*```$/, '').trim();
        return text;
      });

      if (result) {
        // Run Verification Agent: automatically repairs any language drift or untranslated blocks
        const verifiedResult = await verifyAndRepairTranslation(result, settings);
        setCachedVisionTranslation(pdfUrl, pageNumber, verifiedResult, model);
        return verifiedResult;
      }
    } catch (err) {
      lastError = err;
      console.warn(`[Live-Trans Vision] Model ${model} failed for page ${pageNumber}:`, err);
    }
  }

  throw lastError || new Error(`Không thể dịch trang ${pageNumber} bằng mô hình thị giác.`);
}
