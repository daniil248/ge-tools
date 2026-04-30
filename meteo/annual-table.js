// meteo/annual-table.js — v0.59.900
// Annual hours pivot table: бин Ambient T °C × агрегаты (часы/год, дни/год,
// RH/wind, и chiller-energy если задан chillerSpec).
// Колонки настраиваются. Экспорт в CSV (Excel-совместимый, с BOM).

import { escHtml, escAttr } from './util.js';
import { tableToCsv, downloadCsv } from './charts.js';

// v0.59.900: chiller-spec — пользовательская спецификация чиллера для
// расчёта годового энергопотребления. По формату скрина 2 (Daikin/SAEL
// chiller perf table). Линейный CapCorr и упрощённый COP-curve.
//
// shape:
//   { ratedCapKw, ratedCOP, capCorrPctPerC, ambientRated, partLoadCurve }
// partLoadCurve: 'iplv' — стандартный IPLV профиль; 'fixed' — COP не
// зависит от загрузки.
export const DEFAULT_CHILLER = {
  ratedCapKw: 0,
  ratedCOP: 3.5,
  capCorrPctPerC: -1.5,   // capacity снижается ~1.5% за каждый °C выше ratedAmbient
  ambientRated: 35,        // условия по которым задан rated (ASHRAE 35°C)
  partLoadCurve: 'iplv',
};

// Описание всех доступных столбцов. Plugin-style — модуль может пополнять
// COLUMNS своими metric-определениями.
export const COLUMNS = [
  { id: 'tBin',     label: 'Ambient Temp [°C]', default: true,  fmt: v => v.tBin },
  { id: 'hours',    label: 'Annual hours [h]',  default: true,  fmt: v => v.hours.toFixed(0) },
  { id: 'days',     label: 'Annual days [d]',   default: true,  fmt: v => v.days.toFixed(2) },
  { id: 'pct',      label: '% of year',         default: false, fmt: v => v.pct.toFixed(2) },
  { id: 'rhAvg',    label: 'Avg RH [%]',        default: true,  fmt: v => v.rhAvg != null ? v.rhAvg.toFixed(0) : '' },
  { id: 'rhMin',    label: 'Min RH [%]',        default: false, fmt: v => v.rhMin != null ? v.rhMin.toFixed(0) : '' },
  { id: 'rhMax',    label: 'Max RH [%]',        default: false, fmt: v => v.rhMax != null ? v.rhMax.toFixed(0) : '' },
  { id: 'windAvg',  label: 'Avg wind [m/s]',    default: false, fmt: v => v.windAvg != null ? v.windAvg.toFixed(1) : '' },
  { id: 'cumPct',   label: 'Cumulative %',      default: false, fmt: v => v.cumPct.toFixed(1) },
  // ─── Chiller columns (видимы только если задана chillerSpec)
  { id: 'capacity', label: 'Capacity [kW]',     default: false, chiller: true, fmt: v => v.capacity != null ? v.capacity.toFixed(1) : '' },
  { id: 'cop',      label: 'COP',               default: false, chiller: true, fmt: v => v.cop != null ? v.cop.toFixed(2) : '' },
  { id: 'power',    label: 'Compr.Power [kW]',  default: false, chiller: true, fmt: v => v.power != null ? v.power.toFixed(2) : '' },
  { id: 'energy',   label: 'Annual energy [kWh]', default: false, chiller: true, fmt: v => v.energy != null ? v.energy.toFixed(0) : '' },
];

// v0.59.900: расчёт capacity / COP / power / energy для одного бина T,
// если задан chillerSpec.
//   capacity = ratedCap × (1 + corrPct × (T - ambientRated))
//   COP при IPLV — снижается линейно при > rated ambient, растёт при < rated.
//     COP_T = ratedCOP × (1 + 0.02 × (ambientRated - T)) clamp [0.6×rated; 1.8×rated]
//   power = capacity / COP
//   energy = power × hoursInBin
function applyChillerCalc(row, spec) {
  if (!spec || !Number.isFinite(Number(spec.ratedCapKw)) || Number(spec.ratedCapKw) <= 0) return row;
  const dT = row.tBin - (spec.ambientRated || 35);
  const corr = (spec.capCorrPctPerC || 0) / 100;
  const capacity = Math.max(0, (spec.ratedCapKw || 0) * (1 + corr * dT));
  const ratedCOP = spec.ratedCOP || 3.5;
  let cop;
  if (spec.partLoadCurve === 'fixed') {
    cop = ratedCOP;
  } else {
    // Упрощённый IPLV-стиль: COP падает с ростом ambient T
    const copFactor = 1 + 0.02 * (-dT);
    cop = ratedCOP * Math.max(0.6, Math.min(1.8, copFactor));
  }
  const power = capacity > 0 && cop > 0 ? capacity / cop : 0;
  const energy = power * row.hours;
  return { ...row, capacity, cop, power, energy };
}

// Bin данные по hourly: T → { hours, days, rhAvg, rhMin, rhMax, windAvg, ... }
export function buildBinData(hourly, chillerSpec = null) {
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
    const row = {
      tBin: acc.tBin,
      hours, days, pct, cumPct: cum,
      rhAvg: acc.rhN > 0 ? acc.rhSum / acc.rhN : null,
      rhMin: acc.rhN > 0 ? acc.rhMin : null,
      rhMax: acc.rhN > 0 ? acc.rhMax : null,
      windAvg: acc.windN > 0 ? acc.windSum / acc.windN : null,
    };
    return chillerSpec ? applyChillerCalc(row, chillerSpec) : row;
  });
}

// Render-функция: возвращает HTML таблицы с активными столбцами.
export function renderAnnualTable(rows, activeCols) {
  const cols = COLUMNS.filter(c => activeCols.includes(c.id));
  if (!rows.length) return '<div class="muted">Нет данных.</div>';
  let totalHours = 0, totalDays = 0, totalEnergy = 0;
  for (const r of rows) {
    totalHours += r.hours;
    totalDays += r.days;
    if (Number.isFinite(r.energy)) totalEnergy += r.energy;
  }
  return `<table class="mt-annual-table">
    <thead><tr>${cols.map(c => `<th class="${c.id === 'tBin' ? '' : 'num'}">${escHtml(c.label)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr>${cols.map(c => `<td class="${c.id === 'tBin' ? '' : 'num'}">${escHtml(c.fmt(r))}</td>`).join('')}</tr>`).join('')}</tbody>
    <tfoot><tr>${cols.map(c => {
      if (c.id === 'tBin') return `<td><b>Σ</b></td>`;
      if (c.id === 'hours') return `<td class="num"><b>${totalHours.toFixed(0)}</b></td>`;
      if (c.id === 'days') return `<td class="num"><b>${totalDays.toFixed(1)}</b></td>`;
      if (c.id === 'pct') return `<td class="num"><b>100.00</b></td>`;
      if (c.id === 'energy') return `<td class="num"><b>${totalEnergy.toFixed(0)}</b></td>`;
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
export function renderColumnPicker(activeCols, onChange, hasChillerSpec = false) {
  const wrap = document.createElement('div');
  wrap.className = 'mt-col-picker';
  wrap.innerHTML = COLUMNS.map(c => {
    const disabled = c.id === 'tBin' || (c.chiller && !hasChillerSpec);
    const note = c.chiller && !hasChillerSpec ? ' <span class="muted">(задайте Chiller spec)</span>' : '';
    return `<label class="mt-col-picker-row">
      <input type="checkbox" data-col-id="${escAttr(c.id)}" ${activeCols.includes(c.id) ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
      <span>${escHtml(c.label)}${note}</span>
    </label>`;
  }).join('');
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

// v0.59.900: chiller-spec form (inline, прямо над таблицей)
export function renderChillerSpecForm(spec, onChange, onClear) {
  const s = spec || DEFAULT_CHILLER;
  const wrap = document.createElement('div');
  wrap.className = 'mt-chiller-form';
  wrap.innerHTML = `
    <h4>❄ Chiller spec (для расчёта годовой энергии)</h4>
    <div class="mt-chiller-grid">
      <label>Rated capacity, кВт:<input type="number" step="1" min="0" data-cf="ratedCapKw" value="${s.ratedCapKw}"></label>
      <label>Rated COP:<input type="number" step="0.1" min="1" max="10" data-cf="ratedCOP" value="${s.ratedCOP}"></label>
      <label>Rated ambient T, °C:<input type="number" step="1" data-cf="ambientRated" value="${s.ambientRated}"></label>
      <label>Capacity correction, %/°C:<input type="number" step="0.1" data-cf="capCorrPctPerC" value="${s.capCorrPctPerC}"></label>
      <label>Part-load COP curve:
        <select data-cf="partLoadCurve">
          <option value="iplv"${s.partLoadCurve === 'iplv' ? ' selected' : ''}>IPLV (linear T-correction)</option>
          <option value="fixed"${s.partLoadCurve === 'fixed' ? ' selected' : ''}>Fixed COP (без T-correction)</option>
        </select>
      </label>
      <label>&nbsp;<button type="button" class="mt-btn-ghost" data-clear-chiller>🗑 Сбросить</button></label>
    </div>
    <p class="muted" style="font-size:11px;margin:6px 0 0">Capacity = ratedCap × (1 + corr × (T − T<sub>rated</sub>)). COP = ratedCOP × (1 + 0.02 × (T<sub>rated</sub> − T)) clamp [0.6×; 1.8×]. Power = capacity / COP. Energy = Power × annual hours.</p>
  `;
  wrap.addEventListener('change', (e) => {
    const inp = e.target.closest('[data-cf]');
    if (!inp) return;
    const field = inp.dataset.cf;
    const val = inp.type === 'number' ? Number(inp.value) || 0 : inp.value;
    onChange({ ...s, [field]: val });
  });
  wrap.addEventListener('click', (e) => {
    if (e.target.closest('[data-clear-chiller]')) onClear();
  });
  return wrap;
}
