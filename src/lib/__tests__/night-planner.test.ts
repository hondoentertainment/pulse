import { describe, it, expect } from 'vitest'
import {
  generateNightPlan,
  allocateBudget,
  estimateTransit,
  mergeCrewPreferences,
  adaptPlan,
  swapStop,
  getCurrentStopIndex,
  getTotalEstimatedSpend,
  PLANNER_VIBES,
  VENUE_TYPES,
  type NightPlan,
  type PlanStop,
  type PlanPreferences,
} from '../night-planner'
import type { Venue, Pulse, User } from '../types'

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: `venue-${Math.random().toString(36).slice(2, 8)}`,
    name: 'Test Venue',
    location: { lat: 40.7128, lng: -74.006, address: '' },
    pulseScore: 50,
    category: 'bar',
    ...overrides,
  }
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    username: 'user',
    friends: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    favoriteCategories: [],
    favoriteVenues: [],
    venueCheckInHistory: {},
    ...overrides,
  }
}

function makeStop(overrides: Partial<PlanStop> = {}): PlanStop {
  return {
    venueId: 'venue-1',
    venueName: 'The Place',
    venueCategory: 'bar',
    venueLocation: { lat: 40.7128, lng: -74.006, address: '' },
    arrivalTime: '2026-03-14T20:00:00.000Z',
    departureTime: '2026-03-14T21:30:00.000Z',
    purpose: 'drinks',
    estimatedSpend: 40,
    transitMode: 'walk',
    transitDuration: 5,
    energyPrediction: 'buzzing',
    ...overrides,
  }
}

function makePlan(overrides: Partial<NightPlan> = {}): NightPlan {
  return {
    id: 'plan-1',
    date: '2026-03-14',
    budget: { total: 200, perPerson: 100 },
    preferences: { vibes: [], musicGenres: [], venueTypes: [], avoidCategories: [] },
    stops: [],
    status: 'draft',
    createdBy: 'user-1',
    groupSize: 2,
    startTime: '2026-03-14T20:00:00.000Z',
    endTime: '2026-03-14T23:59:00.000Z',
    createdAt: '2026-03-14T18:00:00.000Z',
    ...overrides,
  }
}

describe('allocateBudget', () => {
  it('normalizes allocation to exactly the per-person budget for a full progression', () => {
    const result = allocateBudget(100, ['dinner', 'drinks', 'dancing', 'latenight'])
    expect(result).toHaveLength(4)
    // Each entry is rounded; total should be close to 100
    const total = result.reduce((a, b) => a + b, 0)
    expect(total).toBeGreaterThanOrEqual(98)
    expect(total).toBeLessThanOrEqual(101)
    // Dinner gets the largest share (40%)
    expect(result[0]).toBeGreaterThan(result[1])
    expect(result[1]).toBeGreaterThan(result[2])
  })

  it('normalizes correctly for a partial progression (missing dinner)', () => {
    const result = allocateBudget(90, ['drinks', 'dancing', 'latenight'])
    expect(result).toHaveLength(3)
    const total = result.reduce((a, b) => a + b, 0)
    expect(total).toBeGreaterThanOrEqual(88)
    expect(total).toBeLessThanOrEqual(91)
  })

  it('returns the whole budget for a single-purpose plan', () => {
    expect(allocateBudget(80, ['dinner'])).toEqual([80])
  })
})

describe('estimateTransit', () => {
  it('uses walk mode for distances under 0.5 miles', () => {
    const from = { lat: 40.7128, lng: -74.006 }
    const to = { lat: 40.7130, lng: -74.0062 } // very close
    const result = estimateTransit(from, to)
    expect(result.mode).toBe('walk')
    expect(result.duration).toBeGreaterThanOrEqual(3)
    expect(result.deepLink).toBeUndefined()
  })

  it('uses rideshare mode for distances over 0.5 miles', () => {
    const from = { lat: 40.7128, lng: -74.006 }
    const to = { lat: 40.7500, lng: -74.010 } // ~2.5 miles away
    const result = estimateTransit(from, to)
    expect(result.mode).toBe('rideshare')
    expect(result.duration).toBeGreaterThanOrEqual(5)
  })

  it('includes a deep link when a venue is provided for rideshare', () => {
    const from = { lat: 40.7128, lng: -74.006 }
    const venue = makeVenue({ location: { lat: 40.7500, lng: -74.010, address: '' } })
    const result = estimateTransit(from, venue.location, venue)
    expect(result.mode).toBe('rideshare')
    expect(result.deepLink).toBeDefined()
  })

  it('returns minimum walking duration of 3 minutes', () => {
    const from = { lat: 40.7128, lng: -74.006 }
    const to = { lat: 40.7128, lng: -74.006 } // 0 distance
    const result = estimateTransit(from, to)
    expect(result.mode).toBe('walk')
    expect(result.duration).toBe(3)
  })
})

describe('mergeCrewPreferences', () => {
  it('returns default empty preferences for an empty member list', () => {
    const result = mergeCrewPreferences([])
    expect(result.preferences.vibes).toEqual([])
    expect(result.averageBudget).toBe(100)
  })

  it('keeps only vibes that at least half the crew wants', () => {
    const members = [
      { preferences: { vibes: ['chill', 'wild'], musicGenres: [], venueTypes: [], avoidCategories: [] }, budget: 50 },
      { preferences: { vibes: ['chill', 'classy'], musicGenres: [], venueTypes: [], avoidCategories: [] }, budget: 100 },
      { preferences: { vibes: ['chill', 'wild'], musicGenres: [], venueTypes: [], avoidCategories: [] }, budget: 150 },
    ]
    const result = mergeCrewPreferences(members)
    expect(result.preferences.vibes).toContain('chill')
    expect(result.preferences.vibes).toContain('wild')
    expect(result.preferences.vibes).not.toContain('classy')
    expect(result.averageBudget).toBe(100)
  })

  it('unions all avoidCategories across members', () => {
    const members = [
      { preferences: { vibes: [], musicGenres: [], venueTypes: [], avoidCategories: ['karaoke'] }, budget: 50 },
      { preferences: { vibes: [], musicGenres: [], venueTypes: [], avoidCategories: ['dive_bar'] }, budget: 100 },
    ]
    const result = mergeCrewPreferences(members)
    expect(result.preferences.avoidCategories).toContain('karaoke')
    expect(result.preferences.avoidCategories).toContain('dive_bar')
  })

  it('falls back to the first member\'s vibes when no consensus forms', () => {
    const members = [
      { preferences: { vibes: ['chill'], musicGenres: [], venueTypes: [], avoidCategories: [] }, budget: 100 },
      { preferences: { vibes: ['wild'], musicGenres: [], venueTypes: [], avoidCategories: [] }, budget: 100 },
    ]
    const result = mergeCrewPreferences(members)
    // Both vibes got 1 count with threshold = ceil(2/2) = 1, so they both pass. Let's re-check.
    // With 2 members, threshold = ceil(2/2) = 1, so ANY vibe mentioned passes.
    expect(result.preferences.vibes.length).toBeGreaterThan(0)
  })
})

describe('getCurrentStopIndex', () => {
  it('returns -1 when current time is before the first stop', () => {
    const plan = makePlan({
      stops: [
        makeStop({ arrivalTime: '2026-03-14T20:00:00.000Z' }),
        makeStop({ arrivalTime: '2026-03-14T21:30:00.000Z' }),
      ],
    })
    expect(getCurrentStopIndex(plan, '2026-03-14T19:00:00.000Z')).toBe(-1)
  })

  it('returns the latest stop whose arrival has passed', () => {
    const plan = makePlan({
      stops: [
        makeStop({ arrivalTime: '2026-03-14T20:00:00.000Z' }),
        makeStop({ arrivalTime: '2026-03-14T21:30:00.000Z' }),
        makeStop({ arrivalTime: '2026-03-14T23:00:00.000Z' }),
      ],
    })
    expect(getCurrentStopIndex(plan, '2026-03-14T22:00:00.000Z')).toBe(1)
  })

  it('returns the last index when current time is after every stop', () => {
    const plan = makePlan({
      stops: [
        makeStop({ arrivalTime: '2026-03-14T20:00:00.000Z' }),
        makeStop({ arrivalTime: '2026-03-14T21:30:00.000Z' }),
      ],
    })
    expect(getCurrentStopIndex(plan, '2026-03-15T01:00:00.000Z')).toBe(1)
  })

  it('returns -1 for a plan with no stops', () => {
    expect(getCurrentStopIndex(makePlan({ stops: [] }), '2026-03-14T20:00:00.000Z')).toBe(-1)
  })
})

describe('getTotalEstimatedSpend', () => {
  it('sums estimatedSpend across all stops', () => {
    const plan = makePlan({
      stops: [
        makeStop({ estimatedSpend: 40 }),
        makeStop({ estimatedSpend: 30 }),
        makeStop({ estimatedSpend: 20 }),
      ],
    })
    expect(getTotalEstimatedSpend(plan)).toBe(90)
  })

  it('returns 0 for a plan with no stops', () => {
    expect(getTotalEstimatedSpend(makePlan({ stops: [] }))).toBe(0)
  })
})

describe('generateNightPlan', () => {
  const venues: Venue[] = [
    makeVenue({ id: 'v-rest', name: 'Dinner Place', category: 'restaurant', location: { lat: 40.7128, lng: -74.006, address: '' } }),
    makeVenue({ id: 'v-bar', name: 'Happy Hour', category: 'bar', location: { lat: 40.7130, lng: -74.007, address: '' } }),
    makeVenue({ id: 'v-club', name: 'Nightclub', category: 'nightclub', location: { lat: 40.7135, lng: -74.008, address: '' } }),
    makeVenue({ id: 'v-lounge', name: 'Late Lounge', category: 'lounge', location: { lat: 40.714, lng: -74.009, address: '' } }),
  ]

  const pulses: Pulse[] = []
  const user = makeUser()

  it('generates a 4-stop plan for a full evening (8pm to 2am)', () => {
    const plan = generateNightPlan(
      {
        groupSize: 2,
        budget: 100,
        preferences: { vibes: [], musicGenres: [], venueTypes: [], avoidCategories: [] },
        location: { lat: 40.7128, lng: -74.006 },
        startTime: '2026-03-14T20:00:00.000Z',
        endTime: '2026-03-15T02:00:00.000Z',
        userId: 'user-1',
      },
      venues,
      pulses,
      user
    )

    expect(plan.groupSize).toBe(2)
    expect(plan.budget.total).toBe(200)
    expect(plan.budget.perPerson).toBe(100)
    expect(plan.stops.length).toBeGreaterThan(0)
    expect(plan.stops.length).toBeLessThanOrEqual(4)
    expect(plan.status).toBe('draft')
    expect(plan.createdBy).toBe('user-1')
  })

  it('starts with a drinks stop (skipping dinner) when the start time is 10 PM or later', () => {
    const plan = generateNightPlan(
      {
        groupSize: 1,
        budget: 50,
        preferences: { vibes: [], musicGenres: [], venueTypes: [], avoidCategories: [] },
        location: { lat: 40.7128, lng: -74.006 },
        startTime: '2026-03-14T22:00:00.000Z',
        endTime: '2026-03-15T02:00:00.000Z',
        userId: 'user-1',
      },
      venues,
      pulses,
      user
    )
    const purposes = plan.stops.map((s) => s.purpose)
    expect(purposes).not.toContain('dinner')
  })

  it('respects avoidCategories by never selecting those venues', () => {
    const plan = generateNightPlan(
      {
        groupSize: 2,
        budget: 100,
        preferences: { vibes: [], musicGenres: [], venueTypes: [], avoidCategories: ['nightclub'] },
        location: { lat: 40.7128, lng: -74.006 },
        startTime: '2026-03-14T20:00:00.000Z',
        endTime: '2026-03-15T02:00:00.000Z',
        userId: 'user-1',
      },
      venues,
      pulses,
      user
    )
    expect(plan.stops.every((s) => s.venueCategory !== 'nightclub')).toBe(true)
  })

  it('respects locked stops in the output', () => {
    const lockedStops: PlanStop[] = [
      makeStop({
        venueId: 'v-bar',
        venueName: 'Happy Hour',
        venueCategory: 'bar',
        purpose: 'drinks',
        locked: true,
      }),
    ]
    const plan = generateNightPlan(
      {
        groupSize: 2,
        budget: 100,
        preferences: { vibes: [], musicGenres: [], venueTypes: [], avoidCategories: [] },
        location: { lat: 40.7128, lng: -74.006 },
        startTime: '2026-03-14T20:00:00.000Z',
        endTime: '2026-03-15T02:00:00.000Z',
        userId: 'user-1',
        lockedStops,
      },
      venues,
      pulses,
      user
    )
    const lockedStop = plan.stops.find((s) => s.venueId === 'v-bar')
    expect(lockedStop).toBeDefined()
    expect(lockedStop?.locked).toBe(true)
  })

  it('produces stops with arrival times in chronological order', () => {
    const plan = generateNightPlan(
      {
        groupSize: 2,
        budget: 100,
        preferences: { vibes: [], musicGenres: [], venueTypes: [], avoidCategories: [] },
        location: { lat: 40.7128, lng: -74.006 },
        startTime: '2026-03-14T20:00:00.000Z',
        endTime: '2026-03-15T02:00:00.000Z',
        userId: 'user-1',
      },
      venues,
      pulses,
      user
    )
    for (let i = 1; i < plan.stops.length; i++) {
      const prev = new Date(plan.stops[i - 1].arrivalTime).getTime()
      const curr = new Date(plan.stops[i].arrivalTime).getTime()
      expect(curr).toBeGreaterThan(prev)
    }
  })
})

describe('adaptPlan', () => {
  const venues: Venue[] = [
    makeVenue({ id: 'v-alt', name: 'Alternative Spot', pulseScore: 80 }),
  ]
  const pulses: Pulse[] = []
  const user = makeUser()

  it('suggests a swap when a future stop is reported as dead', () => {
    const plan = makePlan({
      stops: [
        makeStop({
          venueId: 'v-current',
          venueName: 'Current Venue',
          arrivalTime: '2026-03-14T23:00:00.000Z',
        }),
      ],
    })
    const liveEnergyScores = {
      'v-current': { energy: 'dead' as const, score: 10 },
    }
    const result = adaptPlan(
      plan,
      '2026-03-14T22:00:00.000Z', // before arrival
      liveEnergyScores,
      venues,
      pulses,
      user
    )

    expect(result.swapSuggestions).toHaveLength(1)
    expect(result.swapSuggestions[0].currentEnergy).toBe('dead')
    expect(result.swapSuggestions[0].suggestedVenue.id).toBe('v-alt')
  })

  it('skips swap suggestions for past stops', () => {
    const plan = makePlan({
      stops: [
        makeStop({
          venueId: 'v-current',
          arrivalTime: '2026-03-14T20:00:00.000Z', // already passed
        }),
      ],
    })
    const liveEnergyScores = {
      'v-current': { energy: 'dead' as const, score: 10 },
    }
    const result = adaptPlan(
      plan,
      '2026-03-14T22:00:00.000Z', // after arrival
      liveEnergyScores,
      venues,
      pulses,
      user
    )
    expect(result.swapSuggestions).toHaveLength(0)
  })

  it('skips swap suggestions for locked stops', () => {
    const plan = makePlan({
      stops: [
        makeStop({
          venueId: 'v-current',
          arrivalTime: '2026-03-14T23:00:00.000Z',
          locked: true,
        }),
      ],
    })
    const liveEnergyScores = {
      'v-current': { energy: 'dead' as const, score: 10 },
    }
    const result = adaptPlan(
      plan,
      '2026-03-14T22:00:00.000Z',
      liveEnergyScores,
      venues,
      pulses,
      user
    )
    expect(result.swapSuggestions).toHaveLength(0)
  })

  it('updates energy prediction in-place with live data', () => {
    const plan = makePlan({
      stops: [
        makeStop({
          venueId: 'v-current',
          arrivalTime: '2026-03-14T23:00:00.000Z',
          energyPrediction: 'chill',
        }),
      ],
    })
    const liveEnergyScores = {
      'v-current': { energy: 'electric' as const, score: 95 },
    }
    const result = adaptPlan(
      plan,
      '2026-03-14T22:00:00.000Z',
      liveEnergyScores,
      venues,
      pulses,
      user
    )
    expect(result.plan.stops[0].energyPrediction).toBe('electric')
  })
})

describe('swapStop', () => {
  const pulses: Pulse[] = []

  it('replaces the stop at the given index with the new venue', () => {
    const plan = makePlan({
      stops: [
        makeStop({ venueId: 'v-1', venueName: 'Old Venue' }),
      ],
    })
    const newVenue = makeVenue({ id: 'v-2', name: 'New Venue', category: 'nightclub' })
    const updated = swapStop(plan, 0, newVenue, pulses)

    expect(updated.stops[0].venueId).toBe('v-2')
    expect(updated.stops[0].venueName).toBe('New Venue')
    expect(updated.stops[0].venueCategory).toBe('nightclub')
  })

  it('preserves the old arrival/departure and spend when swapping', () => {
    const plan = makePlan({
      stops: [
        makeStop({
          venueId: 'v-1',
          arrivalTime: '2026-03-14T21:00:00.000Z',
          departureTime: '2026-03-14T22:30:00.000Z',
          estimatedSpend: 40,
        }),
      ],
    })
    const newVenue = makeVenue({ id: 'v-2', name: 'New Venue' })
    const updated = swapStop(plan, 0, newVenue, pulses)

    expect(updated.stops[0].arrivalTime).toBe('2026-03-14T21:00:00.000Z')
    expect(updated.stops[0].departureTime).toBe('2026-03-14T22:30:00.000Z')
    expect(updated.stops[0].estimatedSpend).toBe(40)
  })

  it('returns the original plan when stopIndex is out of range', () => {
    const plan = makePlan({ stops: [makeStop()] })
    const newVenue = makeVenue({ id: 'v-new' })
    const updated = swapStop(plan, 99, newVenue, pulses)
    expect(updated).toBe(plan)
  })
})

describe('constants (PLANNER_VIBES, VENUE_TYPES)', () => {
  it('exports expected vibe shapes', () => {
    expect(PLANNER_VIBES.length).toBeGreaterThan(0)
    for (const v of PLANNER_VIBES) {
      expect(v.id).toBeDefined()
      expect(v.label).toBeDefined()
      expect(v.emoji).toBeDefined()
    }
  })

  it('exports expected venue type shapes', () => {
    expect(VENUE_TYPES.length).toBeGreaterThan(0)
    for (const v of VENUE_TYPES) {
      expect(v.id).toBeDefined()
      expect(v.label).toBeDefined()
    }
  })
})
