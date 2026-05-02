// =============================================================================
// service/ui/work-catalog.js — UI каталога типовых работ сервиса
// =============================================================================
// Phase 24.2 UI follow-up: модалка для CRUD пользовательских шаблонов работ.
// Seed-шаблоны (id="seed-...") read-only, помечены 📦; user-шаблоны
// редактируемы (✏) и удаляемы (🗑).
//
// Открывается через кнопку «📚 Каталог работ» в сайдбаре service-модуля.

import {
  SEED_TEMPLATES, listTemplates, addTemplate, updateTemplate,
  deleteTemplate, resetUserTemplates,
} from '../catalog/work-templates.js';
import { ORDER_TYPES, POSITION_CATEGORIES, UNITS } from '../calc/order-model.js';
import { escAttr, escHtml, modalOpen, toast } from '../../meteo/util.js';

/**
 * Открыть модалку каталога. Возвращает Promise<void> — каталог обновляется
 * через pub/sub (onWorkTemplatesChange), вызывающий код может слушать.
 */
export async function openWorkCatalogModal() {
  let activeType = 'install';

  const renderRows = () => {
    const rows = listTemplates(activeType);
    if (!rows.length) return '<tr><td colspan="6" class="muted" style="text-align:center;padding:20px">Шаблонов нет.</td></tr>';
    return rows.map(t => {
      const catLabel = POSITION_CATEGORIES.find(c => c.id === t.category)?.label || t.category;
      const isSeed = !t.isUser;
      const lock = isSeed ? '📦' : '✏';
      const editBtn = isSeed
        ? '<button type="button" disabled style="opacity:0.3;cursor:not-allowed" title="Встроенный шаблон — нельзя редактировать. Скопируйте его кнопкой 📋 если нужно изменить.">✏</button>'
        : `<button type="button" class="wc-edit" data-id="${escAttr(t.id)}" title="Редактировать пользовательский шаблон">✏</button>`;
      const cloneBtn = `<button type="button" class="wc-clone" data-id="${escAttr(t.id)}" title="Скопировать как пользовательский шаблон (можно потом редактировать)">📋</button>`;
      const delBtn = isSeed
        ? '<button type="button" disabled style="opacity:0.3;cursor:not-allowed" title="Встроенный шаблон — нельзя удалить">🗑</button>'
        : `<button type="button" class="wc-del" data-id="${escAttr(t.id)}" title="Удалить пользовательский шаблон">🗑</button>`;
      return `<tr data-tid="${escAttr(t.id)}">
        <td title="${isSeed ? 'Встроенный (read-only)' : 'Пользовательский'}">${lock}</td>
        <td>${escHtml(t.label)}</td>
        <td title="${escAttr(POSITION_CATEGORIES.find(c => c.id === t.category)?.tip || '')}">${escHtml(catLabel)}</td>
        <td>${escHtml(t.unit)}</td>
        <td class="num">${(t.costPrice || 0).toLocaleString('ru-RU')} ₽</td>
        <td class="num">${(t.clientPrice || 0).toLocaleString('ru-RU')} ₽</td>
        <td style="white-space:nowrap">${cloneBtn}${editBtn}${delBtn}</td>
      </tr>`;
    }).join('');
  };

  const typeTabs = ORDER_TYPES.map(t =>
    `<button type="button" class="wc-tab${t.id === activeType ? ' active' : ''}" data-type="${escAttr(t.id)}" title="${escAttr(t.desc)}">${escHtml(t.label)}</button>`
  ).join('');

  const body = `
    <p class="muted" style="font-size:11.5px;margin:0 0 8px">
      📦 — встроенные (read-only, всегда доступны). ✏ — пользовательские. Используйте 📋 чтобы скопировать встроенный как редактируемый.
    </p>
    <div class="wc-tabs" style="display:flex;gap:4px;border-bottom:2px solid #e2e8f0;margin-bottom:8px">${typeTabs}</div>
    <div class="wc-table-wrap" style="max-height:50vh;overflow:auto;border:1px solid #e2e8f0;border-radius:3px">
      <table class="wc-table" style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr>
            <th style="width:32px"></th>
            <th>Название работы / материала</th>
            <th>Категория</th>
            <th style="width:80px">Ед.</th>
            <th class="num" style="width:100px">Себес/ед</th>
            <th class="num" style="width:100px">Клиент/ед</th>
            <th style="width:90px"></th>
          </tr>
        </thead>
        <tbody id="wc-tbody">${renderRows()}</tbody>
      </table>
    </div>
    <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
      <button type="button" id="wc-add" class="sv-btn-primary" title="Создать новый пользовательский шаблон в текущей категории">+ Добавить шаблон</button>
      <button type="button" id="wc-reset" class="sv-btn-ghost" style="margin-left:auto" title="Удалить ВСЕ пользовательские шаблоны (встроенные останутся)">🗑 Сбросить пользовательские</button>
    </div>
  `;

  const promise = modalOpen(
    '<h3>📚 Каталог типовых работ сервиса</h3>',
    body,
    async () => ({ ok: true })  // OK просто закрывает модалку
  );

  requestAnimationFrame(() => bindEvents());
  await promise;

  function bindEvents() {
    const overlay = document.querySelector('.mt-modal-overlay');
    if (!overlay) return;
    const tbody = overlay.querySelector('#wc-tbody');
    const refresh = () => { if (tbody) tbody.innerHTML = renderRows(); };

    // Type tabs
    overlay.querySelectorAll('.wc-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        activeType = btn.dataset.type;
        overlay.querySelectorAll('.wc-tab').forEach(b => b.classList.toggle('active', b === btn));
        refresh();
      });
    });

    // Add new
    const addBtn = overlay.querySelector('#wc-add');
    if (addBtn) addBtn.addEventListener('click', async () => {
      const tpl = await editTemplateForm(null);
      if (!tpl) return;
      addTemplate(activeType, tpl);
      toast(`✓ Шаблон «${tpl.label}» добавлен`, 'ok');
      refresh();
    });

    // Reset all user templates
    const resetBtn = overlay.querySelector('#wc-reset');
    if (resetBtn) resetBtn.addEventListener('click', async () => {
      const ok = await modalOpen('<h3>Подтверждение</h3>',
        '<p>Удалить ВСЕ пользовательские шаблоны во всех категориях? Встроенные шаблоны останутся.</p>',
        async () => ({ ok: true })
      );
      if (!ok) return;
      resetUserTemplates();
      toast('Пользовательские шаблоны удалены', 'info');
      refresh();
    });

    // Row actions: clone / edit / delete
    overlay.addEventListener('click', async (ev) => {
      const tr = ev.target.closest('tr[data-tid]');
      if (!tr) return;
      const tid = tr.dataset.tid;
      const all = listTemplates(activeType);
      const t = all.find(x => x.id === tid);
      if (!t) return;

      if (ev.target.closest('.wc-clone')) {
        const tpl = { ...t, label: t.label + ' (копия)' };
        delete tpl.id;
        delete tpl.isUser;
        const created = addTemplate(activeType, tpl);
        toast(`✓ Скопирован: «${created.label}»`, 'ok');
        refresh();
        return;
      }
      if (ev.target.closest('.wc-edit') && t.isUser) {
        const updated = await editTemplateForm(t);
        if (!updated) return;
        updateTemplate(activeType, tid, updated);
        toast(`✓ Обновлён: «${updated.label}»`, 'ok');
        refresh();
        return;
      }
      if (ev.target.closest('.wc-del') && t.isUser) {
        const ok = await modalOpen('<h3>Подтверждение</h3>',
          `<p>Удалить шаблон «${escHtml(t.label)}»? Уже созданные наряды НЕ затрагиваются.</p>`,
          async () => ({ ok: true })
        );
        if (!ok) return;
        deleteTemplate(activeType, tid);
        toast(`Шаблон удалён`, 'info');
        refresh();
        return;
      }
    });
  }
}

/**
 * Modal-форма редактирования / создания шаблона работы.
 * @param {object|null} initial — null для нового шаблона
 * @returns {Promise<object|null>} {label, category, unit, costPrice, clientPrice} или null
 */
async function editTemplateForm(initial) {
  const t = initial || { label: '', category: 'labor', unit: 'комплект', costPrice: 0, clientPrice: 0 };
  const catOpts = POSITION_CATEGORIES.map(c =>
    `<option value="${c.id}"${c.id === t.category ? ' selected' : ''} title="${escAttr(c.tip)}">${escHtml(c.label)}</option>`
  ).join('');
  const unitOpts = UNITS.map(u =>
    `<option value="${u}"${u === t.unit ? ' selected' : ''}>${escHtml(u)}</option>`
  ).join('');

  const body = `
    <label title="Описание работы или материала. Будет видно в picker'е шаблонов и в наряде.">
      <span style="display:block;font-size:11.5px;color:#475569;margin-bottom:3px">Название</span>
      <input type="text" id="wc-f-label" value="${escAttr(t.label)}" placeholder="напр. Монтаж чиллера 200 кВт" style="width:100%;padding:6px 8px;border:1px solid #cbd5e1;border-radius:3px">
    </label>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px">
      <label title="Категория работы — влияет на группировку в КП и распределение себестоимости.">
        <span style="display:block;font-size:11.5px;color:#475569;margin-bottom:3px">Категория</span>
        <select id="wc-f-cat" style="width:100%;padding:6px 8px;border:1px solid #cbd5e1;border-radius:3px">${catOpts}</select>
      </label>
      <label title="Единица измерения для qty.">
        <span style="display:block;font-size:11.5px;color:#475569;margin-bottom:3px">Единица</span>
        <select id="wc-f-unit" style="width:100%;padding:6px 8px;border:1px solid #cbd5e1;border-radius:3px">${unitOpts}</select>
      </label>
      <label title="Себестоимость одной единицы (₽). Используется при расчёте маржи.">
        <span style="display:block;font-size:11.5px;color:#475569;margin-bottom:3px">Себес/ед, ₽</span>
        <input type="number" min="0" step="100" id="wc-f-cost" value="${Number(t.costPrice) || 0}" style="width:100%;padding:6px 8px;border:1px solid #cbd5e1;border-radius:3px;text-align:right">
      </label>
      <label title="Цена для клиента за одну единицу (₽).">
        <span style="display:block;font-size:11.5px;color:#475569;margin-bottom:3px">Клиент/ед, ₽</span>
        <input type="number" min="0" step="100" id="wc-f-client" value="${Number(t.clientPrice) || 0}" style="width:100%;padding:6px 8px;border:1px solid #cbd5e1;border-radius:3px;text-align:right">
      </label>
    </div>
    <p class="muted" style="font-size:11px;margin:8px 0 0">💡 Цены в шаблоне — в ₽. После добавления в наряд можно переключить валюту в строке.</p>
  `;
  const result = await modalOpen(
    `<h3>${initial ? '✏ Редактирование шаблона' : '+ Новый шаблон'}</h3>`,
    body,
    async () => {
      const label = document.getElementById('wc-f-label')?.value?.trim() || '';
      if (!label) { toast('Укажите название', 'err'); return null; }
      return {
        ok: true,
        payload: {
          label,
          category: document.getElementById('wc-f-cat')?.value || 'labor',
          unit: document.getElementById('wc-f-unit')?.value || 'комплект',
          costPrice: Number(document.getElementById('wc-f-cost')?.value) || 0,
          clientPrice: Number(document.getElementById('wc-f-client')?.value) || 0,
        },
      };
    }
  );
  return result?.payload || null;
}
