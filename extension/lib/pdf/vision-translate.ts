import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { Settings } from '../settings';
import { fetchWithRetry } from '../providers/fetch-retry';
import { getKeyRouter } from '../providers/key-router';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const VISION_CANDIDATE_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];

/**
 * Builds the specialized Academic Multimodal Paper Translation Prompt
 */
function buildVisionPrompt(targetLang: string): string {
  return `Bạn là một dịch giả và nhà khoa học máy tính hàng đầu thế giới, chuyên dịch các bài báo nghiên cứu khoa học (Arxiv, CVPR, NeurIPS, ICML).

Dưới đây là hình ảnh chụp một trang bài báo nghiên cứu khoa học.

NHIỆM VỤ:
Hãy đọc nội dung từ hình ảnh và dịch toàn bộ nội dung của trang này sang ${targetLang} dưới định dạng MARKDOWN HỌC THUẬT CHUẨN XÁC CAO.

QUY TẮC CÔNG THỨC TOÁN & LATEX (QUAN TRỌNG NHẤT):
1. Mọi công thức toán học, biến số nội dòng PHẢI được viết bằng mã LaTeX chuẩn trong cặp dấu $:
   - Ví dụ: $z_{t-1} = S(z_t, \\hat{\\epsilon}_t, t)$, $\\epsilon' \\sim \\mathcal{N}(0, \\mathbf{I})$, $z_t'$, $z_0$, $\\alpha_t$, $t=1$.
   - Giữ nguyên các ký hiệu Hy Lạp: $\\epsilon$, $\\alpha$, $\\beta$, $\\sigma$, $\\lambda$, v.v.
   - TUYỆT ĐỐI KHÔNG để sót ký tự rác, không dùng ô vuông □ hay text thô cho công thức toán.
2. Với phương trình hiển thị độc lập (display equations):
   - Đặt trong cặp dấu $$...$$ và giữ nguyên số thứ tự phương trình nếu có (ví dụ \\quad (10)):
     $$z_t' = \\sqrt{\\alpha_t / \\alpha_{t-1}} \\cdot z_{t-1} + \\sqrt{1 - \\alpha_t / \\alpha_{t-1}} \\cdot \\epsilon' \\quad (10)$$

QUY TẮC BỐ CỤC & HÌNH ẢNH:
3. TIÊU ĐỀ & ĐOẠN VĂN:
   - Dùng # cho Tiêu đề bài báo, ## cho Section Heading (ví dụ: ## 4.1. Kết quả cho Stable Diffusion), ### cho Sub-section.
   - Dịch văn phong học thuật, tự nhiên, chính xác, liên kết chặt chẽ.
4. HÌNH ẢNH & BIỂU ĐỒ:
   - Khi gặp Hình ảnh hoặc Biểu đồ trong trang, hãy tạo block trích dẫn Markdown mô tả rõ ràng:
     > **[Hình X]**: <Bản dịch đầy đủ mô tả caption của Hình X>
   - Nếu có các nhãn mô tả minh họa bên trong đồ họa, hãy liệt kê dịch tương ứng (ví dụ: *Conditional Stable-Diffusion*: Khuếch tán ổn định có điều kiện).

Hãy trả về TRỰC TIẾP nội dung Markdown hoàn chỉnh, không bọc ngoài bằng \`\`\`markdown.`;
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

function getVisionCacheKey(pdfUrl: string, pageNumber: number, model: string): string {
  return `live_trans_pdf_vision_${encodeURIComponent(pdfUrl)}_p${pageNumber}_${model}`;
}

export function getCachedVisionTranslation(
  pdfUrl: string,
  pageNumber: number,
  model: string = 'gemini-2.5-flash',
): string | null {
  try {
    const key = getVisionCacheKey(pdfUrl, pageNumber, model);
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setCachedVisionTranslation(
  pdfUrl: string,
  pageNumber: number,
  markdown: string,
  model: string = 'gemini-2.5-flash',
): void {
  try {
    const key = getVisionCacheKey(pdfUrl, pageNumber, model);
    sessionStorage.setItem(key, markdown);
  } catch {
    // sessionStorage quota full or blocked
  }
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
    : VISION_CANDIDATE_MODELS[0]!;

  if (!force) {
    const cached = getCachedVisionTranslation(pdfUrl, pageNumber, modelToUse);
    if (cached) {
      return cached;
    }
  }

  const router = getKeyRouter(settings.apiKey);
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
            temperature: 0.2,
            max_output_tokens: 4096,
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
        text = text.replace(/^\`\`\`(?:markdown)?\\s*/i, '').replace(/\\s*\`\`\`$/, '').trim();
        return text;
      });

      if (result) {
        setCachedVisionTranslation(pdfUrl, pageNumber, result, model);
        return result;
      }
    } catch (err) {
      lastError = err;
      console.warn(`[Live-Trans Vision] Model ${model} failed for page ${pageNumber}:`, err);
    }
  }

  throw lastError || new Error(`Không thể dịch trang ${pageNumber} bằng mô hình thị giác.`);
}
