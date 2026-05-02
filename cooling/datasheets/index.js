// =============================================================================
// cooling/datasheets/index.js — каталог готовых даташитов вендоров
// =============================================================================
// Phase 25.3: По требованию: «бесплатные шаблоны от популярных вендоров
// (Daikin / Stulz / York / Carrier / Trane) — несколько готовых JSON для
// быстрого старта».
//
// Все значения — типичные/представительные для класса оборудования. Для
// проектного использования рекомендуется уточнить из официального datasheet
// производителя на конкретную модель.
//
// Источники (открытая инфо):
//   - Daikin EWAQ catalogue
//   - Stulz CyberCool / CyberHandler datasheets
//   - York YLAA series
//   - Carrier 30RB AquaForce
//   - Vertiv Liebert PCW
//   - Trane RTAF
//
// Pure JS, no DOM.

import { DATASHEET_SCHEMA } from '../calc/datasheet.js';

/**
 * Каталог. Каждая запись — полный datasheet-объект, готовый к
 * applyDatasheetToSpec(). Группированы по vendor для UI.
 */
export const VENDOR_DATASHEETS = [
  // ===== Daikin =====
  {
    schema: DATASHEET_SCHEMA,
    vendor: 'Daikin',
    model: 'EWAQ-G 200 (air-cooled scroll)',
    kind: 'chiller',
    systemType: 'chiller',
    ratedCapKw: 200,
    ratedCop: 3.2,
    ambientRated: 35,
    capCorrPctPerC: -1.5,
    partLoadCurve: 'iplv',
    freeCoolingMode: 'dry',
    chwsTemp: 7,
    freeCoolingApproach: 5,
    freeCoolingAuxPctOfRated: 6,
    refrigerant: 'R32',
    compressorType: 'scroll',
    physical: { lengthMm: 4500, widthMm: 2200, heightMm: 2100, weightKg: 2800 },
  },
  {
    schema: DATASHEET_SCHEMA,
    vendor: 'Daikin',
    model: 'EWAH-TZ 350 (air-cooled inverter screw)',
    kind: 'chiller',
    systemType: 'chiller',
    ratedCapKw: 350,
    ratedCop: 3.5,
    ambientRated: 35,
    capCorrPctPerC: -1.4,
    partLoadCurve: 'iplv',
    freeCoolingMode: 'dry',
    chwsTemp: 12,
    freeCoolingApproach: 5,
    freeCoolingAuxPctOfRated: 5,
    refrigerant: 'R134a',
    compressorType: 'screw',
  },

  // ===== York (Johnson Controls) =====
  {
    schema: DATASHEET_SCHEMA,
    vendor: 'York',
    model: 'YLAA0250HE (air-cooled scroll)',
    kind: 'chiller',
    systemType: 'chiller',
    ratedCapKw: 250,
    ratedCop: 3.1,
    ambientRated: 35,
    capCorrPctPerC: -1.6,
    partLoadCurve: 'iplv',
    freeCoolingMode: 'none',
    refrigerant: 'R410A',
    compressorType: 'scroll',
  },
  {
    schema: DATASHEET_SCHEMA,
    vendor: 'York',
    model: 'YVAA 0500 (air-cooled VSD screw, free-cooling)',
    kind: 'chiller',
    systemType: 'chiller',
    ratedCapKw: 500,
    ratedCop: 3.6,
    ambientRated: 35,
    capCorrPctPerC: -1.3,
    partLoadCurve: 'iplv',
    freeCoolingMode: 'dry',
    chwsTemp: 12,
    freeCoolingApproach: 4,
    freeCoolingAuxPctOfRated: 4,
    refrigerant: 'R134a',
    compressorType: 'screw',
  },

  // ===== Carrier =====
  {
    schema: DATASHEET_SCHEMA,
    vendor: 'Carrier',
    model: '30RB AquaForce 300 (air-cooled scroll)',
    kind: 'chiller',
    systemType: 'chiller',
    ratedCapKw: 300,
    ratedCop: 3.3,
    ambientRated: 35,
    capCorrPctPerC: -1.5,
    partLoadCurve: 'iplv',
    freeCoolingMode: 'dry',
    chwsTemp: 7,
    freeCoolingApproach: 5,
    freeCoolingAuxPctOfRated: 5,
    refrigerant: 'R410A',
    compressorType: 'scroll',
  },
  {
    schema: DATASHEET_SCHEMA,
    vendor: 'Carrier',
    model: '30XW Water-cooled centrifugal 1000',
    kind: 'chiller',
    systemType: 'chiller',
    ratedCapKw: 1000,
    ratedCop: 5.8,
    ambientRated: 30,
    capCorrPctPerC: -0.5,
    partLoadCurve: 'iplv',
    freeCoolingMode: 'wet',
    chwsTemp: 7,
    freeCoolingApproach: 3,
    freeCoolingAuxPctOfRated: 3,
    refrigerant: 'R134a',
    compressorType: 'centrifugal',
  },

  // ===== Trane =====
  {
    schema: DATASHEET_SCHEMA,
    vendor: 'Trane',
    model: 'RTAF 400 (air-cooled VSD screw)',
    kind: 'chiller',
    systemType: 'chiller',
    ratedCapKw: 400,
    ratedCop: 3.5,
    ambientRated: 35,
    capCorrPctPerC: -1.4,
    partLoadCurve: 'iplv',
    freeCoolingMode: 'dry',
    chwsTemp: 12,
    freeCoolingApproach: 5,
    freeCoolingAuxPctOfRated: 5,
    refrigerant: 'R134a',
    compressorType: 'screw',
  },

  // ===== Stulz (CRAC) =====
  {
    schema: DATASHEET_SCHEMA,
    vendor: 'Stulz',
    model: 'CyberCool CW 80 (CRAC chilled water)',
    kind: 'crac',
    systemType: 'crac-water',
    ratedCapKw: 80,
    ratedCop: 30, // EER ratio для CRAC водяного охлаждения (только вентиляторы)
    ambientRated: 24,
    capCorrPctPerC: 0,
    partLoadCurve: 'fixed',
    refrigerant: 'water',
  },
  {
    schema: DATASHEET_SCHEMA,
    vendor: 'Stulz',
    model: 'CyberHandler 2 350 (CRAC + free-cooling loop)',
    kind: 'crac',
    systemType: 'crac-water+fc-loop',
    ratedCapKw: 350,
    ratedCop: 25,
    ambientRated: 24,
    capCorrPctPerC: 0,
    partLoadCurve: 'fixed',
    refrigerant: 'water+glycol',
  },

  // ===== Vertiv (Liebert) =====
  {
    schema: DATASHEET_SCHEMA,
    vendor: 'Vertiv (Liebert)',
    model: 'PCW 100 (CRAC chilled water)',
    kind: 'crac',
    systemType: 'crac-water',
    ratedCapKw: 100,
    ratedCop: 32,
    ambientRated: 24,
    capCorrPctPerC: 0,
    partLoadCurve: 'fixed',
    refrigerant: 'water',
  },
  {
    schema: DATASHEET_SCHEMA,
    vendor: 'Vertiv (Liebert)',
    model: 'DSE 200 (DX with pumped refrigerant economizer)',
    kind: 'dx',
    systemType: 'dx-pumped-fc',
    ratedCapKw: 200,
    ratedCop: 3.2,
    ambientRated: 35,
    capCorrPctPerC: -1.5,
    partLoadCurve: 'iplv',
    dxPumpedThresholdDb: 13,
    dxPumpedAuxPctOfRated: 3,
    refrigerant: 'R134a',
    compressorType: 'scroll',
  },

  // ===== Generic small DX =====
  {
    schema: DATASHEET_SCHEMA,
    vendor: 'Generic',
    model: 'DX air-cooled split inverter 12 kW',
    kind: 'dx',
    systemType: 'dx-air',
    ratedCapKw: 12,
    ratedCop: 4.2,
    ambientRated: 35,
    capCorrPctPerC: -2.0,
    partLoadCurve: 'iplv',
    refrigerant: 'R32',
    compressorType: 'scroll',
  },
];

/**
 * Получить datasheets, опционально отфильтрованные по vendor / kind.
 */
export function listDatasheets(filter = {}) {
  let arr = VENDOR_DATASHEETS.slice();
  if (filter.vendor) arr = arr.filter(d => d.vendor === filter.vendor);
  if (filter.kind)   arr = arr.filter(d => d.kind === filter.kind);
  return arr;
}

export function listVendors() {
  return [...new Set(VENDOR_DATASHEETS.map(d => d.vendor))];
}
