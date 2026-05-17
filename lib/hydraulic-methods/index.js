/* =========================================================================
   hydraulic-methods/index.js — реестр гидравлических методик (calc-lib).
   Контракт идентичен suppression-methods: каждый метод-модуль экспортирует
   { META, compute(input) }; здесь — METHODS / METHOD_LIST / run().
   Дисциплина: hydraulic (scheme.discipline, 47.4.1). Без UI/DOM.
   Потребитель (будущий): UI-модуль гидравлики / cross-discipline отчёт.
   ========================================================================= */

import * as DW   from './darcy-weisbach.js';
import * as NPSH from './npsh.js';

export * as formulas from './formulas.js';

export const METHODS = {
  [DW.META.id]:   DW,
  [NPSH.META.id]: NPSH,
};

export const METHOD_LIST = [DW.META, NPSH.META];

/** Запустить методику по id: run('darcy-weisbach', input) → result. */
export function run(methodId, input) {
  const m = METHODS[methodId];
  if (!m) throw new Error('Unknown hydraulic method: ' + methodId);
  return m.compute(input);
}

export const DISCIPLINE = 'hydraulic';
