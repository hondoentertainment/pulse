/**
 * Supabase data-access layer for the Safety Kit.
 *
 * Distinct from `src/lib/safety-client.ts`, which talks to the Edge Functions.
 * This module talks directly to Supabase tables for simple reads (contact list,
 * session history) that don't need server-side fan-out.
 *
 * All functions return `{ ok: true, data }` / `{ ok: false, error }` so callers
 * can branch on shape instead of catching exceptions.
 */

import { supabase } from '../supabase'
import {
  endSafetySession,
  pingSafetySession,
  startSafetySession,
  triggerSafetyPanic,
  type EndInput,
  type PingInput,
  type SafetyResult,
  type SafetySession,
  type StartSessionInput,
  type TriggerInput,
  type TriggerResult,
} from '../safety-client'

export interface EmergencyContact {
  id: string
  user_id: string
  name: string
  phone_e164: string
  relationship: string | null
  verified_at: string | null
  preferred_contact_method: 'sms' | 'push'
  created_at: string
  updated_at: string
}

export type Result<T> = SafetyResult<T>

function ok<T>(data: T): Result<T> {
  return { ok: true, data }
}

function err(error: string): Result<never> {
  return { ok: false, error }
}

// ---- emergency_contacts ------------------------------------------------

export async function listEmergencyContacts(userId: string): Promise<Result<EmergencyContact[]>> {
  try {
    const { data, error } = await supabase
      .from('emergency_contacts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
    if (error) return err(error.message)
    return ok((data ?? []) as EmergencyContact[])
  } catch (error) {
    return err(error instanceof Error ? error.message : 'network-error')
  }
}

export interface CreateContactInput {
  userId: string
  name: string
  phone_e164: string
  relationship?: string
  preferred_contact_method?: 'sms' | 'push'
}

export async function createEmergencyContact(input: CreateContactInput): Promise<Result<EmergencyContact>> {
  if (!/^\+[1-9][0-9]{6,14}$/.test(input.phone_e164)) {
    return err('invalid-phone-e164')
  }
  try {
    const { data, error } = await supabase
      .from('emergency_contacts')
      .insert({
        user_id: input.userId,
        name: input.name.trim(),
        phone_e164: input.phone_e164,
        relationship: input.relationship ?? null,
        preferred_contact_method: input.preferred_contact_method ?? 'sms',
      })
      .select()
      .single()
    if (error) return err(error.message)
    return ok(data as EmergencyContact)
  } catch (error) {
    return err(error instanceof Error ? error.message : 'network-error')
  }
}

export async function deleteEmergencyContact(contactId: string): Promise<Result<{ id: string }>> {
  try {
    const { error } = await supabase.from('emergency_contacts').delete().eq('id', contactId)
    if (error) return err(error.message)
    return ok({ id: contactId })
  } catch (error) {
    return err(error instanceof Error ? error.message : 'network-error')
  }
}

// ---- sessions (re-exported server wrappers) ----------------------------

export async function startSession(input: StartSessionInput): Promise<Result<SafetySession>> {
  return startSafetySession(input)
}

export async function pingSession(input: PingInput): Promise<Result<{ ok: boolean }>> {
  return pingSafetySession(input)
}

export async function endSession(input: EndInput): Promise<Result<SafetySession>> {
  return endSafetySession(input)
}

export async function triggerPanic(input: TriggerInput): Promise<Result<TriggerResult>> {
  return triggerSafetyPanic(input)
}

// ---- session history ---------------------------------------------------

export async function listRecentSessions(userId: string, limit: number = 20): Promise<Result<SafetySession[]>> {
  try {
    const { data, error } = await supabase
      .from('safety_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('starts_at', { ascending: false })
      .limit(limit)
    if (error) return err(error.message)
    return ok((data ?? []) as SafetySession[])
  } catch (error) {
    return err(error instanceof Error ? error.message : 'network-error')
  }
}

// ---- trusted rides -----------------------------------------------------

export interface TrustedRide {
  id: string
  user_id: string
  session_id: string | null
  provider: 'uber' | 'lyft'
  ride_id: string | null
  pickup_lat: number | null
  pickup_lng: number | null
  dropoff_lat: number | null
  dropoff_lng: number | null
  status: string
  created_at: string
  updated_at: string
}

export interface LogTrustedRideInput {
  userId: string
  provider: 'uber' | 'lyft'
  sessionId?: string
  pickup?: { lat: number; lng: number }
  dropoff?: { lat: number; lng: number }
  rideId?: string
}

export async function logTrustedRide(input: LogTrustedRideInput): Promise<Result<TrustedRide>> {
  try {
    const { data, error } = await supabase
      .from('trusted_rides')
      .insert({
        user_id: input.userId,
        provider: input.provider,
        session_id: input.sessionId ?? null,
        pickup_lat: input.pickup?.lat ?? null,
        pickup_lng: input.pickup?.lng ?? null,
        dropoff_lat: input.dropoff?.lat ?? null,
        dropoff_lng: input.dropoff?.lng ?? null,
        ride_id: input.rideId ?? null,
        status: 'requested',
      })
      .select()
      .single()
    if (error) return err(error.message)
    return ok(data as TrustedRide)
  } catch (error) {
    return err(error instanceof Error ? error.message : 'network-error')
  }
}
