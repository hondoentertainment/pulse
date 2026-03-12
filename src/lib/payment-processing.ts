/**
 * Payment Processing — Abstraction Layer
 *
 * Stripe-like mock payment interface, split payments,
 * fee calculation, status tracking, and venue revenue reporting.
 */

export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded'

export type PaymentType = 'ticket' | 'table_booking' | 'transfer'

export interface PaymentIntent {
  id: string
  amount: number
  currency: string
  status: PaymentStatus
  type: PaymentType
  userId: string
  venueId: string
  eventId?: string
  platformFee: number
  venueRevenue: number
  metadata: Record<string, string>
  createdAt: string
  completedAt?: string
}

export interface SplitPaymentGroup {
  id: string
  paymentIntentId: string
  totalAmount: number
  members: SplitPaymentMember[]
  status: 'pending' | 'partial' | 'completed'
  createdAt: string
}

export interface SplitPaymentMember {
  userId: string
  amount: number
  paid: boolean
  paidAt?: string
}

export interface VenueRevenueReport {
  venueId: string
  period: string
  ticketRevenue: number
  tableBookingRevenue: number
  totalRevenue: number
  platformFees: number
  netRevenue: number
  ticketsSold: number
  tableBookings: number
  averageTicketPrice: number
}

/**
 * Platform commission rates.
 */
export const COMMISSION_RATES = {
  ticket: 0.07,       // 7% on tickets
  table_booking: 0.05, // 5% on table bookings
  transfer: 0.05,      // 5% on transfers
} as const

/**
 * Calculate platform fee for a payment.
 */
export function calculatePlatformFee(amount: number, type: PaymentType): number {
  const rate = COMMISSION_RATES[type]
  return Math.round(amount * rate * 100) / 100
}

/**
 * Calculate venue revenue after platform fee.
 */
export function calculateVenueRevenue(amount: number, type: PaymentType): number {
  const fee = calculatePlatformFee(amount, type)
  return Math.round((amount - fee) * 100) / 100
}

/**
 * Create a payment intent (Stripe-like mock).
 */
export function createPaymentIntent(
  amount: number,
  type: PaymentType,
  userId: string,
  venueId: string,
  eventId?: string,
  metadata: Record<string, string> = {}
): PaymentIntent {
  const platformFee = calculatePlatformFee(amount, type)
  const venueRevenue = calculateVenueRevenue(amount, type)

  return {
    id: `pi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    amount,
    currency: 'usd',
    status: 'pending',
    type,
    userId,
    venueId,
    eventId,
    platformFee,
    venueRevenue,
    metadata,
    createdAt: new Date().toISOString(),
  }
}

/**
 * Process a payment (mock — always succeeds after brief delay simulation).
 */
export function processPayment(intent: PaymentIntent): PaymentIntent {
  return {
    ...intent,
    status: 'succeeded',
    completedAt: new Date().toISOString(),
  }
}

/**
 * Refund a payment.
 */
export function refundPayment(intent: PaymentIntent, amount?: number): PaymentIntent {
  const refundAmount = amount ?? intent.amount
  return {
    ...intent,
    status: 'refunded',
    amount: refundAmount,
    completedAt: new Date().toISOString(),
  }
}

/**
 * Create a split payment group for dividing cost among users.
 */
export function createSplitPayment(
  paymentIntentId: string,
  totalAmount: number,
  memberUserIds: string[]
): SplitPaymentGroup {
  const perPerson = Math.round((totalAmount / memberUserIds.length) * 100) / 100

  // Adjust last member to handle rounding
  const members: SplitPaymentMember[] = memberUserIds.map((userId, i) => ({
    userId,
    amount: i === memberUserIds.length - 1
      ? Math.round((totalAmount - perPerson * (memberUserIds.length - 1)) * 100) / 100
      : perPerson,
    paid: false,
  }))

  return {
    id: `split-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    paymentIntentId,
    totalAmount,
    members,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }
}

/**
 * Record a member's payment in a split group.
 */
export function recordSplitMemberPayment(
  group: SplitPaymentGroup,
  userId: string
): SplitPaymentGroup {
  const members = group.members.map(m =>
    m.userId === userId ? { ...m, paid: true, paidAt: new Date().toISOString() } : m
  )

  const allPaid = members.every(m => m.paid)
  const somePaid = members.some(m => m.paid)

  return {
    ...group,
    members,
    status: allPaid ? 'completed' : somePaid ? 'partial' : 'pending',
  }
}

/**
 * Generate a venue revenue report from payment history.
 */
export function generateRevenueReport(
  venueId: string,
  payments: PaymentIntent[],
  period: string
): VenueRevenueReport {
  const venuePayments = payments.filter(
    p => p.venueId === venueId && p.status === 'succeeded'
  )

  const ticketPayments = venuePayments.filter(p => p.type === 'ticket')
  const tablePayments = venuePayments.filter(p => p.type === 'table_booking')

  const ticketRevenue = ticketPayments.reduce((sum, p) => sum + p.amount, 0)
  const tableBookingRevenue = tablePayments.reduce((sum, p) => sum + p.amount, 0)
  const totalRevenue = ticketRevenue + tableBookingRevenue
  const platformFees = venuePayments.reduce((sum, p) => sum + p.platformFee, 0)
  const netRevenue = venuePayments.reduce((sum, p) => sum + p.venueRevenue, 0)

  return {
    venueId,
    period,
    ticketRevenue: Math.round(ticketRevenue * 100) / 100,
    tableBookingRevenue: Math.round(tableBookingRevenue * 100) / 100,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    platformFees: Math.round(platformFees * 100) / 100,
    netRevenue: Math.round(netRevenue * 100) / 100,
    ticketsSold: ticketPayments.length,
    tableBookings: tablePayments.length,
    averageTicketPrice: ticketPayments.length > 0
      ? Math.round((ticketRevenue / ticketPayments.length) * 100) / 100
      : 0,
  }
}

/**
 * Format a price for display.
 */
export function formatPrice(amount: number): string {
  return `$${amount.toFixed(2)}`
}
