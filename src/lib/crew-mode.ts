import type { EnergyRating } from './types'

/**
 * Crew Mode — Group Check-Ins
 *
 * Create crews of 2-8 friends, shared check-ins, combined energy ratings,
 * crew activity feed, and squad goals badge.
 */

export interface Crew {
  id: string
  name: string
  createdBy: string
  memberIds: string[]
  createdAt: string
  activeNight?: string
}

export interface CrewCheckIn {
  id: string
  crewId: string
  venueId: string
  initiatorId: string
  confirmations: Record<string, { confirmed: boolean; energyRating?: EnergyRating; timestamp?: string }>
  combinedEnergyRating?: EnergyRating
  createdAt: string
  status: 'pending' | 'active' | 'completed'
}

export interface CrewActivityEntry {
  crewId: string
  venueId: string
  venueName: string
  checkInTime: string
  membersPresent: number
  totalMembers: number
  combinedEnergy: EnergyRating
  isSquadGoals: boolean
}

export interface CrewActivityFeed {
  crewId: string
  crewName: string
  date: string
  entries: CrewActivityEntry[]
  squadGoalsCount: number
}

const MIN_CREW_SIZE = 2
const MAX_CREW_SIZE = 8

/**
 * Create a new crew.
 */
export function createCrew(
  name: string,
  creatorId: string,
  memberIds: string[]
): Crew | { error: string } {
  const allMembers = [creatorId, ...memberIds.filter(id => id !== creatorId)]

  if (allMembers.length < MIN_CREW_SIZE) {
    return { error: `Crew needs at least ${MIN_CREW_SIZE} members` }
  }
  if (allMembers.length > MAX_CREW_SIZE) {
    return { error: `Crew can have at most ${MAX_CREW_SIZE} members` }
  }

  return {
    id: `crew-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    createdBy: creatorId,
    memberIds: allMembers,
    createdAt: new Date().toISOString(),
  }
}

/**
 * Add a member to a crew.
 */
export function addCrewMember(crew: Crew, userId: string): Crew | { error: string } {
  if (crew.memberIds.includes(userId)) {
    return { error: 'Already a member' }
  }
  if (crew.memberIds.length >= MAX_CREW_SIZE) {
    return { error: `Crew is full (max ${MAX_CREW_SIZE})` }
  }
  return { ...crew, memberIds: [...crew.memberIds, userId] }
}

/**
 * Remove a member from a crew.
 */
export function removeCrewMember(crew: Crew, userId: string): Crew | { error: string } {
  if (!crew.memberIds.includes(userId)) {
    return { error: 'Not a member' }
  }
  const remaining = crew.memberIds.filter(id => id !== userId)
  if (remaining.length < MIN_CREW_SIZE) {
    return { error: `Crew needs at least ${MIN_CREW_SIZE} members` }
  }
  return { ...crew, memberIds: remaining }
}

/**
 * Initiate a shared crew check-in at a venue.
 */
export function initiateCrewCheckIn(
  crew: Crew,
  venueId: string,
  initiatorId: string,
  initiatorEnergy: EnergyRating
): CrewCheckIn {
  const confirmations: CrewCheckIn['confirmations'] = {}
  for (const memberId of crew.memberIds) {
    if (memberId === initiatorId) {
      confirmations[memberId] = {
        confirmed: true,
        energyRating: initiatorEnergy,
        timestamp: new Date().toISOString(),
      }
    } else {
      confirmations[memberId] = { confirmed: false }
    }
  }

  return {
    id: `crew-checkin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    crewId: crew.id,
    venueId,
    initiatorId,
    confirmations,
    createdAt: new Date().toISOString(),
    status: 'pending',
  }
}

/**
 * Confirm a crew check-in for a member.
 */
export function confirmCrewCheckIn(
  checkIn: CrewCheckIn,
  userId: string,
  energyRating: EnergyRating
): CrewCheckIn {
  const confirmations = {
    ...checkIn.confirmations,
    [userId]: {
      confirmed: true,
      energyRating,
      timestamp: new Date().toISOString(),
    },
  }

  const confirmedMembers = Object.values(confirmations).filter(c => c.confirmed)
  const energyValues: Record<EnergyRating, number> = { dead: 0, chill: 1, buzzing: 2, electric: 3 }
  const energyLabels: EnergyRating[] = ['dead', 'chill', 'buzzing', 'electric']

  // Weighted average of confirmed energy ratings
  const totalEnergy = confirmedMembers.reduce(
    (sum, c) => sum + (c.energyRating ? energyValues[c.energyRating] : 0), 0
  )
  const avgEnergy = confirmedMembers.length > 0 ? totalEnergy / confirmedMembers.length : 0
  const combinedEnergyRating = energyLabels[Math.round(avgEnergy)]

  const allConfirmed = Object.values(confirmations).every(c => c.confirmed)

  return {
    ...checkIn,
    confirmations,
    combinedEnergyRating,
    status: allConfirmed ? 'active' : 'pending',
  }
}

/**
 * Check if all crew members have confirmed (squad goals!).
 */
export function isSquadGoals(checkIn: CrewCheckIn): boolean {
  return Object.values(checkIn.confirmations).every(c => c.confirmed)
}

/**
 * Get number of confirmed members.
 */
export function getConfirmedCount(checkIn: CrewCheckIn): { confirmed: number; total: number } {
  const confirmed = Object.values(checkIn.confirmations).filter(c => c.confirmed).length
  return { confirmed, total: Object.keys(checkIn.confirmations).length }
}

/**
 * Build the crew activity feed for a night.
 */
export function buildCrewActivityFeed(
  crew: Crew,
  checkIns: CrewCheckIn[],
  venueNames: Record<string, string>
): CrewActivityFeed {
  const tonight = new Date()
  tonight.setHours(17, 0, 0, 0)
  if (new Date().getHours() < 17) {
    tonight.setDate(tonight.getDate() - 1)
  }

  const tonightCheckIns = checkIns
    .filter(ci => ci.crewId === crew.id && new Date(ci.createdAt) >= tonight)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  const entries: CrewActivityEntry[] = tonightCheckIns.map(ci => {
    const { confirmed, total } = getConfirmedCount(ci)
    return {
      crewId: crew.id,
      venueId: ci.venueId,
      venueName: venueNames[ci.venueId] ?? 'Unknown venue',
      checkInTime: ci.createdAt,
      membersPresent: confirmed,
      totalMembers: total,
      combinedEnergy: ci.combinedEnergyRating ?? 'chill',
      isSquadGoals: isSquadGoals(ci),
    }
  })

  return {
    crewId: crew.id,
    crewName: crew.name,
    date: tonight.toISOString().split('T')[0],
    entries,
    squadGoalsCount: entries.filter(e => e.isSquadGoals).length,
  }
}

/**
 * Get a user's crews.
 */
export function getUserCrews(crews: Crew[], userId: string): Crew[] {
  return crews.filter(c => c.memberIds.includes(userId))
}

/**
 * Get active crew check-ins for a venue.
 */
export function getActiveCrewCheckIns(checkIns: CrewCheckIn[], venueId: string): CrewCheckIn[] {
  return checkIns.filter(
    ci => ci.venueId === venueId && (ci.status === 'pending' || ci.status === 'active')
  )
}
