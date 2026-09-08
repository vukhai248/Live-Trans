import type { PostSavePromptModalProps } from './types';

export function PostSavePromptModal({
  isOpen,
  onClose,
  currentPage,
  onRetryCurrentPage,
  onRetranslateAll,
  onContinueReading,
}: PostSavePromptModalProps) {
  if (!isOpen) return null;

  return (
    <div class="lt-modal-backdrop" onClick={onClose}>
      <div class="lt-modal-card lt-modal-card-sm" onClick={(e) => e.stopPropagation()}>
        <div class="lt-modal-header">
          <div class="lt-modal-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <span>Đã lưu API Key thành công!</span>
          </div>
          <button
            class="lt-modal-close-btn"
            onClick={onClose}
            title="Đóng"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div class="lt-modal-body">
          <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#e4e4e7', lineHeight: '1.5' }}>
            Bạn đã cập nhật cấu hình API Key. Bạn muốn áp dụng vào tài liệu đang mở như thế nào?
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              class="lt-btn lt-btn-primary"
              style={{ justifyContent: 'flex-start', padding: '10px 14px', textAlign: 'left', gap: '12px' }}
              onClick={() => {
                onClose();
                onRetryCurrentPage(currentPage);
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
              <div>
                <div style={{ fontWeight: 600 }}>Dịch lại Trang hiện tại (Trang {currentPage})</div>
                <div style={{ fontSize: '11px', color: '#bae6fd' }}>Ưu tiên dịch ngay trang bạn đang xem với API Key mới</div>
              </div>
            </button>

            <button
              class="lt-btn"
              style={{ justifyContent: 'flex-start', padding: '10px 14px', textAlign: 'left', gap: '12px', background: '#27272a', borderColor: '#3f3f46' }}
              onClick={() => {
                onClose();
                onRetranslateAll();
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
                <path d="M21 3v5h-5"/>
              </svg>
              <div>
                <div style={{ fontWeight: 600 }}>Dịch lại Toàn bộ tài liệu</div>
                <div style={{ fontSize: '11px', color: '#a1a1aa' }}>Xóa toàn bộ cache cũ và khởi động lại dịch từ Trang 1</div>
              </div>
            </button>

            <button
              class="lt-btn"
              style={{ padding: '8px 12px', color: '#a1a1aa' }}
              onClick={() => {
                onClose();
                onContinueReading();
              }}
            >
              Để sau (tiếp tục đọc bình thường)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
