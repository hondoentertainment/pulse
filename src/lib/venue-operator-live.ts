export type GuestListStatus = 'open' | 'limited' | 'closed'
export type KitchenStatus = 'smooth' | 'busy' | 'slammed'

export interface VenueOperatorStatus {
  venueId: string
  updatedBy: string
  updatedAt: string
  guestListStatus: GuestListStatus | null
  tableMinimum: number | null
  doorNote?: string
  djStatus?: string
  kitchenStatus?: KitchenStatus | null
  special?: string
}

let operatorStatusStore: Record<string, VenueOperatorStatus> = {}

export function getVenueOperatorStatus(venueId: string): VenueOperatorStatus | null {
  return operatorStatusStore[venueId] ?? null
}

export function updateVenueOperatorStatus(
  venueId: string,
  updatedBy: string,
  updates: Partial<Omit<VenueOperatorStatus, 'venueId' | 'updatedBy' | 'updatedAt'>>
): VenueOperatorStatus {
  const next: VenueOperatorStatus = {
    venueId,
    updatedBy,
    updatedAt: new Date().toISOString(),
    guestListStatus: updates.guestListStatus ?? operatorStatusStore[venueId]?.guestListStatus ?? null,
    tableMinimum: updates.tableMinimum ?? operatorStatusStore[venueId]?.tableMinimum ?? null,
    doorNote: updates.doorNote ?? operatorStatusStore[venueId]?.doorNote,
    djStatus: updates.djStatus ?? operatorStatusStore[venueId]?.djStatus,
    kitchenStatus: updates.kitchenStatus ?? operatorStatusStore[venueId]?.kitchenStatus ?? null,
    special: updates.special ?? operatorStatusStore[venueId]?.special,
  }

  operatorStatusStore[venueId] = next
  return next
}

export function seedVenueOperatorStatus(venueId: string, venueName: string): VenueOperatorStatus {
  const existing = getVenueOperatorStatus(venueId)
  if (existing) return existing

  const hash = `${venueId}-${venueName}`.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
  const guestListStatus: GuestListStatus[] = ['open', 'limited', 'closed']
  const kitchenStatus: KitchenStatus[] = ['smooth', 'busy', 'slammed']
  const djMoments = [
    'DJ on now',
    'Headliner in 30 min',
    'Warm-up set rolling',
    'Open format till midnight',
  ]
  const doorNotes = [
    'Best odds before 11:00 PM',
    'Line is moving faster from the side entrance',
    'ID check is strict tonight',
    'Walk-ins still getting in',
  ]
  const specials = [
    'Free before 10:30 PM',
    'Half-off cocktails till 9',
    'Kitchen serving late menu',
    'Birthday table package still open',
  ]

  return updateVenueOperatorStatus(venueId, 'owner-demo', {
    guestListStatus: guestListStatus[hash % guestListStatus.length],
    tableMinimum: hash % 3 === 0 ? 300 : hash % 5 === 0 ? 500 : null,
    doorNote: doorNotes[hash % doorNotes.length],
    djStatus: djMoments[hash % djMoments.length],
    kitchenStatus: kitchenStatus[hash % kitchenStatus.length],
    special: specials[hash % specials.length],
  })
}

export function formatGuestListStatus(status: GuestListStatus | null): string | null {
  if (!status) return null
  if (status === 'open') return 'Guest list open'
  if (status === 'limited') return 'Guest list limited'
  return 'Guest list closed'
}

export function formatKitchenStatus(status: KitchenStatus | null | undefined): string | null {
  if (!status) return null
  if (status === 'smooth') return 'Kitchen moving smoothly'
  if (status === 'busy') return 'Kitchen running a little behind'
  return 'Kitchen is slammed'
}

export function clearVenueOperatorStatuses(): void {
  operatorStatusStore = {}
}
