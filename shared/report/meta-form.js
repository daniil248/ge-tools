// ======================================================================
// shared/report/meta-form.js
// Форма «Реквизиты документа» — данные КОНКРЕТНОГО отчёта, которые
// подставляются в плейсхолдеры шаблона ({{meta.*}} / {{meta.custom.*}}):
// кому, кто составил, компания, дата, № документа, версия и т.п.
//
//   import { collectReportMeta } from 'shared/report/meta-form.js';
//   const meta = await collectReportMeta({ defaults: {...}, persistKey });
//   if (!meta) return;            // пользователь отменил
//   tpl.meta = { ...tpl.meta, ...meta.meta };
//   tpl.meta.custom = { ...(tpl.meta.custom||{}), ...meta.custom };
//
// Значения запоминаются (persistKey → localStorage) и предзаполняются
// в следующий раз — чтобы не вводить повторно.
// ======================================================================

const LS_PREFIX = 'raschet.reportMeta.';

// Поля: id → { label, custom? (в meta.custom, иначе meta) }
const ALL_FIELDS = [
  { id: 'author',         label: 'Составил (Ф.И.О.)' },
  { id: 'recipient',      label: 'Кому (получатель)',           custom: true },
  { id: 'recipientPost',  label: 'Должность получателя',        custom: true },
  { id: 'companyName',    label: 'Компания',                    custom: true },
  { id: 'companyAddr',    label: 'Адрес компании',              custom: true },
  { id: 'companyPhone',   label: 'Телефон компании',            custom: true },
  { id: 'signRole',       label: 'Должность подписанта',        custom: true },
  { id: 'signName',       label: 'Ф.И.О. подписанта',           custom: true },
  { id: 'docNo',          label: '№ документа',                 custom: true },
  { id: 'version',        label: 'Версия отчёта',               custom: true },
  { id: 'date',           label: 'Дата (пусто = сегодня)',      custom: true },
];

function loadPersisted(key) {
  if (!key) return {};
  try { return JSON.parse(localStorage.getItem(LS_PREFIX + key) || '{}') || {}; }
  catch { return {}; }
}
function savePersisted(key, obj) {
  if (!key) return;
  try { localStorage.setItem(LS_PREFIX + key, JSON.stringify(obj)); } catch { /* noop */ }
}

/**
 * Показать модал «Реквизиты документа».
 * opts:
 *   defaults  — { author, recipient, companyName, ... } предзаполнение
 *               (напр. из проекта); приоритет ниже сохранённых значений,
 *               но выше пустых.
 *   persistKey — ключ для запоминания (напр. project id или 'global').
 *   title     — заголовок модала.
 * Возвращает Promise<{ meta:{author?}, custom:{...} } | null>.
 */
export function collectReportMeta(opts = {}) {
  const { defaults = {}, persistKey = 'global', title = 'Реквизиты документа' } = opts;
  // Только поля, реально присутствующие в ЭТОМ документе (плейсхолдеры
  // шаблона). Если не передано/пусто — показываем все (fallback).
  const only = opts.onlyKeys
    ? (opts.onlyKeys instanceof Set ? opts.onlyKeys : new Set(opts.onlyKeys))
    : null;
  const FIELDS = (only && only.size)
    ? ALL_FIELDS.filter(f => only.has(f.id))
    : ALL_FIELDS;
  const saved = loadPersisted(persistKey);
  // Приоритет: сохранённое > defaults(проект) > ''
  const initial = {};
  for (const f of FIELDS) {
    initial[f.id] = (saved[f.id] != null && saved[f.id] !== '')
      ? saved[f.id]
      : (defaults[f.id] != null ? defaults[f.id] : '');
  }

  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.6);z-index:99998;display:flex;align-items:center;justify-content:center;padding:24px;font:13px/1.4 system-ui,sans-serif';
    const box = document.createElement('div');
    box.style.cssText = 'background:#fff;border-radius:8px;box-shadow:0 16px 48px rgba(0,0,0,0.35);width:min(560px,95vw);max-height:90vh;display:flex;flex-direction:column;overflow:hidden';
    box.innerHTML =
      '<div style="padding:14px 20px;border-bottom:1px solid #e2e8f0;background:#f8fafc;font-weight:700;font-size:15px;color:#0f172a">' +
      title + '</div>' +
      '<div style="padding:8px 20px 4px;font-size:11.5px;color:#64748b">Эти данные подставятся в шаблон (плейсхолдеры <code>{{meta.author}}</code>, <code>{{meta.custom.recipient}}</code> и т.п.). Запомнятся для следующего отчёта.</div>' +
      '<div id="rmf-body" style="flex:1;overflow:auto;padding:8px 20px 16px"></div>' +
      '<div style="padding:12px 20px;border-top:1px solid #e2e8f0;background:#f8fafc;display:flex;justify-content:flex-end;gap:8px">' +
      '<button type="button" id="rmf-skip" style="padding:8px 14px;background:#fff;border:1px solid #cbd5e1;color:#475569;border-radius:5px;cursor:pointer;font:inherit">Пропустить</button>' +
      '<button type="button" id="rmf-ok" style="padding:8px 16px;background:#1976d2;color:#fff;border:0;border-radius:5px;cursor:pointer;font:inherit;font-weight:600">Применить</button>' +
      '</div>';
    backdrop.appendChild(box);
    const bodyEl = box.querySelector('#rmf-body');
    const inputs = {};
    for (const f of FIELDS) {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'margin-bottom:10px';
      const lab = document.createElement('label');
      lab.textContent = f.label;
      lab.style.cssText = 'display:block;font-size:11.5px;color:#475569;margin-bottom:3px';
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.value = initial[f.id] || '';
      inp.style.cssText = 'width:100%;box-sizing:border-box;padding:7px 9px;border:1px solid #cbd5e1;border-radius:5px;font:inherit';
      inputs[f.id] = inp;
      wrap.appendChild(lab); wrap.appendChild(inp);
      bodyEl.appendChild(wrap);
    }
    document.body.appendChild(backdrop);
    const first = bodyEl.querySelector('input');
    if (first) { first.focus(); first.select(); }

    const collect = () => {
      const meta = {};
      const custom = {};
      const persist = {};
      for (const f of FIELDS) {
        const v = (inputs[f.id].value || '').trim();
        persist[f.id] = v;
        if (!v) continue;
        if (f.custom) custom[f.id] = v;
        else meta[f.id] = v;
      }
      savePersisted(persistKey, persist);
      return { meta, custom };
    };
    const close = (val) => { backdrop.remove(); resolve(val); };
    box.querySelector('#rmf-ok').addEventListener('click', () => close(collect()));
    box.querySelector('#rmf-skip').addEventListener('click', () => close({ meta: {}, custom: {} }));
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(null); });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); close(collect()); }
      if (e.key === 'Escape') close(null);
    });
  });
}
