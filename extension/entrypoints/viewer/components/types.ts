import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { TextBlock, TranslatedBlock } from '@/lib/pdf/types';

export interface SidebarDrawerProps {
  isOpen: boolean;
  isPinned: boolean;
  numPages: number;
  currentPage: number;
  onSelectPage: (pageNumber: number) => void;
  onTogglePin: () => void;
  onClose?: () => void;
  pageVisionStatus?: Record<number, 'loading' | 'done' | 'error' | 'queued'>;
  pageStatus?: Record<number, 'loading' | 'done' | 'error'>;
  readerMode?: 'whiteboard' | 'vision' | 'markdown' | 'overlay';
  activePriorityPages?: number[];
  pendingPriorityPages?: number[];
}

export interface DraggableSplitterProps {
  splitRatio?: number;
  isDragging?: boolean;
  onMouseDown?: (e: MouseEvent) => void;
  onReset5050?: () => void;
  onPointerDown?: (e: PointerEvent) => void;
  onSplitRatioChange?: (ratio: number) => void;
}

export interface PageRendererProps {
  pdfDoc: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  blocks?: (TextBlock | TranslatedBlock)[];
  hoveredSentenceId?: string | null;
  onHoverSentence?: (id: string | null) => void;
  onVisible?: (pageNumber: number) => void;
}

export interface FlowBlockProps {
  b?: TextBlock | TranslatedBlock;
  block?: TextBlock | TranslatedBlock;
  scale: number;
  hoveredSentenceId?: string | null;
  onHoverSentence?: (id: string | null) => void;
}
