// =============================================================================
// cooling/calc/topology.js — топология холодоснабжения (chillers ↔ CRACs)
// =============================================================================
// Pure-функции расчёта системы из нескольких чиллеров и нескольких CRAC,
// связанных через общий контур (common-loop) или точка-точка (p2p).
//
// По требованию Пользователя 2026-05-02:
//   • Несколько водяных CRAC могут подключаться к общему чиллеру.
//   • Чиллеры включаются с резервированием (N+1, 2N) — общий трубопровод
//     или точка-точка (один чиллер — один CRAC).
//   • Водяные CRAC могут быть с компрессором на борту (DX-glycol гибрид)
//     или с отдельным контуром фрикулинга (Stulz CyberHandler dual-circuit).
//
// Модель данных:
//   topology = {
//     chillers: [chillerSpec, ...]      — массив чиллеров (могут быть одинаковые)
//     cracs:    [cracSpec, ...]          — массив CRAC (любые типы кондиционеров)
//     loopMode: 'common-loop' | 'p2p',
//     redundancyN: 2,    // штатно работающих чиллеров
//     redundancyM: 1,    // в горячем резерве (для расчёта при отказе)
//   }
//
// Симуляция (метод интервалов, аналогично chiller-bin-calc):
//   Для каждого T_amb:
//     1. Каждый CRAC даёт capacity (corrected) и cracCoolingLoadKw на чиллер.
//     2. Σ cracCoolingLoadKw = total chiller load.
//     3. Распределяем нагрузку между chillers[] (равномерно по N штатным).
//     4. Каждый чиллер — applyChillerCalc(load, его spec) → power.
//     5. Σ power_chillers + Σ power_cracs = total power per bin.
//     6. energy_bin = power × hours_in_bin.
//
// NO DOM. Pure JS.

import { applyChillerCalc, buildBinData } from './chiller-bin-calc.js';
import { isCracType } from './chiller-defaults.js';

/**
 * @typedef {object} TopologyDef
 * @property {Array<object>} chillers    — chillerSpec[] (типов chiller / dx-air / dx-pumped-fc)
 * @property {Array<object>} cracs       — cracSpec[] (типов crac-* или dx-air для standalone)
 * @property {'common-loop'|'p2p'} loopMode
 * @property {number} redundancyN        — штатно работающих чиллеров
 * @property {number} redundancyM        — в резерве
 *
 * @typedef {object} TopologyMetrics
 * @property {number} totalEnergyKwh     — годовое суммарное потребление, кВт·ч
 * @property {number} totalCoolingKw     — суммарная capacity всех CRAC, кВт
 * @property {Array<object>} perEquipment — массив { kind, name, energyKwh, peakKw }
 * @property {Array<object>} bins         — массив интервалов температуры с распределением load
 */

export const DEFAULT_TOPOLOGY = {
  chillers: [],
  cracs: [],
  loopMode: 'common-loop',
  redundancyN: 1,
  redundancyM: 0,
};

/**
 * Построить топологию из массива опций подбора. Опции с системами kind='plant'
 * (chiller/dx-air/dx-pumped-fc) → chillers. Опции с kind='crac' → cracs.
 * Используется для лёгкой интеграции с существующей моделью selections.
 */
export function buildTopologyFromOptions(options, loopMode = 'common-loop', redundancyN = 1, redundancyM = 0) {
  const chillers = [];
  const cracs = [];
  for (const opt of options || []) {
    const sysType = opt.spec?.systemType || 'chiller';
    if (isCracType(sysType)) cracs.push(opt);
    else chillers.push(opt);
  }
  return { chillers, cracs, loopMode, redundancyN: Math.max(1, redundancyN), redundancyM };
}

/**
 * Симуляция топологии по часовому ряду meteo.
 *
 * @param {TopologyDef} topo
 * @param {Array<object>} hourly       — фильтрованный hourly meteo
 * @returns {TopologyMetrics}
 */
export function simulateTopology(topo, hourly) {
  if (!topo || !hourly || !hourly.length) {
    return { totalEnergyKwh: 0, totalCoolingKw: 0, perEquipment: [], bins: [] };
  }
  const N = Math.max(1, topo.redundancyN || 1);

  // Сначала считаем bin-данные для CRAC (чтобы получить cracCoolingLoadKw на чиллер).
  const cracPerEquipment = (topo.cracs || []).map(crac => {
    const rows = buildBinData(hourly, crac.spec);
    let energyKwh = 0;
    let peakKw = 0;
    for (const r of rows) {
      energyKwh += r.energy || 0;
      if (r.power > peakKw) peakKw = r.power;
    }
    return { kind: 'crac', name: crac.name, ratedCapKw: crac.spec?.ratedCapKw || 0, energyKwh, peakKw, rows };
  });

  // Суммируем нагрузку CRAC на чиллер по интервалам (по T наружн.).
  // Map: tBin → Σ cracCoolingLoadKw
  const chillerLoadByBin = new Map();
  for (const ce of cracPerEquipment) {
    for (const r of ce.rows) {
      const cur = chillerLoadByBin.get(r.tBin) || { tBin: r.tBin, hours: r.hours, load: 0, twbAvg: r.twbAvg };
      cur.load += (r.cracCoolingLoadKw || 0);
      chillerLoadByBin.set(r.tBin, cur);
    }
  }
  const chillerBins = [...chillerLoadByBin.values()].sort((a, b) => a.tBin - b.tBin);

  // Теперь для каждого чиллера: распределяем нагрузку (equally между N штатных).
  // Важно: сохраняем оригинальную capacity-долю в каждом интервале через scaling.
  const chillersList = (topo.chillers || []);
  const activeChillers = chillersList.slice(0, N);   // первые N штатно работают
  const standbyChillers = chillersList.slice(N);     // остальные — резерв

  const chillerPerEquipment = activeChillers.map(ch => {
    let energyKwh = 0;
    let peakKw = 0;
    for (const bin of chillerBins) {
      // Доля этого чиллера = 1/N (равномерное распределение по active).
      const sharedLoad = bin.load / N;
      // Создаём виртуальный row с capacity = sharedLoad (вместо ratedCap).
      // Используем applyChillerCalc для интервального расчёта со спецификой именно этого чиллера.
      // Подменяем ratedCapKw временно на sharedLoad для корректного COP/power.
      const tempSpec = { ...ch.spec, ratedCapKw: ch.spec.ratedCapKw };  // оставляем оригинал
      const baseRow = { tBin: bin.tBin, hours: bin.hours, twbAvg: bin.twbAvg };
      const calc = applyChillerCalc(baseRow, tempSpec);
      // Скейлим power пропорционально нагрузке: power ≈ sharedLoad / COP_eff.
      // calc.cop посчитан для full ratedCap; для частичной нагрузки power
      // упрощённо ≈ sharedLoad / cop (предполагаем линейную зависимость).
      const power = calc.cop > 0 ? sharedLoad / calc.cop : 0;
      const energy = power * bin.hours;
      energyKwh += energy;
      if (power > peakKw) peakKw = power;
    }
    return { kind: 'chiller', name: ch.name, ratedCapKw: ch.spec?.ratedCapKw || 0, energyKwh, peakKw };
  });

  // Standby чиллеры — энергия = 0 (горячий резерв предполагает только idle losses,
  // которые в этом упрощённом расчёте не учитываются).
  for (const ch of standbyChillers) {
    chillerPerEquipment.push({ kind: 'chiller-standby', name: ch.name, ratedCapKw: ch.spec?.ratedCapKw || 0, energyKwh: 0, peakKw: 0 });
  }

  const perEquipment = [...chillerPerEquipment, ...cracPerEquipment.map(ce => ({ kind: ce.kind, name: ce.name, ratedCapKw: ce.ratedCapKw, energyKwh: ce.energyKwh, peakKw: ce.peakKw }))];
  const totalEnergyKwh = perEquipment.reduce((a, e) => a + e.energyKwh, 0);
  const totalCoolingKw = (topo.cracs || []).reduce((a, c) => a + (c.spec?.ratedCapKw || 0), 0);

  return { totalEnergyKwh, totalCoolingKw, perEquipment, bins: chillerBins };
}
