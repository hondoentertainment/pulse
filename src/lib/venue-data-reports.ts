/**
 * User-submitted catalog quality signals (not live door intel).
 * Used for "something's wrong", menu gaps, and static pricing flags.
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
  createdAt: string
  status: 'pending' | 'reviewed' | 'actioned' | 'dismissed'
}

export function createLocalVenueDataReport(
  venueId: string,
  userId: string,
  reason: VenueDataReportReason,
  extras?: { note?: string; menuUrl?: string; priceRange?: VenuePriceRange },
): VenueDataReport {
  return {
    id: `vdr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    venueId,
    userId,
    reason,
    note: extras?.note,
    menuUrl: extras?.menuUrl,
    priceRange: extras?.priceRange,
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
  accessToken?: string | null
}): Promise<{ ok: true; report: VenueDataReport } | { ok: false; error: string }> {
  const local = createLocalVenueDataReport('pending', 'pending', input.reason, {
    note: input.note,
    menuUrl: input.menuUrl,
    priceRange: input.priceRange,
  })
  // Fill real ids after local scaffold
  local.venueId = input.venueId
  local.userId = 'local'

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (input.accessToken) headers.Authorization = `Bearer ${input.accessToken}`

    const res = await fetch('/api/venues/data-report', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        venueId: input.venueId,
        reason: input.reason,
        note: input.note,
        menuUrl: input.menuUrl,
        priceRange: input.priceRange,
      }),
    })

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null
      // Offline / unauth: keep local pending report for UX
      if (res.status === 401 || res.status >= 500) {
        return { ok: true, report: local }
      }
      return { ok: false, error: body?.message ?? `Request failed (${res.status})` }
    }

    const body = (await res.json()) as { data?: VenueDataReport }
    return { ok: true, report: body.data ?? local }
  } catch {
    return { ok: true, report: local }
  }
}
