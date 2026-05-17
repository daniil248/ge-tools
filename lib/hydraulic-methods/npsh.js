/* =========================================================================
   hydraulic-methods/npsh.js — запас по кавитации насоса (NPSH available).
   Контракт calc-lib: { META, compute(input) }.
     NPSHa = (P0 − Pv)/(ρ·g) + Hs − Hf_вс
   где P0 — давление на свободной поверхности (Па), Pv — давление паров,
   Hs — геод. высота уровня жидкости относительно оси насоса (м; + если
   уровень ВЫШЕ насоса = подпор, − если насос выше = всасывание),
   Hf_вс — потери во всасывающей линии (м).
   Кавитация исключена при NPSHa ≥ NPSHr + запас (обычно ≥ 0.5 м).
   ========================================================================= */

import { waterDensity, waterVaporPressure, headToPressure, G, P_ATM } from './formulas.js';

export const META = {
  id: 'npsh',
  label: 'NPSH (запас по кавитации)',
  discipline: 'hydraulic',
  refs: ['ISO 17769', 'ГОСТ 6134', 'NPSHa = (P0−Pv)/ρg + Hs − Hf'],
};

/**
 * @param {object} input
 *   P0_kPa   — абс. давление над жидкостью, кПа (опц., атм. 101.325)
 *   tC       — температура жидкости, °C (опц., 20)
 *   Hs       — высота уровня отн. оси насоса, м (+ подпор / − всасывание)
 *   Hf_suct  — потери во всасывающей линии, м (опц., 0)
 *   NPSHr    — требуемый NPSH насоса (паспорт), м (опц.)
 *   margin   — нормируемый запас, м (опц., 0.5)
 * @returns {object} { NPSHa, ok, deficit, ... }
 */
export function compute(input = {}) {
  const tC      = Number.isFinite(+input.tC) ? +input.tC : 20;
  const P0      = Number.isFinite(+input.P0_kPa) ? (+input.P0_kPa) * 1000 : P_ATM;
  const Hs      = Number(input.Hs) || 0;
  const HfSuct  = Number(input.Hf_suct) || 0;
  const NPSHr   = Number.isFinite(+input.NPSHr) ? +input.NPSHr : null;
  const margin  = Number.isFinite(+input.margin) ? +input.margin : 0.5;

  const rho = waterDensity(tC);
  const Pv  = waterVaporPressure(tC);
  const pressureHead = (P0 - Pv) / (rho * G);    // м
  const NPSHa = pressureHead + Hs - HfSuct;

  let ok = null, deficit = null;
  if (NPSHr != null) {
    deficit = (NPSHr + margin) - NPSHa;          // >0 → не хватает
    ok = deficit <= 0;
  }

  return {
    method: META.id,
    inputs: { P0_kPa: P0 / 1000, tC, Hs, Hf_suct: HfSuct, NPSHr, margin },
    rho, Pv_kPa: Pv / 1000,
    pressureHead, NPSHa,
    NPSHr, requiredWithMargin: NPSHr != null ? NPSHr + margin : null,
    ok, deficit,
    steps: [
      `Pv(${tC}°C) = ${(Pv / 1000).toFixed(3)} кПа; ρ = ${rho.toFixed(1)} кг/м³`,
      `(P0−Pv)/ρg = (${(P0 / 1000).toFixed(2)}−${(Pv / 1000).toFixed(3)})·1000/${(rho * G).toFixed(1)} = ${pressureHead.toFixed(3)} м`,
      `NPSHa = ${pressureHead.toFixed(3)} + Hs(${Hs}) − Hf(${HfSuct}) = ${NPSHa.toFixed(3)} м`,
      NPSHr != null
        ? `Проверка: NPSHa ${ok ? '≥' : '<'} NPSHr+запас (${NPSHr}+${margin}=${(NPSHr + margin).toFixed(2)} м) → ${ok ? 'кавитации нет' : 'РИСК КАВИТАЦИИ, дефицит ' + deficit.toFixed(2) + ' м'}`
        : 'NPSHr не задан — проверка пропущена',
    ],
  };
}
