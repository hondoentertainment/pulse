/**
 * Ticketing & Reservations Engine
 *
 * Ticket types, dynamic pricing, purchase flow,
 * transfer system, group splitting, and refund policy.
 */

export type TicketType = 'general_admission' | 'vip' | 'table_reservation' | 'guest_list'

export type TicketStatus = 'available' | 'reserved' | 'purchased' | 'used' | 'refunded' | 'transferred'

export interface TicketTransferRecord {
  fromUserId: string
  toUserId: string
  price: number
  transferredAt: string
}

export interface Ticket {
  id: string
  eventId: string
  venueId: string
  userId: string
  type: TicketType
  price: number
  originalPrice: number
  status: TicketStatus
  purchasedAt: string
  qrCode: string
  transferable: boolean
  transferHistory: TicketTransferRecord[]
  reservedUntil?: string
  groupOrderId?: string
}

export interface TicketTier {
  type: TicketType
  label: string
  description: string
  basePrice: number
  available: number
  total: number
  perks: string[]
}

export interface GroupOrder {
  id: string
  eventId: string
  creatorUserId: string
  memberUserIds: string[]
  ticketType: TicketType
  totalPrice: number
  perPersonPrice: number
  splits: Record<string, { amount: number; paid: boolean }>
  status: 'pending' | 'partial' | 'completed' | 'cancelled'
  createdAt: string
}

export interface RefundRequest {
  id: string
  ticketId: string
  userId: string
  reason: string
  refundAmount: number
  refundPercentage: number
  status: 'pending' | 'approved' | 'denied'
  createdAt: string
}

export const TICKET_TYPE_CONFIG: Record<TicketType, { label: string; emoji: string }> = {
  general_admission: { label: 'General Admission', emoji: '🎫' },
  vip: { label: 'VIP', emoji: '⭐' },
  table_reservation: { label: 'Table Reservation', emoji: '🍾' },
  guest_list: { label: 'Guest List', emoji: '📋' },
}

/**
 * Calculate dynamic pricing based on demand, time, and inventory.
 *
 * Price increases as demand rises and inventory drops.
 * Maximum price multiplier is 2x base price.
 */
export function calculateDynamicPrice(
  basePrice: number,
  demandScore: number,
  timeUntilEvent: number,
  inventoryRemaining: number,
  totalInventory: number
): { price: number; multiplier: number; demandLevel: 'low' | 'moderate' | 'high' | 'surge' } {
  // Demand factor: 0-1 scale, higher demand = higher price
  const demandFactor = Math.min(demandScore / 100, 1)

  // Time factor: closer to event = higher price (exponential decay)
  const hoursUntil = timeUntilEvent / (1000 * 60 * 60)
  const timeFactor = hoursUntil <= 0 ? 1 : Math.max(0, 1 - (hoursUntil / 168)) // 168h = 1 week

  // Scarcity factor: less inventory = higher price
  const inventoryRatio = totalInventory > 0 ? inventoryRemaining / totalInventory : 1
  const scarcityFactor = 1 - inventoryRatio

  // Combined multiplier (weighted)
  const rawMultiplier = 1 + (demandFactor * 0.4 + timeFactor * 0.3 + scarcityFactor * 0.3)
  const multiplier = Math.min(rawMultiplier, 2.0) // Cap at 2x

  const price = Math.round(basePrice * multiplier * 100) / 100

  let demandLevel: 'low' | 'moderate' | 'high' | 'surge'
  if (multiplier < 1.15) demandLevel = 'low'
  else if (multiplier < 1.4) demandLevel = 'moderate'
  else if (multiplier < 1.7) demandLevel = 'high'
  else demandLevel = 'surge'

  return { price, multiplier, demandLevel }
}

/**
 * Generate a mock QR code string for a ticket.
 */
export function generateTicketQR(ticketId: string, eventId: string, userId: string): string {
  const payload = `PULSE-TKT:${ticketId}:${eventId}:${userId}:${Date.now()}`
  // In production, this would be an actual QR code. For now, return a unique string.
  return btoa(payload)
}

/**
 * Reserve a ticket (hold for 10 minutes before purchase confirmation).
 */
export function reserveTicket(
  eventId: string,
  venueId: string,
  userId: string,
  type: TicketType,
  price: number,
  transferable: boolean = true
): Ticket {
  const id = `tkt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const now = new Date()
  const reservedUntil = new Date(now.getTime() + 10 * 60 * 1000) // 10 min hold

  return {
    id,
    eventId,
    venueId,
    userId,
    type,
    price,
    originalPrice: price,
    status: 'reserved',
    purchasedAt: '',
    qrCode: '',
    transferable,
    transferHistory: [],
    reservedUntil: reservedUntil.toISOString(),
  }
}

/**
 * Confirm purchase of a reserved ticket.
 */
export function confirmPurchase(ticket: Ticket): Ticket {
  const qrCode = generateTicketQR(ticket.id, ticket.eventId, ticket.userId)
  return {
    ...ticket,
    status: 'purchased',
    purchasedAt: new Date().toISOString(),
    qrCode,
    reservedUntil: undefined,
  }
}

/**
 * Mark a ticket as used (scanned at venue).
 */
export function markTicketUsed(ticket: Ticket): Ticket {
  return { ...ticket, status: 'used' }
}

/**
 * Initiate a ticket transfer. Anti-scalping rules:
 * - Max 1 transfer per ticket
 * - Price cap at 110% of original price
 */
export function initiateTransfer(
  ticket: Ticket,
  toUserId: string,
  transferPrice: number
): { success: boolean; ticket?: Ticket; error?: string } {
  if (ticket.status !== 'purchased') {
    return { success: false, error: 'Only purchased tickets can be transferred' }
  }

  if (!ticket.transferable) {
    return { success: false, error: 'This ticket is not transferable' }
  }

  if (ticket.transferHistory.length >= 1) {
    return { success: false, error: 'This ticket has already been transferred once (anti-scalping limit)' }
  }

  const maxPrice = ticket.originalPrice * 1.1
  if (transferPrice > maxPrice) {
    return {
      success: false,
      error: `Transfer price cannot exceed $${maxPrice.toFixed(2)} (110% of original price)`,
    }
  }

  if (toUserId === ticket.userId) {
    return { success: false, error: 'Cannot transfer to yourself' }
  }

  const transferRecord: TicketTransferRecord = {
    fromUserId: ticket.userId,
    toUserId,
    price: transferPrice,
    transferredAt: new Date().toISOString(),
  }

  const newQr = generateTicketQR(ticket.id, ticket.eventId, toUserId)

  return {
    success: true,
    ticket: {
      ...ticket,
      userId: toUserId,
      status: 'purchased',
      qrCode: newQr,
      transferHistory: [...ticket.transferHistory, transferRecord],
    },
  }
}

/**
 * Accept a transfer — alias for finalization. In a real system
 * there would be an intermediate pending step.
 */
export function acceptTransfer(ticket: Ticket): Ticket {
  return { ...ticket, status: 'purchased' }
}

/**
 * Create a group order for splitting ticket costs among crew members.
 */
export function createGroupOrder(
  eventId: string,
  creatorUserId: string,
  memberUserIds: string[],
  ticketType: TicketType,
  pricePerTicket: number
): GroupOrder {
  const allMembers = [creatorUserId, ...memberUserIds.filter(id => id !== creatorUserId)]
  const totalPrice = pricePerTicket * allMembers.length
  const perPersonPrice = Math.round((totalPrice / allMembers.length) * 100) / 100

  const splits: Record<string, { amount: number; paid: boolean }> = {}
  for (const memberId of allMembers) {
    splits[memberId] = { amount: perPersonPrice, paid: false }
  }

  return {
    id: `grp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    eventId,
    creatorUserId,
    memberUserIds: allMembers,
    ticketType,
    totalPrice,
    perPersonPrice,
    splits,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }
}

/**
 * Record a member's payment in a group order.
 */
export function splitPayment(
  groupOrder: GroupOrder,
  userId: string
): GroupOrder {
  if (!groupOrder.splits[userId]) return groupOrder

  const updatedSplits = {
    ...groupOrder.splits,
    [userId]: { ...groupOrder.splits[userId], paid: true },
  }

  const allPaid = Object.values(updatedSplits).every(s => s.paid)
  const somePaid = Object.values(updatedSplits).some(s => s.paid)

  return {
    ...groupOrder,
    splits: updatedSplits,
    status: allPaid ? 'completed' : somePaid ? 'partial' : 'pending',
  }
}

/**
 * Request a refund. Tiered policy:
 * - >48h before event: 100% refund
 * - >24h before event: 50% refund
 * - <24h before event: no refund (0%)
 */
export function requestRefund(
  ticket: Ticket,
  eventStartTime: string,
  reason: string
): RefundRequest {
  const now = Date.now()
  const eventStart = new Date(eventStartTime).getTime()
  const hoursUntilEvent = (eventStart - now) / (1000 * 60 * 60)

  let refundPercentage: number
  if (hoursUntilEvent > 48) {
    refundPercentage = 100
  } else if (hoursUntilEvent > 24) {
    refundPercentage = 50
  } else {
    refundPercentage = 0
  }

  const refundAmount = Math.round((ticket.price * refundPercentage) / 100 * 100) / 100

  return {
    id: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ticketId: ticket.id,
    userId: ticket.userId,
    reason,
    refundAmount,
    refundPercentage,
    status: refundPercentage > 0 ? 'approved' : 'denied',
    createdAt: new Date().toISOString(),
  }
}

/**
 * Apply a refund to a ticket.
 */
export function applyRefund(ticket: Ticket): Ticket {
  return { ...ticket, status: 'refunded' }
}

/**
 * Get the refund eligibility info for a ticket.
 */
export function getRefundEligibility(
  eventStartTime: string
): { eligible: boolean; percentage: number; label: string } {
  const now = Date.now()
  const eventStart = new Date(eventStartTime).getTime()
  const hoursUntilEvent = (eventStart - now) / (1000 * 60 * 60)

  if (hoursUntilEvent > 48) {
    return { eligible: true, percentage: 100, label: 'Full refund available' }
  } else if (hoursUntilEvent > 24) {
    return { eligible: true, percentage: 50, label: '50% refund available' }
  } else {
    return { eligible: false, percentage: 0, label: 'No refund available' }
  }
}

/**
 * Get default ticket tiers for an event.
 */
export function getDefaultTicketTiers(coverCharge?: number): TicketTier[] {
  const baseGA = coverCharge ?? 25

  return [
    {
      type: 'general_admission',
      label: 'General Admission',
      description: 'Standard entry to the event',
      basePrice: baseGA,
      available: 200,
      total: 200,
      perks: ['Entry to event', 'Access to main floor'],
    },
    {
      type: 'vip',
      label: 'VIP',
      description: 'Premium experience with exclusive perks',
      basePrice: baseGA * 3,
      available: 50,
      total: 50,
      perks: ['Priority entry', 'VIP lounge access', 'Complimentary drink', 'Skip the line'],
    },
    {
      type: 'guest_list',
      label: 'Guest List',
      description: 'Reduced cover with early arrival',
      basePrice: Math.round(baseGA * 0.6),
      available: 100,
      total: 100,
      perks: ['Reduced cover', 'Must arrive before 11 PM'],
    },
  ]
}

/**
 * Get user's tickets for an event.
 */
export function getUserTickets(tickets: Ticket[], userId: string): Ticket[] {
  return tickets.filter(t => t.userId === userId && t.status !== 'refunded')
}

/**
 * Get upcoming tickets (purchased, for future events).
 */
export function getUpcomingTickets(
  tickets: Ticket[],
  userId: string,
  events: { id: string; startTime: string }[]
): Ticket[] {
  const now = Date.now()
  const futureEventIds = new Set(
    events
      .filter(e => new Date(e.startTime).getTime() > now)
      .map(e => e.id)
  )

  return tickets
    .filter(t =>
      t.userId === userId &&
      (t.status === 'purchased' || t.status === 'reserved') &&
      futureEventIds.has(t.eventId)
    )
}

/**
 * Get past tickets.
 */
export function getPastTickets(
  tickets: Ticket[],
  userId: string,
  events: { id: string; startTime: string }[]
): Ticket[] {
  const now = Date.now()
  const pastEventIds = new Set(
    events
      .filter(e => new Date(e.startTime).getTime() <= now)
      .map(e => e.id)
  )

  return tickets
    .filter(t =>
      t.userId === userId &&
      (t.status === 'purchased' || t.status === 'used') &&
      pastEventIds.has(t.eventId)
    )
}
