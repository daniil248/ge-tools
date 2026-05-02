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
  } catch {}
}

/** Сохранить project-override. */
export function saveProjectCompanyProfile(pid, profile) {
  if (!pid) return;
  try {
    const key = `raschet.project.${pid}.${PROJECT_KEY_SUFFIX}`;
    localStorage.setItem(key, JSON.stringify(profile || { ...DEFAULT_COMPANY, overrideEnabled: false }));
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
