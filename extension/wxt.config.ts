import { defineConfig } from 'wxt';
import preact from '@preact/preset-vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: 'Live-Trans',
    short_name: 'Live-Trans',
    description:
      'Dịch live âm thanh/video với bảo toàn thuật ngữ học thuật — miễn phí cho học sinh/sinh viên.',
    version: '0.1.0',
    permissions: ['storage', 'tabCapture', 'offscreen', 'activeTab', 'scripting', 'tabs'],
    host_permissions: ['<all_urls>'],
    action: {
      default_title: 'Live-Trans — Dịch live',
      default_popup: 'popup/index.html',
    },
    options_ui: {
      page: 'options/index.html',
      open_in_tab: true,
    },
    commands: {
      _execute_action: {
        suggested_key: { default: 'Ctrl+Shift+U' },
        description: 'Mở/tắt popup Live-Trans',
      },
    },
    icons: {
      16: 'icons/16.png',
      32: 'icons/32.png',
      48: 'icons/48.png',
      128: 'icons/128.png',
    },
  },
  vite: () => ({
    plugins: [preact()],
  }),
});
