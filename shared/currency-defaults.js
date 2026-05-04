// ======================================================================
// shared/currency-defaults.js — v0.60.105
//
// Каскадный резолвер валюты по умолчанию для всех модулей платформы.
// Раньше валюта хардкодилась как «₽» в каждом месте; теперь — единая
// логика наследования от уровня к уровню.
//
// По требованию Пользователя 2026-05-04: «Валюта по умолчанию должна
// задаваться в настройках пользователя, в настройках компании и в
// настройках конкретного проекта».
//
// Каскад приоритетов (от высшего к низшему):
//   1. Project-level   — project.economics.displayCurrency
//                        (свойства проекта → 💰 Экономика)
//   2. Company-level   — company-profile.defaultCurrency
//                        (⚙ → Реквизиты организации → Валюта по умолчанию)
//   3. Organization    — org-profile.defaultCurrency  [Phase 41 TODO]
//                        (⚙ → Организация — группа людей с общими шаблонами)
//   4. User-level      — user-settings.defaultCurrency
//                        (⚙ → Личные настройки → Валюта)
//   5. Hardcoded       — '₽' (универсальный fallback)
//
// Примечания:
//   • Все коды валют — символьные (₽/$/€/₸/¥/£/Br/₺/₴/CHF), потому что
//     UI исторически использует символы. Конвертация в ISO-3 (RUB/USD/...)
//     поддерживается через CURRENCIES.findByCode().iso.
//   • Резолвер не выполняет миграцию старых данных (cooling/service
//     уже хранят валюту явно в записях).
//   • Слушатель изменений: подпишитесь на storage-event с ключом
//     'raschet.user.defaultCurrency.v1' / 'raschet.companyProfile.global.v1'
//     / 'raschet.org.profile.v1' для cross-tab синхронизации.
// ======================================================================

import { getProject } from './project-storage.js';
import { loadEffectiveCompanyProfile } from './company-profile.js';

// Поддерживаемые валюты (single source of truth для всей платформы).
// При добавлении новой валюты — она автоматически появится во всех
// pickers (project economics, work-catalog, cooling capex и т.д.).
export const CURRENCIES = [
  { code: '₽',   iso: 'RUB', label: 'RUB · российский рубль' },
  { code: '$',   iso: 'USD', label: 'USD · доллар США' },
  { code: '€',   iso: 'EUR', label: 'EUR · евро' },
  { code: '₸',   iso: 'KZT', label: 'KZT · тенге' },
  { code: '¥',   iso: 'CNY', label: 'CNY · юань' },
  { code: '£',   iso: 'GBP', label: 'GBP · фунт' },
  { code: 'Br',  iso: 'BYN', label: 'BYN · бел. рубль' },
  { code: '₺',   iso: 'TRY', label: 'TRY · лира' },
  { code: '₴',   iso: 'UAH', label: 'UAH · гривна' },
  { code: 'CHF', iso: 'CHF', label: 'CHF · франк' },
];

const LS_USER = 'raschet.user.defaultCurrency.v1';
const LS_ORG  = 'raschet.org.profile.v1';

/** Хардкоднутый последний fallback (если ничего не задано нигде). */
export const HARDCODED_FALLBACK = '₽';

// ─── User-level
export function getUserDefaultCurrency() {
  try { return localStorage.getItem(LS_USER) || null; } catch { return null; }
}
export function setUserDefaultCurrency(code) {
  if (!code) { try { localStorage.removeItem(LS_USER); } catch {}; return; }
  try { localStorage.setItem(LS_USER, code); } catch {}
}

// ─── Organization-level [Phase 41 — пока scaffold]
//
// Организация — группа людей, работающая над общими проектами с общими
// настройками шаблонов и общих данных. Зафиксировано Пользователем
// 2026-05-04. Полная реализация — см. ROADMAP Phase 41.
//
// Сейчас: храним org-profile как локальный объект с базовыми полями.
// В будущем — синхронизация через cloud (Firestore), мульти-пользователь.
export function getOrgProfile() {
  try {
    const raw = localStorage.getItem(LS_ORG);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export function saveOrgProfile(profile) {
  try { localStorage.setItem(LS_ORG, JSON.stringify(profile || {})); } catch {}
}
export function getOrgDefaultCurrency() {
  const p = getOrgProfile();
  return p && p.defaultCurrency ? p.defaultCurrency : null;
}

// ─── Company-level (через company-profile)
export function getCompanyDefaultCurrency(pid) {
  try {
    const cp = loadEffectiveCompanyProfile(pid);
    return cp && cp.defaultCurrency ? cp.defaultCurrency : null;
  } catch { return null; }
}

// ─── Project-level
export function getProjectDefaultCurrency(pid) {
  if (!pid) return null;
  try {
    const p = getProject(pid);
    return p && p.economics && p.economics.displayCurrency
      ? p.economics.displayCurrency
      : null;
  } catch { return null; }
}

/**
 * Каскадный резолвер: возвращает первое непустое значение из:
 *   project → company → org → user → HARDCODED_FALLBACK
 *
 * @param {string|null} pid — id проекта (если не задано, project-уровень
 *                            пропускается)
 * @returns {string} символ валюты ('₽', '$', '€', '₸', и т.д.)
 */
export function resolveDefaultCurrency(pid = null) {
  return getProjectDefaultCurrency(pid)
      || getCompanyDefaultCurrency(pid)
      || getOrgDefaultCurrency()
      || getUserDefaultCurrency()
      || HARDCODED_FALLBACK;
}

/**
 * Объяснение откуда взялась валюта (для UI-tooltip'ов «📁 из проекта»
 * / «🏢 из компании» / «👥 из организации» / «👤 из пользователя»).
 *
 * @param {string|null} pid
 * @returns {{ value: string, source: 'project'|'company'|'org'|'user'|'fallback', sourceLabel: string }}
 */
export function resolveDefaultCurrencyWithSource(pid = null) {
  let v;
  v = getProjectDefaultCurrency(pid);
  if (v) return { value: v, source: 'project',  sourceLabel: '📁 из проекта' };
  v = getCompanyDefaultCurrency(pid);
  if (v) return { value: v, source: 'company',  sourceLabel: '🏢 из компании' };
  v = getOrgDefaultCurrency();
  if (v) return { value: v, source: 'org',      sourceLabel: '👥 из организации' };
  v = getUserDefaultCurrency();
  if (v) return { value: v, source: 'user',     sourceLabel: '👤 из настроек пользователя' };
  return       { value: HARDCODED_FALLBACK, source: 'fallback', sourceLabel: '⚙ дефолт системы' };
}

/** Найти CURRENCIES-объект по коду (символу). */
export function findCurrencyByCode(code) {
  return CURRENCIES.find(c => c.code === code) || null;
}

/** Лейбл для UI («₽ — RUB · российский рубль»). */
export function currencyLabel(code) {
  const c = findCurrencyByCode(code);
  return c ? `${c.code} — ${c.label}` : (code || '');
}
