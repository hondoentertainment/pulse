import { describe, it, expect } from 'vitest'
import {
  createCrew,
  addCrewMember,
  removeCrewMember,
  initiateCrewCheckIn,
  confirmCrewCheckIn,
  isSquadGoals,
  getConfirmedCount,
  buildCrewActivityFeed,
  getUserCrews,
  getActiveCrewCheckIns,
} from '../crew-mode'
import type { Crew } from '../crew-mode'

describe('createCrew', () => {
  it('creates a crew with creator included', () => {
    const result = createCrew('Night Owls', 'u1', ['u2', 'u3'])
    expect('error' in result).toBe(false)
    const crew = result as Crew
    expect(crew.name).toBe('Night Owls')
    expect(crew.memberIds).toContain('u1')
    expect(crew.memberIds).toHaveLength(3)
  })

  it('rejects too few members', () => {
    const result = createCrew('Solo', 'u1', [])
    expect('error' in result).toBe(true)
  })

  it('rejects too many members', () => {
    const ids = Array.from({ length: 9 }, (_, i) => `u${i + 2}`)
    const result = createCrew('Army', 'u1', ids)
    expect('error' in result).toBe(true)
  })

  it('deduplicates creator from member list', () => {
    const result = createCrew('Test', 'u1', ['u1', 'u2'])
    expect('error' in result).toBe(false)
    expect((result as Crew).memberIds).toHaveLength(2)
  })
})

describe('addCrewMember', () => {
  const crew = createCrew('Test', 'u1', ['u2']) as Crew

  it('adds a new member', () => {
    const updated = addCrewMember(crew, 'u3')
    expect('error' in updated).toBe(false)
    expect((updated as Crew).memberIds).toContain('u3')
  })

  it('rejects duplicate member', () => {
    expect('error' in addCrewMember(crew, 'u1')).toBe(true)
  })

  it('rejects when full', () => {
    let c = crew
    for (let i = 3; i <= 8; i++) c = addCrewMember(c, `u${i}`) as Crew
    expect('error' in addCrewMember(c, 'u9')).toBe(true)
  })
})

describe('removeCrewMember', () => {
  it('removes a member', () => {
    const crew = createCrew('Test', 'u1', ['u2', 'u3']) as Crew
    const updated = removeCrewMember(crew, 'u3')
    expect('error' in updated).toBe(false)
    expect((updated as Crew).memberIds).not.toContain('u3')
  })

  it('rejects if would go below minimum', () => {
    const crew = createCrew('Test', 'u1', ['u2']) as Crew
    expect('error' in removeCrewMember(crew, 'u2')).toBe(true)
  })
})

describe('crew check-in flow', () => {
  const crew = createCrew('Squad', 'u1', ['u2', 'u3']) as Crew

  it('initiates a check-in', () => {
    const ci = initiateCrewCheckIn(crew, 'v1', 'u1', 'buzzing')
    expect(ci.status).toBe('pending')
    expect(ci.confirmations['u1'].confirmed).toBe(true)
    expect(ci.confirmations['u2'].confirmed).toBe(false)
  })

  it('confirms and calculates combined energy', () => {
    let ci = initiateCrewCheckIn(crew, 'v1', 'u1', 'buzzing')
    ci = confirmCrewCheckIn(ci, 'u2', 'electric')
    expect(ci.confirmations['u2'].confirmed).toBe(true)
    expect(ci.combinedEnergyRating).toBeDefined()
    expect(ci.status).toBe('pending') // u3 hasn't confirmed
  })

  it('becomes active when all confirm (squad goals)', () => {
    let ci = initiateCrewCheckIn(crew, 'v1', 'u1', 'electric')
    ci = confirmCrewCheckIn(ci, 'u2', 'electric')
    ci = confirmCrewCheckIn(ci, 'u3', 'buzzing')
    expect(ci.status).toBe('active')
    expect(isSquadGoals(ci)).toBe(true)
  })
})

describe('getConfirmedCount', () => {
  it('counts confirmed members', () => {
    const crew = createCrew('Test', 'u1', ['u2', 'u3']) as Crew
    let ci = initiateCrewCheckIn(crew, 'v1', 'u1', 'chill')
    ci = confirmCrewCheckIn(ci, 'u2', 'buzzing')
    const { confirmed, total } = getConfirmedCount(ci)
    expect(confirmed).toBe(2)
    expect(total).toBe(3)
  })
})

describe('buildCrewActivityFeed', () => {
  it('builds a feed for tonight', () => {
    const crew = createCrew('Squad', 'u1', ['u2']) as Crew
    const tonight = new Date()
    tonight.setHours(20, 0, 0, 0)
    if (new Date().getHours() < 17) tonight.setDate(tonight.getDate() - 1)

    let ci = initiateCrewCheckIn(crew, 'v1', 'u1', 'electric')
    ci = confirmCrewCheckIn(ci, 'u2', 'buzzing')
    ci = { ...ci, createdAt: tonight.toISOString() }

    const feed = buildCrewActivityFeed(crew, [ci], { v1: 'Bar A' })
    expect(feed.entries).toHaveLength(1)
    expect(feed.entries[0].venueName).toBe('Bar A')
  })
})

describe('getUserCrews', () => {
  it('returns crews a user belongs to', () => {
    const c1 = createCrew('A', 'u1', ['u2']) as Crew
    const c2 = createCrew('B', 'u3', ['u4']) as Crew
    expect(getUserCrews([c1, c2], 'u1')).toHaveLength(1)
    expect(getUserCrews([c1, c2], 'u3')).toHaveLength(1)
    expect(getUserCrews([c1, c2], 'u5')).toHaveLength(0)
  })
})

describe('getActiveCrewCheckIns', () => {
  it('returns active check-ins for a venue', () => {
    const crew = createCrew('Test', 'u1', ['u2']) as Crew
    const ci = initiateCrewCheckIn(crew, 'v1', 'u1', 'chill')
    expect(getActiveCrewCheckIns([ci], 'v1')).toHaveLength(1)
    expect(getActiveCrewCheckIns([ci], 'v2')).toHaveLength(0)
    expect(getActiveCrewCheckIns([{ ...ci, status: 'completed' }], 'v1')).toHaveLength(0)
  })
})
