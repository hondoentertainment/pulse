/**
 * Ticket data access.
 *
 * Tickets are strictly owner-readable via RLS. Lifecycle transitions
 * happen server-side via the ticketing Edge Functions.
 */

import { supabase } from '@/lib/supabase'

export type TicketStatus = 'pending' | 'paid' | 'refunded' | 'transferred' | 'cancelled'

export interface TicketRow {
  id: string
  event_id: string
  user_id: string
  ticket_type: string
  price_cents: number
  currency: string
  status: TicketStatus
  stripe_payment_intent: string | null
  qr_code_secret: string | null
  transferable_to_user_id: string | null
  created_at: string
  paid_at: string | null
  refunded_at: string | null
  transferred_at: string | null
}

export async function listMyTickets(userId: string): Promise<TicketRow[]> {
  const { data, error } = await supabase
    .from('tickets')
    .select('id, event_id, user_id, ticket_type, price_cents, currency, status, stripe_payment_intent, qr_code_secret, transferable_to_user_id, created_at, paid_at, refunded_at, transferred_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as TicketRow[]
}

export async function getTicket(ticketId: string): Promise<TicketRow | null> {
  const { data, error } = await supabase
    .from('tickets')
    .select('id, event_id, user_id, ticket_type, price_cents, currency, status, stripe_payment_intent, qr_code_secret, transferable_to_user_id, created_at, paid_at, refunded_at, transferred_at')
    .eq('id', ticketId)
    .maybeSingle()
  if (error) throw error
  return (data as unknown as TicketRow) ?? null
}
