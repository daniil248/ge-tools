// =============================================================================
// shared/auto-norm.js — v0.60.121 (Phase auto-norm by location)
// =============================================================================
// Универсальный helper для авто-выбора нормативного документа по стране
// проекта. По правилу memory feedback_auto_norm_by_location.md.
//
// Принцип:
//   1. project.location.country задаётся ОДИН раз в свойствах проекта.
//   2. detectCountryCode(country) → 'KZ' | 'RU' | 'BY' | 'US' | 'CA' | 'EU' | null.
//   3. resolveAutoNorm(domain, country) → id методики из NORM_MATRIX или null.
//   4. Юзер может override в локальном dropdown модуля — auto-pick применяется
//      ТОЛЬКО для новых объектов (existing.norm имеет приоритет).
//
// Как использовать в модуле (паттерн из suppression-config v0.60.120):
//
//   import { resolveAutoNormForActiveProject } from '../shared/auto-norm.js';
//   const autoNorm = resolveAutoNormForActiveProject('cable');
//   const initialNorm = existing?.norm || autoNorm || 'iec-60364';
//   if (!existing && autoNorm) {
//     rsToast(`📋 Норматив авто-выбран по стране проекта. Можно изменить.`, 'info');
//   }
// =============================================================================

import { getActiveProjectId } from './project-storage.js';

// =============================================================================
// NORM_MATRIX — карта domain × country → norm-id.
//
// При добавлении новой методики в модуле — добавить запись сюда.
// =============================================================================
export const NORM_MATRIX = {
  // Газовое пожаротушение (АГПТ).
  suppression: {
    KZ: 'sp-rk-2022',         // СП РК 2.02-102-2022
    RU: 'sp-485-annex-d',     // СП 485.1311500.2020 Прил. Д
    BY: 'sp-485-annex-d',     // BY использует РФ как fallback
    US: 'nfpa-2001',          // NFPA 2001
    CA: 'nfpa-2001',
    EU: 'iso-14520',          // ISO 14520
  },
  // Расчёт кабельных линий (выбор сечения, защита).
  cable: {
    KZ: 'iec-60364',          // KZ в переходе на IEC; ПУЭ-РК ⊃ IEC
    RU: 'pue-7',              // ПУЭ-7 + СП 76 / СП 256
    BY: 'pue-7',
    US: 'nec',                // NFPA 70 (NEC)
    CA: 'nec',                // CSA C22.1 ≈ NEC
    EU: 'iec-60364',          // IEC 60364-5-52
  },
  // СКС (структурированная кабельная система).
  scs: {
    KZ: 'iso-24764',          // KZ через IEC/ISO
    RU: 'gost-r-53246',       // ГОСТ Р 53246 (на базе TIA-942)
    BY: 'gost-r-53246',
    US: 'tia-942',            // TIA-942-C (текущая)
    CA: 'tia-942',
    EU: 'iso-24764',          // ISO/IEC 24764 + EN 50173-5
  },
  // Климат / вентиляция / кондиционирование.
  cooling: {
    KZ: 'sp-60',              // СП 60.13330.2020 + СП 7.13130
    RU: 'sp-60',
    BY: 'sp-60',
    US: 'ashrae-tc99',        // ASHRAE TC 9.9 (Datacom)
    CA: 'ashrae-tc99',
    EU: 'en-12831',           // EN 12831 + EN 15251
  },
  // НКУ / распределительные щиты НН.
  panel: {
    KZ: 'iec-61439',          // IEC 61439 + ПУЭ-РК
    RU: 'pue-7',              // ПУЭ-7 + ГОСТ IEC 61439
    BY: 'pue-7',
    US: 'ul-891',             // UL 891 (Switchboards) + UL 67 (Panelboards)
    CA: 'ul-891',
    EU: 'iec-61439',
  },
  // РУ среднего напряжения.
  mv: {
    KZ: 'iec-62271',
    RU: 'pue-7',              // ПУЭ-7 + ГОСТ IEC 62271
    BY: 'pue-7',
    US: 'ieee-c37',           // IEEE C37.20.x
    CA: 'ieee-c37',
    EU: 'iec-62271',
  },
  // АКБ (для ИБП / гелиосистем / связи).
  battery: {
    KZ: 'iec-62485',
    RU: 'gost-iec-62485',     // ГОСТ IEC 62485
    BY: 'gost-iec-62485',
    US: 'ieee-1187',          // IEEE 1187 (VRLA install)
    CA: 'ieee-1187',
    EU: 'iec-62485',
  },
  // ДГУ (по нагрузочным режимам и выбросам).
  dgu: {
    KZ: 'iso-8528',
    RU: 'iso-8528',           // ISO 8528-1 (mode classification)
    BY: 'iso-8528',
    US: 'epa-tier4',          // EPA Tier 4 / NFPA 110 для emergency
    CA: 'epa-tier4',
    EU: 'iso-8528',
  },
};

// =============================================================================
// detectCountryCode — нормализует строку country в один из кодов матрицы.
// =============================================================================
export function detectCountryCode(country) {
  if (!country) return null;
  const c = String(country).toLowerCase().trim();
  if (!c) return null;
  // Казахстан
  if (/казах|qazaq|kazakh/.test(c) || /^kz$/.test(c)) return 'KZ';
  // Россия
  if (/росси|russia/.test(c) || /^ru$/.test(c)) return 'RU';
  // Беларусь
  if (/белар|belarus/.test(c) || /^by$/.test(c)) return 'BY';
  // США / Канада
  if (/usa|united states|америк/.test(c) || /^us$/.test(c)) return 'US';
  if (/canada|канад/.test(c) || /^ca$/.test(c)) return 'CA';
  // EU
  if (/germ|france|italy|spain|poland|finland|swed|norway|netherl|euro|герман|франц|итал|испан|польш|финлянд|швец|норвег|нидерланд|^de$|^fr$|^it$|^es$|^pl$|^fi$|^se$|^no$|^nl$/.test(c)) return 'EU';
  return null;
}

// =============================================================================
// resolveAutoNorm — основной API. Возвращает id методики или null.
// =============================================================================
export function resolveAutoNorm(domain, country) {
  const code = detectCountryCode(country);
  if (!code) return null;
  const map = NORM_MATRIX[domain];
  return map ? (map[code] || null) : null;
}

// =============================================================================
// resolveAutoNormForActiveProject — convenience wrapper. Читает country
// из active project и возвращает рекомендуемый norm для domain.
// =============================================================================
export function resolveAutoNormForActiveProject(domain) {
  const country = getProjectCountry(null);
  return resolveAutoNorm(domain, country);
}

// =============================================================================
// getProjectCountry — читает country из project.location.
// =============================================================================
export function getProjectCountry(pid = null) {
  if (!pid) {
    try {
      const aid = JSON.parse(localStorage.getItem('raschet.activeProject.v1') || 'null');
      pid = aid && typeof aid === 'object' ? aid.id : aid;
    } catch {}
    if (!pid) {
      try { pid = getActiveProjectId(); } catch {}
    }
  }
  if (!pid) return null;
  try {
    const arr = JSON.parse(localStorage.getItem('raschet.projects.v1') || '[]');
    const p = (arr || []).find(x => x && x.id === pid);
    return p?.location?.country || null;
  } catch { return null; }
}

// =============================================================================
// Метаданные для UI — иконка флага + краткое имя страны для toast'ов.
// =============================================================================
export const COUNTRY_FLAG = {
  KZ: '🇰🇿', RU: '🇷🇺', BY: '🇧🇾',
  US: '🇺🇸', CA: '🇨🇦', EU: '🇪🇺',
};
export const COUNTRY_NAME = {
  KZ: 'Казахстан', RU: 'Россия', BY: 'Беларусь',
  US: 'США', CA: 'Канада', EU: 'EU',
};

/** Лейбл «🇰🇿 Казахстан» для toast'ов. */
export function countryLabel(code) {
  if (!code) return '';
  return `${COUNTRY_FLAG[code] || ''} ${COUNTRY_NAME[code] || code}`.trim();
}
