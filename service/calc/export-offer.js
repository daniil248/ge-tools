// =============================================================================
// service/calc/export-offer.js — экспорт КП клиенту (HTML → window.print → PDF)
// =============================================================================
// Phase 24.4: По требованию: «формирование стоимости для клиента». Открывает
// новое окно с форматированной HTML-вёрсткой коммерческого предложения, готовой
// к печати в PDF (Ctrl+P → Save as PDF) или к отправке клиенту через Print to
// File / отправить браузером.
//
// Без зависимостей от jsPDF — браузерный print API даёт качественный PDF.

import { computeOrderTotals, ORDER_TYPES, POSITION_CATEGORIES } from './order-model.js';
import { fmtMoney } from '../../cooling/calc/fc-summary.js';
import { loadEffectiveCompanyProfile } from '../../shared/company-profile.js';

function escHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * Сгенерировать HTML коммерческого предложения для печати.
 *
 * @param {object} order            — наряд (см. order-model.js)
 * @param {string} displayCurrency  — валюта проекта
 * @param {function|null} convertFn — для per-cell конверсии валют
 * @param {object} opts             — { showCostBreakdown: bool, companyInfo: {name, address, contact, logo} }
 * @returns {string} HTML
 */
export function generateOfferHtml(order, displayCurrency = '₽', convertFn = null, opts = {}) {
  const showCost = opts.showCostBreakdown === true;
  // v0.60.27: компания подтягивается из global-settings (shared/company-profile.js).
  // Можно override через opts.companyInfo (приоритет).
  const profile = opts.pid !== undefined
    ? loadEffectiveCompanyProfile(opts.pid)
    : loadEffectiveCompanyProfile(null);
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

  // Группировка позиций по категориям для красивой структуры КП
  const byCategory = new Map();
  for (const p of positions) {
    const cat = POSITION_CATEGORIES.find(c => c.id === p.category) || POSITION_CATEGORIES.find(c => c.id === 'other');
    const arr = byCategory.get(cat.id) || { label: cat.label, items: [] };
    arr.items.push(p);
    byCategory.set(cat.id, arr);
  }

  // Рендер групп
  const groupHtml = (POSITION_CATEGORIES.map(c => {
    const grp = byCategory.get(c.id);
    if (!grp || !grp.items.length) return '';
    let grpSubtotal = 0;
    const rows = grp.items.map((p, i) => {
      const q = Number(p.qty) || 0;
      const clientPerUnit = Number(p.clientPrice?.value) || 0;
      const clientPerUnitDC = conv(clientPerUnit, p.clientPrice?.currency || displayCurrency, displayCurrency);
      const lineTotal = q * clientPerUnitDC;
      grpSubtotal += lineTotal;
      const costLine = showCost
        ? `<td class="num">${fmt(conv(Number(p.costPrice?.value) || 0, p.costPrice?.currency || displayCurrency, displayCurrency))}</td>`
        : '';
      return `<tr>
        <td>${i + 1}</td>
        <td>${escHtml(p.label || '')}</td>
        <td class="num">${q}</td>
        <td>${escHtml(p.unit || '')}</td>
        <td class="num">${fmt(clientPerUnitDC)}</td>
        ${costLine}
        <td class="num"><b>${fmt(lineTotal)}</b></td>
      </tr>`;
    }).join('');
    return `
      <tr class="group-header"><td colspan="${showCost ? 7 : 6}"><b>${escHtml(grp.label)}</b></td></tr>
      ${rows}
      <tr class="group-subtotal">
        <td colspan="${showCost ? 6 : 5}" class="num">Итого по разделу «${escHtml(grp.label)}»:</td>
        <td class="num"><b>${fmt(grpSubtotal)}</b></td>
      </tr>
    `;
  })).join('');

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>КП №${escHtml(orderNum)} — ${escHtml(order.name || '')}</title>
<style>
  @page { size: A4; margin: 15mm 15mm 18mm 18mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Times New Roman', Times, serif; font-size: 11pt; color: #000; margin: 0; padding: 0; line-height: 1.35; }
  h1 { font-size: 16pt; margin: 0 0 8pt; text-align: center; }
  h2 { font-size: 12pt; margin: 12pt 0 6pt; border-bottom: 1pt solid #000; padding-bottom: 2pt; }
  table { width: 100%; border-collapse: collapse; font-size: 10pt; margin: 4pt 0 8pt; }
  th, td { border: 0.5pt solid #000; padding: 3pt 5pt; vertical-align: top; }
  th { background: #f0f0f0; font-weight: bold; }
  td.num { text-align: right; white-space: nowrap; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12pt; }
  .header-left { flex: 1; }
  .header-right { text-align: right; font-size: 10pt; }
  .company-name { font-size: 14pt; font-weight: bold; margin-bottom: 4pt; }
  .info-block { display: grid; grid-template-columns: 130pt 1fr; gap: 4pt 10pt; font-size: 10.5pt; margin-bottom: 8pt; }
  .info-block dt { color: #555; }
  .info-block dd { margin: 0; font-weight: 500; }
  .group-header td { background: #e8f0f8; padding: 4pt 5pt; }
  .group-subtotal td { background: #fafafa; font-weight: 500; }
  .totals-block { margin-top: 8pt; width: 50%; margin-left: auto; }
  .totals-block table { font-size: 11pt; }
  .totals-block .grand td { background: #f0f0f0; font-size: 12pt; }
  .signature { margin-top: 30pt; display: grid; grid-template-columns: 1fr 1fr; gap: 30pt; font-size: 10pt; }
  .signature .line { border-top: 0.5pt solid #000; margin-top: 30pt; padding-top: 4pt; text-align: center; }
  .footer { margin-top: 16pt; font-size: 9pt; color: #555; text-align: center; }
  .no-print { background: #fff7ed; border: 1px solid #fdba74; padding: 8pt; margin: 10pt 0; border-radius: 3pt; font-family: system-ui, sans-serif; }
  @media print { .no-print { display: none; } }
</style>
</head>
<body>
  <div class="no-print">
    <b>👁 Предпросмотр КП.</b> Для сохранения в PDF: <b>Ctrl+P → Сохранить как PDF</b>. Для отправки клиенту: распечатать или сохранить в файл.
    ${showCost
      ? '<br>⚠ В КП показана колонка «Себес/ед» — не отправляйте клиенту в таком виде. Снимите галочку «Показать себестоимость» в форме экспорта.'
      : ''}
  </div>

  <div class="header">
    <div class="header-left">
      ${company.name ? `<div class="company-name">${escHtml(company.name)}</div>` : '<div class="company-name" style="color:#dc2626">⚠ Реквизиты компании не заполнены</div>'}
      ${company.address ? `<div>${escHtml(company.address)}</div>` : ''}
      ${[company.phone, company.email, company.website].filter(Boolean).map(escHtml).join(' · ') || ''}
      ${company.bin ? `<div style="font-size:9pt;color:#555">БИН/ИНН: ${escHtml(company.bin)}</div>` : ''}
    </div>
    <div class="header-right">
      <div><b>КП №${escHtml(orderNum)}</b></div>
      <div>от ${escHtml(date)}</div>
    </div>
  </div>
  ${!company.name ? `<div class="no-print" style="background:#fef2f2;border-color:#fecaca">⚠ Реквизиты компании не заполнены. Заполните в шестерёнке (⚙) → «🏢 Реквизиты организации».</div>` : ''}

  <h1>Коммерческое предложение</h1>
  <h2>«${escHtml(order.name || '(без названия)')}»</h2>

  <dl class="info-block">
    <dt>Тип работ:</dt><dd>${escHtml(typeLabel)}</dd>
    ${order.customer?.name ? `<dt>Заказчик:</dt><dd>${escHtml(order.customer.name)}</dd>` : ''}
    ${order.customer?.contact ? `<dt>Контакт:</dt><dd>${escHtml(order.customer.contact)}</dd>` : ''}
    <dt>Валюта:</dt><dd>${escHtml(displayCurrency)}</dd>
  </dl>

  <h2>Состав работ и материалов</h2>
  <table>
    <thead>
      <tr>
        <th style="width:24pt">№</th>
        <th>Наименование</th>
        <th style="width:40pt">Кол-во</th>
        <th style="width:42pt">Ед.</th>
        <th style="width:80pt">Цена за ед.</th>
        ${showCost ? '<th style="width:80pt">Себес/ед.</th>' : ''}
        <th style="width:90pt">Сумма</th>
      </tr>
    </thead>
    <tbody>
      ${groupHtml}
    </tbody>
  </table>

  <div class="totals-block">
    <table>
      <tr>
        <td>Стоимость работ и материалов (без НДС):</td>
        <td class="num">${fmt(t.sumClientNative)}</td>
      </tr>
      <tr>
        <td>НДС (${order.vatPct}%):</td>
        <td class="num">${fmt(t.sumVat)}</td>
      </tr>
      <tr class="grand">
        <td><b>ИТОГО к оплате:</b></td>
        <td class="num"><b>${fmt(t.sumClientWithVat)}</b></td>
      </tr>
      ${showCost ? `
      <tr style="background:#fff8e1">
        <td>(служебно) Себестоимость + накладные:</td>
        <td class="num">${fmt(t.sumCostWithOverhead)}</td>
      </tr>
      <tr style="background:#fff8e1">
        <td>(служебно) Маржа:</td>
        <td class="num">${fmt(t.marginAbs)} (${t.marginPct.toFixed(1)} %)</td>
      </tr>` : ''}
    </table>
  </div>

  ${order.notes ? `
    <h2>Примечания</h2>
    <p>${escHtml(order.notes).replace(/\n/g, '<br>')}</p>
  ` : ''}

  ${company.bankRequisites ? `
    <h2>Платёжные реквизиты</h2>
    <p style="white-space:pre-wrap">${escHtml(company.bankRequisites)}</p>
  ` : ''}

  <div class="signature">
    <div>
      <div>Исполнитель${company.director ? ': ' + escHtml(company.director) : ':'}</div>
      <div class="line">подпись / расшифровка / дата</div>
    </div>
    <div>
      <div>Заказчик:</div>
      <div class="line">подпись / расшифровка / дата</div>
    </div>
  </div>

  <div class="footer">
    КП действительно 30 календарных дней с даты составления. Сформировано в Raschet (raschet.app).
  </div>
</body>
</html>`;
}

/**
 * Открыть КП в новом окне для печати/сохранения PDF.
 *
 * @param {object} order
 * @param {string} displayCurrency
 * @param {function|null} convertFn
 * @param {object} opts — { showCostBreakdown, pid, companyInfo }
 */
export function openOfferPreview(order, displayCurrency, convertFn, opts) {
  const html = generateOfferHtml(order, displayCurrency, convertFn, opts);
  const win = window.open('', '_blank', 'width=900,height=1200,scrollbars=yes');
  if (!win) {
    throw new Error('Браузер заблокировал открытие нового окна. Разрешите popup для этого сайта в настройках и попробуйте снова.');
  }
  win.document.write(html);
  win.document.close();
}
