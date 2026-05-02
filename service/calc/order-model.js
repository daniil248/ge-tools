// =============================================================================
// service/calc/order-model.js — модель «наряда» сервисных/монтажных работ
// =============================================================================
// Phase 24.1: По требованию Пользователя 2026-05-02:
// «Расчёт стоимости технического обслуживания и стоимости монтажных работ,
//  где инженер сервиса сможет формировать стоимость себеса и стоимости для
//  клиента по монтажным и сервисным работам по проекту или разовые работы».
//
// Pure JS, no DOM. Используется в service/ui/order-form.js и других модулях,
// которые могут предложить выгрузку наряда (например, cooling → service).
//
// Модель НАРЯДА:
//   order = {
//     id, name,                       // например «Монтаж чиллера York YLAA200»
//     type: 'install' | 'maintenance' | 'one-off',
//     projectId: string|null,         // null — разовые работы
//     coolingSelectionId: string|null,// если связан с подбором cooling
//     date,                           // дата создания
//     customer: { name, contact },    // клиент
//     positions: [
//       {
//         id, label,                   // описание работы/материала
//         category: 'labor' | 'material' | 'travel' | 'subcontract' | 'other',
//         qty, unit,                   // 5 шт / 12 ч / 30 м / ...
//         costPrice:   {value, currency},  // себестоимость / единица
//         clientPrice: {value, currency},  // клиент-цена / единица
//       }, ...
//     ],
//     overheadPct,                     // накладные расходы (% от себеса)
//     vatPct,                          // НДС (% от клиент-цены)
//     notes,                           // примечания
//   }
//
// Расчёт:
//   Σ Себес     = Σ qty × costPrice (с per-cell currency-конверсией)
//   Σ Накладные = Σ Себес × overheadPct/100
//   Σ Клиент    = Σ qty × clientPrice (с per-cell currency-конверсией)
//   Σ НДС       = Σ Клиент × vatPct/100
//   Маржа₽     = Σ Клиент − (Σ Себес + Σ Накладные)
//   Маржа%     = Маржа / (Σ Себес + Σ Накладные) × 100

import { CURRENCIES } from '../../cooling/calc/fc-summary.js';

export const ORDER_TYPES = [
  { id: 'install',     label: 'Монтаж',           desc: 'Монтажные работы (установка, обвязка, ПНР).' },
  { id: 'maintenance', label: 'ТО (регламент)',   desc: 'Плановое техобслуживание (квартал/год).' },
  { id: 'one-off',     label: 'Разовая работа',   desc: 'Внеплановая работа (выезд, диагностика, ремонт).' },
];

export const POSITION_CATEGORIES = [
  { id: 'labor',       label: 'Работа',         tip: 'Трудозатраты сервисной бригады. Единица обычно «час».' },
  { id: 'material',    label: 'Материал',       tip: 'Расходные материалы, запчасти, хладагент, фитинги.' },
  { id: 'travel',      label: 'Командировочные',tip: 'Билеты + проживание + суточные + транспорт.' },
  { id: 'subcontract', label: 'Субподряд',      tip: 'Стороннее лицо (грузчики, кран, спец.техника).' },
  { id: 'other',       label: 'Прочее',         tip: 'Прочие статьи затрат.' },
];

export const UNITS = ['ч', 'шт', 'м', 'м²', 'м³', 'кг', 'комплект', 'выезд', 'смена', 'сутки'];

/** Default-параметры нового наряда. */
export const DEFAULT_ORDER = {
  id: '',
  name: '',
  type: 'install',
  projectId: null,
  coolingSelectionId: null,
  date: new Date().toISOString().slice(0, 10),
  customer: { name: '', contact: '' },
  positions: [],
  overheadPct: 15,
  vatPct: 12,
  notes: '',
};

/** Default-позиция. */
export function defaultPosition(displayCurrency = '₽') {
  return {
    id: 'pos-' + Math.random().toString(36).slice(2, 8),
    label: '',
    category: 'labor',
    qty: 1,
    unit: 'ч',
    costPrice:   { value: 0, currency: displayCurrency },
    clientPrice: { value: 0, currency: displayCurrency },
  };
}

/**
 * Подсчитать суммы наряда в displayCurrency с per-cell конвертацией.
 *
 * @param {object} order
 * @param {string} displayCurrency
 * @param {function|null} convertFn — (amount, fromCur, toCur) => number
 * @returns {{
 *   sumCostNative, sumOverhead, sumCostWithOverhead,
 *   sumClientNative, sumVat, sumClientWithVat,
 *   marginAbs, marginPct, byCategory: {labor, material, travel, subcontract, other}
 * }}
 */
export function computeOrderTotals(order, displayCurrency = '₽', convertFn = null) {
  const o = { ...DEFAULT_ORDER, ...(order || {}) };
  const positions = Array.isArray(o.positions) ? o.positions : [];
  const conv = (v, from, to) => {
    if (!Number.isFinite(v) || v === 0 || from === to || !convertFn) return v;
    const r = convertFn(v, from, to);
    return Number.isFinite(r) ? r : v;
  };
  let sumCost = 0, sumClient = 0;
  const byCategory = { labor: 0, material: 0, travel: 0, subcontract: 0, other: 0 };
  for (const p of positions) {
    const q = Number(p.qty) || 0;
    const c = conv(Number(p.costPrice?.value)   || 0, p.costPrice?.currency   || displayCurrency, displayCurrency);
    const cl = conv(Number(p.clientPrice?.value) || 0, p.clientPrice?.currency || displayCurrency, displayCurrency);
    sumCost   += q * c;
    sumClient += q * cl;
    if (byCategory[p.category] != null) byCategory[p.category] += q * c;
    else byCategory.other += q * c;
  }
  const overheadPct = Number(o.overheadPct) || 0;
  const vatPct = Number(o.vatPct) || 0;
  const sumOverhead = sumCost * overheadPct / 100;
  const sumCostWithOverhead = sumCost + sumOverhead;
  const sumVat = sumClient * vatPct / 100;
  const sumClientWithVat = sumClient + sumVat;
  const marginAbs = sumClient - sumCostWithOverhead;
  const marginPct = sumCostWithOverhead > 0 ? (marginAbs / sumCostWithOverhead) * 100 : 0;
  return {
    sumCostNative: sumCost,
    sumOverhead, sumCostWithOverhead,
    sumClientNative: sumClient, sumVat, sumClientWithVat,
    marginAbs, marginPct,
    byCategory,
  };
}

/**
 * Шаблоны типовых работ — base-каталог. Можно добавить через UI.
 */
export const WORK_TEMPLATES = {
  install: [
    { label: 'Монтаж чиллера до 200 кВт', category: 'labor', unit: 'комплект', costPrice: 80000, clientPrice: 130000 },
    { label: 'Монтаж чиллера 200–500 кВт', category: 'labor', unit: 'комплект', costPrice: 150000, clientPrice: 240000 },
    { label: 'Монтаж DX-блока', category: 'labor', unit: 'комплект', costPrice: 35000, clientPrice: 60000 },
    { label: 'Монтаж CRAC прецизионного', category: 'labor', unit: 'комплект', costPrice: 50000, clientPrice: 80000 },
    { label: 'Опрессовка холодильного контура', category: 'labor', unit: 'комплект', costPrice: 12000, clientPrice: 22000 },
    { label: 'Заправка R410A', category: 'material', unit: 'кг', costPrice: 3500, clientPrice: 5500 },
    { label: 'Заправка R32', category: 'material', unit: 'кг', costPrice: 4200, clientPrice: 6500 },
    { label: 'Заправка R134a', category: 'material', unit: 'кг', costPrice: 4800, clientPrice: 7200 },
    { label: 'Пусконаладочные работы (ПНР)', category: 'labor', unit: 'комплект', costPrice: 25000, clientPrice: 45000 },
    { label: 'Командировка инженера (день)', category: 'travel', unit: 'сутки', costPrice: 8000, clientPrice: 15000 },
  ],
  maintenance: [
    { label: 'Регламентное ТО ежемесячное', category: 'labor', unit: 'выезд', costPrice: 6000, clientPrice: 10000 },
    { label: 'Регламентное ТО квартальное', category: 'labor', unit: 'выезд', costPrice: 12000, clientPrice: 20000 },
    { label: 'Регламентное ТО годовое', category: 'labor', unit: 'выезд', costPrice: 30000, clientPrice: 50000 },
    { label: 'Замена воздушных фильтров', category: 'material', unit: 'шт', costPrice: 1200, clientPrice: 2000 },
    { label: 'Чистка теплообменника', category: 'labor', unit: 'комплект', costPrice: 8000, clientPrice: 14000 },
    { label: 'Дозаправка хладагента', category: 'material', unit: 'кг', costPrice: 4000, clientPrice: 6500 },
    { label: 'Анализ масла компрессора', category: 'labor', unit: 'комплект', costPrice: 5000, clientPrice: 9000 },
  ],
  'one-off': [
    { label: 'Аварийный выезд', category: 'travel', unit: 'выезд', costPrice: 15000, clientPrice: 28000 },
    { label: 'Диагностика неисправности', category: 'labor', unit: 'ч', costPrice: 3500, clientPrice: 6000 },
    { label: 'Ремонт компрессора', category: 'labor', unit: 'комплект', costPrice: 50000, clientPrice: 90000 },
  ],
};

export { CURRENCIES };
