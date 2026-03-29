import { describe, it, expect } from 'vitest'
import {
  createWhiteLabelConfig,
  createFestivalConfig,
  createCampusConfig,
  createCorporateConfig,
  createHotelConfig,
  createDistrictConfig,
  getStageEnergy,
  getZoneActivity,
  getBuildingActivity,
  getEditionFeatures,
  isFeatureEnabled,
  customizeFeatures,
  deactivateConfig,
} from '../white-label'

describe('createWhiteLabelConfig', () => {
  it('creates with default features', () => {
    const config = createWhiteLabelConfig('festival', 'Summer Fest', '#FF5500')
    expect(config.edition).toBe('festival')
    expect(config.brandColor).toBe('#FF5500')
    expect(config.active).toBe(true)
    expect(config.features.length).toBeGreaterThan(0)
  })
})

describe('createFestivalConfig', () => {
  it('creates festival config with stages', () => {
    const config = createFestivalConfig(
      'Lolla Pulse', 'Lollapalooza', '#00FF00',
      '2026-08-01', '2026-08-03',
      [{ id: 's1', name: 'Main Stage', capacity: 5000 }, { id: 's2', name: 'Side Stage', capacity: 1000 }]
    )
    expect(config.festivalName).toBe('Lollapalooza')
    expect(config.stages).toHaveLength(2)
    expect(config.edition).toBe('festival')
  })
})

describe('createCampusConfig', () => {
  it('creates campus config with zones', () => {
    const config = createCampusConfig(
      'NYU Pulse', 'NYU', '#57068c',
      [{ id: 'z1', name: 'Library', type: 'library' }, { id: 'z2', name: 'Dining Hall', type: 'dining', capacity: 500 }]
    )
    expect(config.universityName).toBe('NYU')
    expect(config.zones).toHaveLength(2)
    expect(config.edition).toBe('campus')
  })
})

describe('createCorporateConfig', () => {
  it('creates corporate config', () => {
    const config = createCorporateConfig(
      'Acme Pulse', 'Acme Corp', '#003366',
      [{ id: 'b1', name: 'HQ', floors: 10 }]
    )
    expect(config.companyName).toBe('Acme Corp')
    expect(config.buildings).toHaveLength(1)
  })
})

describe('createHotelConfig', () => {
  it('creates hotel config', () => {
    const config = createHotelConfig(
      'Marriott Pulse', 'Marriott', '#b3282d',
      [{ id: 'p1', name: 'Times Square', city: 'NYC' }]
    )
    expect(config.chainName).toBe('Marriott')
    expect(config.properties).toHaveLength(1)
  })
})

describe('createDistrictConfig', () => {
  it('creates district config', () => {
    const config = createDistrictConfig(
      'SoHo Pulse', 'SoHo', 'NYC', '#FFD700',
      { north: 40.73, south: 40.72, east: -73.99, west: -74.01 }
    )
    expect(config.districtName).toBe('SoHo')
    expect(config.city).toBe('NYC')
  })
})

describe('getStageEnergy', () => {
  it('maps score to energy level', () => {
    const low = getStageEnergy('s1', 'Main', 10)
    expect(low.energy).toBe('dead')

    const high = getStageEnergy('s2', 'Side', 90)
    expect(high.energy).toBe('electric')
    expect(high.crowdLevel).toBe(0) // No longer derived from pulseScore
  })
})

describe('getZoneActivity', () => {
  it('tracks zone activity', () => {
    const zone = { id: 'z1', name: 'Library', type: 'library' as const }
    const activity = getZoneActivity(zone, 75)
    expect(activity.zoneType).toBe('library')
    expect(activity.occupancyPercent).toBe(75)
    expect(activity.energy).toBe('buzzing')
  })

  it('caps at 100%', () => {
    const zone = { id: 'z1', name: 'Gym', type: 'gym' as const }
    const activity = getZoneActivity(zone, 150)
    expect(activity.occupancyPercent).toBe(100)
  })
})

describe('getBuildingActivity', () => {
  it('tracks building activity', () => {
    const activity = getBuildingActivity('b1', 'HQ', 80, 65)
    expect(activity.cafeteriaEnergy).toBe('buzzing')
    expect(activity.meetingRoomUsage).toBe(65)
  })

  it('handles no cafeteria data', () => {
    const activity = getBuildingActivity('b1', 'HQ')
    expect(activity.cafeteriaEnergy).toBeUndefined()
  })
})

describe('getEditionFeatures', () => {
  it('returns features for each edition', () => {
    expect(getEditionFeatures('festival').length).toBeGreaterThan(0)
    expect(getEditionFeatures('campus')).toContain('dorm_energy')
    expect(getEditionFeatures('corporate')).toContain('cafeteria_buzz')
  })
})

describe('isFeatureEnabled', () => {
  it('checks active config', () => {
    const config = createWhiteLabelConfig('festival', 'Test', '#000')
    expect(isFeatureEnabled(config, 'stage_energy')).toBe(true)
    expect(isFeatureEnabled(config, 'nonexistent')).toBe(false)
  })

  it('returns false for inactive', () => {
    const config = deactivateConfig(createWhiteLabelConfig('festival', 'Test', '#000'))
    expect(isFeatureEnabled(config, 'stage_energy')).toBe(false)
  })
})

describe('customizeFeatures', () => {
  it('replaces features list', () => {
    const config = createWhiteLabelConfig('festival', 'Test', '#000')
    const custom = customizeFeatures(config, ['stage_energy', 'custom_feature'])
    expect(custom.features).toHaveLength(2)
    expect(custom.features).toContain('custom_feature')
  })
})

describe('deactivateConfig', () => {
  it('deactivates config', () => {
    const config = createWhiteLabelConfig('hotel', 'Test', '#000')
    expect(config.active).toBe(true)
    const deactivated = deactivateConfig(config)
    expect(deactivated.active).toBe(false)
  })
})
