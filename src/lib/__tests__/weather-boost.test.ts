import { describe, it, expect } from 'vitest'
import {
  applyWeatherBoost,
  computeWeatherDelta,
  WEATHER_BOOSTS,
  type WeatherLike,
} from '../weather-boost'
import type { Venue } from '../types'

const makeVenue = (overrides: Partial<Venue> = {}): Venue => ({
  id: overrides.id ?? 'v1',
  name: overrides.name ?? 'Venue',
  location: { lat: 0, lng: 0, address: '' },
  pulseScore: 50,
  ...overrides,
})

const weather = (overrides: Partial<WeatherLike> = {}): WeatherLike => ({
  condition: 'clear',
  tempC: 20,
  windKph: 5,
  visibilityKm: 10,
  ...overrides,
})

describe('computeWeatherDelta', () => {
  it('rain boosts indoor and penalizes outdoor', () => {
    const indoor = makeVenue({ id: 'in', indoorOutdoor: 'indoor' })
    const outdoor = makeVenue({ id: 'out', indoorOutdoor: 'outdoor' })
    const w = weather({ condition: 'rain' })
    expect(computeWeatherDelta(indoor, w)).toBe(WEATHER_BOOSTS.rainIndoor)
    expect(computeWeatherDelta(outdoor, w)).toBe(WEATHER_BOOSTS.rainOutdoor)
  })

  it('snow heavily penalizes outdoor', () => {
    const v = makeVenue({ indoorOutdoor: 'outdoor' })
    expect(computeWeatherDelta(v, weather({ condition: 'snow', tempC: -1 }))).toBe(
      WEATHER_BOOSTS.snowOutdoor,
    )
  })

  it('sunny + warm boosts outdoor & rooftop', () => {
    const outdoor = makeVenue({ indoorOutdoor: 'outdoor' })
    const rooftop = makeVenue({ name: 'Skyline Rooftop Lounge' })
    const w = weather({ condition: 'clear', tempC: 24 })
    expect(computeWeatherDelta(outdoor, w)).toBe(WEATHER_BOOSTS.sunnyWarmOutdoor)
    expect(computeWeatherDelta(rooftop, w)).toBe(WEATHER_BOOSTS.sunnyWarmOutdoor)
  })

  it('cold + clear nudges outdoor down', () => {
    const v = makeVenue({ indoorOutdoor: 'outdoor' })
    expect(computeWeatherDelta(v, weather({ condition: 'clear', tempC: 2 }))).toBe(
      WEATHER_BOOSTS.coldOutdoor,
    )
  })

  it('storm hurts outdoor, gently helps indoor', () => {
    const outdoor = makeVenue({ indoorOutdoor: 'outdoor' })
    const indoor = makeVenue({ indoorOutdoor: 'indoor' })
    const w = weather({ condition: 'storm' })
    expect(computeWeatherDelta(outdoor, w)).toBe(WEATHER_BOOSTS.stormOutdoor)
    expect(computeWeatherDelta(indoor, w)).toBe(WEATHER_BOOSTS.stormIndoor)
  })

  it('windy penalizes rooftop even on a clear day', () => {
    const rooftop = makeVenue({ name: 'Rooftop Bar' })
    const delta = computeWeatherDelta(
      rooftop,
      weather({ condition: 'clear', tempC: 22, windKph: 45 }),
    )
    // sunny + warm => +10, windy rooftop => -10, net 0
    expect(delta).toBe(WEATHER_BOOSTS.sunnyWarmOutdoor + WEATHER_BOOSTS.windyRooftop)
  })

  it('low visibility trims outdoor', () => {
    const v = makeVenue({ indoorOutdoor: 'outdoor' })
    expect(
      computeWeatherDelta(v, weather({ condition: 'cloudy', visibilityKm: 1 })),
    ).toBe(WEATHER_BOOSTS.lowVisibilityOutdoor)
  })

  it('no-op for indoor venue under clear/cold weather', () => {
    const v = makeVenue({ indoorOutdoor: 'indoor' })
    expect(computeWeatherDelta(v, weather({ condition: 'clear', tempC: 0 }))).toBe(0)
  })
})

describe('applyWeatherBoost', () => {
  it('returns a new array (does not mutate input)', () => {
    const venues = [makeVenue({ indoorOutdoor: 'indoor' })]
    const result = applyWeatherBoost(venues, weather({ condition: 'rain' }))
    expect(result).not.toBe(venues)
    expect(result[0]).not.toBe(venues[0])
    expect(venues[0].contextualScore).toBeUndefined()
  })

  it('adds deltas onto existing contextualScore', () => {
    const v = makeVenue({ indoorOutdoor: 'indoor', contextualScore: 5 })
    const [result] = applyWeatherBoost([v], weather({ condition: 'rain' }))
    expect(result.contextualScore).toBe(5 + WEATHER_BOOSTS.rainIndoor)
  })

  it('returns cloned venues unchanged when weather is null', () => {
    const venues = [makeVenue({ contextualScore: 3 })]
    const result = applyWeatherBoost(venues, null)
    expect(result[0].contextualScore).toBe(3)
    expect(result[0]).not.toBe(venues[0])
  })

  it('handles empty venue arrays and malformed input defensively', () => {
    expect(applyWeatherBoost([], weather())).toEqual([])
    // @ts-expect-error deliberately wrong
    expect(applyWeatherBoost(null, weather())).toEqual([])
  })

  it('ranks rooftop above indoor on a sunny warm day', () => {
    const venues = [
      makeVenue({ id: 'indoor', indoorOutdoor: 'indoor' }),
      makeVenue({ id: 'rooftop', name: 'Rooftop Place', indoorOutdoor: 'outdoor' }),
    ]
    const result = applyWeatherBoost(venues, weather({ condition: 'clear', tempC: 25 }))
    const indoor = result.find((v) => v.id === 'indoor')!
    const rooftop = result.find((v) => v.id === 'rooftop')!
    expect((rooftop.contextualScore ?? 0) > (indoor.contextualScore ?? 0)).toBe(true)
  })
})
