/**
 * Event data access.
 *
 * Thin wrappers over Supabase that return the ticketing-aware event shape.
 * Reads respect RLS (anon/public SELECT is allowed for published events).
 */

import { supabase } from '@/lib/supabase'

export interface TicketingTicketType {
  name: string
  price_cents: number
  qty: number
  remaining: number
}

export interface TicketingEventRow {
  id: string
  venue_id: string
  title: string
  starts_at: string | null
  ends_at: string | null
  cover_price_cents: number
  capacity: number | null
  ticket_types: TicketingTicketType[]
  currency: string
  status: 'draft' | 'published' | 'sold_out' | 'cancelled' | 'completed'
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export async function listEventsForVenue(venueId: string): Promise<TicketingEventRow[]> {
  const { data, error } = await supabase
    .from('events')
    .select('id, venue_id, title, starts_at, ends_at, cover_price_cents, capacity, ticket_types, currency, status, created_at, updated_at, deleted_at')
    .eq('venue_id', venueId)
    .is('deleted_at', null)
    .order('starts_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as TicketingEventRow[]
}

export async function getEvent(eventId: string): Promise<TicketingEventRow | null> {
  const { data, error } = await supabase
    .from('events')
    .select('id, venue_id, title, starts_at, ends_at, cover_price_cents, capacity, ticket_types, currency, status, created_at, updated_at, deleted_at')
    .eq('id', eventId)
    .maybeSingle()
  if (error) throw error
  return (data as unknown as TicketingEventRow) ?? null
}
