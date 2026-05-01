// meteo/annual-table.js — v0.59.900
// Annual hours pivot table: бин Ambient T °C × агрегаты (часы/год, дни/год,
// RH/wind, и chiller-energy если задан chillerSpec).
// Колонки настраиваются. Экспорт в CSV (Excel-совместимый, с BOM).

import { escHtml, escAttr } from './util.js';
import { tableToCsv, downloadCsv } from './charts.js';

// v0.59.900: chiller-spec — пользовательская спецификация чиллера/DX-системы
// для расчёта годового энергопотребления. По формату Daikin/SAEL chiller
// perf table. Линейный CapCorr и упрощённый COP-curve.
//
// v0.59.987: расширено для расчёта фрикулинга (chiller dry/wet) и DX-систем
// (air-cooled / pumped refrigerant economizer). См. README ниже.
//
// systemType:
//   'chiller'         — чиллер с водяным контуром (CHW). Поддерживает
//                       freeCoolingMode = 'none' | 'dry' | 'wet'.
//                       'dry'  — dry cooler / drycooler (теплообменник
//                                воздух-вода, T_ref = T_db).
//                       'wet'  — cooling tower / градирня (T_ref = T_wb,
//                                лучше зимой/летом, требует подпитки).
//   'dx-air'          — DX (direct expansion), воздушного охлаждения
//                       (RTU, сплит). Без фрикулинга (только компрессор).
//   'dx-pumped-fc'    — DX с насосом хладагента (pumped refrigerant
//                       economizer, Liebert/Vertiv). Когда T_amb_db
//                       достаточно холодная, компрессор отключается
//                       и хладагент циркулирует насосом — резко
//                       снижает потребление.
//
// freeCoolingMode (только для chiller):
//   'none'  — только мех. охлаждение
//   'dry'   — dry cooler, T_ref = T_db (drybulb)
//   'wet'   — cooling tower, T_ref = T_wb (wetbulb, считается из T+RH)
//
// chwsTemp — Chilled Water Supply temperature (°C). Типично:
//   7  — стандартный комфорт (HVAC)
//   12 — тех. охлаждение (расширенный диапазон)
//   18–22 — High-Temperature Cooling в ЦОД (ASHRAE TC 9.9 W3/W4)
//
// freeCoolingApproach — ΔT между T_ref и chwsTemp для 100% фрикулинга (°C).
//   T_ref ≤ chwsTemp − approach → 100% FC.
//   T_ref ≥ chwsTemp            → 0%   FC.
//   Между                        → линейная интерполяция (partial FC).
//   Типично 5°C для dry cooler, 3°C для cooling tower.
//
// freeCoolingAuxKw — мощность вспомогательного оборудования при FC
//   (насос вторичного контура + вентиляторы dry cooler / насос градирни).
//   Указывается как % от ratedCapKw. Типично 3–7%.
//
// dxPumpedThresholdDb — порог T_amb_db (°C), ниже которого DX-pumped-FC
//   переходит в режим pumped refrigerant. Обычно T_indoor_supply − 5°C
//   (для ЦОД supply=18°C → порог 13°C).
//
// dxPumpedAuxPctOfRated — мощность насоса хладагента в % от ratedCapKw
//   при работе DX-pumped-FC (типично 2–4%).
//
// partLoadCurve: 'iplv' — линейная T-correction COP; 'fixed' — без неё.
export const DEFAULT_CHILLER = {
  systemType: 'chiller',
  ratedCapKw: 0,
  ratedCOP: 3.5,
  capCorrPctPerC: -1.5,
  ambientRated: 35,
  partLoadCurve: 'iplv',
  // v0.59.987: фрикулинг
  freeCoolingMode: 'none',
  chwsTemp: 12,
  freeCoolingApproach: 5,
  freeCoolingAuxPctOfRated: 5,
  // v0.59.987: DX-pumped-FC
  dxPumpedThresholdDb: 13,
  dxPumpedAuxPctOfRated: 3,
};

// Wetbulb (Stull 2011) — упрощённая формула, погрешность ±1°C при RH 5–99%.
// T в °C, RH в %, возвращает T_wb в °C.
function wetBulbStull(T, RH) {
  if (!Number.isFinite(T) || !Number.isFinite(RH)) return null;
  const Tw = T * Math.atan(0.151977 * Math.sqrt(RH + 8.313659))
    + Math.atan(T + RH) - Math.atan(RH - 1.676331)
    + 0.00391838 * Math.pow(RH, 1.5) * Math.atan(0.023101 * RH) - 4.686035;
  return Tw;
}

// Описание всех доступных столбцов. Plugin-style — модуль может пополнять
// COLUMNS своими metric-определениями. Tooltip = label + расширенное описание.
export const COLUMNS = [
  { id: 'tBin',     label: 'Ambient T [°C]',       tip: 'Бин температуры окружающего воздуха (drybulb), целое число °C. Записи группируются по floor(T).', default: true,  fmt: v => v.tBin },
  { id: 'hours',    label: 'Annual hours [h]',     tip: 'Часов в году в данном бине T. Σ по всем бинам = 8766 (365.25 × 24). Масштабируется к 1 году исходя из объёма выборки.', default: true,  fmt: v => v.hours.toFixed(0) },
  { id: 'days',     label: 'Annual days [d]',      tip: 'Дней в году = hours / 24.', default: true,  fmt: v => v.days.toFixed(2) },
  { id: 'pct',      label: '% of year',            tip: '% года = hours / 8766 × 100. Плотность распределения T.', default: false, fmt: v => v.pct.toFixed(2) },
  { id: 'rhAvg',    label: 'Avg RH [%]',           tip: 'Средняя относительная влажность в данном бине T. Используется для оценки T_wb для wet free-cooling.', default: true,  fmt: v => v.rhAvg != null ? v.rhAvg.toFixed(0) : '' },
  { id: 'rhMin',    label: 'Min RH [%]',           tip: 'Минимальная RH в бине.', default: false, fmt: v => v.rhMin != null ? v.rhMin.toFixed(0) : '' },
  { id: 'rhMax',    label: 'Max RH [%]',           tip: 'Максимальная RH в бине.', default: false, fmt: v => v.rhMax != null ? v.rhMax.toFixed(0) : '' },
  { id: 'twbAvg',   label: 'Avg T_wb [°C]',        tip: 'Средний wet-bulb (Stull 2011) на основе T и RH. Используется как T_ref для wet free-cooling (cooling tower).', default: false, fmt: v => v.twbAvg != null ? v.twbAvg.toFixed(1) : '' },
  { id: 'windAvg',  label: 'Avg wind [m/s]',       tip: 'Средняя скорость ветра. Косвенно влияет на эффективность air-cooled конденсаторов.', default: false, fmt: v => v.windAvg != null ? v.windAvg.toFixed(1) : '' },
  { id: 'cumPct',   label: 'Cumulative %',         tip: 'Кумулятивный % года (от низких T к высоким). Помогает оценить «сколько времени T ≤ X».', default: false, fmt: v => v.cumPct.toFixed(1) },
  // ─── Chiller / DX columns (видимы только если задана chillerSpec)
  { id: 'capacity', label: 'Capacity [kW]',        tip: 'Холодопроизводительность при данной T_amb. Capacity(T) = ratedCap × (1 + capCorr × (T − T_rated)). Снижается при росте T_amb (компрессор хуже работает на жаре).', default: false, chiller: true, fmt: v => v.capacity != null ? v.capacity.toFixed(1) : '' },
  { id: 'copMech',  label: 'COP_mech',             tip: 'COP механического охлаждения (компрессор) при T_amb. COP(T) = ratedCOP × (1 + 0.02 × (T_rated − T)) clamp [0.6×; 1.8×]. Растёт с понижением T_amb.', default: false, chiller: true, fmt: v => v.copMech != null ? v.copMech.toFixed(2) : '' },
  { id: 'fcFraction', label: 'FC %',               tip: 'Доля фрикулинга в данном бине. 100% — компрессор полностью отключён, охлаждение через FC-теплообменник + аукс. насосы. 0% — только мех. охл. Между — partial FC (mixed mode).', default: false, chiller: true, fmt: v => v.fcFraction != null ? (v.fcFraction * 100).toFixed(0) : '' },
  { id: 'cop',      label: 'COP_eff',              tip: 'Эффективный COP с учётом фрикулинга = capacity / (P_compressor + P_aux). При 100% FC может достигать 15–30 (только насосы).', default: false, chiller: true, fmt: v => v.cop != null ? v.cop.toFixed(2) : '' },
  { id: 'power',    label: 'Total Power [kW]',     tip: 'Суммарная электрическая мощность системы при данной T_amb: P = (1 − fcFrac) × P_mech + P_aux. P_mech = capacity / COP_mech, P_aux = freeCoolingAuxKw.', default: false, chiller: true, fmt: v => v.power != null ? v.power.toFixed(2) : '' },
  { id: 'energy',   label: 'Annual energy [kWh]',  tip: 'Годовая энергия в бине = total Power × hours. Σ по всем бинам = годовое потребление системы.', default: false, chiller: true, fmt: v => v.energy != null ? v.energy.toFixed(0) : '' },
];

// v0.59.987: расчёт capacity / COP_mech / FC% / COP_eff / Power / Energy
// для одного бина T_amb с учётом фрикулинга и DX-pumped-FC.
//
// === Алгоритм ===
//
// 1. capacity(T_amb) — холодопроизводительность с T-correction:
//    capacity = ratedCap × (1 + capCorrPctPerC/100 × (T_amb − T_rated))
//    (типично снижается ~1.5%/°C при росте T_amb выше rated 35°C)
//
// 2. COP_mech(T_amb) — COP компрессорного охлаждения:
//    'iplv':  COP = ratedCOP × (1 + 0.02 × (T_rated − T_amb))
//             clamp [0.6×ratedCOP, 1.8×ratedCOP]
//             — линейная Carnot-подобная корреляция (низкая T_cond → ↑COP)
//    'fixed': COP = ratedCOP   (без T-correction, грубая оценка)
//
// 3. FC fraction (0..1):
//    a) systemType='chiller' с freeCoolingMode='dry':
//       T_ref = T_amb_db. Threshold full-FC = chwsTemp − approach.
//       Threshold no-FC   = chwsTemp.
//       T_ref ≤ thr_full        → fc = 1.0
//       T_ref ≥ thr_no          → fc = 0.0
//       между                    → linear interpolation (partial FC)
//    b) systemType='chiller' с freeCoolingMode='wet':
//       Аналогично, но T_ref = T_wb (вычисляется из avgRH в бине через
//       Stull 2011). Wet FC обычно даёт +5–10°C запаса по сравнению
//       с dry — градирня охлаждает до T_wb а не T_db.
//    c) systemType='dx-pumped-fc':
//       Если T_amb_db ≤ dxPumpedThresholdDb → fc = 1.0
//       Иначе                                → fc = 0.0
//       (бинарный режим — насос либо включён, либо нет; нет partial)
//    d) Все остальные (chiller mode='none', dx-air): fc = 0
//
// 4. Power components:
//    P_mech = (1 − fc) × capacity / COP_mech    (компрессор, кВт)
//    P_aux  = aux_pct × ratedCap / 100          (насосы/вентиляторы FC)
//             только если fc > 0; иначе 0
//    P_total = P_mech + P_aux
//
// 5. COP_eff = capacity / P_total
//    energy = P_total × hours_in_bin
//
// === Why this model ===
// Соответствует ASHRAE 90.1 IPLV bin-method с economizer modifier,
// упрощённой до 1 кривой COP (Carnot-stylized) + threshold-based FC.
// Не учитывает part-load на самой нагрузке (предполагается, что
// чиллер всегда работает на rated capacity).
function applyChillerCalc(row, spec) {
  if (!spec || !Number.isFinite(Number(spec.ratedCapKw)) || Number(spec.ratedCapKw) <= 0) return row;
  const T = row.tBin;
  const ratedCap = Number(spec.ratedCapKw) || 0;
  const tRated = Number(spec.ambientRated) || 35;
  const dT = T - tRated;
  const capCorr = (Number(spec.capCorrPctPerC) || 0) / 100;
  const capacity = Math.max(0, ratedCap * (1 + capCorr * dT));
  const ratedCOP = Number(spec.ratedCOP) || 3.5;

  // COP_mech (компрессор)
  let copMech;
  if (spec.partLoadCurve === 'fixed') {
    copMech = ratedCOP;
  } else {
    const copFactor = 1 + 0.02 * (-dT);
    copMech = ratedCOP * Math.max(0.6, Math.min(1.8, copFactor));
  }

  // === Free-cooling fraction ===
  const sysType = spec.systemType || 'chiller';
  const fcMode = spec.freeCoolingMode || 'none';
  let fcFraction = 0;
  let auxKw = 0;

  if (sysType === 'chiller' && fcMode !== 'none') {
    const chws = Number(spec.chwsTemp) || 12;
    const approach = Number(spec.freeCoolingApproach) || 5;
    // T_ref зависит от режима
    let tRef = T;
    if (fcMode === 'wet' && Number.isFinite(row.twbAvg)) tRef = row.twbAvg;
    const thrFull = chws - approach;
    const thrNo   = chws;
    if (tRef <= thrFull)      fcFraction = 1.0;
    else if (tRef >= thrNo)   fcFraction = 0.0;
    else                      fcFraction = (thrNo - tRef) / (thrNo - thrFull);
    if (fcFraction > 0) {
      auxKw = ratedCap * (Number(spec.freeCoolingAuxPctOfRated) || 5) / 100;
    }
  } else if (sysType === 'dx-pumped-fc') {
    const thr = Number(spec.dxPumpedThresholdDb) ?? 13;
    fcFraction = (T <= thr) ? 1.0 : 0.0;
    if (fcFraction > 0) {
      auxKw = ratedCap * (Number(spec.dxPumpedAuxPctOfRated) || 3) / 100;
    }
  }
  // 'dx-air' и 'chiller' без FC — fcFraction остаётся 0

  // === Power ===
  const pMech = capacity > 0 && copMech > 0 ? (1 - fcFraction) * capacity / copMech : 0;
  const pTotal = pMech + auxKw;
  const cop = pTotal > 0 ? capacity / pTotal : 0;
  const energy = pTotal * row.hours;

  return {
    ...row,
    capacity, copMech, fcFraction,
    cop, power: pTotal, energy,
  };
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
      acc = { tBin, count: 0, rhSum: 0, rhN: 0, rhMin: Infinity, rhMax: -Infinity, windSum: 0, windN: 0, twbSum: 0, twbN: 0 };
      map.set(tBin, acc);
    }
    acc.count++;
    const RH = Number(h.RH);
    if (Number.isFinite(RH)) {
      acc.rhSum += RH; acc.rhN++;
      if (RH < acc.rhMin) acc.rhMin = RH;
      if (RH > acc.rhMax) acc.rhMax = RH;
      // v0.59.987: T_wb для wet free-cooling
      const tw = wetBulbStull(T, RH);
      if (Number.isFinite(tw)) { acc.twbSum += tw; acc.twbN++; }
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
      twbAvg: acc.twbN > 0 ? acc.twbSum / acc.twbN : null,
      windAvg: acc.windN > 0 ? acc.windSum / acc.windN : null,
    };
    return chillerSpec ? applyChillerCalc(row, chillerSpec) : row;
  });
}

// Render-функция: возвращает HTML таблицы с активными столбцами.
// Tooltip на каждом th = расширенное описание столбца (см. COLUMNS[i].tip).
export function renderAnnualTable(rows, activeCols) {
  const cols = COLUMNS.filter(c => activeCols.includes(c.id));
  if (!rows.length) return '<div class="muted">Нет данных.</div>';
  let totalHours = 0, totalDays = 0, totalEnergy = 0, totalFcHours = 0;
  for (const r of rows) {
    totalHours += r.hours;
    totalDays += r.days;
    if (Number.isFinite(r.energy)) totalEnergy += r.energy;
    if (Number.isFinite(r.fcFraction)) totalFcHours += r.fcFraction * r.hours;
  }
  const fcAvgPct = totalHours > 0 ? (totalFcHours / totalHours * 100) : null;
  return `<table class="mt-annual-table">
    <thead><tr>${cols.map(c => `<th class="${c.id === 'tBin' ? '' : 'num'}" title="${escAttr(c.tip || c.label)}">${escHtml(c.label)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr>${cols.map(c => `<td class="${c.id === 'tBin' ? '' : 'num'}">${escHtml(c.fmt(r))}</td>`).join('')}</tr>`).join('')}</tbody>
    <tfoot><tr>${cols.map(c => {
      if (c.id === 'tBin')      return `<td title="Сумма по всем бинам"><b>Σ</b></td>`;
      if (c.id === 'hours')     return `<td class="num" title="Сумма часов в году по всем бинам ≈ 8766"><b>${totalHours.toFixed(0)}</b></td>`;
      if (c.id === 'days')      return `<td class="num" title="Сумма дней в году ≈ 365.25"><b>${totalDays.toFixed(1)}</b></td>`;
      if (c.id === 'pct')       return `<td class="num"><b>100.00</b></td>`;
      if (c.id === 'fcFraction')return `<td class="num" title="Средневзвешенная по часам доля фрикулинга в году"><b>${fcAvgPct != null ? fcAvgPct.toFixed(0) : ''}</b></td>`;
      if (c.id === 'energy')    return `<td class="num" title="Годовое суммарное эл. потребление чиллера/DX"><b>${totalEnergy.toFixed(0)}</b></td>`;
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

// HTML столбец-пикера. Tooltip = описание из COLUMNS[i].tip.
export function renderColumnPicker(activeCols, onChange, hasChillerSpec = false) {
  const wrap = document.createElement('div');
  wrap.className = 'mt-col-picker';
  wrap.innerHTML = COLUMNS.map(c => {
    const disabled = c.id === 'tBin' || (c.chiller && !hasChillerSpec);
    const note = c.chiller && !hasChillerSpec ? ' <span class="muted">(задайте Chiller/DX spec)</span>' : '';
    return `<label class="mt-col-picker-row" title="${escAttr(c.tip || c.label)}">
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

// v0.59.987: chiller/DX-spec form (inline, прямо над таблицей).
// Все поля имеют title-tooltip с описанием параметра, формулы и типичных
// значений. Структура секций:
//  1) Основные: тип системы, rated cap / COP / ambient.
//  2) Capacity/COP correction (T_amb dependence).
//  3) Free-cooling (только если systemType='chiller'): mode, chws, approach, aux.
//  4) DX-pumped FC (только если systemType='dx-pumped-fc'): threshold, aux.
export function renderChillerSpecForm(spec, onChange, onClear) {
  const s = { ...DEFAULT_CHILLER, ...(spec || {}) };
  const wrap = document.createElement('div');
  wrap.className = 'mt-chiller-form';
  const sysType = s.systemType || 'chiller';
  const fcVisible = (sysType === 'chiller');
  const dxFcVisible = (sysType === 'dx-pumped-fc');
  wrap.innerHTML = `
    <h4 title="Спецификация чиллера или DX-системы для расчёта Capacity / COP / Power / Energy по бинам ambient T. Поддерживает фрикулинг (chiller dry/wet) и pumped refrigerant economizer (DX-FC).">❄ Chiller / DX spec — расчёт годовой энергии</h4>

    <div class="mt-chiller-section">
      <div class="mt-chiller-section-title">1️⃣ Тип системы и базовые параметры</div>
      <div class="mt-chiller-grid">
        <label title="Тип охлаждающей системы. Определяет применимость фрикулинга:
• chiller — чиллер с водяным контуром CHW. Поддерживает dry/wet free-cooling.
• dx-air — DX (direct expansion) воздушного охлаждения, RTU/сплит. Без FC.
• dx-pumped-fc — DX с насосом хладагента (Liebert/Vertiv pumped refrigerant economizer).">
          Тип системы:
          <select data-cf="systemType">
            <option value="chiller"${sysType === 'chiller' ? ' selected' : ''}>Чиллер (CHW)</option>
            <option value="dx-air"${sysType === 'dx-air' ? ' selected' : ''}>DX air-cooled (RTU/сплит)</option>
            <option value="dx-pumped-fc"${sysType === 'dx-pumped-fc' ? ' selected' : ''}>DX с pumped refrigerant FC</option>
          </select>
        </label>
        <label title="Rated cooling capacity (Q_rated), кВт. Холодопроизводительность при ratedAmbient. Бэйз для T-correction.">
          Rated capacity, кВт:<input type="number" step="1" min="0" data-cf="ratedCapKw" value="${s.ratedCapKw}">
        </label>
        <label title="Rated COP (Coefficient of Performance) = Q_cool / P_elec при ratedAmbient. Типично:
• Чиллер scroll: 3.0–3.5
• Чиллер screw: 3.5–5.0
• Чиллер centrifugal: 5.0–7.0
• DX (RTU): 2.8–3.5
• DX (split inverter): 3.5–4.5">
          Rated COP:<input type="number" step="0.1" min="1" max="10" data-cf="ratedCOP" value="${s.ratedCOP}">
        </label>
        <label title="Rated ambient temperature (T_rated), °C — условия по которым задан rated. Стандартно ASHRAE = 35°C для air-cooled.">
          Rated ambient T, °C:<input type="number" step="1" data-cf="ambientRated" value="${s.ambientRated}">
        </label>
      </div>
    </div>

    <div class="mt-chiller-section">
      <div class="mt-chiller-section-title">2️⃣ Capacity & COP correction по T_amb</div>
      <div class="mt-chiller-grid">
        <label title="Capacity correction (%/°C). Холодопроизводительность снижается с ростом T_amb (горячий конденсатор → хуже теплоотдача). Типично:
• Air-cooled: −1.5%/°C
• Water-cooled: −0.5%/°C
Формула: Capacity(T) = ratedCap × (1 + corr × (T − T_rated)).">
          Capacity correction, %/°C:<input type="number" step="0.1" data-cf="capCorrPctPerC" value="${s.capCorrPctPerC}">
        </label>
        <label title="Part-load COP curve:
• IPLV — линейная Carnot-подобная коррекция COP по T_amb (COP растёт при понижении T_amb, clamp [0.6×; 1.8×]).
• Fixed — COP постоянный, не зависит от T_amb (упрощённая оценка).">
          COP curve:
          <select data-cf="partLoadCurve">
            <option value="iplv"${s.partLoadCurve === 'iplv' ? ' selected' : ''}>IPLV (T-corrected)</option>
            <option value="fixed"${s.partLoadCurve === 'fixed' ? ' selected' : ''}>Fixed (без T-correction)</option>
          </select>
        </label>
      </div>
    </div>

    <div class="mt-chiller-section" ${fcVisible ? '' : 'style="display:none"'} data-fc-section>
      <div class="mt-chiller-section-title">3️⃣ Free-cooling (только для чиллеров)</div>
      <div class="mt-chiller-grid">
        <label title="Режим фрикулинга:
• none — только мех. охлаждение (компрессор всегда работает).
• dry — dry cooler / drycooler (T_ref = T_amb_db). Простой, без водопотребления, но меньше часов FC.
• wet — cooling tower / градирня (T_ref = T_wb). Эффективнее (на 5–10°C запас по сравнению с dry), но требует подпитки и обслуживания.">
          Free-cooling mode:
          <select data-cf="freeCoolingMode">
            <option value="none"${s.freeCoolingMode === 'none' ? ' selected' : ''}>None (только компрессор)</option>
            <option value="dry"${s.freeCoolingMode === 'dry' ? ' selected' : ''}>Dry (drycooler, T_db)</option>
            <option value="wet"${s.freeCoolingMode === 'wet' ? ' selected' : ''}>Wet (градирня, T_wb)</option>
          </select>
        </label>
        <label title="CHWS — Chilled Water Supply temperature, °C. Температура подачи холодной воды от чиллера. Чем выше — тем больше часов FC. Типично:
• 7°C — стандартный комфорт
• 12°C — тех. охлаждение
• 18–22°C — High-Temp Cooling в ЦОД (ASHRAE TC 9.9 W3/W4)">
          CHWS T, °C:<input type="number" step="0.5" min="2" max="30" data-cf="chwsTemp" value="${s.chwsTemp}">
        </label>
        <label title="Approach (ΔT, °C) — разница между T_ref и CHWS для 100% фрикулинга. T_ref ≤ chws−approach → 100% FC. T_ref ≥ chws → 0% FC. Между — partial FC (линейно). Типично:
• Dry cooler: 5°C
• Cooling tower: 3°C">
          Approach ΔT, °C:<input type="number" step="0.5" min="1" max="15" data-cf="freeCoolingApproach" value="${s.freeCoolingApproach}">
        </label>
        <label title="Aux power во время FC, % от ratedCap. Мощность вспомогательного оборудования (насос вторичного контура + вентиляторы dry cooler / насос градирни). Активна только когда fcFraction > 0. Типично:
• Dry cooler: 5–7%
• Cooling tower: 3–5%">
          Aux power FC, %:<input type="number" step="0.5" min="0" max="20" data-cf="freeCoolingAuxPctOfRated" value="${s.freeCoolingAuxPctOfRated}">
        </label>
      </div>
    </div>

    <div class="mt-chiller-section" ${dxFcVisible ? '' : 'style="display:none"'} data-dxfc-section>
      <div class="mt-chiller-section-title">4️⃣ DX pumped refrigerant FC (только для DX-pumped-FC)</div>
      <div class="mt-chiller-grid">
        <label title="Threshold T_amb_db (°C) — температура наружного воздуха, ниже которой DX-pumped-FC переходит в режим pumped refrigerant. Компрессор отключён, насос гонит хладагент через outdoor coil → indoor coil напрямую. Обычно T_indoor_supply − 5°C. Для ЦОД (T_supply≈18°C) → 13°C.">
          Threshold T_db, °C:<input type="number" step="0.5" data-cf="dxPumpedThresholdDb" value="${s.dxPumpedThresholdDb}">
        </label>
        <label title="Aux power DX-pumped (% от ratedCap). Мощность насоса хладагента во время FC. Типично 2–4% — на порядок меньше компрессорной.">
          Aux power pump, %:<input type="number" step="0.5" min="0" max="10" data-cf="dxPumpedAuxPctOfRated" value="${s.dxPumpedAuxPctOfRated}">
        </label>
      </div>
    </div>

    <div class="mt-chiller-actions">
      <button type="button" class="mt-btn-ghost" data-clear-chiller title="Сбросить spec и удалить chiller-колонки из таблицы.">🗑 Сбросить</button>
    </div>

    <details class="mt-chiller-formula" style="margin-top:8px">
      <summary style="cursor:pointer;font-weight:600;color:#475569" title="Раскрыть полное описание методики расчёта">📐 Методика расчёта (формулы)</summary>
      <div style="font-size:11.5px;color:#475569;padding:8px 12px;background:#f8fafc;border-radius:4px;margin-top:6px">
        <p><b>Capacity(T):</b> Capacity = ratedCap × (1 + capCorr × (T − T_rated)). При росте T_amb выше rated теплоотдача конденсатора падает → capacity снижается.</p>
        <p><b>COP_mech(T):</b>
          <br>• IPLV: COP = ratedCOP × (1 + 0.02 × (T_rated − T)) clamp [0.6×; 1.8×]. Carnot-подобная: чем холоднее наружный воздух, тем эффективнее.
          <br>• Fixed: COP = ratedCOP (без зависимости).</p>
        <p><b>Free-cooling fraction (chiller):</b>
          <br>T_ref = T_db (dry) или T_wb (wet, формула Stull 2011 из RH).
          <br>fc = clamp((CHWS − T_ref) / approach, 0, 1).
          <br>100% когда T_ref ≤ CHWS−approach; 0% когда T_ref ≥ CHWS.</p>
        <p><b>DX-pumped FC:</b> бинарный — fc = 1 если T_db ≤ threshold, иначе 0.</p>
        <p><b>Power:</b>
          <br>P_mech = (1 − fc) × Capacity / COP_mech (компрессор)
          <br>P_aux = aux% × ratedCap / 100 (если fc > 0; насосы/вентиляторы FC)
          <br>P_total = P_mech + P_aux
          <br>COP_eff = Capacity / P_total (может достигать 15–30 при 100% FC)</p>
        <p><b>Energy:</b> Σ (P_total × hours) по всем бинам = годовое потребление, кВт·ч/год.</p>
        <p style="color:#94a3b8;font-style:italic">Источники: ASHRAE Handbook Fundamentals (2021) гл. 18 (Refrigeration), ASHRAE 90.1 IPLV bin-method, Vertiv/Liebert Pumped Refrigerant Economizer whitepapers, Stull (2011) "Wet-Bulb Temperature from Relative Humidity and Air Temperature".</p>
      </div>
    </details>
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
