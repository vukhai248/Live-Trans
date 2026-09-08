import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  loadSettings,
  saveSettings,
  DEFAULT_SETTINGS,
  DEFAULT_PDF_MODEL,
  PDF_GEMINI_MODELS,
  PDF_ZEN_MODELS,
  type Settings,
  type PdfProvider,
  type ApiKeyItem,
  getProviderKeys,
} from '@/lib/settings';
import type { UseSettingsManagerReturn } from './types';

export function useSettingsManager(): UseSettingsManagerReturn {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [showAutoSaveBadge, setShowAutoSaveBadge] = useState<boolean>(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [keyItems, setKeyItems] = useState<ApiKeyItem[]>([]);
  const [newKeyProvider, setNewKeyProvider] = useState<PdfProvider>('gemini');
  const [newKeyText, setNewKeyText] = useState<string>('');
  const [isPostSavePromptOpen, setIsPostSavePromptOpen] = useState<boolean>(false);

  // Kích hoạt huy hiệu tự động lưu với timer tự tắt sau 1800ms
  const triggerAutoSaveBadge = useCallback(() => {
    setShowAutoSaveBadge(true);
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      setShowAutoSaveBadge(false);
    }, 1800);
  }, []);

  // Cập nhật tức thời setting và đồng bộ chrome.storage.local
  const updateSettingDirect = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        void saveSettings(next);
        return next;
      });
      triggerAutoSaveBadge();
    },
    [triggerAutoSaveBadge],
  );

  // Đóng modal cài đặt khi bấm phím Escape
  useEffect(() => {
    if (!isSettingsOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSettingsOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSettingsOpen]);

  // Khởi tạo cài đặt từ chrome.storage.local
  useEffect(() => {
    void (async () => {
      const s = await loadSettings();
      // Chuẩn hoá model theo provider (settings cũ có thể lưu model lạ).
      const validModels =
        s.pdfProvider === 'zen' ? PDF_ZEN_MODELS : PDF_GEMINI_MODELS;
      if (!(validModels as readonly string[]).includes(s.pdfModel)) {
        s.pdfModel = DEFAULT_PDF_MODEL[s.pdfProvider];
      }
      setSettings(s);
      setKeyItems(s.apiKeys || []);
      setNewKeyProvider(s.pdfProvider);
    })();
  }, []);

  // Dọn dẹp timer khi component unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // Danh sách key đang hoạt động cho provider hiện tại
  const activeProviderKeys = useMemo(() => {
    return getProviderKeys(settings, settings.pdfProvider);
  }, [settings]);

  const hasActiveKey = activeProviderKeys.length > 0;

  // Lọc danh sách keys hiển thị trong modal theo provider đang chọn
  const modalProviderKeys = useMemo(() => {
    return keyItems.filter((k) => k.provider === settings.pdfProvider);
  }, [keyItems, settings.pdfProvider]);

  // Thêm API key mới vào danh sách
  const handleAddKey = useCallback(() => {
    const trimmed = newKeyText.trim();
    if (!trimmed) return;
    if (keyItems.some((k) => k.key === trimmed)) {
      alert('API Key này đã tồn tại trong danh sách!');
      return;
    }
    const newItem: ApiKeyItem = {
      id: `${newKeyProvider}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      provider: newKeyProvider,
      key: trimmed,
      createdAt: Date.now(),
    };
    const updatedKeys = [...keyItems, newItem];
    setKeyItems(updatedKeys);
    const geminiKeys = updatedKeys.filter((k) => k.provider === 'gemini').map((k) => k.key.trim());
    const zenKeys = updatedKeys.filter((k) => k.provider === 'zen').map((k) => k.key.trim());
    const next: Settings = {
      ...settings,
      apiKeys: updatedKeys,
      apiKey: geminiKeys[0] || '',
      zenApiKey: zenKeys[0] || '',
    };
    setSettings(next);
    void saveSettings(next);
    setNewKeyText('');
    triggerAutoSaveBadge();
  }, [keyItems, newKeyProvider, newKeyText, settings, triggerAutoSaveBadge]);

  // Xóa API key khỏi danh sách
  const handleRemoveKey = useCallback(
    (id: string) => {
      const updatedKeys = keyItems.filter((k) => k.id !== id);
      setKeyItems(updatedKeys);
      const geminiKeys = updatedKeys.filter((k) => k.provider === 'gemini').map((k) => k.key.trim());
      const zenKeys = updatedKeys.filter((k) => k.provider === 'zen').map((k) => k.key.trim());
      const next: Settings = {
        ...settings,
        apiKeys: updatedKeys,
        apiKey: geminiKeys[0] || '',
        zenApiKey: zenKeys[0] || '',
      };
      setSettings(next);
      void saveSettings(next);
      triggerAutoSaveBadge();
    },
    [keyItems, settings, triggerAutoSaveBadge],
  );

  return {
    settings,
    updateSettingDirect,
    isSettingsOpen,
    setIsSettingsOpen,
    showAutoSaveBadge,
    triggerAutoSaveBadge,
    keyItems,
    newKeyProvider,
    setNewKeyProvider,
    newKeyText,
    setNewKeyText,
    handleAddKey,
    handleRemoveKey,
    hasActiveKey,
    modalProviderKeys,
    isPostSavePromptOpen,
    setIsPostSavePromptOpen,
  };
}
