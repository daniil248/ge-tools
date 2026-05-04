// =============================================================================
// shared/company-profile.js — реквизиты организации (общеплатформенные)
// =============================================================================
// Глобальные реквизиты исполнителя — отображаются в шапках КП, договоров,
// технических отчётов. По требованию Пользователя 2026-05-02:
// «"Реквизиты компании" должны быть в настройке организации а не в модуле Сервис».
//
// Хранение:
//   - Глобально: 'raschet.companyProfile.global.v1' (single key)
//   - Per-project override (опционально): 'raschet.project.<pid>.companyProfile.v1'
//     с флагом overrideEnabled. Если выключен — берутся глобальные.
//
// Используется:
//   - service/calc/export-offer.js — шапка КП клиенту
//   - shared/report/template.js — шапка отчётов (потенциально)
//   - reports/ — шаблоны
//
// Pure JS / LocalStorage utility wrappers.

const LS_GLOBAL = 'raschet.companyProfile.global.v1';
const PROJECT_KEY_SUFFIX = 'companyProfile.v1';

export const DEFAULT_COMPANY = {
  name: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  bin: '',           // БИН (KZ) / ИНН (RU)
  bankRequisites: '',// банковские реквизиты (текстовый блок)
  director: '',      // ФИО руководителя
  logoDataUrl: '',   // base64 image (опционально, в будущем)
  // v0.60.105: валюта по умолчанию для всей компании. Используется в
  // каскаде resolveDefaultCurrency (project→company→org→user→fallback).
  // Пусто = унаследовать с уровня выше (org или user). Символ ('₽','$',...).
  defaultCurrency: '',
  // v0.60.112: налоги (НДС / VAT и др.) по умолчанию для компании. По
  // запросу Пользователя 2026-05-04: «Любые налоги должны указываться
  // в настройках проекта и настройках компании». Используется в каскаде
  // resolveDefaultVat (project.economics.vat → company.defaultVat → fallback).
  // null = унаследовать с уровня выше / системный дефолт.
  //
  // Структура: { pct: 16, enabled: true, jurisdiction: 'KZ', label: 'НДС' }
  //   pct          — ставка %
  //   enabled      — включать в КП (false = «без НДС», для экспорта)
  //   jurisdiction — 'KZ' / 'RU' / 'BY' / 'export' / 'custom'
  //   label        — отображаемое имя налога (НДС / VAT / ...)
  defaultVat: null,
};

/**
 * Получить эффективный профиль для текущего контекста.
 * Приоритет: project-override (если включён) → global → DEFAULT.
 *
 * @param {string|null} pid
 * @returns {object} company profile (всегда содержит все поля DEFAULT_COMPANY)
 */
export function loadEffectiveCompanyProfile(pid) {
  let global = { ...DEFAULT_COMPANY };
  try {
    const raw = localStorage.getItem(LS_GLOBAL);
    if (raw) global = { ...DEFAULT_COMPANY, ...JSON.parse(raw) };
  } catch {}
  if (pid) {
    try {
      const key = `raschet.project.${pid}.${PROJECT_KEY_SUFFIX}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const proj = JSON.parse(raw);
        if (proj && proj.overrideEnabled) {
          const merged = { ...global };
          for (const k of Object.keys(DEFAULT_COMPANY)) {
            if (proj[k] != null && proj[k] !== '') merged[k] = proj[k];
          }
          merged.overrideEnabled = true;
          return merged;
        }
      }
    } catch {}
  }
  return global;
}

/** Сохранить глобальный профиль. */
export function saveGlobalCompanyProfile(profile) {
  try {
    const clean = { ...DEFAULT_COMPANY, ...(profile || {}) };
    delete clean.overrideEnabled;
    localStorage.setItem(LS_GLOBAL, JSON.stringify(clean));
    _notifyChange({ scope: 'global', profile: clean });
  } catch {}
}

/** Сохранить project-override. */
export function saveProjectCompanyProfile(pid, profile) {
  if (!pid) return;
  try {
    const key = `raschet.project.${pid}.${PROJECT_KEY_SUFFIX}`;
    localStorage.setItem(key, JSON.stringify(profile || { ...DEFAULT_COMPANY, overrideEnabled: false }));
    _notifyChange({ scope: 'project', pid, profile });
  } catch {}
}

/* v0.60.35: pub/sub для auto-refresh любых UI, использующих company-profile.
   По репорту: «реквизиты автоматически не обновляются». */
const _listeners = new Set();
export function onCompanyProfileChange(cb) {
  _listeners.add(cb);
  return () => _listeners.delete(cb);
}
function _notifyChange(detail) {
  _listeners.forEach(cb => { try { cb(detail); } catch (e) { console.error('[company-profile listener]', e); } });
  // Также шлём DOM event для модулей которые не импортируют company-profile.js напрямую
  try {
    window.dispatchEvent(new CustomEvent('raschet:company-profile-change', { detail }));
  } catch {}
}

/** Прочитать сырой profile (без merge с global). */
export function loadRawProfile(pid) {
  if (pid) {
    try {
      const raw = localStorage.getItem(`raschet.project.${pid}.${PROJECT_KEY_SUFFIX}`);
      if (raw) return JSON.parse(raw);
    } catch {}
    return { ...DEFAULT_COMPANY, overrideEnabled: false };
  }
  try {
    const raw = localStorage.getItem(LS_GLOBAL);
    if (raw) return { ...DEFAULT_COMPANY, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_COMPANY };
}
