/**
 * Local UI types for the safety components. They intentionally mirror a subset
 * of the types exported from `src/lib/safety-client.ts` so UI code can be
 * tested without depending on the real Edge Function wrappers.
 */

export type SafetySessionKind = 'safe_walk' | 'share_night' | 'panic'

export interface SafetyContactSnapshot {
  id: string
  name: string
  phone_e164: string
  method: 'sms' | 'push'
  verified_at?: string | null
}

export interface StartArgs {
  kind: SafetySessionKind
  expectedDurationMinutes: number
  destination?: {
    venueId?: string
    lat?: number
    lng?: number
    label?: string
  }
  contacts: SafetyContactSnapshot[]
  notes?: string
}
