/**
 * User-submitted catalog quality signals (not live door intel).
 * Signed-in Pulse users recommend corrections via structured proposed fields.
 */

export const VENUE_DATA_REPORT_REASONS = [
  'wrong_hours',
  'wrong_address',
  'wrong_phone',
  'venue_closed',
  'missing_info',
  'menu_missing',
  'menu_outdated',
  'pricing_outdated',
  'other',
] as const

export type VenueDataReportReason = (typeof VENUE_DATA_REPORT_REASONS)[number]

export const VENUE_DATA_REPORT_LABELS: Record<VenueDataReportReason, string> = {
  wrong_hours: 'Hours are wrong',
  wrong_address: 'Address is wrong',
  wrong_phone: 'Phone is wrong',
  venue_closed: 'Venue is closed / permanently shut',
  missing_info: 'Missing important info',
  menu_missing: 'No menu listed',
  menu_outdated: 'Menu looks outdated',
  pricing_outdated: 'Pricing looks outdated',
  other: 'Something else',
}

/** Structured correction suggestions a signed-in user can propose. */
export const VENUE_PROPOSED_FIELD_KEYS = [
  'hours',
  'address',
  'phone',
  'website',
  'name',
] as const

export type VenueProposedFieldKey = (typeof VENUE_PROPOSED_FIELD_KEYS)[number]

export type VenueProposedFields = Partial<Record<VenueProposedFieldKey, string>>

export const VENUE_PROPOSED_FIELD_LABELS: Record<VenueProposedFieldKey, string> = {
  hours: 'Suggested hours',
  address: 'Suggested address',
  phone: 'Suggested phone',
  website: 'Suggested website',
  name: 'Suggested name',
}

export type VenuePriceRange = 1 | 2 | 3 | 4

export const PRICE_RANGE_OPTIONS: { value: VenuePriceRange; label: string; hint: string }[] = [
  { value: 1, label: '$', hint: 'Cheap drinks / low cover' },
  { value: 2, label: '$$', hint: 'Typical nightlife prices' },
  { value: 3, label: '$$$', hint: 'Upscale / pricey' },
  { value: 4, label: '$$$$', hint: 'Very expensive' },
]

export interface VenueDataReport {
  id: string
  venueId: string
  userId: string
  reason: VenueDataReportReason
  note?: string
  menuUrl?: string
  priceRange?: VenuePriceRange
  proposedFields?: VenueProposedFields
  createdAt: string
  status: 'pending' | 'reviewed' | 'actioned' | 'dismissed'
}

const PROPOSED_FIELD_MAX: Record<VenueProposedFieldKey, number> = {
  hours: 500,
  address: 300,
  phone: 40,
  website: 2048,
  name: 120,
}

/** Normalize and validate proposed correction fields. Empty object → undefined. */
export function normalizeProposedFields(
  input: unknown,
): { ok: true; value?: VenueProposedFields } | { ok: false; errors: string[] } {
  if (input === undefined || input === null) return { ok: true, value: undefined }
  if (typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: ['proposedFields must be an object'] }
  }

  const raw = input as Record<string, unknown>
  const errors: string[] = []
  const value: VenueProposedFields = {}

  for (const key of Object.keys(raw)) {
    if (!(VENUE_PROPOSED_FIELD_KEYS as readonly string[]).includes(key)) {
      errors.push(`proposedFields.${key} is not a supported field`)
    }
  }

  for (const key of VENUE_PROPOSED_FIELD_KEYS) {
    const entry = raw[key]
    if (entry === undefined || entry === null || entry === '') continue
    if (typeof entry !== 'string') {
      errors.push(`proposedFields.${key} must be a string`)
      continue
    }
    const trimmed = entry.trim()
    if (!trimmed) continue
    if (trimmed.length > PROPOSED_FIELD_MAX[key]) {
      errors.push(`proposedFields.${key} must be at most ${PROPOSED_FIELD_MAX[key]} characters`)
      continue
    }
    value[key] = trimmed
  }

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, value: Object.keys(value).length > 0 ? value : undefined }
}

export function summarizeVenueHours(
  hours?: {
    monday?: string
    tuesday?: string
    wednesday?: string
    thursday?: string
    friday?: string
    saturday?: string
    sunday?: string
  } | null,
): string | undefined {
  if (!hours) return undefined
  const parts = Object.entries(hours)
    .filter(([, value]) => typeof value === 'string' && value.trim())
    .map(([day, value]) => `${day.slice(0, 3)} ${value}`)
  return parts.length > 0 ? parts.join(' · ') : undefined
}

export function createLocalVenueDataReport(
  venueId: string,
  userId: string,
  reason: VenueDataReportReason,
  extras?: {
    note?: string
    menuUrl?: string
    priceRange?: VenuePriceRange
    proposedFields?: VenueProposedFields
  },
): VenueDataReport {
  return {
    id: `vdr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    venueId,
    userId,
    reason,
    note: extras?.note,
    menuUrl: extras?.menuUrl,
    priceRange: extras?.priceRange,
    proposedFields: extras?.proposedFields,
    createdAt: new Date().toISOString(),
    status: 'pending',
  }
}

export async function submitVenueDataReport(input: {
  venueId: string
  reason: VenueDataReportReason
  note?: string
  menuUrl?: string
  priceRange?: VenuePriceRange
  proposedFields?: VenueProposedFields
  accessToken?: string | null
}): Promise<{ ok: true; report: VenueDataReport } | { ok: false; error: string }> {
  if (!input.accessToken) {
    return { ok: false, error: 'Sign in with your Pulse account to suggest a correction.' }
  }

  const normalized = normalizeProposedFields(input.proposedFields)
  if (!normalized.ok) {
    return { ok: false, error: normalized.errors.join('; ') }
  }

  try {
    const res = await fetch('/api/venues/data-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${input.accessToken}`,
      },
      body: JSON.stringify({
        venueId: input.venueId,
        reason: input.reason,
        note: input.note,
        menuUrl: input.menuUrl,
        priceRange: input.priceRange,
        proposedFields: normalized.value,
      }),
    })

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as
        | { message?: string; error?: { message?: string } | string }
        | null
      const message =
        (typeof body?.error === 'string'
          ? body.error
          : body?.error?.message) ??
        body?.message ??
        (res.status === 401
          ? 'Sign in with your Pulse account to suggest a correction.'
          : `Request failed (${res.status})`)
      return { ok: false, error: message }
    }

    const body = (await res.json()) as {
      data?: {
        id: string
        venue_id: string
        user_id: string
        reason: VenueDataReportReason
        note?: string | null
        menu_url?: string | null
        price_range?: VenuePriceRange | null
        proposed_fields?: VenueProposedFields | null
        status?: VenueDataReport['status']
        created_at?: string
      }
    }

    const row = body.data
    if (!row) {
      return {
        ok: true,
        report: createLocalVenueDataReport(input.venueId, 'server', input.reason, {
          note: input.note,
          menuUrl: input.menuUrl,
          priceRange: input.priceRange,
          proposedFields: normalized.value,
        }),
      }
    }

    return {
      ok: true,
      report: {
        id: row.id,
        venueId: row.venue_id,
        userId: row.user_id,
        reason: row.reason,
        note: row.note ?? undefined,
        menuUrl: row.menu_url ?? undefined,
        priceRange: row.price_range ?? undefined,
        proposedFields: row.proposed_fields ?? undefined,
        createdAt: row.created_at ?? new Date().toISOString(),
        status: row.status ?? 'pending',
      },
    }
  } catch {
    return { ok: false, error: 'Could not reach the server. Check your connection and try again.' }
  }
}
