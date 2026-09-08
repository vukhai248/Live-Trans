import type { ViewMode } from '@/lib/pdf/types';

export type ReaderMode = 'whiteboard' | 'vision' | 'markdown' | 'overlay';

export interface PageNavigatorProps {
  currentPage: number;
  numPages: number;
  onPageChange: (page: number) => void;
}

export interface ModeSelectorDropdownProps {
  readerMode: ReaderMode;
  onChangeReaderMode: (mode: ReaderMode) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  onClose: () => void;
}

export interface ViewerToolbarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  docTitle: string;
  viewMode: ViewMode;
  onChangeViewMode: (mode: ViewMode) => void;
  onResetSplitRatio: () => void;
  readerMode: ReaderMode;
  onChangeReaderMode: (mode: ReaderMode) => void;
  isModeMenuOpen: boolean;
  onToggleModeMenu: () => void;
  onCloseModeMenu: () => void;
  currentPage: number;
  numPages: number;
  onPageChange: (page: number) => void;
  onRetranslateAll: () => void;
  onOpenSettings: () => void;
}
