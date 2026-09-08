import type { PageNavigatorProps } from './types';

export function PageNavigator({
  currentPage,
  numPages,
  onPageChange,
}: PageNavigatorProps) {
  return (
    <div class="lt-page-counter">
      <button
        class="lt-btn"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
        title="Trang trước"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <span>
        {currentPage} / {numPages}
      </span>
      <button
        class="lt-btn"
        disabled={currentPage >= numPages}
        onClick={() => onPageChange(currentPage + 1)}
        title="Trang sau"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
    </div>
  );
}
