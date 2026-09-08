import type { Settings, PdfProvider, ApiKeyItem } from '@/lib/settings';

export type SettingsTab = 'appearance' | 'models' | 'performance';

export interface AppearanceTabProps {
  settings: Settings;
  onUpdateSettingDirect: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}

export interface ModelsTabProps {
  settings: Settings;
  onUpdateSettingDirect: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  keyItems: ApiKeyItem[];
  modalProviderKeys: ApiKeyItem[];
  newKeyProvider: PdfProvider;
  onSetNewKeyProvider: (provider: PdfProvider) => void;
  newKeyText: string;
  onSetNewKeyText: (text: string) => void;
  onAddKey: () => void;
  onRemoveKey: (id: string) => void;
  triggerAutoSaveBadge?: () => void;
}

export interface PerformanceTabProps {
  settings: Settings;
  onUpdateSettingDirect: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  onRetranslateAll: () => void;
  onCloseModal?: () => void;
}

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onUpdateSettingDirect: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  keyItems: ApiKeyItem[];
  modalProviderKeys: ApiKeyItem[];
  newKeyProvider: PdfProvider;
  onSetNewKeyProvider: (provider: PdfProvider) => void;
  newKeyText: string;
  onSetNewKeyText: (text: string) => void;
  onAddKey: () => void;
  onRemoveKey: (id: string) => void;
  onRetranslateAll: () => void;
  showAutoSaveBadge: boolean;
  triggerAutoSaveBadge?: () => void;
}

export interface PostSavePromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: number;
  onRetryCurrentPage: (pageNumber: number) => void;
  onRetranslateAll: () => void;
  onContinueReading: () => void;
}

export interface ApiKeyWarningBannerProps {
  hasActiveKey: boolean;
  provider: PdfProvider;
  onOpenSettings: () => void;
}
