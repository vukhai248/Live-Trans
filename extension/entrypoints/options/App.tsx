import { useEffect, useState } from 'preact/hooks';
import { STARTER_GLOSSARY, type GlossaryTerm, type TermType } from '@/lib/glossary/types';
import { clampChunk, loadSettings, saveSettings, type Settings } from '@/lib/settings';

type Tab = 'general' | 'glossary';

export function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [tab, setTab] = useState<Tab>('general');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void loadSettings().then(setSettings);
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
        <Glossary settings={settings} update={update} />
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
        <Field label="Gemini API key">
          <input
            type="password"
            value={settings.apiKey}
            placeholder="AIza..."
            onInput={(e) => update({ apiKey: (e.target as HTMLInputElement).value })}
          />
        </Field>
      )}

      {settings.mode === 'gateway' && (
        <Field label="Gateway URL">
          <input
            type="text"
            value={settings.gatewayUrl}
            placeholder="http://localhost:8787"
            onInput={(e) => update({ gatewayUrl: (e.target as HTMLInputElement).value })}
          />
        </Field>
      )}

      <h2>Ngôn ngữ & hiển thị</h2>
      <div class="grid-2">
        <Field label="Ngôn ngữ đích">
          <input
            type="text"
            value={settings.targetLang}
            placeholder="vi"
            onInput={(e) => update({ targetLang: (e.target as HTMLInputElement).value })}
          />
        </Field>
        <Field label="Ngôn ngữ nguồn (auto để tự nhận)">
          <input
            type="text"
            value={settings.sourceLang}
            placeholder="auto"
            onInput={(e) => update({ sourceLang: (e.target as HTMLInputElement).value })}
          />
        </Field>
      </div>

      <div class="grid-2">
        <Field label={`Độ dài chunk ASR: ${settings.chunkSeconds}s`}>
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

function Glossary({
  settings,
  update,
}: {
  settings: Settings;
  update: (p: Partial<Settings>) => void;
}) {
  const terms = settings.glossary.terms;
  const [draft, setDraft] = useState<GlossaryTerm>({ term: '', type: 'command', vi: '' });

  function addTerm(): void {
    if (!draft.term.trim()) return;
    update({
      glossary: {
        version: 1,
        terms: [
          ...terms,
          { ...draft, term: draft.term.trim(), vi: draft.vi?.trim() || undefined },
        ],
      },
    });
    setDraft({ term: '', type: 'command', vi: '' });
  }

  function removeAt(i: number): void {
    update({ glossary: { version: 1, terms: terms.filter((_, idx) => idx !== i) } });
  }

  async function exportJson(): Promise<void> {
    const blob = new Blob([JSON.stringify(settings.glossary, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'live-trans-glossary.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(file: File): Promise<void> {
    const text = await file.text();
    try {
      const parsed = JSON.parse(text) as { terms?: GlossaryTerm[] };
      if (!Array.isArray(parsed.terms)) throw new Error('bad shape');
      update({ glossary: { version: 1, terms: parsed.terms } });
    } catch {
      window.alert('File glossary không hợp lệ (cần {"version":1,"terms":[...]}).');
    }
  }

  return (
    <section class="card">
      <div class="glossary-head">
        <h2>Glossary ({terms.length} thuật ngữ)</h2>
        <div class="actions">
          <button class="ghost" onClick={() => update({ glossary: STARTER_GLOSSARY })}>
            Nạp bộ mẫu
          </button>
          <button class="ghost" onClick={() => void exportJson()}>
            Xuất JSON
          </button>
          <label class="ghost file">
            Nhập JSON
            <input
              type="file"
              accept="application/json"
              onChange={(e) => {
                const f = (e.target as HTMLInputElement).files?.[0];
                if (f) void importJson(f);
              }}
            />
          </label>
        </div>
      </div>

      <div class="add-row">
        <input
          class="g-term"
          placeholder="Thuật ngữ (vd: npm run start)"
          value={draft.term}
          onInput={(e) =>
            setDraft({ ...draft, term: (e.target as HTMLInputElement).value })
          }
        />
        <select
          value={draft.type}
          onChange={(e) =>
            setDraft({
              ...draft,
              type: (e.target as HTMLSelectElement).value as TermType,
            })
          }
        >
          <option value="command">command</option>
          <option value="code">code</option>
          <option value="jargon">jargon</option>
          <option value="acronym">acronym</option>
        </select>
        <input
          class="g-vi"
          placeholder="Dịch (jargon/acronym)"
          value={draft.vi ?? ''}
          onInput={(e) =>
            setDraft({ ...draft, vi: (e.target as HTMLInputElement).value })
          }
        />
        <button class="primary small" onClick={addTerm}>
          Thêm
        </button>
      </div>

      <table>
        <thead>
          <tr>
            <th>Thuật ngữ</th>
            <th>Loại</th>
            <th>Dịch</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {terms.map((t, i) => (
            <tr key={`${t.term}-${i}`}>
              <td>
                <code>{t.term}</code>
              </td>
              <td>
                <span class={`tag tag-${t.type}`}>{t.type}</span>
              </td>
              <td class="muted">{t.vi ?? '—'}</td>
              <td>
                <button class="ghost danger" onClick={() => removeAt(i)}>
                  Xoá
                </button>
              </td>
            </tr>
          ))}
          {terms.length === 0 && (
            <tr>
              <td colspan={4} class="empty">
                Chưa có thuật ngữ. Thêm hoặc "Nạp bộ mẫu".
              </td>
            </tr>
          )}
        </tbody>
      </table>
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
  children,
}: {
  label: string;
  children: preact.ComponentChildren;
}) {
  return (
    <label class="field">
      <span class="label">{label}</span>
      {children}
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
