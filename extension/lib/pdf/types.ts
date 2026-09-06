export type ViewMode = 'bilingual' | 'translated' | 'original';

export interface SentenceItem {
  id: string;
  text: string;
  translation?: string;
  isFormula?: boolean;
}

export type ComponentType =
  | 'title'
  | 'authors'
  | 'abstract'
  | 'heading'
  | 'paragraph'
  | 'equation'
  | 'algorithm'
  | 'figure_caption'
  | 'reference'
  | 'footnote'
  | 'header'
  | 'footer';

export interface TextBlock {
  /** Unique ID per page, e.g. "p1_b0" */
  id: string;
  /** Page number (1-indexed) */
  page: number;
  /** [x, y, width, height] in PDF user space units (pt) */
  bbox: [number, number, number, number];
  /** Original text content (lines joined by space or newline) */
  text: string;
  /** Sentence-level items for precision hover tracking & translation */
  sentences: SentenceItem[];
  /** True if majority of text is bold */
  bold?: boolean;
  /** Approximate font size in pt */
  fontSize?: number;
  /** Line count */
  lineCount?: number;
  /** Column indicator: 0 = full-width/header, 1 = left, 2 = right */
  col?: number;
  /** Semantic component classification */
  componentType?: ComponentType;
  /** True if this block is a mathematical equation or formula */
  isFormula?: boolean;
  /** True if this block is an algorithm pseudocode box */
  isAlgorithm?: boolean;
  /** True if this block is a section heading or title */
  isHeading?: boolean;
  /** True if this block is a footnote block */
  isFootnote?: boolean;
  /** True if this block is a running page header */
  isHeader?: boolean;
  /** True if this block is a running page footer or footnote */
  isFooter?: boolean;
}

export interface TranslatedBlock extends TextBlock {
  translation: string;
}

export interface PageTranslationResult {
  page: number;
  blocks: TranslatedBlock[];
  fromCache?: boolean;
  /** P2: số câu phải giữ nguyên văn do rớt dịch (UTB — thay vì giấu im lặng) */
  untranslatedCount?: number;
}
