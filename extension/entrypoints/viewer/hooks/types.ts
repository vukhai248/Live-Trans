import type { RefObject } from 'preact';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { ViewMode } from '@/lib/pdf/types';
import type { Settings, PdfProvider, ApiKeyItem } from '@/lib/settings';
import type { ReaderMode } from '../components/Toolbar/types';

// 1. Hook: usePdfDocument
export interface UsePdfDocumentOptions {
  leftPaneRef?: RefObject<HTMLElement | null>;
  rightPaneRef?: RefObject<HTMLElement | null>;
  splitRatio?: number;
  sidebarOpen?: boolean;
  isSidebarPinned?: boolean;
  viewMode?: ViewMode;
}

export interface UsePdfDocumentReturn {
  pdfUrl: string;
  docTitle: string;
  pdfDoc: PDFDocumentProxy | null;
  numPages: number;
  errorMsg: string;
  leftFitScale: number;
  rightFitScale: number;
  calculatePaneFitScale: (pane: HTMLElement | null) => number;
}

// 2. Hook: useSettingsManager
export interface UseSettingsManagerReturn {
  settings: Settings;
  updateSettingDirect: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  showAutoSaveBadge: boolean;
  triggerAutoSaveBadge: () => void;
  keyItems: ApiKeyItem[];
  newKeyProvider: PdfProvider;
  setNewKeyProvider: (provider: PdfProvider) => void;
  newKeyText: string;
  setNewKeyText: (text: string) => void;
  handleAddKey: () => void;
  handleRemoveKey: (id: string) => void;
  hasActiveKey: boolean;
  modalProviderKeys: ApiKeyItem[];
  isPostSavePromptOpen: boolean;
  setIsPostSavePromptOpen: (open: boolean) => void;
}

// 3. Hook: useVisionWorkerQueue
export interface UseVisionWorkerQueueOptions {
  pdfDoc: PDFDocumentProxy | null;
  pdfUrl: string;
  numPages: number;
  currentPage: number;
  settings: Settings;
  readerMode: ReaderMode;
  hasActiveKey: boolean;
}

export interface UseVisionWorkerQueueReturn {
  pageVisionTranslations: Record<number, string>;
  pageVisionStatus: Record<number, 'loading' | 'done' | 'error' | 'queued'>;
  pageVisionErrors: Record<number, string>;
  activePriorityPages: number[];
  pendingPriorityPages: number[];
  prioritizeVisionPage: (pageNumber: number, force?: boolean) => void;
  debouncedPrioritizePage: (pageNumber: number, force?: boolean) => void;
  retryVisionPage: (pageNumber: number) => void;
  retranslateAllVision: () => void;
  processVisionQueue: () => void;
}

// 4. Hook: useSyncScroll
export interface UseSyncScrollOptions {
  viewMode: ViewMode;
  readerMode: ReaderMode;
  numPages: number;
  splitRatio: number;
  sidebarOpen: boolean;
  isSidebarPinned: boolean;
  pdfDoc: PDFDocumentProxy | null;
  leftFitScale?: number;
  rightFitScale?: number;
  onPageChange?: (pageNumber: number) => void;
  onPrioritizePage?: (pageNumber: number) => void;
}

export interface UseSyncScrollReturn {
  leftPaneRef: RefObject<HTMLDivElement>;
  rightPaneRef: RefObject<HTMLDivElement>;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  leftZoomFactor: number;
  rightZoomFactor: number;
  effectiveLeftScale: number;
  effectiveRightScale: number;
  setLeftZoomFactor: (zoom: number | ((prev: number) => number)) => void;
  setRightZoomFactor: (zoom: number | ((prev: number) => number)) => void;
  handleLeftScroll: () => void;
  handleRightScroll: () => void;
  scrollToPage: (pageNumber: number) => void;
  resetZoom: () => void;
}
