import { useEffect, useState } from 'preact/hooks';
import { browser } from 'wxt/browser';
import { GlossaryEditor } from '@/components/GlossaryEditor';
import { clampChunk, loadSettings, saveSettings, SETTINGS_KEY, type Settings } from '@/lib/settings';

type Tab = 'general' | 'glossary';

export function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [tab, setTab] = useState<Tab>('general');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void loadSettings().then(setSettings);

    const handleStorageChange = (
      changes: Record<string, any>,
      areaName: string,
    ) => {
      if (areaName === 'local' && SETTINGS_KEY in changes) {
        void loadSettings().then(setSettings);
      }
    };

    browser.storage.onChanged.addListener(handleStorageChange);
    return () => {
      browser.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  if (!settings) return <div class="loading">Đang tải…</div>;

  function update(partial: Partial<Settings>): void {
    setSettings({ ...settings!, ...partial });
  }

  async function save(): Promise<void> {
    await saveSettings(settings!);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  }

  return (
    <div class="wrap">
      <header>
        <div class="brand">
          <span class="logo">LT</span>
          <div>
            <h1>Cài đặt Live-Trans</h1>
            <p>Key, chế độ và glossary bảo toàn thuật ngữ</p>
          </div>
        </div>
        <button class="primary" onClick={() => void save()} disabled={!settings}>
          {saved ? 'Đã lưu ✓' : 'Lưu cài đặt'}
        </button>
      </header>

      <nav>
        <button
          class={tab === 'general' ? 'active' : ''}
          onClick={() => setTab('general')}
        >
          Chung
        </button>
        <button
          class={tab === 'glossary' ? 'active' : ''}
          onClick={() => setTab('glossary')}
        >
          Glossary
        </button>
      </nav>

      {tab === 'general' ? (
        <General settings={settings} update={update} />
      ) : (
        <GlossaryEditor
          glossary={settings.glossary}
          onChange={(g) => update({ glossary: g })}
          variant="full"
        />
      )}

      <p class="hint">
        ⚠️ Free tier: dữ liệu âm thanh/văn bản có thể được Google dùng để cải thiện sản
        phẩm. Key được lưu <b>chỉ trên máy bạn</b> (chrome.storage.local), không bao giờ
        nhúng vào code.
      </p>
    </div>
  );
}

function General({
  settings,
  update,
}: {
  settings: Settings;
  update: (p: Partial<Settings>) => void;
}) {
  return (
    <section class="card">
      <h2>Chế độ API</h2>
      <div class="modes">
        <ModeButton
          title="Demo"
          desc="Chạy thử không cần key"
          active={settings.mode === 'demo'}
          onClick={() => update({ mode: 'demo' })}
        />
        <ModeButton
          title="Direct"
          desc="Gọi Gemini trực tiếp bằng key của bạn"
          active={settings.mode === 'direct'}
          onClick={() => update({ mode: 'direct' })}
        />
        <ModeButton
          title="Gateway"
          desc="Proxy local giữ key (an toàn hơn)"
          active={settings.mode === 'gateway'}
          onClick={() => update({ mode: 'gateway' })}
        />
      </div>

      {settings.mode === 'direct' && (
        <Field
          label="Gemini API key"
          hint="Lấy key miễn phí tại aistudio.google.com/apikey — key mới mặc định là auth key (Google bắt buộc từ 9/2026). Key chỉ lưu trên máy bạn."
        >
          <input
            type="password"
            value={settings.apiKey}
            placeholder="AIza..."
            onInput={(e) => update({ apiKey: (e.target as HTMLInputElement).value })}
          />
        </Field>
      )}

      {settings.mode === 'gateway' && (
        <Field
          label="Gateway URL"
          hint="Chạy local: node gateway/gateway.mjs — key nằm trong gateway/.env, extension không giữ key."
        >
          <input
            type="text"
            value={settings.gatewayUrl}
            placeholder="http://localhost:8787"
            onInput={(e) => update({ gatewayUrl: (e.target as HTMLInputElement).value })}
          />
        </Field>
      )}

      <h2>Dịch PDF/paper (dự phòng Zen)</h2>
      <Field
        label="OpenCode Zen API key"
        hint="Dùng khi Gemini ốm/quota — lấy key tại opencode.ai/auth. Để trống sẽ dùng key build sẵn (nếu có). Key chỉ lưu trên máy bạn."
      >
        <input
          type="password"
          value={settings.zenApiKey}
          placeholder="sk-..."
          onInput={(e) => update({ zenApiKey: (e.target as HTMLInputElement).value })}
        />
      </Field>

      <h2>Ngôn ngữ & hiển thị</h2>
      <div class="grid-2">
        <Field label="Ngôn ngữ đích" hint="Mã ngôn ngữ: vi, en, ja, ko, zh, fr, de, es…">
          <input
            type="text"
            value={settings.targetLang}
            placeholder="vi"
            onInput={(e) => update({ targetLang: (e.target as HTMLInputElement).value })}
          />
        </Field>
        <Field
          label="Ngôn ngữ nguồn (auto để tự nhận)"
          hint="auto = Gemini tự nhận diện (hỗ trợ 85+ ngôn ngữ)"
        >
          <input
            type="text"
            value={settings.sourceLang}
            placeholder="auto"
            onInput={(e) => update({ sourceLang: (e.target as HTMLInputElement).value })}
          />
        </Field>
      </div>

      <div class="grid-2">
        <Field
          label={`Độ dài chunk ASR: ${settings.chunkSeconds}s`}
          hint="Chunk ngắn → phụ đề đến nhanh hơn nhưng tốn nhiều lời gọi API hơn (khuyến nghị 45s)"
        >
          <input
            type="range"
            min={30}
            max={180}
            step={5}
            value={settings.chunkSeconds}
            onInput={(e) =>
              update({
                chunkSeconds: clampChunk(Number((e.target as HTMLInputElement).value)),
              })
            }
          />
        </Field>
        <Field label="Cỡ chữ phụ đề">
          <select
            value={settings.fontSize}
            onChange={(e) =>
              update({
                fontSize: (e.target as HTMLSelectElement).value as Settings['fontSize'],
              })
            }
          >
            <option value="small">Nhỏ</option>
            <option value="medium">Vừa</option>
            <option value="large">Lớn</option>
          </select>
        </Field>
      </div>

      <Checkbox
        label="Hiện bản gốc dưới bản dịch"
        checked={settings.showOriginal}
        onChange={(v) => update({ showOriginal: v })}
      />
      <Checkbox
        label="Dịch tiêu đề video (hiển thị trên video)"
        checked={settings.showTranslatedTitle}
        onChange={(v) => update({ showTranslatedTitle: v })}
      />
    </section>
  );
}


function ModeButton({
  title,
  desc,
  active,
  onClick,
}: {
  title: string;
  desc: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button class={`mode ${active ? 'active' : ''}`} onClick={onClick}>
      <b>{title}</b>
      <span>{desc}</span>
    </button>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: preact.ComponentChildren;
}) {
  return (
    <label class="field">
      <span class="label">{label}</span>
      {children}
      {hint && <span class="hintline">{hint}</span>}
    </label>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label class="checkbox">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange((e.target as HTMLInputElement).checked)}
      />
      <span>{label}</span>
    </label>
  );
}
