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
import { fmtMoney } from 'cooling/calc/fc-summary.js';
import { loadEffectiveCompanyProfile } from 'shared/company-profile.js';
import { getActiveKpTemplate } from '../../report/kp-template.js';
import { SLOT_BUILDERS } from '../../report/slots/kp-blocks.js';

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
  const B = opts.blocks;
  if (!B) throw new Error('buildOfferBlocks: opts.blocks (shared/report/blocks) is required');

  const profile = loadEffectiveCompanyProfile(opts.pid);
  const company = { ...profile, ...(opts.companyInfo || {}) };
  const totals = computeOrderTotals(order, displayCurrency, convertFn);

  // v0.60.44 (Phase 29): slot-based renderer. Берём активный шаблон,
  // итерируем enabled-слоты, для каждого вызываем builder из SLOT_BUILDERS.
  // Override через opts.template если caller хочет явный шаблон (для preview).
  const template = opts.template || getActiveKpTemplate();
  const ctx = {
    order, displayCurrency, convertFn, company, totals,
    B,
    POSITION_CATEGORIES, ORDER_TYPES,
    fmtMoney,
  };
  const blocks = [];
  for (const slot of (template.slots || [])) {
    if (!slot.enabled) continue;
    const builder = SLOT_BUILDERS[slot.id];
    if (!builder) {
      console.warn(`[export-offer] Нет builder для слота "${slot.id}"`);
      continue;
    }
    try {
      const slotBlocks = builder(ctx, slot.options || {});
      if (Array.isArray(slotBlocks)) {
        // Помечаем разделом (= слот КП): редактор «Разделы» и
        // effectiveContent() смогут менять порядок/видимость, а
        // tpl.sections.manifest получит реальный состав.
        const secId = 'slot-' + slot.id;
        const secLabel = slot.title || slot.label || slot.name || slot.id;
        for (const b of slotBlocks) {
          if (b) { b.section = secId; b.sectionLabel = secLabel; }
        }
        blocks.push(...slotBlocks);
      }
    } catch (e) {
      console.error(`[export-offer] Ошибка builder слота "${slot.id}":`, e);
    }
  }
  // Backward-compat: если opts.showCostBreakdown=true, override slot-options
  // для positions-table и totals чтобы показать колонку себестоимости.
  if (opts.showCostBreakdown === true && !opts.template) {
    // Re-build с временным шаблоном где у positions-table.showCostColumn=true
    const overrideTpl = {
      ...template,
      slots: template.slots.map(s => {
        if (s.id === 'positions-table') return { ...s, options: { ...s.options, showCostColumn: true } };
        if (s.id === 'totals') return { ...s, options: { ...s.options, showCostInTotals: true } };
        return s;
      }),
    };
    return buildOfferBlocks(order, displayCurrency, convertFn, { ...opts, template: overrideTpl });
  }
  return blocks;
}

/**
 * КП формируется ТОЛЬКО на основе кастомного сохраняемого шаблона
 * (требование Пользователя). Поток: pickTemplate (оформление —
 * поля, колонтитулы, логотип, зоны адресата/контактов/печати/
 * подписи, порядок и видимость разделов) → подпрограмма отдаёт
 * лишь содержимое (KP-слоты) → previewPDF (предпросмотр перед
 * сохранением — правило проекта). Состав body — из KP-слотов
 * (порядок слотов задаётся в их редакторе); каждый слот помечен
 * разделом, поэтому редактор шаблона «Разделы» и effectiveContent
 * тоже могут переставлять/скрывать.
 *
 * Прежняя версия (v0.60.40) экспортировала сразу в файл и
 * добавляла overlay нестандартной схемы (area/content вместо
 * type/scope/x/y) + tpl.margins вместо tpl.page.margins — рендерер
 * это игнорировал/ломал. Исправлено: chrome берётся из выбранного
 * шаблона.
 */
export async function openOfferPreview(order, displayCurrency, convertFn, opts = {}) {
  let Report, blocks, Tpl;
  try {
    Report = await import('shared/report/index.js');
    blocks = await import('shared/report/blocks.js');
    Tpl    = await import('shared/report/template.js');
  } catch (e) {
    throw new Error('Не удалось загрузить модуль отчётов: ' + e.message);
  }
  const profile = loadEffectiveCompanyProfile(opts.pid);

  const rec = await Report.pickTemplate({
    title: 'Шаблон коммерческого предложения',
    tags: ['service', 'кп', 'коммерческое', 'общее'],
  });
  if (!rec) return;

  const tpl = Report.createTemplate(rec.template);
  tpl.meta = {
    ...(tpl.meta || {}),
    title:  `КП №${order.id || ''} — ${order.name || ''}`,
    author: profile.director || profile.name || tpl.meta?.author || '',
    kind:   'commercial-offer',
  };
  const content = buildOfferBlocks(order, displayCurrency, convertFn, { ...opts, blocks });
  tpl.content = content;
  // Редизайн: единый поток (структура шаблона + тело КП в одном
  // flow → нет наложения; печать/подпись → floating с привязкой к
  // подписанту; колонтитул-номер остаётся overlay в полях).
  Tpl.migrateToFlow(tpl);
  if (!tpl.sections || typeof tpl.sections !== 'object') tpl.sections = {};
  tpl.sections.manifest = Report.sectionManifestFromContent(tpl.flow);
  if (!Array.isArray(tpl.sections.order))  tpl.sections.order  = [];
  if (!Array.isArray(tpl.sections.hidden)) tpl.sections.hidden = [];
  await persistPickedManifest(rec.id, tpl.sections.manifest);

  const fname = `kp-${(order.id || 'order').replace(/[^\w-]+/g, '_')}.pdf`;
  await Report.previewPDF(tpl, fname);
}

// Записывает состав разделов КП в выбранный шаблон каталога — чтобы
// standalone-редактор «Разделы» был сразу заполнен, а порядок/
// видимость применялись при следующих генерациях. Идемпотентно,
// order/hidden шаблона не трогаем. Использует уже задеплоенный
// shared/report-catalog.js (без новых экспортов — cache-safe).
async function persistPickedManifest(recId, manifest) {
  if (!recId) return;
  try {
    const Cat = await import('shared/report-catalog.js');
    const stored = Cat.getTemplate(recId);
    if (!stored) return;
    const cur = stored.template?.sections?.manifest || [];
    if (JSON.stringify(cur) === JSON.stringify(manifest)) return;
    const t = stored.template || {};
    t.sections = {
      order:  Array.isArray(t.sections?.order)  ? t.sections.order  : [],
      hidden: Array.isArray(t.sections?.hidden) ? t.sections.hidden : [],
      manifest,
    };
    Cat.saveTemplate({ ...stored, template: t });
  } catch (e) { /* персист опционален — не блокируем КП */ }
}
