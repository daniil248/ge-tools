// =============================================================================
// shared/meteo-fetch.js — авто-загрузка meteo-датасета по координатам проекта
// =============================================================================
// Phase 21.3 (extracted): Из tech-workspace вынесено как переиспользуемый
// helper для cooling и других модулей. Один клик → N лет почасовых данных
// через Open-Meteo Historical Weather API → сохранение как ⭐активного для
// проекта датасета.
//
// v0.60.55: добавлен опц. параметр `years` (1/5/10/15/20). Большие датасеты
// (10+ лет ≈ 6+ МБ) не помещаются в LS quota, поэтому сохраняем через IDB
// если он доступен, с автоматическим fallback на LS для совместимости.
//
// API:
//   await fetchAndSaveMeteoForProject(pid, { lat, lon, locationName, name?, years? })
//   → сохраняет dataset через IDB (если доступен) либо LS
//     помечает как ⭐активный, возвращает {ok, dataset, error?}
//
// Pure JS (использует fetch). Без UI-зависимостей.

import { projectKey } from './project-storage.js';
import { idbGet, idbSet, idbAvailable } from './idb-store.js';

/**
 * @param {string|null} pid
 * @param {object} loc — { lat, lon, locationName, name?, years? }
 * @returns {Promise<{ok: boolean, dataset?: object, error?: string}>}
 */
export async function fetchAndSaveMeteoForProject(pid, loc) {
  if (!pid) return { ok: false, error: 'pid обязателен (нет проекта — данные не сохранятся в namespace)' };
  if (!Number.isFinite(loc?.lat) || !Number.isFinite(loc?.lon)) {
    return { ok: false, error: 'Не заданы координаты lat/lon' };
  }
  const years = Math.max(1, Math.min(20, Number(loc.years) || 1));
  // Open-Meteo archive имеет лаг ≈5 дней — берём end_date с запасом.
  const today = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - (years * 365 + 5) * 86400000).toISOString().slice(0, 10);
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${loc.lat}&longitude=${loc.lon}&start_date=${startDate}&end_date=${today}&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m&timezone=auto`;
  let json;
  try {
    const res = await fetch(url);
    if (!res.ok) return { ok: false, error: `Open-Meteo вернул ${res.status}: ${res.statusText}` };
    json = await res.json();
  } catch (e) {
    return { ok: false, error: `Сетевая ошибка: ${e.message || e}` };
  }
  const times = json.hourly?.time || [];
  if (!times.length) return { ok: false, error: 'Open-Meteo вернул пустой ряд' };
  const T = json.hourly?.temperature_2m || [];
  const RH = json.hourly?.relative_humidity_2m || [];
  const W = json.hourly?.wind_speed_10m || [];
  const WD = json.hourly?.wind_direction_10m || [];
  const hourly = times.map((t, i) => ({ t, T: T[i], RH: RH[i], wind: W[i], windDir: WD[i] }));

  // Inline-stats (минимально нужное для cooling/PUE)
  const temps = hourly.map(h => Number(h.T)).filter(Number.isFinite);
  const sorted = [...temps].sort((a, b) => a - b);
  const stats = {
    tmin:  Math.round(sorted[0] * 10) / 10,
    tmax:  Math.round(sorted[sorted.length - 1] * 10) / 10,
    tmean: Math.round((sorted.reduce((s, v) => s + v, 0) / sorted.length) * 10) / 10,
    t99:   Math.round(sorted[Math.floor(sorted.length * 0.99)] * 10) / 10,
    freecoolHours: temps.filter(t => t < 14).length,
    n: temps.length,
  };

  const dsId = 'ds-' + Math.random().toString(36).slice(2, 10);
  const locName = loc.locationName || loc.name || `${loc.lat.toFixed(3)}, ${loc.lon.toFixed(3)}`;
  const dataset = {
    id: dsId,
    name: loc.name || `${locName} (${startDate}…${today}, ${years} ${years === 1 ? 'год' : years < 5 ? 'года' : 'лет'})`,
    source: 'open-meteo',
    lat: loc.lat, lon: loc.lon, locationName: locName,
    stationId: loc.stationId || null,
    dateFrom: startDate, dateTo: today,
    yearsLoaded: years,
    hourly, stats,
    activeForProject: true,
    createdAt: Date.now(),
  };

  // v0.60.55: existing датасеты читаем из IDB (приоритет) либо LS.
  // Большие датасеты (10+ лет) пишутся в IDB чтобы обойти LS quota ~4МБ.
  const idbKey = `meteo.datasets.${pid}`;
  const dsKey = projectKey(pid, 'meteo', 'datasets.v1');
  let existing = [];
  if (idbAvailable()) {
    try {
      const idbData = await idbGet(idbKey, null);
      if (Array.isArray(idbData)) existing = idbData;
    } catch {}
  }
  if (!existing.length) {
    try { existing = JSON.parse(localStorage.getItem(dsKey) || '[]'); } catch {}
  }
  for (const d of existing) d.activeForProject = false;
  existing.unshift(dataset);

  // Persist
  let savedToIdb = false;
  if (idbAvailable()) {
    try {
      await idbSet(idbKey, existing);
      savedToIdb = true;
      // Удаляем LS-копию (мигрировали на IDB)
      try { localStorage.removeItem(dsKey); } catch {}
    } catch (e) {
      console.warn('[meteo-fetch] IDB save failed, fallback to LS:', e);
    }
  }
  if (!savedToIdb) {
    try {
      localStorage.setItem(dsKey, JSON.stringify(existing));
    } catch (e) {
      return { ok: false, error: `Не удалось сохранить (${years} лет = ${(JSON.stringify(existing).length/1024/1024).toFixed(1)} МБ): ${e.message || e}` };
    }
  }
  // activeId — в LS (маленький, всегда вмещается)
  try { localStorage.setItem(projectKey(pid, 'meteo', 'activeId.v1'), JSON.stringify(dsId)); } catch {}

  return { ok: true, dataset };
}
