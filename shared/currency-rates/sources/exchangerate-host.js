// =============================================================================
// shared/currency-rates/sources/open-er-api.js — open.er-api.com (USD base)
// =============================================================================
// Source: https://www.exchangerate-api.com/docs/free
// Free, no API key, CORS-enabled. Поддержка только последних курсов
// (для исторических нужен ключ — оставляем как fallback с notice).
// Endpoint: https://open.er-api.com/v6/latest/USD
//
// Заменил exchangerate.host (он теперь требует ключ от 2024 г.).
// Имя файла оставлено exchangerate-host.js для backward-compat кеша LS.

import { register } from '../index.js';

async function fetchOpenErApi(date) {
  // Free план — только latest. Игнорируем date (используем today).
  const today = new Date().toISOString().slice(0, 10);
  const resp = await fetch('https://open.er-api.com/v6/latest/USD');
  if (!resp.ok) throw new Error(`open.er-api HTTP ${resp.status}`);
  const json = await resp.json();
  if (json.result !== 'success') throw new Error(`open.er-api: result=${json.result}`);
  const rates = { ...(json.rates || {}), USD: 1 };
  // Дата из API: time_last_update_utc — приводим к YYYY-MM-DD
  const apiDate = json.time_last_update_utc
    ? new Date(json.time_last_update_utc).toISOString().slice(0, 10)
    : today;
  return { date: apiDate, base: 'USD', rates, _note: date !== apiDate ? `Free план без истории — возвращены актуальные курсы на ${apiDate}` : undefined };
}

register({
  id: 'exchangerate-host',
  label: 'open.er-api.com (USD base, без ключа)',
  base: 'USD',
  url: 'https://www.exchangerate-api.com/',
  fetch: fetchOpenErApi,
});
