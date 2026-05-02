// =============================================================================
// service/calc/export-offer.js — экспорт КП клиенту через модуль reports/
// =============================================================================
// v0.60.30: По правилу проекта (запомнено 2026-05-02): «все отчёты должны
// формироваться через модуль reports/. Каждый документ должен иметь свои
// шаблоны, которые пользователь может настроить по своим требованиям».
//
// Раньше (v0.60.26) КП собирался прямой HTML-вёрсткой через window.open().
// Это нарушало правило → переписано через shared/report/ (blocks API).
//
// API:
//   - buildOfferBlocks(order, displayCurrency, convertFn, opts) → blocks[]
//   - openOfferPreview(order, displayCurrency, convertFn, opts) → открывает
//     editor шаблона + preview, далее экспорт PDF/DOCX через reports/.

import { computeOrderTotals, ORDER_TYPES, POSITION_CATEGORIES } from './order-model.js';
import { fmtMoney } from '../../cooling/calc/fc-summary.js';
import { loadEffectiveCompanyProfile } from '../../shared/company-profile.js';

/**
 * Сформировать blocks[] для модуля reports.
 * Подпрограмма НЕ рисует HTML — только возвращает структуру; все стили,
 * шрифты, поля страницы — управляются шаблоном из reports/.
 *
 * @param {object} order
 * @param {string} displayCurrency
 * @param {function|null} convertFn
 * @param {object} opts — { showCostBreakdown, pid, blocks (alias to shared/report/blocks) }
 * @returns {Array<object>} blocks для tpl.content
 */
export function buildOfferBlocks(order, displayCurrency = '₽', convertFn = null, opts = {}) {
  const B = opts.blocks;  // передаётся caller'ом (modules не должны импортировать report напрямую если возможно)
  if (!B) throw new Error('buildOfferBlocks: opts.blocks (shared/report/blocks) is required');

  const showCost = opts.showCostBreakdown === true;
  const profile = loadEffectiveCompanyProfile(opts.pid);
  const company = { ...profile, ...(opts.companyInfo || {}) };
  const t = computeOrderTotals(order, displayCurrency, convertFn);
  const fmt = (v) => fmtMoney(v, displayCurrency);
  const typeLabel = ORDER_TYPES.find(x => x.id === order.type)?.label || order.type;
  const date = order.date || new Date().toISOString().slice(0, 10);
  const orderNum = order.id || 'без №';

  const positions = Array.isArray(order.positions) ? order.positions : [];
  const conv = (v, from, to) => {
    if (!Number.isFinite(v) || v === 0 || from === to || !convertFn) return v;
    const r = convertFn(v, from, to);
    return Number.isFinite(r) ? r : v;
  };

  const blocks = [];

  // Шапка: компания (отображаем как параграфы — в шаблоне можно вынести в overlay)
  if (company.name) {
    blocks.push(B.h3(company.name));
  } else {
    blocks.push(B.paragraph('⚠ Реквизиты компании не заполнены — заполните в ⚙ → Реквизиты организации.'));
  }
  const companyLine = [company.address, company.phone, company.email, company.website].filter(Boolean).join(' · ');
  if (companyLine) blocks.push(B.caption(companyLine));
  if (company.bin) blocks.push(B.caption(`БИН/ИНН: ${company.bin}`));
  blocks.push(B.spacer(4));

  // Заголовок документа
  blocks.push(B.h1('Коммерческое предложение'));
  blocks.push(B.h2(`№${orderNum} от ${date} · «${order.name || '(без названия)'}»`));
  blocks.push(B.spacer(2));

  // Информация
  const infoRows = [['Тип работ:', typeLabel]];
  if (order.customer?.name) infoRows.push(['Заказчик:', order.customer.name]);
  if (order.customer?.contact) infoRows.push(['Контакт:', order.customer.contact]);
  infoRows.push(['Валюта:', displayCurrency]);
  blocks.push(B.table(['', ''], infoRows));
  blocks.push(B.spacer(4));

  // Состав работ — группировка по категориям
  blocks.push(B.h2('Состав работ и материалов'));
  const byCategory = new Map();
  for (const p of positions) {
    const cat = POSITION_CATEGORIES.find(c => c.id === p.category) || POSITION_CATEGORIES.find(c => c.id === 'other');
    const arr = byCategory.get(cat.id) || { label: cat.label, items: [] };
    arr.items.push(p);
    byCategory.set(cat.id, arr);
  }

  // Заголовки таблицы
  const tableHeaders = showCost
    ? ['№', 'Наименование', 'Кол-во', 'Ед.', 'Цена/ед.', 'Себес/ед.', 'Сумма']
    : ['№', 'Наименование', 'Кол-во', 'Ед.', 'Цена/ед.', 'Сумма'];

  let lineIdx = 0;
  let grandTotal = 0;
  for (const c of POSITION_CATEGORIES) {
    const grp = byCategory.get(c.id);
    if (!grp || !grp.items.length) continue;
    blocks.push(B.h3(grp.label));
    let grpSubtotal = 0;
    const rows = grp.items.map(p => {
      lineIdx++;
      const q = Number(p.qty) || 0;
      const clientPerUnitDC = conv(Number(p.clientPrice?.value) || 0, p.clientPrice?.currency || displayCurrency, displayCurrency);
      const lineTotal = q * clientPerUnitDC;
      grpSubtotal += lineTotal;
      grandTotal += lineTotal;
      const baseRow = [
        String(lineIdx),
        p.label || '',
        String(q),
        p.unit || '',
        fmt(clientPerUnitDC),
      ];
      if (showCost) {
        const costPerUnitDC = conv(Number(p.costPrice?.value) || 0, p.costPrice?.currency || displayCurrency, displayCurrency);
        baseRow.push(fmt(costPerUnitDC));
      }
      baseRow.push(fmt(lineTotal));
      return baseRow;
    });
    blocks.push(B.table(tableHeaders, rows));
    blocks.push(B.paragraph(`Итого по разделу «${grp.label}»: ${fmt(grpSubtotal)}`, { style: 'caption' }));
    blocks.push(B.spacer(3));
  }

  // Итоги
  blocks.push(B.h2('Итого'));
  const totalsRows = [
    ['Стоимость работ и материалов (без НДС):', fmt(t.sumClientNative)],
    [`НДС (${order.vatPct}%):`, fmt(t.sumVat)],
    ['ИТОГО к оплате:', fmt(t.sumClientWithVat)],
  ];
  if (showCost) {
    totalsRows.push(['(служебно) Себестоимость + накладные:', fmt(t.sumCostWithOverhead)]);
    totalsRows.push(['(служебно) Маржа:', `${fmt(t.marginAbs)} (${t.marginPct.toFixed(1)} %)`]);
  }
  blocks.push(B.table(['', ''], totalsRows));

  // Примечания
  if (order.notes) {
    blocks.push(B.spacer(4));
    blocks.push(B.h2('Примечания'));
    blocks.push(B.paragraph(order.notes));
  }

  // Платёжные реквизиты
  if (company.bankRequisites) {
    blocks.push(B.spacer(4));
    blocks.push(B.h2('Платёжные реквизиты'));
    blocks.push(B.paragraph(company.bankRequisites));
  }

  // Подписи
  blocks.push(B.spacer(8));
  const sigRows = [
    [`Исполнитель${company.director ? ': ' + company.director : ':'}`, 'Заказчик:'],
    ['_______________________ / подпись / дата', '_______________________ / подпись / дата'],
  ];
  blocks.push(B.table(['', ''], sigRows));

  return blocks;
}

/**
 * Экспорт КП напрямую в PDF (без template editor — он накладывал header-overlay
 * поверх контента, по репорту 2026-05-02 «содержимое попадает поверх шаблона»).
 *
 * Phase 29 (TODO в roadmap): полноценная slot-based template system для документов
 * с возможностью перестановки блоков. Сейчас — clean default template без overlays.
 */
export async function openOfferPreview(order, displayCurrency, convertFn, opts = {}) {
  let Report, blocks;
  try {
    Report = await import('../../shared/report/index.js');
    blocks = await import('../../shared/report/blocks.js');
  } catch (e) {
    throw new Error('Не удалось загрузить модуль отчётов: ' + e.message);
  }
  const profile = loadEffectiveCompanyProfile(opts.pid);
  const tpl = Report.createTemplate({
    meta: {
      title: `КП №${order.id || ''} — ${order.name || ''}`,
      author: profile.director || profile.name || '',
      kind: 'commercial-offer',
    },
  });
  // v0.60.40: убираем default overlays (header/footer). Они накладывались
  // ПОВЕРХ контента, искажая шапку. Только page-number footer оставим, и то
  // через slim margin-bottom. Phase 29 даст полную слот-систему.
  tpl.overlays = [
    {
      id: 'kp-page-number',
      area: 'footer',
      align: 'center',
      content: 'стр. {{page}} из {{pages}}',
      fontSize: 8,
      color: '#888',
    },
  ];
  // Page settings — A4, увеличенные поля чтобы контент не упирался в края.
  tpl.page = { ...(tpl.page || {}), format: 'A4', orientation: 'portrait' };
  tpl.margins = { top: 18, right: 15, bottom: 18, left: 18 };  // mm
  tpl.content = buildOfferBlocks(order, displayCurrency, convertFn, { ...opts, blocks });
  // Прямой экспорт PDF — без openTemplateEditor.
  const fname = `kp-${(order.id || 'order').replace(/[^\w-]+/g, '_')}.pdf`;
  Report.exportPDF(tpl, fname);
}
