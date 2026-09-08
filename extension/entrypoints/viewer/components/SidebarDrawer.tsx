import type { SidebarDrawerProps } from './types';

export function SidebarDrawer({
  isOpen,
  isPinned,
  numPages,
  currentPage,
  onSelectPage,
  onTogglePin,
  onClose,
  pageVisionStatus = {},
  pageStatus = {},
  readerMode = 'vision',
  activePriorityPages = [],
  pendingPriorityPages = [],
}: SidebarDrawerProps) {
  return (
    <div class={`lt-sidebar-drawer ${isOpen || isPinned ? 'open' : ''}`}>
      <aside class={`lt-sidebar ${isPinned ? 'pinned' : ''}`}>
        {/* DRAWER HEADER: Ghim & Đóng */}
        <div class="lt-drawer-header">
          <div class="lt-drawer-top-row">
            <div class="lt-drawer-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/>
                <path d="M6 6h10"/>
                <path d="M6 10h10"/>
              </svg>
              Danh sách trang
            </div>
            <div class="lt-drawer-header-actions">
              <button
                class={`lt-drawer-pin-btn ${isPinned ? 'active' : ''}`}
                onClick={onTogglePin}
                title={isPinned ? 'Bỏ ghim thanh bên' : 'Ghim thanh bên'}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" y1="17" x2="12" y2="22"/>
                  <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a1 1 0 0 0 0-2H8a1 1 0 0 0 0 2h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>
                </svg>
              </button>
              <button
                class="lt-drawer-close-btn"
                onClick={onClose || onTogglePin}
                title="Đóng thanh trang"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>

          <div class="lt-drawer-page-stat">
            Đang xem: <strong>Trang {currentPage}</strong> / {numPages}
          </div>
        </div>

        {/* PAGE THUMBNAILS LIST - Gọn gàng 1 dòng duy nhất */}
        {Array.from({ length: numPages }).map((_, idx) => {
          const pno = idx + 1;
          const status = readerMode === 'vision' ? pageVisionStatus[pno] : pageStatus[pno];
          const isExecutingPriority = activePriorityPages.includes(pno);
          const isWaitingPriority = pendingPriorityPages.includes(pno);
          const isPriority = isExecutingPriority || isWaitingPriority;
          return (
            <div
              key={pno}
              class={`lt-thumb-item ${currentPage === pno ? 'active' : ''}`}
              onClick={() => onSelectPage(pno)}
            >
              <span class="lt-thumb-number">Trang {pno}</span>
              {status === 'done' && (
                <span class="lt-thumb-status lt-thumb-done">Đã dịch ✓</span>
              )}
              {status === 'loading' && (
                <span class={`lt-thumb-status ${isPriority ? 'lt-thumb-priority' : 'lt-thumb-loading'}`}>
                  {isPriority ? 'Ưu tiên ⚡' : 'Đang dịch...'}
                </span>
              )}
              {status === 'queued' && (
                <span class={`lt-thumb-status ${isWaitingPriority ? 'lt-thumb-priority' : 'lt-thumb-queued'}`}>
                  {isWaitingPriority ? 'Chờ ưu tiên ⚡' : 'Đang đợi...'}
                </span>
              )}
              {status === 'error' && (
                <span class="lt-thumb-status lt-thumb-error">Lỗi ⚠</span>
              )}
              {!status && (
                <span class="lt-thumb-status lt-thumb-pending">Chưa dịch</span>
              )}
            </div>
          );
        })}
      </aside>
    </div>
  );
}
