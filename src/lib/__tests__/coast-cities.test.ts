import { describe, expect, it } from 'vitest'
import {
  COAST_CITIES,
  COAST_LAUNCH_CITIES_ENV,
  listSelectableCoastCities,
  resolveSelectedCoastCity,
} from '../coast-cities'
import { parseLaunchedCities } from '../geo-launch'

describe('coast index', () => {
  it('defaults a guest to Seattle and lists Portland and San Francisco, not Los Angeles', () => {
    expect(resolveSelectedCoastCity(null).key).toBe('seattle')
    expect(resolveSelectedCoastCity('miami').key).toBe('seattle')
    expect(resolveSelectedCoastCity('sf').key).toBe('san-francisco')
    const open = listSelectableCoastCities([])
    expect(open.map((city) => city.key)).toEqual(['seattle', 'portland', 'san-francisco'])
    expect(open.some((city) => city.city === 'Los Angeles' || city.city === 'San Diego')).toBe(false)
    expect(COAST_CITIES).toHaveLength(3)
  })

  it('keeps an empty gate as no gate and wires Portland,OR and San Francisco,CA', () => {
    expect(listSelectableCoastCities(parseLaunchedCities(''))).toHaveLength(3)
    expect(listSelectableCoastCities(parseLaunchedCities(undefined))).toHaveLength(3)
    const launched = listSelectableCoastCities(parseLaunchedCities(COAST_LAUNCH_CITIES_ENV))
    expect(launched.map((city) => `${city.city},${city.state}`)).toEqual([
      'Seattle,WA',
      'Portland,OR',
      'San Francisco,CA',
    ])
    expect(listSelectableCoastCities(parseLaunchedCities('Seattle,WA')).map((city) => city.key)).toEqual(['seattle'])
    expect(parseLaunchedCities('Seattle,WA;Portland,OR;San Francisco,CA')[2]).toMatchObject({
      city: 'San Francisco',
      state: 'CA',
    })
  })
})
