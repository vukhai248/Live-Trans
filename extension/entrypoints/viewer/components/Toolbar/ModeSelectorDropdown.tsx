import type { ModeSelectorDropdownProps } from './types';

export function ModeSelectorDropdown({
  readerMode,
  onChangeReaderMode,
  isOpen,
  onToggleOpen,
  onClose,
}: ModeSelectorDropdownProps) {
  return (
    <div class="lt-dropdown-container">
      <button
        class="lt-btn lt-dropdown-btn lt-mode-select-btn"
        onClick={onToggleOpen}
        title="Chọn chế độ hiển thị bản dịch"
      >
        {readerMode === 'whiteboard' ? (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="7" height="7" x="3" y="3" rx="1"/>
              <rect width="7" height="7" x="14" y="3" rx="1"/>
              <rect width="7" height="7" x="14" y="14" rx="1"/>
              <rect width="7" height="7" x="3" y="14" rx="1"/>
            </svg>
            <span>Bảng trắng</span>
          </>
        ) : (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c084fc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            <span style={{ color: '#c084fc', fontWeight: 600 }}>Vision AI</span>
          </>
        )}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style={{ opacity: 0.7 }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {isOpen && (
        <div class="lt-dropdown-menu lt-mode-menu" onClick={onClose}>
          <div
            class={`lt-dropdown-item ${readerMode === 'vision' ? 'active' : ''}`}
            onClick={() => onChangeReaderMode('vision')}
          >
            <div class="lt-dropdown-item-title">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c084fc" stroke-width="2">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              <strong style={{ color: '#c084fc' }}>Vision AI (Thị giác Đa phương thức) (Khuyên dùng)</strong>
            </div>
            <div class="lt-dropdown-item-desc">Chụp ảnh trang gửi Gemini 3.5 Flash-Lite, công thức KaTeX & Markdown học thuật siêu chuẩn.</div>
          </div>

          <div
            class={`lt-dropdown-item ${readerMode === 'whiteboard' ? 'active' : ''}`}
            onClick={() => onChangeReaderMode('whiteboard')}
          >
            <div class="lt-dropdown-item-title">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2">
                <rect width="7" height="7" x="3" y="3" rx="1"/>
                <rect width="7" height="7" x="14" y="3" rx="1"/>
                <rect width="7" height="7" x="14" y="14" rx="1"/>
                <rect width="7" height="7" x="3" y="14" rx="1"/>
              </svg>
              <strong>Bảng trắng Component (Chưa hoàn thiện)</strong>
            </div>
            <div class="lt-dropdown-item-desc">Bảo toàn vị trí và tỉ lệ tọa độ paper, từng component độc lập, hỗ trợ kéo thả.</div>
          </div>

          <div class="lt-dropdown-item lt-disabled">
            <div class="lt-dropdown-item-title">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="21" y1="6" x2="3" y2="6"/>
                <line x1="15" y1="12" x2="3" y2="12"/>
                <line x1="17" y1="18" x2="3" y2="18"/>
              </svg>
              <strong>Markdown Dòng chảy (Chưa phát triển)</strong>
            </div>
            <div class="lt-dropdown-item-desc">Chưa hỗ trợ - đang trong lộ trình phát triển.</div>
          </div>

          <div class="lt-dropdown-item lt-disabled">
            <div class="lt-dropdown-item-title">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="12 2 2 7 12 12 22 7 12 2"/>
                <polyline points="2 17 12 22 22 17"/>
                <polyline points="2 12 12 17 22 12"/>
              </svg>
              <strong>Overlay Đè chữ (Chưa phát triển)</strong>
            </div>
            <div class="lt-dropdown-item-desc">Chưa hỗ trợ - đang trong lộ trình phát triển.</div>
          </div>
        </div>
      )}
    </div>
  );
}
