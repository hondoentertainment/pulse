/**
 * WC-10 crew I'm-here. 2–4 people, one pinned venue.
 * Guests see nothing. A member of crew A does not see crew B.
 */

import { isPresenceActive } from '@/lib/here-now'

export interface CrewTonightMembership {
  ownerId: string
  venueId: string
  memberUserIds: readonly string[]
}

export interface CrewPresenceRow {
  userId: string
  venueId: string
  checkedInAt: string
  leftAt?: string | null
  username?: string | null
}

export function viewerInCrew(crew: CrewTonightMembership, viewerId: string): boolean {
  if (!viewerId) return false
  if (crew.ownerId === viewerId) return true
  return crew.memberUserIds.includes(viewerId)
}

export function crewMateIds(crew: CrewTonightMembership, viewerId: string): string[] {
  const ids = new Set<string>([crew.ownerId, ...crew.memberUserIds])
  ids.delete(viewerId)
  return [...ids]
}

/**
 * I'm-here rows the viewer may see at this pinned venue.
 * Empty for guests and for crews the viewer is not in.
 */
export function crewImHereForViewer(input: {
  viewerId: string | null | undefined
  crews: readonly CrewTonightMembership[]
  presence: readonly CrewPresenceRow[]
  venueId: string
  nowMs?: number
}): CrewPresenceRow[] {
  const viewerId = input.viewerId ?? ''
  if (!viewerId) return []
  const nowMs = input.nowMs ?? Date.now()
  const allowed = new Set<string>()
  for (const crew of input.crews) {
    if (crew.venueId !== input.venueId) continue
    if (!viewerInCrew(crew, viewerId)) continue
    for (const id of crewMateIds(crew, viewerId)) allowed.add(id)
  }
  if (allowed.size === 0) return []
  const seen = new Set<string>()
  const visible: CrewPresenceRow[] = []
  for (const row of input.presence) {
    if (row.venueId !== input.venueId) continue
    if (!allowed.has(row.userId) || seen.has(row.userId)) continue
    if (!isPresenceActive(row.checkedInAt, row.leftAt, nowMs)) continue
    seen.add(row.userId)
    visible.push(row)
  }
  return visible
}

export function formatCrewImHere(people: readonly { username?: string | null }[]): string {
  const names = people.map((person) => person.username?.trim() || 'Crew member')
  if (names.length === 0) return ''
  if (names.length === 1) return `${names[0]} is here`
  if (names.length === 2) return `${names[0]} and ${names[1]} are here`
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]} are here`
}
