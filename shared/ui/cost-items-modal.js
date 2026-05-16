// =============================================================================
// shared/ui/cost-items-modal.js — единый редактор СТАТЕЙ ЗАТРАТ
// =============================================================================
// v0.60.454. По замечанию Пользователя 2026-05-16: «в подборе холода цена
// всё в вариантах; цена и валюта должны быть на каждый пункт; структура
// одинаковая во всех модулях». Самодостаточный (без cooling/meteo-зависимостей)
// порт cooling «Состав оборудования — статьи затрат»: построчная таблица
// Статья / Кол-во / Оборудование(+вал) / Монтаж+ПНР(+вал) / ТО за год(+вал),
// итоги в валюте подбора, авто-конвертация при смене валюты ячейки.
//
// openCostItemsModal(initialItems, displayCurrency, convertFn)
//   → Promise<costItems[] | null>  (null = отмена)
//
// Зависимости: shared/money.js (CURRENCIES/fmtMoney),
//              shared/calc/capex-tco.js (normCostItems/computeEcoTotals).
// =============================================================================

import { CURRENCIES, fmtMoney } from '../money.js';
import { normCostItems, computeEcoTotals } from '../calc/capex-tco.js';

function escHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
const escAttr = escHtml;
function rid() { return 'ci-' + Math.random().toString(36).slice(2, 8); }

let _cssDone = false;
function injectCss() {
  if (_cssDone || typeof document === 'undefined') return;
  _cssDone = true;
  const s = document.createElement('style');
  s.textContent = `
  .ci-modal-ov{position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;z-index:10000;padding:20px}
  .ci-modal{background:#fff;border-radius:10px;max-width:920px;width:100%;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 10px 40px rgba(0,0,0,.25);font:13px/1.4 system-ui,sans-serif}
  .ci-modal-hd{padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:15px;font-weight:600;color:#1f2937;display:flex;justify-content:space-between;align-items:center}
  .ci-modal-bd{padding:14px 16px;overflow:auto}
  .ci-modal-ft{padding:10px 16px;border-top:1px solid #e2e8f0;display:flex;justify-content:flex-end;gap:8px}
  .ci-hint{font-size:11.5px;color:#64748b;margin:0 0 8px}
  .ci-tbl{width:100%;border-collapse:collapse;font-size:12px}
  .ci-tbl th,.ci-tbl td{border:1px solid #e2e8f0;padding:4px 6px;text-align:left}
  .ci-tbl th{background:#f1f5f9;color:#334155;font-weight:600;white-space:nowrap}
  .ci-tbl input,.ci-tbl select{width:100%;box-sizing:border-box;padding:4px 6px;border:1px solid #cbd5e1;border-radius:3px;font:inherit;font-size:12px}
  .ci-tbl input[type=number]{text-align:right}
  .ci-del{background:transparent;border:none;color:#dc2626;cursor:pointer;font-size:14px;padding:2px 6px}
  .ci-del:disabled{opacity:.3;cursor:not-allowed}
  .ci-add{margin-top:8px;padding:6px 12px;border:1px dashed #93c5fd;background:#f0f9ff;color:#1e40af;border-radius:4px;cursor:pointer;font:inherit;font-size:12px}
  .ci-add:hover{background:#dbeafe;border-style:solid}
  .ci-totals{margin-top:12px;padding:10px 12px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:6px;font-size:12.5px}
  .ci-total-row{display:flex;justify-content:space-between;padding:2px 0;color:#065f46}
  .ci-total-grand{border-top:1px solid #6ee7b7;margin-top:4px;padding-top:6px;font-weight:700}
  .ci-btn{padding:7px 16px;border-radius:5px;border:1px solid #cbd5e1;background:#fff;cursor:pointer;font:inherit;font-size:13px}
  .ci-btn-primary{background:#2563eb;color:#fff;border-color:#2563eb}
  .ci-toast{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:#1f2937;color:#fff;padding:8px 14px;border-radius:6px;font-size:12px;z-index:10001;opacity:0;transition:opacity .2s}
  .ci-toast.show{opacity:1}
  `;
  document.head.appendChild(s);
}

function toast(msg, kind) {
  try {
    let t = document.querySelector('.ci-toast');
    if (!t) { t = document.createElement('div'); t.className = 'ci-toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.style.background = kind === 'err' ? '#b91c1c' : (kind === 'ok' ? '#15803d' : '#1f2937');
    t.classList.add('show');
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove('show'), 2600);
  } catch {}
}

const COLS = ['equipmentPrice', 'installPrice', 'maintenancePerYearPrice'];

export function openCostItemsModal(initialItems, displayCurrency = '₸', convertFn = null) {
  injectCss();
  const cur0 = displayCurrency || '₸';
  const items = normCostItems({ costItems: initialItems || [], currency: cur0 }, cur0)
    .map(it => ({ ...it,
      equipmentPrice: { ...it.equipmentPrice },
      installPrice: { ...it.installPrice },
      maintenancePerYearPrice: { ...it.maintenancePerYearPrice } }));

  const curOpts = (sel) => CURRENCIES.map(c =>
    `<option value="${c.code}"${c.code === sel ? ' selected' : ''} title="${escAttr(c.label)}">${c.code}</option>`).join('');

  const cell = (it, col) => `
    <td><input type="number" min="0" step="100" class="ci-val" data-col="${col}" value="${Number(it[col] && it[col].value) || 0}"></td>
    <td style="width:62px"><select class="ci-cur" data-col="${col}">${curOpts((it[col] && it[col].currency) || cur0)}</select></td>`;

  const renderRows = () => items.map((it, idx) => {
    const auto = !!it.linkedGroupId;
    return `<tr data-row="${idx}">
      <td>${auto ? '🔒 ' : ''}<input type="text" class="ci-label" value="${escAttr(it.label || '')}" placeholder="Например: ИБП Kehua MR33…"></td>
      <td style="width:64px"><input type="number" min="1" step="1" class="ci-qty" value="${Number(it.qty) || 1}"${auto ? ' readonly style="background:#f1f5f9;color:#64748b"' : ''}></td>
      ${cell(it, 'equipmentPrice')}
      ${cell(it, 'installPrice')}
      ${cell(it, 'maintenancePerYearPrice')}
      <td style="width:34px;text-align:center"><button type="button" class="ci-del"${auto ? ' disabled title="Авто-строка"' : ' title="Удалить позицию"'}>×</button></td>
    </tr>`;
  }).join('');

  const renderTotals = () => {
    const t = computeEcoTotals({ costItems: items, currency: cur0 }, cur0, convertFn);
    const f = (v) => fmtMoney(v, cur0);
    return `
      <div class="ci-total-row"><span>Σ Оборудование:</span><b>${f(t.equipmentCost)}</b></div>
      <div class="ci-total-row"><span>Σ Монтаж/ПНР:</span><b>${f(t.installationCost)}</b></div>
      <div class="ci-total-row"><span>Σ ТО за год:</span><b>${f(t.maintenanceRubPerYear)}</b></div>
      <div class="ci-total-row ci-total-grand"><span>CAPEX (год 0):</span><b>${f(t.equipmentCost + t.installationCost)}</b></div>`;
  };

  return new Promise((resolve) => {
    const ov = document.createElement('div');
    ov.className = 'ci-modal-ov';
    ov.innerHTML = `
      <div class="ci-modal" role="dialog" aria-modal="true">
        <div class="ci-modal-hd"><span>📦 Состав оборудования — статьи затрат</span></div>
        <div class="ci-modal-bd">
          <p class="ci-hint">Одна строка = одно изделие. Цена и валюта — на каждый пункт; итоги — в валюте подбора (${escHtml(cur0)}).</p>
          <table class="ci-tbl">
            <thead><tr>
              <th title="Описание позиции">Статья</th>
              <th title="Количество одинаковых единиц">Кол-во</th>
              <th colspan="2" title="Стоимость единицы оборудования + валюта">Оборудование</th>
              <th colspan="2" title="Стоимость монтажа+ПНР + валюта">Монтаж+ПНР</th>
              <th colspan="2" title="Стоимость ТО за год + валюта">ТО за год</th>
              <th></th>
            </tr></thead>
            <tbody id="ci-tb">${renderRows()}</tbody>
          </table>
          <button type="button" id="ci-add" class="ci-add">+ Добавить позицию</button>
          <div class="ci-totals" id="ci-tot">${renderTotals()}</div>
        </div>
        <div class="ci-modal-ft">
          <button type="button" class="ci-btn" id="ci-cancel">Отмена</button>
          <button type="button" class="ci-btn ci-btn-primary" id="ci-ok">OK</button>
        </div>
      </div>`;
    document.body.appendChild(ov);

    const tb = ov.querySelector('#ci-tb');
    const tot = ov.querySelector('#ci-tot');
    const repaintTotals = () => { tot.innerHTML = renderTotals(); };
    const repaintRows = () => { tb.innerHTML = renderRows(); repaintTotals(); };

    function syncDom() {
      tb.querySelectorAll('tr[data-row]').forEach(tr => {
        const i = Number(tr.dataset.row);
        if (!items[i]) return;
        items[i].label = tr.querySelector('.ci-label')?.value || '';
        if (!items[i].linkedGroupId) items[i].qty = Number(tr.querySelector('.ci-qty')?.value) || 1;
        COLS.forEach(col => {
          const v = tr.querySelector(`.ci-val[data-col="${col}"]`);
          const c = tr.querySelector(`.ci-cur[data-col="${col}"]`);
          if (!items[i][col]) items[i][col] = { value: 0, currency: cur0 };
          if (v) items[i][col].value = Number(v.value) || 0;
          if (c) items[i][col].currency = c.value;
        });
      });
    }

    ov.addEventListener('input', (e) => {
      const tr = e.target.closest('tr[data-row]'); if (!tr) return;
      const i = Number(tr.dataset.row); if (!items[i]) return;
      if (e.target.classList.contains('ci-label')) items[i].label = e.target.value;
      else if (e.target.classList.contains('ci-qty') && !items[i].linkedGroupId) items[i].qty = Number(e.target.value) || 1;
      else if (e.target.classList.contains('ci-val')) {
        const col = e.target.dataset.col;
        if (!items[i][col]) items[i][col] = { value: 0, currency: cur0 };
        items[i][col].value = Number(e.target.value) || 0;
      }
      repaintTotals();
    });
    ov.addEventListener('change', (e) => {
      if (!e.target.classList.contains('ci-cur')) return;
      const tr = e.target.closest('tr[data-row]'); if (!tr) return;
      const i = Number(tr.dataset.row); if (!items[i]) return;
      const col = e.target.dataset.col;
      if (!items[i][col]) items[i][col] = { value: 0, currency: cur0 };
      const oldCur = items[i][col].currency, newCur = e.target.value;
      if (oldCur !== newCur) {
        const cv = Number(items[i][col].value) || 0;
        if (cv > 0) {
          if (!convertFn) toast(`Курсы валют не загружены (${oldCur}→${newCur})`, 'err');
          else {
            const nv = convertFn(cv, oldCur, newCur);
            if (Number.isFinite(nv) && nv > 0) {
              items[i][col].value = +(nv.toFixed(2));
              const vi = tr.querySelector(`.ci-val[data-col="${col}"]`);
              if (vi) vi.value = items[i][col].value;
              toast(`${cv} ${oldCur} → ${items[i][col].value} ${newCur}`, 'ok');
            } else toast(`Курс ${oldCur}→${newCur} не найден`, 'err');
          }
        }
        items[i][col].currency = newCur;
      }
      repaintTotals();
    });
    ov.addEventListener('click', (e) => {
      const del = e.target.closest('.ci-del');
      if (del && !del.disabled) {
        const i = Number(del.closest('tr[data-row]').dataset.row);
        if (items[i] && items[i].linkedGroupId) return;
        items.splice(i, 1); repaintRows(); return;
      }
      if (e.target.id === 'ci-add') {
        items.push({ id: rid(), label: '', qty: 1,
          equipmentPrice: { value: 0, currency: cur0 },
          installPrice: { value: 0, currency: cur0 },
          maintenancePerYearPrice: { value: 0, currency: cur0 } });
        repaintRows(); return;
      }
      if (e.target === ov || e.target.id === 'ci-cancel') { ov.remove(); resolve(null); return; }
      if (e.target.id === 'ci-ok') {
        syncDom();
        const cleaned = items.filter(it => (it.label && it.label.trim())
          || COLS.some(c => Number(it[c] && it[c].value) > 0));
        ov.remove(); resolve(cleaned);
      }
    });
  });
}
