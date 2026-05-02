// =============================================================================
// shared/currency-rates/sources/frankfurter.js — Frankfurter.app (ECB)
// =============================================================================
// Source: https://www.frankfurter.app/
// Free, no API key. Курсы Европейского ЦБ (ECB), база EUR.
// Endpoint: https://api.frankfurter.app/YYYY-MM-DD
// Формат: { date, base, rates: { USD: 1.085, ... } }

import { register } from '../index.js';

async function fetchFrankfurter(date) {
  // Frankfurter возвращает 404 для дат без публикации (будущее, выходные/праздники).
  // Пробуем точную дату, на ошибке fallback на /latest (последняя доступная).
  const tryUrls = [
    `https://api.frankfurter.app/${date}`,
    `https://api.frankfurter.dev/v1/${date}`,
    `https://api.frankfurter.app/latest`,
    `https://api.frankfurter.dev/v1/latest`,
  ];
  let lastErr = null;
  for (const url of tryUrls) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) { lastErr = new Error(`HTTP ${resp.status}`); continue; }
      const json = await resp.json();
      if (!json.rates) { lastErr = new Error('no rates field'); continue; }
      const rates = { ...json.rates, EUR: 1 };
      const note = (json.date && json.date !== date)
        ? `Запрошенная дата ${date} недоступна — возвращены курсы на ${json.date} (последняя публикация ECB).`
        : undefined;
      return { date: json.date || date, base: json.base || 'EUR', rates, _note: note };
    } catch (e) { lastErr = e; }
  }
  throw new Error(`Frankfurter: ${lastErr?.message || 'unknown'}`);
}

register({
  id: 'frankfurter',
  label: 'ECB / Frankfurter.app (EUR base)',
  base: 'EUR',
  url: 'https://www.frankfurter.app/',
  fetch: fetchFrankfurter,
});
