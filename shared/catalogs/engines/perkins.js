// =============================================================================
// shared/catalogs/engines/perkins.js
// Perkins diesel engines — 1100/1300/2500/4000 series.
// Источник: Perkins datasheets 2023-2024 (perkins.com).
//
// v0.60.336 (по запросу Пользователя 2026-05-06: «может двигатели вынесешь
// отдельно»): engines catalog как single source of truth — derate profile,
// SFC, emission tier, габариты двигателя. ДГУ-каталог ссылается через
// engineRef: 'perkins-1106a-70tag2'.
// =============================================================================

export const PERKINS_ENGINES = [
  {
    id: 'perkins-1106a-70tag2',
    manufacturer: 'Perkins', series: '1100', model: '1106A-70TAG2',
    cylinders: 6, displacement: 7.0,
    sfcLkWh: 0.227,
    emissionTier: 'EU Stage IIIA',
    aspiration: 'turbocharged + aftercooled',
    derateProfile: {
      altBaselineM: 2400,           // baseline @ 25°C
      altPerHundredPct: 1.1,        // -1.1% per 100m above baseline
      tempBaselineC: 25,
      tempPer5Pct: 0,               // T effect via altShiftPerC only
      altShiftPerC: 14,             // baseline -14m per °C above 25
    },
    source: 'Perkins datasheet 1106A-70TAG2 50Hz Prime Derate Chart',
    note: 'Точные данные из datasheet. Дирейтинг 0% до 2400м при 25°C, до 2300м при 30°C.',
  },
  {
    id: 'perkins-1106a-70tag3',
    manufacturer: 'Perkins', series: '1100', model: '1106A-70TAG3',
    cylinders: 6, displacement: 7.0,
    sfcLkWh: 0.225,
    emissionTier: 'EU Stage IIIA / Tier 3',
    aspiration: 'turbocharged + aftercooled',
    derateProfile: {
      altBaselineM: 2400,
      altPerHundredPct: 1.1,
      tempBaselineC: 25,
      tempPer5Pct: 0,
      altShiftPerC: 14,
    },
    source: 'Perkins 1106A-70TAG3 datasheet',
    note: 'Аналогично TAG2, чуть улучшенный SFC. Кривая derate та же.',
  },
  {
    id: 'perkins-2206a-e13tag3',
    manufacturer: 'Perkins', series: '2200', model: '2206A-E13TAG3',
    cylinders: 6, displacement: 12.5,
    sfcLkWh: 0.222,
    emissionTier: 'EU Stage IIIA',
    aspiration: 'turbocharged + aftercooled',
    derateProfile: {
      altBaselineM: 2000,
      altPerHundredPct: 1.2,
      tempBaselineC: 25,
      tempPer5Pct: 0,
      altShiftPerC: 20,
    },
    source: 'Perkins 2206A-E13TAG3 datasheet',
    note: 'Среднеразмерный двигатель для 250-450 кВА ДГУ.',
  },
  {
    id: 'perkins-2506a-e15',
    manufacturer: 'Perkins', series: '2500', model: '2506A-E15 (TAG1-4)',
    cylinders: 6, displacement: 15.2,
    sfcLkWh: 0.215,
    emissionTier: 'EU Stage IIIA / Tier 3',
    aspiration: 'turbocharged + aftercooled',
    derateProfile: {
      altBaselineM: 1700,
      altPerHundredPct: 1.5,
      tempBaselineC: 25,
      tempPer5Pct: 0,
      altShiftPerC: 25,
    },
    source: 'Perkins 2506A-E15 derate curve datasheet',
    note: '500-650 кВА класс. Точная кривая по datasheet.',
  },
  {
    id: 'perkins-4006-23tag3a',
    manufacturer: 'Perkins', series: '4000', model: '4006-23TAG3A',
    cylinders: 6, displacement: 23,
    sfcLkWh: 0.210,
    emissionTier: 'EU Stage IIIA',
    aspiration: 'turbocharged + aftercooled',
    derateProfile: {
      altBaselineM: 1500,
      altPerHundredPct: 1.5,
      tempBaselineC: 25,
      tempPer5Pct: 0,
      altShiftPerC: 50,
    },
    source: 'Perkins 4006-23TAG3A datasheet',
    note: '800-1000 кВА. T-чувствительный (50м/°C).',
  },
  {
    id: 'perkins-4008-30tag3',
    manufacturer: 'Perkins', series: '4000', model: '4008-30TAG3',
    cylinders: 8, displacement: 30,
    sfcLkWh: 0.208,
    emissionTier: 'EU Stage IIIA',
    aspiration: 'turbocharged + aftercooled',
    derateProfile: {
      altBaselineM: 1500,
      altPerHundredPct: 1.5,
      tempBaselineC: 25,
      tempPer5Pct: 0,
      altShiftPerC: 50,
    },
    source: 'Perkins 4008-30TAG3 datasheet',
    note: '1000-1500 кВА класс.',
  },
  {
    id: 'perkins-4016-61trg3',
    manufacturer: 'Perkins', series: '4000', model: '4016-61TRG3',
    cylinders: 16, displacement: 61,
    sfcLkWh: 0.205,
    emissionTier: 'EU Stage IIIA',
    aspiration: 'turbocharged + aftercooled',
    derateProfile: {
      altBaselineM: 1500,
      altPerHundredPct: 1.5,
      tempBaselineC: 25,
      tempPer5Pct: 0,
      altShiftPerC: 50,
    },
    source: 'Perkins 4016-61TRG3 datasheet (October 2012)',
    note: '2000-2500 кВА класс. По известному графику: 25°C→1500м, 30°C→1000м, 50°C→0м.',
  },
];
