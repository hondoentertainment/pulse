/**
 * Table & VIP Reservation System
 *
 * Available tables per venue, time slot management,
 * deposit calculation, availability checking, and booking confirmation.
 */

export type TableLocation = 'main_floor' | 'vip' | 'rooftop' | 'patio'

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'

export interface VenueTable {
  id: string
  venueId: string
  tableNumber: string
  location: TableLocation
  capacity: number
  minimumSpend: number
  description: string
}

export interface TimeSlot {
  start: string
  end: string
  label: string
}

export interface TableReservation {
  id: string
  venueId: string
  tableId: string
  userId: string
  date: string
  timeSlot: TimeSlot
  partySize: number
  tableNumber: string
  minimumSpend: number
  deposit: number
  status: BookingStatus
  specialRequests: string
  qrCode: string
  createdAt: string
}

export const TABLE_LOCATION_CONFIG: Record<TableLocation, { label: string; emoji: string }> = {
  main_floor: { label: 'Main Floor', emoji: '🎵' },
  vip: { label: 'VIP Section', emoji: '⭐' },
  rooftop: { label: 'Rooftop', emoji: '🌃' },
  patio: { label: 'Patio', emoji: '🌿' },
}

/**
 * Generate standard 2-hour time slots for a venue's evening hours.
 */
export function generateTimeSlots(date: string): TimeSlot[] {
  const slots: TimeSlot[] = [
    { start: `${date}T18:00:00`, end: `${date}T20:00:00`, label: '6:00 PM - 8:00 PM' },
    { start: `${date}T20:00:00`, end: `${date}T22:00:00`, label: '8:00 PM - 10:00 PM' },
    { start: `${date}T22:00:00`, end: `${date}T00:00:00`, label: '10:00 PM - 12:00 AM' },
    { start: `${date}T00:00:00`, end: `${date}T02:00:00`, label: '12:00 AM - 2:00 AM' },
  ]
  return slots
}

/**
 * Get default tables for a venue. In production, this would be
 * venue-specific data from the backend.
 */
export function getDefaultVenueTables(venueId: string): VenueTable[] {
  return [
    {
      id: `tbl-${venueId}-1`,
      venueId,
      tableNumber: 'T1',
      location: 'main_floor',
      capacity: 4,
      minimumSpend: 200,
      description: 'Intimate table near the dance floor',
    },
    {
      id: `tbl-${venueId}-2`,
      venueId,
      tableNumber: 'T2',
      location: 'main_floor',
      capacity: 6,
      minimumSpend: 350,
      description: 'Prime spot with stage view',
    },
    {
      id: `tbl-${venueId}-3`,
      venueId,
      tableNumber: 'V1',
      location: 'vip',
      capacity: 8,
      minimumSpend: 750,
      description: 'VIP booth with bottle service',
    },
    {
      id: `tbl-${venueId}-4`,
      venueId,
      tableNumber: 'V2',
      location: 'vip',
      capacity: 10,
      minimumSpend: 1200,
      description: 'Premium VIP section with private bar access',
    },
    {
      id: `tbl-${venueId}-5`,
      venueId,
      tableNumber: 'R1',
      location: 'rooftop',
      capacity: 6,
      minimumSpend: 500,
      description: 'Rooftop lounge with city views',
    },
    {
      id: `tbl-${venueId}-6`,
      venueId,
      tableNumber: 'P1',
      location: 'patio',
      capacity: 4,
      minimumSpend: 150,
      description: 'Relaxed outdoor patio seating',
    },
  ]
}

/**
 * Calculate deposit amount (50% of minimum spend).
 */
export function calculateDeposit(minimumSpend: number): number {
  return Math.round(minimumSpend * 0.5 * 100) / 100
}

/**
 * Check table availability for a given date and time slot.
 * Returns tables that are not booked for that slot.
 */
export function getAvailableTables(
  venueTables: VenueTable[],
  existingReservations: TableReservation[],
  date: string,
  timeSlot: TimeSlot,
  partySize: number
): VenueTable[] {
  const bookedTableIds = new Set(
    existingReservations
      .filter(r =>
        r.date === date &&
        r.timeSlot.start === timeSlot.start &&
        (r.status === 'confirmed' || r.status === 'pending')
      )
      .map(r => r.tableId)
  )

  return venueTables.filter(t =>
    !bookedTableIds.has(t.id) &&
    t.capacity >= partySize
  )
}

/**
 * Generate a QR code string for a table reservation.
 */
function generateBookingQR(reservationId: string, venueId: string, userId: string): string {
  const payload = `PULSE-TBL:${reservationId}:${venueId}:${userId}:${Date.now()}`
  return btoa(payload)
}

/**
 * Create a table reservation.
 */
export function createTableReservation(
  venueId: string,
  tableId: string,
  userId: string,
  date: string,
  timeSlot: TimeSlot,
  partySize: number,
  tableNumber: string,
  minimumSpend: number,
  specialRequests: string = ''
): TableReservation {
  const id = `res-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const deposit = calculateDeposit(minimumSpend)
  const qrCode = generateBookingQR(id, venueId, userId)

  return {
    id,
    venueId,
    tableId,
    userId,
    date,
    timeSlot,
    partySize,
    tableNumber,
    minimumSpend,
    deposit,
    status: 'confirmed',
    specialRequests,
    qrCode,
    createdAt: new Date().toISOString(),
  }
}

/**
 * Cancel a table reservation.
 */
export function cancelReservation(reservation: TableReservation): TableReservation {
  return { ...reservation, status: 'cancelled' }
}

/**
 * Get user's reservations.
 */
export function getUserReservations(
  reservations: TableReservation[],
  userId: string
): TableReservation[] {
  return reservations.filter(r => r.userId === userId && r.status !== 'cancelled')
}

/**
 * Get upcoming reservations for a user.
 */
export function getUpcomingReservations(
  reservations: TableReservation[],
  userId: string
): TableReservation[] {
  const now = Date.now()
  return reservations
    .filter(r =>
      r.userId === userId &&
      (r.status === 'confirmed' || r.status === 'pending') &&
      new Date(r.timeSlot.end).getTime() > now
    )
    .sort((a, b) =>
      new Date(a.timeSlot.start).getTime() - new Date(b.timeSlot.start).getTime()
    )
}

/**
 * Get past reservations for a user.
 */
export function getPastReservations(
  reservations: TableReservation[],
  userId: string
): TableReservation[] {
  const now = Date.now()
  return reservations
    .filter(r =>
      r.userId === userId &&
      (r.status === 'completed' || r.status === 'confirmed') &&
      new Date(r.timeSlot.end).getTime() <= now
    )
    .sort((a, b) =>
      new Date(b.timeSlot.start).getTime() - new Date(a.timeSlot.start).getTime()
    )
}
