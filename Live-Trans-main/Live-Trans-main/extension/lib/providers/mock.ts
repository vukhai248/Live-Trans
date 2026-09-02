import type { Transcript, Word } from '../asr/types';
import type { GlossaryTerm } from '../glossary/types';
import type { Settings } from '../settings';
import type {
  Provider,
  TranslateBatchRequest,
  TranslateBatchResponse,
  TranscribeRequest,
} from './provider';

/**
 * Offline demo provider so the whole extension — capture pipeline, TSR
 * validation, subtitle overlay, title translation — runs without a Gemini key.
 * Replacing it with DirectGemini looks identical from the pipeline's point of
 * view because both implement `Provider`.
 */

const DEMO_SCRIPT = [
  'Welcome to this introduction to machine learning. Today we look at gradient descent and how it minimizes the loss.',
  'A common problem when you train too long is overfitting. Your model memorizes the data instead of learning the pattern.',
  'Now run the app with npm run start and inspect the component that uses the useEffect hook.',
  'The transformer architecture changed natural language processing entirely. In short, attention is all you need.',
  'So to summarize, watch the learning rate, keep your data clean, and always validate on a separate test set.',
];

const DEMO_TITLE_EN = 'Machine Learning Fundamentals: Building Your First Model';
const DEMO_TITLE_VI = 'Nền tảng học máy: Xây dựng mô hình đầu tiên của bạn';

// Small phrase dictionary so demo translations look like Vietnamese, not just
// swapped jargon. Everything else is kept as-is (honest mock, not fake MT).
const DICT: Record<string, string> = {
  welcome: 'chào mừng',
  introduction: 'giới thiệu',
  today: 'hôm nay',
  'we look': 'chúng ta tìm hiểu',
  'it minimizes': 'nó tối thiểu hóa',
  common: 'thường gặp',
  problem: 'vấn đề',
  'when you train': 'khi bạn huấn luyện',
  'too long': 'quá lâu',
  model: 'mô hình',
  memorizes: 'ghi nhớ',
  data: 'dữ liệu',
  instead: 'thay vì',
  learning: 'học',
  pattern: 'khuôn mẫu',
  'now run': 'giờ hãy chạy',
  'the app': 'ứng dụng',
  'with ': 'bằng ',
  'and inspect': 'và kiểm tra',
  component: 'thành phần',
  'that uses': 'sử dụng',
  hook: 'hook',
  architecture: 'kiến trúc',
  changed: 'đã thay đổi',
  'natural language processing': 'xử lý ngôn ngữ tự nhiên',
  entirely: 'hoàn toàn',
  'in short': 'nói ngắn gọn',
  'attention is all you need': 'sự chú ý là tất cả những gì bạn cần',
  'so to summarize': 'tóm lại',
  'watch the learning rate': 'hãy chú ý tốc độ học',
  'keep your data clean': 'giữ dữ liệu sạch',
  'and always validate': 'và luôn kiểm định',
  'on a separate test set': 'trên tập kiểm tra riêng',
  'the loss': 'hàm mất mát',
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function mockTranslate(masked: string, terms: GlossaryTerm[]): string {
  let out = masked;
  // Jargon → authoritative translation (keeps TSR valid).
  for (const t of terms) {
    if (t.type !== 'jargon' || !t.vi) continue;
    out = out.replace(new RegExp(escapeRegExp(t.term), 'g'), t.vi);
  }
  // Light dictionary pass (word boundaries, case-insensitive) for realism.
  for (const [en, vi] of Object.entries(DICT)) {
    out = out.replace(new RegExp(escapeRegExp(en), 'gi'), vi);
  }
  return out.replace(/\s+/g, ' ').trim();
}

export function mockTranslateTitle(title: string): string {
  if (title.trim().toLowerCase().includes(DEMO_TITLE_EN.toLowerCase()))
    return DEMO_TITLE_VI;
  return `[demo] ${title}`;
}

export class MockProvider implements Provider {
  readonly mode = 'demo' as const;
  private chunkIndex = 0;

  async transcribe(_req: TranscribeRequest, _settings: Settings): Promise<Transcript> {
    const text = DEMO_SCRIPT[this.chunkIndex % DEMO_SCRIPT.length]!;
    this.chunkIndex += 1;
    const words: Word[] = text.split(/\s+/).map((t, i) => ({
      text: t,
      startMs: i * 400,
      endMs: (i + 1) * 400,
    }));
    await delay(300);
    return { id: `mock-${this.chunkIndex}`, text, words, language: 'en' };
  }

  async translate(
    req: TranslateBatchRequest,
    _settings: Settings,
  ): Promise<TranslateBatchResponse> {
    await delay(120);
    return {
      translations: req.units.map((u) => ({
        text: mockTranslate(u.masked, req.selectedTerms),
        termsUsed: [],
      })),
    };
  }

  async translateTitle(title: string, _settings: Settings): Promise<string> {
    await delay(100);
    return mockTranslateTitle(title);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
