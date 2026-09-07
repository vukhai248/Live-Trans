import { useState } from 'preact/hooks';
import {
  STARTER_GLOSSARY,
  type GlossaryDoc,
  type GlossaryTerm,
  type TermType,
} from '@/lib/glossary/types';

export interface GlossaryEditorProps {
  glossary: GlossaryDoc;
  onChange: (glossary: GlossaryDoc) => void;
  variant?: 'compact' | 'full';
}

export function GlossaryEditor({
  glossary,
  onChange,
  variant = 'full',
}: GlossaryEditorProps) {
  const terms = glossary?.terms || [];
  const [draft, setDraft] = useState<GlossaryTerm>({
    term: '',
    type: variant === 'compact' ? 'code' : 'command',
    vi: '',
  });

  function addTerm(): void {
    if (!draft.term.trim()) return;
    onChange({
      version: 1,
      terms: [
        ...terms,
        {
          term: draft.term.trim(),
          type: draft.type,
          vi: draft.vi?.trim() || undefined,
        },
      ],
    });
    setDraft({ term: '', type: variant === 'compact' ? 'code' : 'command', vi: '' });
  }

  function removeAt(index: number): void {
    onChange({
      version: 1,
      terms: terms.filter((_, idx) => idx !== index),
    });
  }

  function loadStarter(): void {
    onChange(STARTER_GLOSSARY);
  }

  async function exportJson(): Promise<void> {
    const blob = new Blob([JSON.stringify(glossary, null, 2)], {
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
      onChange({ version: 1, terms: parsed.terms });
    } catch {
      window.alert('File glossary không hợp lệ (cần {"version":1,"terms":[...]}).');
    }
  }

  if (variant === 'compact') {
    return (
      <div class="tab-content">
        <div class="glossary-header">
          <div class="section-title">Bảo toàn thuật ngữ ({terms.length})</div>
          <button class="text-link" onClick={loadStarter}>
            Nạp bộ mẫu
          </button>
        </div>

        {/* Quick Add Form */}
        <div class="glossary-add-box">
          <input
            type="text"
            placeholder="Thuật ngữ (vd: useEffect, npm run start...)"
            value={draft.term}
            onInput={(e) =>
              setDraft({ ...draft, term: (e.target as HTMLInputElement).value })
            }
          />
          <div class="glossary-row">
            <select
              value={draft.type}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  type: (e.target as HTMLSelectElement).value as TermType,
                })
              }
            >
              <option value="code">Mã nguồn (code)</option>
              <option value="command">Lệnh shell (command)</option>
              <option value="jargon">Thuật ngữ dịch (jargon)</option>
              <option value="acronym">Từ viết tắt (acronym)</option>
            </select>
            <input
              type="text"
              placeholder={draft.type === 'jargon' ? 'Dịch là (vd: hạ gradient)' : 'Ghi chú (tuỳ chọn)'}
              value={draft.vi ?? ''}
              onInput={(e) =>
                setDraft({ ...draft, vi: (e.target as HTMLInputElement).value })
              }
            />
          </div>
          <button
            class="ghost btn-add"
            onClick={addTerm}
            disabled={!draft.term.trim()}
          >
            + Thêm thuật ngữ
          </button>
        </div>

        {/* Term List */}
        <div class="glossary-list">
          {terms.length === 0 ? (
            <div class="empty-hint">Chưa có thuật ngữ nào. Hãy thêm thuật ngữ cần bảo toàn.</div>
          ) : (
            terms.map((t, idx) => (
              <div class="glossary-item" key={`${t.term}-${idx}`}>
                <div class="glossary-item-info">
                  <span class="glossary-item-term">{t.term}</span>
                  <span class={`type-tag type-${t.type}`}>{t.type}</span>
                  {t.vi && <span class="glossary-item-vi">➔ {t.vi}</span>}
                </div>
                <button
                  class="btn-delete"
                  onClick={() => removeAt(idx)}
                  title="Xóa thuật ngữ"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <section class="card">
      <div class="glossary-head">
        <h2>Glossary ({terms.length} thuật ngữ)</h2>
        <div class="actions">
          <button class="ghost" onClick={loadStarter}>
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
