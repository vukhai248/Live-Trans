import { CustomSelect } from '../../CustomSelect';
import {
  DEFAULT_PDF_MODEL,
  PDF_GEMINI_MODELS,
  PDF_ZEN_MODELS,
  maskApiKey,
  type PdfProvider,
} from '@/lib/settings';
import type { ModelsTabProps } from './types';

export function ModelsTab({
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
  triggerAutoSaveBadge,
}: ModelsTabProps) {
  return (
    <>
      {/* Nhà cung cấp & Model */}
      <div class="lt-settings-section-card">
        <div class="lt-section-card-title">Nhà cung cấp & Mô hình AI (Provider & Model)</div>
        <div class="lt-section-card-desc">
          Chọn mô hình dịch thuật. Thay đổi sẽ tự động áp dụng cho các trang kế tiếp ngay lập tức.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <label class="lt-setting-label">Nhà cung cấp (Provider)</label>
            <CustomSelect
              value={settings.pdfProvider}
              options={[
                { value: 'gemini', label: 'Google Gemini (Mặc định, ổn định)', desc: 'Chính thức từ Google AI Studio, nhanh & nhiều quota' },
                { value: 'zen', label: 'OpenCode Zen (Dự phòng SOTA)', desc: 'OpenAI-compatible proxy, hỗ trợ đa model SOTA' },
              ]}
              onChange={(val: string) => {
                const p = val as PdfProvider;
                const defaultModel = DEFAULT_PDF_MODEL[p];
                onUpdateSettingDirect('pdfProvider', p);
                onUpdateSettingDirect('pdfModel', defaultModel);
                triggerAutoSaveBadge?.();
              }}
            />
          </div>

          <div>
            <label class="lt-setting-label">Mô hình AI (Model)</label>
            <CustomSelect
              value={settings.pdfModel}
              options={(settings.pdfProvider === 'gemini' ? PDF_GEMINI_MODELS : PDF_ZEN_MODELS).map((m) => ({
                value: m,
                label: m,
                desc: m === 'gemini-3.5-flash-lite' ? 'Khuyên dùng: Dịch cực nhanh, nhẹ & hạn mức lớn' : undefined,
              }))}
              onChange={(val: string) => {
                onUpdateSettingDirect('pdfModel', val as string);
              }}
            />
          </div>
        </div>
      </div>

      {/* Quản lý Đa API Key */}
      <div class="lt-settings-section-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div class="lt-section-card-title">Quản lý API Key (Đa khóa & Smart Router)</div>
          <span class="lt-key-count-badge">
            {modalProviderKeys.length} key {settings.pdfProvider === 'gemini' ? 'Gemini' : 'Zen'}
          </span>
        </div>
        <div class="lt-section-card-desc">
          Thêm một hoặc nhiều key để hệ thống tự động xoay tua (Router) khi gặp giới hạn hạn mức Rate Limit (429).
        </div>

        <div class="lt-add-key-row">
          <CustomSelect
            className="lt-key-provider-select"
            value={newKeyProvider}
            options={[
              { value: 'gemini', label: 'Google Gemini' },
              { value: 'zen', label: 'OpenCode Zen' },
            ]}
            onChange={(val: string) => onSetNewKeyProvider(val as PdfProvider)}
          />
          <input
            type="password"
            class="lt-setting-input lt-key-input"
            placeholder={newKeyProvider === 'gemini' ? 'Nhập Gemini Key (AIzaSy...)' : 'Nhập Zen Key (sk-...)'}
            value={newKeyText}
            onInput={(e) => onSetNewKeyText((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onAddKey();
              }
            }}
          />
          <button
            type="button"
            class="lt-btn lt-btn-primary lt-btn-add-key"
            onClick={onAddKey}
            title="Thêm API Key này vào danh sách"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="12" y2="12"/>
            </svg>
            <span>Thêm</span>
          </button>
        </div>

        {/* Danh sách các key đã thêm */}
        <div class="lt-keys-list">
          {keyItems.length === 0 ? (
            <div class="lt-keys-empty">Chưa có API key nào. Vui lòng thêm ít nhất 1 key ở trên để bắt đầu dịch.</div>
          ) : (
            keyItems.map((item, idx) => (
              <div key={item.id} class="lt-key-card">
                <div class="lt-key-card-left">
                  <span class={`lt-key-badge lt-key-badge-${item.provider}`}>
                    {item.provider === 'gemini' ? 'Gemini' : 'Zen'}
                  </span>
                  <span class="lt-key-masked">
                    {maskApiKey(item.key)}
                  </span>
                  {idx === 0 && (
                    <span class="lt-key-primary-tag">Mặc định</span>
                  )}
                </div>
                <button
                  type="button"
                  class="lt-key-del-btn"
                  title="Xóa key này"
                  onClick={() => onRemoveKey(item.id)}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Trạng thái Router tương ứng với provider đang chọn */}
        <div class="lt-router-status-note">
          {modalProviderKeys.length >= 2 ? (
            <div class="lt-router-alert lt-router-active">
              🟢 <strong>Đang kích hoạt Smart Router ({modalProviderKeys.length} keys):</strong> Tự động xoay vòng sang key kế tiếp khi một key bị limit (429/quota).
            </div>
          ) : modalProviderKeys.length === 1 ? (
            <div class="lt-router-alert lt-router-single">
              ℹ️ <strong>Sử dụng 1 key đơn lẻ:</strong> Khi chạm hạn mức (429/quota), hệ thống sẽ thông báo lỗi trực tiếp thay vì xoay vòng.
            </div>
          ) : (
            <div class="lt-router-alert lt-router-empty">
              ⚠️ <strong>Chưa có API key:</strong> Cần thêm ít nhất 1 key cho {settings.pdfProvider === 'gemini' ? 'Google Gemini' : 'OpenCode Zen'} để sử dụng tính năng dịch.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
