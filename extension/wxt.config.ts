import { defineConfig } from 'wxt';
import preact from '@preact/preset-vite';

import fs from 'node:fs';
import path from 'node:path';

function loadEnvKeys(): string[] {
  try {
    const envPath = path.resolve(process.cwd(), '../.env');
    if (!fs.existsSync(envPath)) return [];
    const content = fs.readFileSync(envPath, 'utf8');
    const keys: string[] = [];
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const m = trimmed.match(/^GEMINI_API_KEY(_\d+)?\s*=\s*(.+)$/);
      if (m && m[2]) {
        const k = m[2].trim();
        if (k && !keys.includes(k)) keys.push(k);
      }
    }
    return keys;
  } catch {
    return [];
  }
}

function loadZenKey(): string {
  try {
    const envPath = path.resolve(process.cwd(), '../.env');
    if (!fs.existsSync(envPath)) return '';
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const m = trimmed.match(/^ZEN_API_KEY\s*=\s*(.+)$/);
      if (m && m[1]) return m[1].trim();
    }
    return '';
  } catch {
    return '';
  }
}

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: 'Live-Trans',
    short_name: 'Live-Trans',
    description:
      'Dịch live âm thanh/video với bảo toàn thuật ngữ học thuật — miễn phí cho học sinh/sinh viên.',
    version: '1.0.0',
    permissions: ['storage', 'tabCapture', 'offscreen', 'activeTab', 'scripting', 'tabs', 'contextMenus'],
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
    web_accessible_resources: [
      {
        resources: ['pdf.worker.min.mjs'],
        matches: ['<all_urls>'],
      },
    ],
  },
  vite: () => ({
    plugins: [preact()],
    define: {
      __BUILTIN_GEMINI_API_KEYS__: JSON.stringify(loadEnvKeys()),
      __BUILTIN_ZEN_API_KEY__: JSON.stringify(loadZenKey()),
    },
  }),
});
