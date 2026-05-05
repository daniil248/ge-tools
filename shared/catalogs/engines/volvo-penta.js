// =============================================================================
// shared/catalogs/engines/volvo-penta.js
// Volvo Penta industrial engines — TAD/TWD series.
// Источник: Volvo Penta Power Generation datasheets 2023-2024.
// =============================================================================

export const VOLVO_PENTA_ENGINES = [
  {
    id: 'volvo-tad531ge',
    manufacturer: 'Volvo Penta', series: 'TAD', model: 'TAD531GE',
    cylinders: 4, displacement: 5.1,
    sfcLkWh: 0.230,
    emissionTier: 'EU Stage IIIA',
    aspiration: 'turbocharged + aftercooled',
    derateProfile: {
      altBaselineM: 1500,
      altPerHundredPct: 1.0,
      tempBaselineC: 25,
      tempPer5Pct: 0,
      altShiftPerC: 10,
    },
    source: 'Volvo Penta TAD531GE datasheet',
    note: '4-цил., 80-100 кВА класс.',
  },
  {
    id: 'volvo-tad732ge',
    manufacturer: 'Volvo Penta', series: 'TAD', model: 'TAD732GE',
    cylinders: 6, displacement: 7.2,
    sfcLkWh: 0.227,
    emissionTier: 'EU Stage IIIA',
    aspiration: 'turbocharged + aftercooled',
    derateProfile: {
      altBaselineM: 1500,
      altPerHundredPct: 1.0,
      tempBaselineC: 25,
      tempPer5Pct: 0,
      altShiftPerC: 10,
    },
    source: 'Volvo Penta TAD732GE datasheet',
    note: '6-цил., 130-165 кВА класс. Высокий T-tolerance до 50°C.',
  },
  {
    id: 'volvo-tad941ge',
    manufacturer: 'Volvo Penta', series: 'TAD', model: 'TAD941GE',
    cylinders: 6, displacement: 9.4,
    sfcLkWh: 0.222,
    emissionTier: 'EU Stage IIIA',
    aspiration: 'turbocharged + aftercooled',
    derateProfile: {
      altBaselineM: 1500,
      altPerHundredPct: 1.0,
      tempBaselineC: 25,
      tempPer5Pct: 0,
      altShiftPerC: 10,
    },
    source: 'Volvo Penta TAD941GE datasheet',
    note: '6-цил. 9.4L, 200-250 кВА класс.',
  },
  {
    id: 'volvo-tad1342ge',
    manufacturer: 'Volvo Penta', series: 'TAD', model: 'TAD1342GE',
    cylinders: 6, displacement: 13,
    sfcLkWh: 0.218,
    emissionTier: 'EU Stage IIIA',
    aspiration: 'turbocharged + aftercooled',
    derateProfile: {
      altBaselineM: 1500,
      altPerHundredPct: 1.0,
      tempBaselineC: 25,
      tempPer5Pct: 0,
      altShiftPerC: 10,
    },
    source: 'Volvo Penta TAD1342GE datasheet',
    note: '6-цил. 13L, 320-400 кВА класс.',
  },
  {
    id: 'volvo-twd1683ge',
    manufacturer: 'Volvo Penta', series: 'TWD', model: 'TWD1683GE',
    cylinders: 6, displacement: 16.1,
    sfcLkWh: 0.213,
    emissionTier: 'EU Stage IIIA',
    aspiration: 'turbocharged + aftercooled (water-cooled)',
    derateProfile: {
      altBaselineM: 1500,
      altPerHundredPct: 1.0,
      tempBaselineC: 25,
      tempPer5Pct: 0,
      altShiftPerC: 10,
    },
    source: 'Volvo Penta TWD1683GE datasheet',
    note: '6-цил. 16.1L, 500-650 кВА класс. TWD = water-cooled aftercooler.',
  },
];
