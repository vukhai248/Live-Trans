import { CustomSelect } from '../../CustomSelect';
import type { PerformanceTabProps } from './types';

export function PerformanceTab({
  settings,
  onUpdateSettingDirect,
  onRetranslateAll,
  onCloseModal,
}: PerformanceTabProps) {
  return (
    <>
      {/* Số trang dịch song song */}
      <div class="lt-settings-section-card">
        <div class="lt-section-card-title">Số trang dịch song song (Multi-Worker Concurrency)</div>
        <div class="lt-section-card-desc">
          Số worker dịch đồng thời theo hàng đợi thác nước. Khuyên dùng 5 trang để đọc nhanh mà không nghẽn mạng.
        </div>
        <CustomSelect
          value={settings.pdfConcurrency || 5}
          options={[
            { value: 2, label: '2 trang song song' },
            { value: 3, label: '3 trang song song' },
            { value: 4, label: '4 trang song song' },
            { value: 5, label: '5 trang song song (Mặc định, tối ưu)' },
            { value: 6, label: '6 trang song song' },
            { value: 7, label: '7 trang song song (Tối đa)' },
          ]}
          onChange={(val: number) => onUpdateSettingDirect('pdfConcurrency', Number(val))}
        />
      </div>

      {/* Ngôn ngữ đích */}
      <div class="lt-settings-section-card">
        <div class="lt-section-card-title">Ngôn ngữ đích (Target Language)</div>
        <div class="lt-section-card-desc">
          Ngôn ngữ kết quả sau khi dịch tài liệu (mặc định Tiếng Việt).
        </div>
        <CustomSelect
          value={settings.targetLang || 'vi'}
          options={[
            { value: 'vi', label: 'Tiếng Việt (Mặc định)' },
            { value: 'en', label: 'English (Tiếng Anh)' },
            { value: 'ja', label: '日本語 (Tiếng Nhật)' },
            { value: 'zh', label: '中文 (Tiếng Trung)' },
            { value: 'ko', label: '한국어 (Tiếng Hàn)' },
            { value: 'fr', label: 'Français (Tiếng Pháp)' },
            { value: 'de', label: 'Deutsch (Tiếng Đức)' },
          ]}
          onChange={(val: string) => onUpdateSettingDirect('targetLang', val as string)}
        />
      </div>

      {/* Bộ nhớ đệm thông minh & Dịch lại */}
      <div class="lt-settings-section-card">
        <div class="lt-section-card-title">Bộ nhớ đệm thông minh (LRU Cache)</div>
        <div class="lt-section-card-desc">
          ⚡ Hệ thống tự động lưu trữ bền vững kết quả tối đa 50 bài báo trong 14 ngày. Khi mở lại bài báo, toàn bộ các trang đã dịch sẽ hiển thị tức thì 0ms.
        </div>
        <div style={{ marginTop: '6px' }}>
          <button
            type="button"
            class="lt-btn"
            style={{ width: '100%', justifyContent: 'center', padding: '9px 16px' }}
            onClick={() => {
              onRetranslateAll();
              onCloseModal?.();
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
            </svg>
            <span>↻ Xóa cache & Dịch lại toàn bộ các trang</span>
          </button>
        </div>
      </div>
    </>
  );
}
