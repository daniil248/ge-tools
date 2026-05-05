// =============================================================================
// shared/catalogs/engines/index.js — агрегатор каталога двигателей
// =============================================================================
// v0.60.336 (по запросу Пользователя 2026-05-06: «может двигатели вынесешь
// отдельно или это не целесообразно?»): engines library как single source of
// truth для derate profiles, SFC, emission tier и габаритов двигателя.
//
// Один и тот же двигатель используется множеством vendor'ов ДГУ
// (Perkins 1106A в AJ Power, FG Wilson; Volvo TAD732GE в AJ Power, etc.) —
// engine-data описана раз, ДГУ-каталог ссылается через engineRef.
//
// Структура engine-record:
//   {
//     id: 'perkins-1106a-70tag2',
//     manufacturer, series, model,
//     cylinders, displacement,
//     sfcLkWh, emissionTier, aspiration,
//     derateProfile: { altBaselineM, altPerHundredPct, tempBaselineC,
//                      tempPer5Pct, altShiftPerC },
//     source, note,
//   }
// =============================================================================

import { PERKINS_ENGINES }     from './perkins.js';
import { VOLVO_PENTA_ENGINES } from './volvo-penta.js';
import { CUMMINS_ENGINES }     from './cummins.js';
import { CATERPILLAR_ENGINES } from './caterpillar.js';
import { MTU_ENGINES }         from './mtu.js';

export const ENGINES = [
  ...PERKINS_ENGINES,
  ...VOLVO_PENTA_ENGINES,
  ...CUMMINS_ENGINES,
  ...CATERPILLAR_ENGINES,
  ...MTU_ENGINES,
];

const _byId = new Map(ENGINES.map(e => [e.id, e]));

/** Получить двигатель по id. Возвращает null если не найден. */
export function getEngine(id) {
  if (!id) return null;
  return _byId.get(id) || null;
}

/** Получить все двигатели. */
export function listEngines(filter) {
  if (!filter) return ENGINES.slice();
  let arr = ENGINES.slice();
  if (filter.manufacturer) arr = arr.filter(e => e.manufacturer === filter.manufacturer);
  if (filter.series) arr = arr.filter(e => e.series === filter.series);
  return arr;
}

/** Список уникальных производителей двигателей. */
export function listEngineManufacturers() {
  return [...new Set(ENGINES.map(e => e.manufacturer))];
}

/**
 * Получить derate profile двигателя. Возвращает { altBaselineM, altPerHundredPct,
 * tempBaselineC, tempPer5Pct, altShiftPerC, label, note, source } для использования
 * в calcClimateDerate.
 *
 * Если engine.derateProfile отсутствует — возвращает null (caller должен
 * использовать generic ISO 3046-1 fallback).
 */
export function getEngineDerateProfile(engineId) {
  const eng = getEngine(engineId);
  if (!eng || !eng.derateProfile) return null;
  return {
    ...eng.derateProfile,
    label: `${eng.manufacturer} ${eng.model}`,
    note: eng.note,
    source: eng.source,
  };
}

/**
 * Эвристика match'а engine из текстового поля engineModel в DGU datasheet.
 * Используется для legacy-DGU-записей которые не имеют engineRef. Возвращает
 * id двигателя в каталоге или null.
 */
export function detectEngineByModel(engineModelText) {
  if (!engineModelText) return null;
  const s = String(engineModelText).toLowerCase();
  for (const e of ENGINES) {
    const modelLow = e.model.toLowerCase();
    if (s.includes(modelLow.split(' ')[0])) return e.id;
  }
  // Серийные совпадения
  if (/1106a-70tag2|1106a-70/.test(s)) return 'perkins-1106a-70tag2';
  if (/1106a/.test(s)) return 'perkins-1106a-70tag3';
  if (/2206a-e13/.test(s)) return 'perkins-2206a-e13tag3';
  if (/2506a/.test(s)) return 'perkins-2506a-e15';
  if (/4006/.test(s)) return 'perkins-4006-23tag3a';
  if (/4008/.test(s)) return 'perkins-4008-30tag3';
  if (/4016/.test(s)) return 'perkins-4016-61trg3';
  if (/tad531/.test(s)) return 'volvo-tad531ge';
  if (/tad732/.test(s)) return 'volvo-tad732ge';
  if (/tad941/.test(s)) return 'volvo-tad941ge';
  if (/tad1342/.test(s)) return 'volvo-tad1342ge';
  if (/twd1683|tad1683/.test(s)) return 'volvo-twd1683ge';
  if (/qsl9/.test(s)) return 'cummins-qsl9-g7';
  if (/qsx15/.test(s)) return 'cummins-qsx15-g8';
  if (/qsk23/.test(s)) return 'cummins-qsk23-g3';
  if (/qsk60/.test(s)) return 'cummins-qsk60-g3';
  if (/qsk78/.test(s)) return 'cummins-qsk78-g16';
  if (/x2\.5/.test(s)) return 'cummins-x2.5-g3';
  if (/ntaa855/.test(s)) return 'cummins-ntaa855-g7a';
  if (/c9\.3/.test(s)) return 'cat-c9.3';
  if (/c18/.test(s)) return 'cat-c18';
  if (/c32/.test(s)) return 'cat-c32';
  if (/c175/.test(s)) return 'cat-c175-16';
  if (/3516/.test(s)) return 'cat-3516b';
  if (/3520/.test(s)) return 'cat-3520c';
  if (/12v2000/.test(s)) return 'mtu-12v2000g65';
  if (/16v4000/.test(s)) return 'mtu-16v4000g94s';
  if (/20v4000/.test(s)) return 'mtu-20v4000g94s';
  return null;
}
