import { useEffect, useState } from 'preact/hooks';
import type { SettingsModalProps, SettingsTab } from './types';
import { AppearanceTab } from './AppearanceTab';
import { ModelsTab } from './ModelsTab';
import { PerformanceTab } from './PerformanceTab';

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettingDirect,
  keyItems,
  modalProviderKeys,
  newKeyProvider,
  onSetNewKeyProvider,
  newKeyText,
  onSetNewKeyText,
  onAddKey,
  onRemoveKey,
  onRetranslateAll,
  showAutoSaveBadge,
  triggerAutoSaveBadge,
}: SettingsModalProps) {
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>('appearance');

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div class="lt-modal-backdrop" onClick={onClose}>
      <div class="lt-modal-card-modern" onClick={(e) => e.stopPropagation()}>
        {/* SIDEBAR BÊN TRÁI */}
        <aside class="lt-modal-sidebar">
          <div class="lt-modal-sidebar-header">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            <span>Cài đặt Live-Trans</span>
          </div>

          <nav class="lt-sidebar-nav">
            <button
              type="button"
              class={`lt-sidebar-nav-item ${activeSettingsTab === 'appearance' ? 'active' : ''}`}
              onClick={() => setActiveSettingsTab('appearance')}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/>
                <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>
                <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>
                <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>
                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
              </svg>
              <span>Giao diện & Đọc</span>
            </button>

            <button
              type="button"
              class={`lt-sidebar-nav-item ${activeSettingsTab === 'models' ? 'active' : ''}`}
              onClick={() => setActiveSettingsTab('models')}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/>
                <path d="M4 11a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7z"/>
                <path d="M9 16v1"/>
                <path d="M15 16v1"/>
              </svg>
              <span>Mô hình AI & API</span>
            </button>

            <button
              type="button"
              class={`lt-sidebar-nav-item ${activeSettingsTab === 'performance' ? 'active' : ''}`}
              onClick={() => setActiveSettingsTab('performance')}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
              <span>Hiệu năng & Bộ nhớ</span>
            </button>
          </nav>

          <div style={{ marginTop: 'auto', padding: '12px 6px 4px 6px', borderTop: '1px solid #202024' }}>
            <div style={{ fontSize: '11px', color: '#71717a', lineHeight: '1.4' }}>
              Live-Trans v1.1.1<br/>
              Tối ưu cho Paper PDF
            </div>
          </div>
        </aside>

        {/* KHUNG NỘI DUNG BÊN PHẢI */}
        <main class="lt-modal-main-content">
          {/* TOPBAR */}
          <div class="lt-modal-content-topbar">
            <div class="lt-modal-topbar-title">
              {activeSettingsTab === 'appearance' && '🎨 Tùy chỉnh Giao diện & Đọc'}
              {activeSettingsTab === 'models' && '🤖 Cấu hình Mô hình AI & Đa Khóa API'}
              {activeSettingsTab === 'performance' && '⚡ Hiệu năng Dịch & Quản lý Bộ nhớ'}
            </div>

            <div class="lt-modal-topbar-right">
              {showAutoSaveBadge && (
                <span class="lt-autosave-badge">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Đã tự động lưu
                </span>
              )}
              <button
                class="lt-modal-close-btn"
                onClick={onClose}
                title="Đóng (Esc)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>

          {/* SCROLLABLE CONTENT */}
          <div class="lt-modal-content-scroll">
            {activeSettingsTab === 'appearance' && (
              <AppearanceTab
                settings={settings}
                onUpdateSettingDirect={onUpdateSettingDirect}
              />
            )}

            {activeSettingsTab === 'models' && (
              <ModelsTab
                settings={settings}
                onUpdateSettingDirect={onUpdateSettingDirect}
                keyItems={keyItems}
                modalProviderKeys={modalProviderKeys}
                newKeyProvider={newKeyProvider}
                onSetNewKeyProvider={onSetNewKeyProvider}
                newKeyText={newKeyText}
                onSetNewKeyText={onSetNewKeyText}
                onAddKey={onAddKey}
                onRemoveKey={onRemoveKey}
                triggerAutoSaveBadge={triggerAutoSaveBadge}
              />
            )}

            {activeSettingsTab === 'performance' && (
              <PerformanceTab
                settings={settings}
                onUpdateSettingDirect={onUpdateSettingDirect}
                onRetranslateAll={onRetranslateAll}
                onCloseModal={onClose}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
