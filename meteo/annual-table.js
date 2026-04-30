// meteo/annual-table.js — v0.59.898
// Annual hours pivot table: бин Ambient T °C × агрегаты (часы/год, дни/год,
// средняя RH в бине, средний ветер, ASHRAE flag).
// Колонки настраиваются — пользователь включает/выключает что хочет видеть.
// Экспорт в CSV (Excel-совместимый, с BOM).

import { escHtml, escAttr } from './util.js';
import { tableToCsv, downloadCsv } from './charts.js';

// Описание всех доступных столбцов. В будущем плагины могут добавлять свои
// (например, chiller-spec модуль может добавить «Capacity [kW]» / «Compr.Power [kW]»).
export const COLUMNS = [
  { id: 'tBin',    label: 'Ambient Temp [°C]', default: true,  fmt: v => v.tBin },
  { id: 'hours',   label: 'Annual hours [h]',  default: true,  fmt: v => v.hours.toFixed(0) },
  { id: 'days',    label: 'Annual days [d]',   default: true,  fmt: v => v.days.toFixed(2) },
  { id: 'pct',     label: '% of year',         default: false, fmt: v => v.pct.toFixed(2) },
  { id: 'rhAvg',   label: 'Avg RH [%]',        default: true,  fmt: v => v.rhAvg != null ? v.rhAvg.toFixed(0) : '' },
  { id: 'rhMin',   label: 'Min RH [%]',        default: false, fmt: v => v.rhMin != null ? v.rhMin.toFixed(0) : '' },
  { id: 'rhMax',   label: 'Max RH [%]',        default: false, fmt: v => v.rhMax != null ? v.rhMax.toFixed(0) : '' },
  { id: 'windAvg', label: 'Avg wind [m/s]',    default: false, fmt: v => v.windAvg != null ? v.windAvg.toFixed(1) : '' },
  { id: 'cumPct',  label: 'Cumulative %',      default: false, fmt: v => v.cumPct.toFixed(1) },
];

// Bin данные по hourly: T → { hours, days, rhAvg, rhMin, rhMax, windAvg, ... }
export function buildBinData(hourly) {
  if (!hourly || !hourly.length) return [];
  const totalRecords = hourly.filter(h => Number.isFinite(Number(h.T))).length;
  const yearScale = totalRecords > 0 ? (8766 / totalRecords) : 1;  // 8766 = 365.25 × 24
  const map = new Map();  // tBin → accumulator
  for (const h of hourly) {
    const T = Number(h.T);
    if (!Number.isFinite(T)) continue;
    const tBin = Math.floor(T);
    let acc = map.get(tBin);
    if (!acc) {
      acc = { tBin, count: 0, rhSum: 0, rhN: 0, rhMin: Infinity, rhMax: -Infinity, windSum: 0, windN: 0 };
      map.set(tBin, acc);
    }
    acc.count++;
    const RH = Number(h.RH);
    if (Number.isFinite(RH)) {
      acc.rhSum += RH; acc.rhN++;
      if (RH < acc.rhMin) acc.rhMin = RH;
      if (RH > acc.rhMax) acc.rhMax = RH;
    }
    const W = Number(h.wind);
    if (Number.isFinite(W)) {
      acc.windSum += W; acc.windN++;
    }
  }
  const rows = [...map.values()].sort((a, b) => a.tBin - b.tBin);
  // Cumulative % (от низких к высоким, доля года ≤ T)
  let cum = 0;
  return rows.map(acc => {
    const hours = acc.count * yearScale;
    const days = hours / 24;
    const pct = (hours / 8766) * 100;
    cum += pct;
    return {
      tBin: acc.tBin,
      hours, days, pct, cumPct: cum,
      rhAvg: acc.rhN > 0 ? acc.rhSum / acc.rhN : null,
      rhMin: acc.rhN > 0 ? acc.rhMin : null,
      rhMax: acc.rhN > 0 ? acc.rhMax : null,
      windAvg: acc.windN > 0 ? acc.windSum / acc.windN : null,
    };
  });
}

// Render-функция: возвращает HTML таблицы с активными столбцами.
export function renderAnnualTable(rows, activeCols) {
  const cols = COLUMNS.filter(c => activeCols.includes(c.id));
  if (!rows.length) return '<div class="muted">Нет данных.</div>';
  let totalHours = 0, totalDays = 0;
  for (const r of rows) { totalHours += r.hours; totalDays += r.days; }
  return `<table class="mt-annual-table">
    <thead><tr>${cols.map(c => `<th class="${c.id === 'tBin' ? '' : 'num'}">${escHtml(c.label)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr>${cols.map(c => `<td class="${c.id === 'tBin' ? '' : 'num'}">${escHtml(c.fmt(r))}</td>`).join('')}</tr>`).join('')}</tbody>
    <tfoot><tr>${cols.map(c => {
      if (c.id === 'tBin') return `<td><b>Σ</b></td>`;
      if (c.id === 'hours') return `<td class="num"><b>${totalHours.toFixed(0)}</b></td>`;
      if (c.id === 'days') return `<td class="num"><b>${totalDays.toFixed(1)}</b></td>`;
      if (c.id === 'pct') return `<td class="num"><b>100.00</b></td>`;
      return `<td></td>`;
    }).join('')}</tr></tfoot>
  </table>`;
}

export function exportAnnualTableCsv(rows, activeCols, filename = 'annual-hours.csv') {
  const cols = COLUMNS.filter(c => activeCols.includes(c.id));
  const csvRows = [cols.map(c => c.label)];
  for (const r of rows) csvRows.push(cols.map(c => c.fmt(r)));
  downloadCsv(tableToCsv(csvRows), filename);
}

// HTML столбец-пикера
export function renderColumnPicker(activeCols, onChange) {
  const wrap = document.createElement('div');
  wrap.className = 'mt-col-picker';
  wrap.innerHTML = COLUMNS.map(c => `
    <label class="mt-col-picker-row">
      <input type="checkbox" data-col-id="${escAttr(c.id)}" ${activeCols.includes(c.id) ? 'checked' : ''} ${c.id === 'tBin' ? 'disabled' : ''}>
      <span>${escHtml(c.label)}</span>
    </label>
  `).join('');
  wrap.addEventListener('change', (e) => {
    if (e.target.matches('input[data-col-id]')) {
      const id = e.target.dataset.colId;
      const next = e.target.checked
        ? [...activeCols, id]
        : activeCols.filter(c => c !== id);
      onChange(next);
    }
  });
  return wrap;
}
