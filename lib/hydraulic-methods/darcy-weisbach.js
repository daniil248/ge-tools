/* =========================================================================
   hydraulic-methods/darcy-weisbach.js — расчёт потерь напора/давления
   в напорном трубопроводе (Дарси–Вейсбах + Colebrook–White).
   Контракт calc-lib: { META, compute(input) } (как suppression-methods).
   ========================================================================= */

import {
  waterDensity, waterKinematicViscosity, pipeArea, flowVelocity,
  reynolds, frictionFactor, headLossDarcy, headLossLocal,
  headToPressure, ROUGHNESS, G,
} from './formulas.js';

export const META = {
  id: 'darcy-weisbach',
  label: 'Дарси–Вейсбах (потери напора)',
  discipline: 'hydraulic',
  refs: ['Darcy–Weisbach', 'Colebrook–White / Swamee–Jain', 'СП 30.13330'],
};

/**
 * @param {object} input
 *   Q        — расход, м³/ч (вход в привычных единицах)
 *   D_mm     — внутренний диаметр, мм
 *   L        — длина участка, м
 *   material — ключ ROUGHNESS ('steel_new'…) | eps_mm абс. шероховатость, мм
 *   eps_mm   — переопределение шероховатости, мм (опц.)
 *   sumK     — сумма коэф. местных сопротивлений (опц., 0)
 *   tC       — температура воды, °C (опц., 20)
 *   dz       — геодезический перепад (выход−вход), м (опц., 0; + = подъём)
 * @returns {object} { v, Re, regime, f, hf_len, hf_local, hf_geo, hf_total,
 *                      dP_total, rho, nu, ... }
 */
export function compute(input = {}) {
  const Qh   = Number(input.Q) || 0;            // м³/ч
  const Q    = Qh / 3600;                        // м³/с
  const D    = (Number(input.D_mm) || 0) / 1000; // м
  const L    = Number(input.L) || 0;
  const tC   = Number.isFinite(+input.tC) ? +input.tC : 20;
  const sumK = Number(input.sumK) || 0;
  const dz   = Number(input.dz) || 0;
  const eps  = Number.isFinite(+input.eps_mm)
    ? (+input.eps_mm) / 1000
    : (ROUGHNESS[input.material] ?? ROUGHNESS.steel_new);

  const rho = waterDensity(tC);
  const nu  = waterKinematicViscosity(tC);
  const v   = flowVelocity(Q, D);
  const Re  = reynolds(v, D, nu);
  const f   = frictionFactor(Re, eps, D);

  const hf_len   = headLossDarcy(f, L, D, v);
  const hf_local = headLossLocal(sumK, v);
  const hf_geo   = dz;                            // подъём = доп. напор
  const hf_total = hf_len + hf_local + hf_geo;
  const dP_total = headToPressure(hf_total, rho);

  const regime = Re <= 0 ? '—' : (Re < 2300 ? 'ламинарный'
    : (Re < 4000 ? 'переходный' : 'турбулентный'));

  return {
    method: META.id,
    inputs: { Q_m3h: Qh, D_mm: input.D_mm, L, tC, sumK, dz, eps_mm: eps * 1000 },
    rho, nu, area_m2: pipeArea(D),
    v, Re, regime, f,
    hf_len, hf_local, hf_geo, hf_total,
    dP_total, dP_kPa: dP_total / 1000,
    // удельные потери на 100 м (для подбора диаметра)
    i_per_100m: D > 0 && L > 0 ? hf_len / L * 100 : 0,
    steps: [
      `v = Q/A = ${(Qh / 3600).toFixed(5)}/${pipeArea(D).toFixed(6)} = ${v.toFixed(3)} м/с`,
      `Re = v·D/ν = ${v.toFixed(3)}·${D.toFixed(4)}/${nu.toExponential(3)} = ${Re.toFixed(0)} (${regime})`,
      `f = ${f.toFixed(5)} (Swamee–Jain, ε=${(eps * 1000).toFixed(4)} мм)`,
      `hf = f·(L/D)·v²/2g = ${hf_len.toFixed(3)} м; местн. ${hf_local.toFixed(3)} м; геод. ${hf_geo.toFixed(3)} м`,
      `ΔP = ρ·g·Σh = ${rho.toFixed(1)}·${G}·${hf_total.toFixed(3)} = ${(dP_total / 1000).toFixed(2)} кПа`,
    ],
  };
}
