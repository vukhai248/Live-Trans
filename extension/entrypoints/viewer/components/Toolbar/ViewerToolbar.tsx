import type { ViewerToolbarProps } from './types';
import { ModeSelectorDropdown } from './ModeSelectorDropdown';
import { PageNavigator } from './PageNavigator';

export function ViewerToolbar({
  sidebarOpen,
  onToggleSidebar,
  docTitle,
  viewMode,
  onChangeViewMode,
  onResetSplitRatio,
  readerMode,
  onChangeReaderMode,
  isModeMenuOpen,
  onToggleModeMenu,
  onCloseModeMenu,
  currentPage,
  numPages,
  onPageChange,
  onRetranslateAll,
  onOpenSettings,
}: ViewerToolbarProps) {
  return (
    <header class="lt-toolbar">
      {/* LEFT: Brand & Document info */}
      <div class="lt-toolbar-group">
        <button
          class={`lt-btn lt-sidebar-toggle-btn ${sidebarOpen ? 'active' : ''}`}
          title={sidebarOpen ? 'Ẩn danh sách trang' : 'Danh sách trang'}
          onClick={onToggleSidebar}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2"/>
            <path d="M9 3v18"/>
          </svg>
        </button>
        <div class="lt-brand">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m5 8 6 6"/>
            <path d="m4 14 6-6 2-3"/>
            <path d="M2 5h12"/>
            <path d="M7 2h1"/>
            <path d="m22 22-5-10-5 10"/>
            <path d="M14 18h6"/>
          </svg>
          <span>Live-Trans</span>
        </div>
        <span class="lt-doc-title" title={docTitle}>
          {docTitle}
        </span>
      </div>

      {/* CENTER: Segmented View Controls & Reader Layout */}
      <div class="lt-toolbar-group">
        {/* Segmented View Mode */}
        <div class="lt-segmented-group" title="Chế độ xem">
          <button
            class={`lt-seg-btn ${viewMode === 'bilingual' ? 'active' : ''}`}
            onClick={() => onChangeViewMode('bilingual')}
            title="Song ngữ đối chiếu"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2"/>
              <path d="M12 3v18"/>
            </svg>
          </button>
          <button
            class={`lt-seg-btn ${viewMode === 'translated' ? 'active' : ''}`}
            onClick={() => onChangeViewMode('translated')}
            title="Chỉ hiển thị bản dịch"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4"/>
              <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
              <path d="m3 15 2 2 4-4"/>
            </svg>
          </button>
          <button
            class={`lt-seg-btn ${viewMode === 'original' ? 'active' : ''}`}
            onClick={() => onChangeViewMode('original')}
            title="Chỉ hiển thị bản gốc"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          </button>
        </div>

        {/* Nút đặt lại tỉ lệ 50:50 (Bilingual mode) */}
        {viewMode === 'bilingual' && (
          <button
            class="lt-btn"
            onClick={onResetSplitRatio}
            title="Đặt lại tỉ lệ chia đều 50:50"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2"/>
              <path d="M12 3v18"/>
            </svg>
            <span>50:50</span>
          </button>
        )}

        {/* Mode Selector Dropdown */}
        <ModeSelectorDropdown
          readerMode={readerMode}
          onChangeReaderMode={onChangeReaderMode}
          isOpen={isModeMenuOpen}
          onToggleOpen={onToggleModeMenu}
          onClose={onCloseModeMenu}
        />

        {/* PAGE NAVIGATOR */}
        <PageNavigator
          currentPage={currentPage}
          numPages={numPages}
          onPageChange={onPageChange}
        />
      </div>

      {/* RIGHT: Actions, Settings */}
      <div class="lt-toolbar-group">
        <button
          class="lt-btn"
          onClick={onRetranslateAll}
          title="Xoá cache + dịch lại toàn bộ các trang"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
            <path d="M21 3v5h-5"/>
          </svg>
          Dịch lại
        </button>

        <button
          class="lt-btn lt-btn-primary"
          title="Cài đặt (Model AI, API Key, Số luồng song song)"
          onClick={onOpenSettings}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
      </div>
    </header>
  );
}
