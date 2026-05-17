/* =========================================================================
   gas-methods/index.js — реестр газовых методик (calc-lib).
   Контракт идентичен suppression-/hydraulic-/hvac-methods: каждый
   метод-модуль экспортирует { META, compute(input) }; здесь —
   METHODS / METHOD_LIST / run(). Дисциплина: gas (47.4.1). Без UI/DOM.
   Потребитель (будущий): UI-модуль газоснабжения / cross-discipline.
   ========================================================================= */

import * as PD from './pressure-drop.js';
import * as TP from './throughput.js';

export * as formulas from './formulas.js';

export const METHODS = {
  [PD.META.id]: PD,
  [TP.META.id]: TP,
};

export const METHOD_LIST = [PD.META, TP.META];

/** Запустить методику по id: run('gas-pressure-drop', input) → result. */
export function run(methodId, input) {
  const m = METHODS[methodId];
  if (!m) throw new Error('Unknown gas method: ' + methodId);
  return m.compute(input);
}

export const DISCIPLINE = 'gas';
