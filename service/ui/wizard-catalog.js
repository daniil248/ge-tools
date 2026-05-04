// =============================================================================
// service/ui/wizard-catalog.js — Phase 42.4 (v0.60.118)
// =============================================================================
// CRUD-модалка для пользовательских / org-сценариев мастера составления
// нарядов. Аналогично work-catalog.js (Phase 41.2 pattern):
//   📦 seed — встроенные read-only.
//   👥 org  — общие шаблоны организации (видны всем членам команды).
//   ✏ user  — личные.
//
// Действия: Clone (📋) / Edit (✏ через JSON editor) / Promote (↑) /
// Demote (↓) / Delete (🗑).
//
// Edit — JSON-editor (полный DSL): textarea с JSON, валидация перед save.
// =============================================================================

import {
  SEED_WIZARDS, listWizards, addUserWizard, updateUserWizard, deleteUserWizard,
  updateOrgWizard, deleteOrgWizard, promoteWizardToOrg, demoteWizardToUser,
  cloneToUser, validateWizard, getWizard,
} from '../catalog/wizards/index.js';
import { ORDER_TYPES } from '../calc/order-model.js';
import { escAttr, escHtml, modalOpen, toast } from '../../meteo/util.js';

export async function openWizardCatalogModal() {
  let activeType = 'maintenance';

  const renderRows = () => {
    const rows = listWizards(activeType);
    if (!rows.length) return '<tr><td colspan="6" class="muted" style="text-align:center;padding:20px">Сценариев нет.</td></tr>';
    return rows.map(w => {
      const scope = w.scope || 'seed';
      const lock = scope === 'seed' ? '📦' : scope === 'org' ? '👥' : '✏';
      const scopeTitle = scope === 'seed'
        ? 'Встроенный сценарий — поставляется с платформой, всем доступен.'
        : scope === 'org'
          ? 'Общий сценарий организации — виден всем членам команды.'
          : 'Личный сценарий — виден только вам.';
      const editBtn = scope === 'seed'
        ? '<button type="button" disabled style="opacity:0.3;cursor:not-allowed" title="Встроенный сценарий — нельзя редактировать. Скопируйте через 📋 для редактирования.">✏</button>'
        : `<button type="button" class="wzc-edit" data-id="${escAttr(w.id)}" data-scope="${escAttr(scope)}" title="Редактировать (JSON editor)">✏</button>`;
      const cloneBtn = `<button type="button" class="wzc-clone" data-id="${escAttr(w.id)}" title="Скопировать как личный сценарий (можно потом редактировать)">📋</button>`;
      const promoteBtn = scope === 'user'
        ? `<button type="button" class="wzc-promote" data-id="${escAttr(w.id)}" title="Опубликовать в общий каталог организации">↑</button>`
        : scope === 'org'
          ? `<button type="button" class="wzc-demote" data-id="${escAttr(w.id)}" title="Вернуть в личные">↓</button>`
          : '';
      const delBtn = scope === 'seed'
        ? '<button type="button" disabled style="opacity:0.3;cursor:not-allowed" title="Встроенный — нельзя удалить">🗑</button>'
        : `<button type="button" class="wzc-del" data-id="${escAttr(w.id)}" data-scope="${escAttr(scope)}" title="Удалить ${scope === 'org' ? 'общий сценарий организации' : 'личный сценарий'}">🗑</button>`;
      const rowBg = scope === 'org' ? 'background:#eff6ff' : (scope === 'user' ? 'background:#fefce8' : '');
      const paramsCount = Array.isArray(w.params) ? w.params.length : 0;
      const rulesCount = Array.isArray(w.suggestions) ? w.suggestions.reduce((s, g) => s + (Array.isArray(g.rules) ? g.rules.length : 0), 0) : 0;
      return `<tr data-wid="${escAttr(w.id)}" data-scope="${escAttr(scope)}" style="${rowBg}">
        <td title="${escAttr(scopeTitle)}">${lock}</td>
        <td>${w.icon || '🪄'} ${escHtml(w.title || '(без имени)')}</td>
        <td class="muted" style="font-size:11px;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escAttr(w.description || '')}">${escHtml(w.description || '')}</td>
        <td class="num">${paramsCount}</td>
        <td class="num">${rulesCount}</td>
        <td style="white-space:nowrap">${cloneBtn}${editBtn}${promoteBtn}${delBtn}</td>
      </tr>`;
    }).join('');
  };

  const typeTabs = ORDER_TYPES.map(t =>
    `<button type="button" class="wzc-tab${t.id === activeType ? ' active' : ''}" data-type="${escAttr(t.id)}" title="${escAttr(t.desc)}">${escHtml(t.label)}</button>`
  ).join('');

  const body = `
    <p class="muted" style="font-size:11.5px;margin:0 0 8px">
      📦 встроенные · 👥 общие организации · ✏ личные. Используйте 📋 для копирования встроенного, ↑ для публикации в общий, ↓ для возврата в личные. Edit = JSON-editor (полный DSL).
    </p>
    <div class="wzc-tabs" style="display:flex;gap:4px;border-bottom:2px solid #e2e8f0;margin-bottom:8px">${typeTabs}</div>
    <div class="wzc-table-wrap" style="max-height:55vh;overflow:auto;border:1px solid #e2e8f0;border-radius:3px">
      <table class="wzc-table" style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="background:#f1f5f9">
            <th style="padding:6px 8px;text-align:left;width:32px"></th>
            <th style="padding:6px 8px;text-align:left">Название</th>
            <th style="padding:6px 8px;text-align:left">Описание</th>
            <th style="padding:6px 8px;text-align:right;width:60px" title="Кол-во параметров (вопросов мастера)">Парам</th>
            <th style="padding:6px 8px;text-align:right;width:60px" title="Кол-во правил-предложений">Правил</th>
            <th style="padding:6px 8px;text-align:left;width:120px">Действия</th>
          </tr>
        </thead>
        <tbody id="wzc-tbody">${renderRows()}</tbody>
      </table>
    </div>
    <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
      <button type="button" id="wzc-add" class="sv-btn-primary" title="Создать пустой пользовательский сценарий с заготовкой структуры">+ Новый сценарий</button>
      <span class="muted" style="margin-left:auto;font-size:10.5px;align-self:center">DSL: см. <code>service/catalog/wizards/index.js</code></span>
    </div>
  `;

  const promise = modalOpen(
    '<h3>🪄 Каталог сценариев мастера нарядов</h3>',
    body,
    async () => ({ ok: true })
  );

  requestAnimationFrame(() => bindEvents());
  await promise;

  function bindEvents() {
    const overlay = document.querySelector('.mt-modal-overlay');
    if (!overlay) return;
    const tbody = overlay.querySelector('#wzc-tbody');
    const refresh = () => { if (tbody) tbody.innerHTML = renderRows(); };

    overlay.querySelectorAll('.wzc-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        activeType = btn.dataset.type;
        overlay.querySelectorAll('.wzc-tab').forEach(b => b.classList.toggle('active', b === btn));
        refresh();
      });
    });

    overlay.querySelector('#wzc-add')?.addEventListener('click', async () => {
      // Создаём blank-сценарий — для этого активного orderType.
      const blank = {
        title: 'Новый сценарий',
        icon: '🪄',
        description: 'Опишите назначение мастера.',
        appliesTo: [activeType],
        params: [
          { id: 'param1', label: 'Параметр 1', type: 'number', default: 0 },
        ],
        suggestions: [
          { group: '🔧 Работы', rules: [
            { when: 'true', label: 'Выезд бригады', qty: 1, unit: 'выезд', category: 'labor', costPrice: 10000, clientPrice: 18000, ask: 'Добавить выезд?' },
          ]},
        ],
      };
      const created = addUserWizard(blank);
      toast(`✓ Создан: «${created.title}». Откройте редактор для настройки.`, 'ok');
      refresh();
    });

    overlay.addEventListener('click', async (ev) => {
      const tr = ev.target.closest('tr[data-wid]');
      if (!tr) return;
      const wid = tr.dataset.wid;
      const scope = tr.dataset.scope || 'seed';

      if (ev.target.closest('.wzc-clone')) {
        const cloned = cloneToUser(wid);
        if (cloned) toast(`📋 Скопирован: «${cloned.title}»`, 'ok');
        refresh();
        return;
      }
      if (ev.target.closest('.wzc-edit') && (scope === 'user' || scope === 'org')) {
        const wz = getWizard(wid);
        if (!wz) return;
        const updated = await editWizardJson(wz);
        if (!updated) return;
        if (scope === 'org') updateOrgWizard(wid, updated);
        else updateUserWizard(wid, updated);
        toast(`✓ Обновлён: «${updated.title}»`, 'ok');
        refresh();
        return;
      }
      if (ev.target.closest('.wzc-del') && (scope === 'user' || scope === 'org')) {
        const scopeLbl = scope === 'org' ? 'общий сценарий организации' : 'личный сценарий';
        const ok = await modalOpen('<h3>Подтверждение</h3>',
          `<p>Удалить ${scopeLbl}?${scope === 'org' ? '<br><b style="color:#dc2626">⚠ Будет удалён у всех членов организации.</b>' : ''}</p>`,
          async () => ({ ok: true })
        );
        if (!ok) return;
        if (scope === 'org') deleteOrgWizard(wid); else deleteUserWizard(wid);
        toast('Сценарий удалён', 'info');
        refresh();
        return;
      }
      if (ev.target.closest('.wzc-promote') && scope === 'user') {
        const ok = await modalOpen('<h3>👥 В организацию?</h3>',
          `<p>Опубликовать сценарий в общий каталог организации?<br>
           <span class="muted" style="font-size:11.5px">Будет виден всем членам команды (Phase 40 Cloud Sync синхронизирует между устройствами в будущем; пока локально).</span></p>`,
          async () => ({ ok: true })
        );
        if (!ok) return;
        promoteWizardToOrg(wid);
        toast('👥 Сценарий теперь в общем каталоге', 'ok');
        refresh();
        return;
      }
      if (ev.target.closest('.wzc-demote') && scope === 'org') {
        const ok = await modalOpen('<h3>↓ В личные?</h3>',
          `<p>Снять сценарий из общего каталога? Другие члены команды его перестанут видеть.</p>`,
          async () => ({ ok: true })
        );
        if (!ok) return;
        demoteWizardToUser(wid);
        toast('↓ Сценарий вернулся в личные', 'info');
        refresh();
        return;
      }
    });
  }
}

// ─── JSON editor для одного сценария
async function editWizardJson(wizard) {
  const initial = JSON.stringify(wizard, null, 2);
  const body = `
    <p class="muted" style="font-size:11.5px;margin:0 0 8px">
      Полный DSL (см. <code>service/catalog/wizards/index.js</code>). Минимум: <code>title, appliesTo[], params[], suggestions[]</code>. Поля <code>when</code> / <code>qty</code> в правилах могут быть числами или expression-строками (доступ к params: <code>params.airflow * 2</code>, <code>Math.ceil(...)</code>).
    </p>
    <textarea id="wzc-json" rows="20" style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:3px;font:12px/1.4 ui-monospace,Consolas,monospace;resize:vertical;tab-size:2">${escHtml(initial)}</textarea>
    <p id="wzc-json-err" class="muted" style="font-size:11px;margin:4px 0 0;color:#dc2626"></p>
  `;
  const result = await modalOpen(
    `<h3>✏ ${escHtml(wizard.title || '')} — JSON editor</h3>`,
    body,
    async () => {
      const txt = document.getElementById('wzc-json')?.value;
      const errEl = document.getElementById('wzc-json-err');
      let parsed;
      try { parsed = JSON.parse(txt); }
      catch (e) {
        if (errEl) errEl.textContent = 'JSON-ошибка: ' + (e.message || e);
        return null;
      }
      const v = validateWizard(parsed);
      if (!v.ok) {
        if (errEl) errEl.textContent = '❌ ' + v.errors.join(' · ');
        return null;
      }
      // Сохраняем id из original — нельзя менять.
      delete parsed.id;
      delete parsed.scope;
      return { ok: true, payload: parsed };
    }
  );
  return result?.payload || null;
}
