import { CustomSelect } from '../../CustomSelect';
import type { AppearanceTabProps } from './types';

export function AppearanceTab({
  settings,
  onUpdateSettingDirect,
}: AppearanceTabProps) {
  return (
    <div class="lt-appearance-split-layout">
      {/* CỘT TRÁI: CÁC NÚT ĐIỀU KHIỂN */}
      <div class="lt-appearance-controls-col">
        {/* Chủ đề & Màu nền (5 Themes) */}
        <div class="lt-settings-section-card">
          <div class="lt-section-card-title">Màu nền & Chủ đề bản dịch (Theme)</div>
          <div class="lt-section-card-desc">
            Chọn phong cách trang đọc bài báo phù hợp điều kiện ánh sáng. Tự động áp dụng tức thì.
          </div>
          <div class="lt-theme-grid">
            {[
              { id: 'white', name: 'Trắng', previewClass: 'lt-preview-white' },
              { id: 'sepia', name: 'Giấy ngà', previewClass: 'lt-preview-sepia' },
              { id: 'dark', name: 'Tối êm', previewClass: 'lt-preview-dark' },
              { id: 'midnight', name: 'Đêm đen', previewClass: 'lt-preview-midnight' },
              { id: 'oceanic', name: 'Biển sâu', previewClass: 'lt-preview-oceanic' },
            ].map((t) => (
              <div
                key={t.id}
                class={`lt-theme-card ${(settings.viewerTheme || 'white') === t.id ? 'active' : ''}`}
                onClick={() => onUpdateSettingDirect('viewerTheme', t.id as any)}
                title={t.name}
              >
                <div class={`lt-theme-card-preview ${t.previewClass}`}>
                  <div class="lt-preview-line" style={{ width: '85%' }} />
                  <div class="lt-preview-line" style={{ width: '60%' }} />
                  <div class="lt-preview-line" style={{ width: '90%' }} />
                </div>
                <div class="lt-theme-card-title">{t.name}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Font chữ bản dịch (Dropdown Select - Chuẩn tiếng Việt 100%) */}
        <div class="lt-settings-section-card">
          <div class="lt-section-card-title">Font chữ bản dịch (Font Family)</div>
          <div class="lt-section-card-desc">
            Chọn kiểu chữ hiển thị cho toàn bộ văn bản và công thức. Hỗ trợ tiếng Việt tuyệt đối 100%.
          </div>
          <CustomSelect
            value={settings.viewerFontFamily || 'system'}
            options={[
              {
                value: 'system',
                label: 'Hệ thống (Mặc định - Sans-serif)',
                desc: 'Inter / Roboto / Segoe UI — Tối giản, hiện đại, tối ưu 100% tiếng Việt',
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              },
              {
                value: 'times',
                label: 'Times New Roman (Serif Học thuật)',
                desc: 'Chuẩn mực bài báo quốc tế (IEEE, Nature, ACM) — Rõ ràng, uy tín',
                fontFamily: "'Times New Roman', Times, serif",
              },
              {
                value: 'palatino',
                label: 'Palatino Linotype (Serif Cổ điển)',
                desc: 'Dáng chữ luận án & sách học thuật — Thanh lịch, trang nhã',
                fontFamily: "'Palatino Linotype', Palatino, 'Book Antiqua', serif",
              },
              {
                value: 'segoe',
                label: 'Segoe UI (Sans-serif Mượt mà)',
                desc: 'Chuẩn mực Fluent Design — Bo cong êm ái, dễ đọc trên màn hình',
                fontFamily: "'Segoe UI', Roboto, sans-serif",
              },
              {
                value: 'arial',
                label: 'Arial Clean (Sans-serif Tiêu chuẩn)',
                desc: 'Độ tương phản cao, chân phương, hiển thị sắc nét ở mọi độ phân giải',
                fontFamily: "Arial, Helvetica, sans-serif",
              },
            ]}
            onChange={(val: string) => {
              onUpdateSettingDirect('viewerFontFamily', val as any);
            }}
          />
        </div>

        {/* Tỷ lệ thu phóng bản dịch (Content Scale) */}
        <div class="lt-settings-section-card">
          <div class="lt-section-card-title">Tỷ lệ thu phóng bản dịch (Content Scale)</div>
          <div class="lt-section-card-desc">
            Điều chỉnh độ phóng to/thu nhỏ toàn bộ tiêu đề, văn bản, công thức KaTeX và bảng biểu theo tỷ lệ chuẩn.
          </div>

          {/* Nút chọn nhanh */}
          <div class="lt-scale-pills">
            {[85, 90, 100, 115, 130, 150, 175].map((scale) => (
              <button
                key={scale}
                type="button"
                class={`lt-scale-btn ${(settings.viewerFontScale || 100) === scale ? 'active' : ''}`}
                onClick={() => {
                  onUpdateSettingDirect('viewerFontScale', scale);
                  onUpdateSettingDirect('viewerFontSize', Math.round(15 * (scale / 100)));
                }}
              >
                {scale}% {scale === 100 ? '(Chuẩn)' : ''}
              </button>
            ))}
          </div>

          {/* Thanh kéo Slider & Hiển thị % */}
          <div class="lt-custom-scale-controls">
            <span style={{ fontSize: '11px', color: '#a1a1aa', flex: 'none' }}>75%</span>
            <input
              type="range"
              class="lt-scale-slider"
              min="75"
              max="180"
              step="1"
              value={settings.viewerFontScale || 100}
              onInput={(e) => {
                const val = Number((e.target as HTMLInputElement).value);
                onUpdateSettingDirect('viewerFontScale', val);
                onUpdateSettingDirect('viewerFontSize', Math.round(15 * (val / 100)));
              }}
            />
            <span style={{ fontSize: '11px', color: '#a1a1aa', flex: 'none' }}>180%</span>
            <div class="lt-scale-value-label">
              {settings.viewerFontScale || 100}%
            </div>
          </div>
        </div>
      </div>

      {/* CỘT PHẢI: KHUNG XEM TRƯỚC TRỰC TIẾP (LIVE DOCUMENT PREVIEW) */}
      <div class="lt-appearance-preview-col">
        <div class="lt-live-preview-header">
          <div class="lt-live-preview-header-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2">
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            Xem trước trực tiếp
          </div>
          <span class="lt-live-preview-tag">⚡ 0ms Real-time</span>
        </div>

        <div class="lt-live-preview-body-scroll">
          <div
            class={`lt-live-preview-paper-sheet lt-preview-theme-${settings.viewerTheme || 'white'}`}
            style={{
              zoom: `${(settings.viewerFontScale || 100) / 100}`,
              fontFamily: settings.viewerFontFamily === 'times'
                ? "'Times New Roman', Times, serif"
                : settings.viewerFontFamily === 'palatino'
                ? "'Palatino Linotype', Palatino, 'Book Antiqua', serif"
                : settings.viewerFontFamily === 'segoe'
                ? "'Segoe UI', Roboto, sans-serif"
                : settings.viewerFontFamily === 'arial'
                ? "Arial, 'Helvetica Neue', Helvetica, sans-serif"
                : "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            }}
          >
            <div class="lt-pv-h1">Universal Guidance for Diffusion Models</div>
            <div class="lt-pv-meta">A. Bansal, H.M. Chu, T. Goldstein — CVPR Conference</div>

            <div class="lt-pv-h2">Tóm tắt (Abstract)</div>
            <div class="lt-pv-p">
              Chúng tôi đề xuất một thuật toán <strong>hướng dẫn phổ quát</strong> cho phép điều khiển mô hình khuếch tán bằng bất kỳ hàm tổn thất nào mà không cần huấn luyện lại.
            </div>

            <div class="lt-pv-h2">1. Cơ sở lý thuyết & Công thức</div>
            <div class="lt-pv-p">
              Hàm gradient điểm số tại bước khuếch tán thời gian <em>t</em>:
            </div>
            <div class="lt-pv-eq">
              ∇_x log p_t(x) = (x_t - √α_t x_0) / (1 - α_t)  (1)
            </div>

            <table class="lt-pv-table">
              <thead>
                <tr>
                  <th>Phương pháp</th>
                  <th>FID (↓)</th>
                  <th>CLIP (↑)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>DDIM Baseline</td>
                  <td>14.2</td>
                  <td>0.26</td>
                </tr>
                <tr>
                  <td><strong>Đề xuất (Ours)</strong></td>
                  <td><strong>6.8</strong></td>
                  <td><strong>0.37</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
