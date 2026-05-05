// =============================================================================
// shared/catalogs/engines/mtu.js
// MTU (Rolls-Royce Power Systems) engines — Series 2000 / 4000.
// Источник: MTU/Rolls-Royce Power Systems datasheets 2023-2024.
// =============================================================================

export const MTU_ENGINES = [
  {
    id: 'mtu-12v2000g65',
    manufacturer: 'MTU', series: '2000', model: '12V2000G65',
    cylinders: 12, displacement: 23.9,
    sfcLkWh: 0.200,
    emissionTier: 'EU Stage IIIA',
    aspiration: 'turbocharged + aftercooled',
    derateProfile: {
      altBaselineM: 1700,
      altPerHundredPct: 0.8,
      tempBaselineC: 25,
      tempPer5Pct: 0,
      altShiftPerC: 8,
    },
    source: 'MTU 12V2000G65 datasheet',
    note: '12-цил. V-образный 23.9L, 1000-1250 кВА класс.',
  },
  {
    id: 'mtu-16v4000g94s',
    manufacturer: 'MTU', series: '4000', model: '16V4000G94S',
    cylinders: 16, displacement: 76.3,
    sfcLkWh: 0.195,
    emissionTier: 'EU Stage IIIA',
    aspiration: 'turbocharged + aftercooled (water-cooled)',
    derateProfile: {
      altBaselineM: 1700,
      altPerHundredPct: 0.8,
      tempBaselineC: 25,
      tempPer5Pct: 0,
      altShiftPerC: 8,
    },
    source: 'MTU 16V4000G94S datasheet',
    note: '16-цил. V-образный 76.3L, 2000 кВА класс. Standard data center industry.',
  },
  {
    id: 'mtu-20v4000g94s',
    manufacturer: 'MTU', series: '4000', model: '20V4000G94S',
    cylinders: 20, displacement: 95.4,
    sfcLkWh: 0.193,
    emissionTier: 'EU Stage IIIA',
    aspiration: 'turbocharged + aftercooled (water-cooled)',
    derateProfile: {
      altBaselineM: 1700,
      altPerHundredPct: 0.8,
      tempBaselineC: 25,
      tempPer5Pct: 0,
      altShiftPerC: 8,
    },
    source: 'MTU 20V4000G94S datasheet',
    note: '20-цил. V-образный 95.4L, 2500 кВА. Топ-класс ЦОД Tier IV.',
  },
];
