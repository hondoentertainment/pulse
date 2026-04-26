/**
 * Real tool-backend dispatcher for the AI Night Concierge.
 *
 * The chat handler (`api/concierge/chat.ts`) hands tool calls to
 * `executeToolCall` which routes each by name to the right engine:
 *
 *   search_venues     -> Supabase `venues` (RLS under the caller JWT)
 *   build_plan        -> generateNightPlan (pure engine in src/lib/night-planner)
 *   estimate_rideshare-> api/integrations/{uber,lyft} handlers via mock req/res
 *   check_surge       -> Supabase `pulses` + analyzeVenuePatterns/predictSurge
 *   check_moderation  -> checkContent from api/_lib/moderation
 *
 * Contracts:
 *   - Pure functions where possible; the side-effect boundary is the
 *     Supabase client and the outbound fetch used by the rideshare
 *     handlers. Everything else is in-process.
 *   - Every tool result is serialised to JSON for the model. On error we
 *     return `{ error: { code, message } }` content with `isError: true`
 *     so the model surfaces the failure rather than hallucinating.
 *
 * Structured logging uses the server-side `logger.child({ component })`
 * if it is importable in this runtime, otherwise falls back to
 * `console.error`. We never let a logger throw leak into the tool
 * result.
 */
import type { ToolCallResult } from './anthropic'
import { createUserClient } from './supabase-server'
import { checkContent, type ContentKind, type ModerationResult } from './moderation'
import uberHandler from '../integrations/uber'
import lyftHandler from '../integrations/lyft'
import type { RequestLike, ResponseLike } from './http'
import {
  generateNightPlan,
  type NightPlan,
  type PlanPreferences,
} from '../../src/lib/night-planner'
import {
  analyzeVenuePatterns,
  predictSurge,
  type SurgePrediction,
} from '../../src/lib/predictive-surge'
import type { Pulse, User, Venue, EnergyRating } from '../../src/lib/types'

/* -------------------------------------------------------------------------- */
/* Shared context + error helpers                                             */
/* -------------------------------------------------------------------------- */

export interface ConciergeToolContext {
  /** Authenticated user id (from JWT `sub`). */
  userId: string
  /** Raw bearer JWT — passed to Supabase so RLS runs as the caller. */
  userJwt: string
  /** Optional request-time context supplied by the client. */
  userContext?: {
    location?: { lat: number; lng: number }
    friends?: string[]
    preferences?: Record<string, unknown>
  }
}

export type ToolName =
  | 'search_venues'
  | 'build_plan'
  | 'estimate_rideshare'
  | 'check_surge'
  | 'check_moderation'

type LoggerLike = {
  child?: (bound: Record<string, unknown>) => LoggerLike
  error?: (message: string, fields?: Record<string, unknown>) => void
  warn?: (message: string, fields?: Record<string, unknown>) => void
}

/**
 * Best-effort structured logger. The canonical `src/lib/observability`
 * logger uses `import.meta.env` + `@sentry/react` which are not
 * available in the Edge runtime, so we fall back to `console`.
 */
function getLogger(): LoggerLike {
  return {
    child: (bound) => ({
      error: (m, f) => console.error(`[concierge] ${m}`, { ...bound, ...f }),
      warn: (m, f) => console.warn(`[concierge] ${m}`, { ...bound, ...f }),
    }),
    error: (m, f) => console.error(`[concierge] ${m}`, f ?? {}),
    warn: (m, f) => console.warn(`[concierge] ${m}`, f ?? {}),
  }
}

const logger = getLogger().child!({ component: 'concierge' })

function okJson(payload: unknown): ToolCallResult {
  return { content: JSON.stringify(payload) }
}

function errJson(code: string, message: string, extra?: Record<string, unknown>): ToolCallResult {
  return {
    content: JSON.stringify({ error: { code, message, ...(extra ?? {}) } }),
    isError: true,
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function asLatLngLoose(value: unknown): { lat: number; lng: number } | null {
  const obj = asRecord(value)
  const lat = typeof obj.lat === 'number' ? obj.lat : null
  const lng = typeof obj.lng === 'number' ? obj.lng : null
  if (lat === null || lng === null) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

function haversineMi(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8
  const toRad = (x: number) => (x * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/* -------------------------------------------------------------------------- */
/* search_venues                                                              */
/* -------------------------------------------------------------------------- */

interface SearchVenuesInput {
  vibe?: string
  neighborhood?: string
  category?: string
  priceTier?: number
}

interface VenueRow {
  id: string
  name: string
  location_lat: number
  location_lng: number
  location_address: string | null
  city: string | null
  category: string | null
  pulse_score: number | null
  cover_charge_cents: number | null
}

function rowDistanceMi(row: VenueRow, loc?: { lat: number; lng: number }): number {
  if (!loc) return 0
  return haversineMi(loc.lat, loc.lng, row.location_lat, row.location_lng)
}

/**
 * Approximate tier mapping from cover charge (the venues table has no
 * first-class `price_tier` column yet — follow-up migration tracked in
 * docs/ai-concierge.md).
 */
function tierFromCover(cents: number | null | undefined): number | undefined {
  if (cents == null) return undefined
  if (cents <= 0) return 1
  if (cents < 2000) return 2
  if (cents < 5000) return 3
  return 4
}

export async function searchVenuesTool(
  input: SearchVenuesInput,
  ctx: ConciergeToolContext,
): Promise<ToolCallResult> {
  const supa = createUserClient(ctx.userJwt)
  let q = supa
    .from('venues')
    .select(
      'id, name, location_lat, location_lng, location_address, city, category, pulse_score, cover_charge_cents',
    )
    .is('deleted_at', null)
    .order('pulse_score', { ascending: false })
    .limit(40)

  if (typeof input.category === 'string' && input.category.trim()) {
    q = q.ilike('category', `%${input.category.trim()}%`)
  }
  if (typeof input.neighborhood === 'string' && input.neighborhood.trim()) {
    const nbh = input.neighborhood.trim()
    q = q.or(`city.ilike.%${nbh}%,location_address.ilike.%${nbh}%`)
  }
  // vibe is best-effort against the category for now; when we add a
  // dedicated vibes column / taxonomy the filter will move there.
  if (typeof input.vibe === 'string' && input.vibe.trim()) {
    q = q.ilike('category', `%${input.vibe.trim()}%`)
  }

  const { data, error } = await q
  if (error) {
    logger.error?.('search_venues supabase failed', { extra: { error: error.message } })
    return errJson('db_error', error.message)
  }

  const rows = Array.isArray(data) ? (data as VenueRow[]) : []

  // Optional client-side price-tier filter (approximate via cover charge).
  const tierFilter = typeof input.priceTier === 'number' ? input.priceTier : undefined
  const filtered =
    tierFilter !== undefined
      ? rows.filter((r) => tierFromCover(r.cover_charge_cents) === tierFilter)
      : rows

  const loc = ctx.userContext?.location
  const ranked = filtered
    .map((r) => {
      const distance = rowDistanceMi(r, loc)
      // Penalise venues far from the user; pulse_score dominates within a mile.
      const score = (r.pulse_score ?? 0) - distance * 2
      return { r, distance, score }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)

  return okJson({
    count: ranked.length,
    results: ranked.map(({ r, distance }) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      location: {
        lat: r.location_lat,
        lng: r.location_lng,
        address: r.location_address,
        city: r.city,
      },
      pulseScore: r.pulse_score ?? 0,
      distanceMi: Math.round(distance * 10) / 10,
      priceTier: tierFromCover(r.cover_charge_cents),
      vibes: r.category ? [r.category] : [],
    })),
  })
}

/* -------------------------------------------------------------------------- */
/* build_plan                                                                 */
/* -------------------------------------------------------------------------- */

interface BuildPlanInput {
  groupSize?: number
  budget?: number
  budgetPerPerson?: number
  startTime?: string
  endTime?: string
  location?: { lat: number; lng: number }
  preferences?: Partial<PlanPreferences>
}

interface PulseRow {
  id: string
  venue_id: string
  energy_rating: EnergyRating
  created_at: string
  expires_at: string
}

function pulseFromRow(row: PulseRow): Pulse {
  return {
    id: row.id,
    userId: '',
    venueId: row.venue_id,
    photos: [],
    energyRating: row.energy_rating,
    views: 0,
    isPioneer: false,
    credibilityWeight: 1,
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    isPending: false,
    uploadError: false,
  }
}

function venueFromRow(row: VenueRow): Venue {
  return {
    id: row.id,
    name: row.name,
    location: {
      lat: row.location_lat,
      lng: row.location_lng,
      address: row.location_address ?? '',
    },
    city: row.city ?? undefined,
    category: row.category ?? undefined,
    pulseScore: row.pulse_score ?? 0,
  }
}

export async function buildPlanTool(
  input: BuildPlanInput,
  ctx: ConciergeToolContext,
): Promise<ToolCallResult> {
  const groupSize = typeof input.groupSize === 'number' ? input.groupSize : 2
  const perPerson =
    typeof input.budgetPerPerson === 'number'
      ? input.budgetPerPerson
      : typeof input.budget === 'number'
        ? input.budget
        : 80
  const startTime = typeof input.startTime === 'string' ? input.startTime : new Date().toISOString()
  const endTime =
    typeof input.endTime === 'string'
      ? input.endTime
      : new Date(Date.now() + 4 * 3600_000).toISOString()
  const location =
    asLatLngLoose(input.location) ?? ctx.userContext?.location ?? { lat: 40.7128, lng: -74.006 }
  const prefs: PlanPreferences = {
    vibes: Array.isArray(input.preferences?.vibes) ? (input.preferences!.vibes as string[]) : [],
    musicGenres: Array.isArray(input.preferences?.musicGenres)
      ? (input.preferences!.musicGenres as string[])
      : [],
    venueTypes: Array.isArray(input.preferences?.venueTypes)
      ? (input.preferences!.venueTypes as string[])
      : [],
    avoidCategories: Array.isArray(input.preferences?.avoidCategories)
      ? (input.preferences!.avoidCategories as string[])
      : [],
  }

  const supa = createUserClient(ctx.userJwt)

  // Pull a candidate set near the user. 200 is well above any realistic
  // 2-4 stop plan but still bounded.
  const [venuesRes, pulsesRes] = await Promise.all([
    supa
      .from('venues')
      .select(
        'id, name, location_lat, location_lng, location_address, city, category, pulse_score, cover_charge_cents',
      )
      .is('deleted_at', null)
      .order('pulse_score', { ascending: false })
      .limit(200),
    supa
      .from('pulses')
      .select('id, venue_id, energy_rating, created_at, expires_at')
      .order('created_at', { ascending: false })
      .limit(500),
  ])

  if (venuesRes.error) {
    logger.error?.('build_plan venues failed', { extra: { error: venuesRes.error.message } })
    return errJson('db_error', venuesRes.error.message)
  }
  if (pulsesRes.error) {
    logger.warn?.('build_plan pulses failed', { extra: { error: pulsesRes.error.message } })
  }

  const venues: Venue[] = (venuesRes.data ?? []).map((r) => venueFromRow(r as VenueRow))
  const pulses: Pulse[] = (pulsesRes.data ?? []).map((r) => pulseFromRow(r as PulseRow))

  if (venues.length === 0) {
    return errJson('no_venues', 'No venues available to build a plan with')
  }

  // Minimal user record — generateNightPlan reads a few preference hints
  // but will degrade gracefully when they are absent.
  const user: User = {
    id: ctx.userId,
    username: '',
    friends: [],
    createdAt: new Date().toISOString(),
  }

  let plan: NightPlan
  try {
    plan = generateNightPlan(
      {
        groupSize,
        budget: perPerson,
        preferences: prefs,
        location,
        startTime,
        endTime,
        userId: ctx.userId,
      },
      venues,
      pulses,
      user,
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error?.('build_plan generate failed', { extra: { error: message } })
    return errJson('planner_error', message)
  }

  return okJson({
    plan,
    stopCount: plan.stops.length,
    totalBudgetPerPerson: plan.budget.perPerson,
  })
}

/* -------------------------------------------------------------------------- */
/* estimate_rideshare                                                         */
/* -------------------------------------------------------------------------- */

interface RideshareInput {
  pickup?: unknown
  dropoff?: unknown
}

/**
 * Build a minimal ResponseLike that captures the handler's output
 * without shipping a real HTTP response. Edge handlers only ever call
 * `status`, `setHeader`, `json`, `end` so this is sufficient.
 */
function captureHandlerResponse(): {
  res: ResponseLike
  read: () => { status: number; body: unknown; headers: Record<string, string> }
} {
  let status = 200
  let body: unknown = undefined
  const headers: Record<string, string> = {}
  const res: ResponseLike = {
    status(code: number) {
      status = code
      return res
    },
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value
    },
    json(payload: unknown) {
      body = payload
    },
    end() {
      /* no-op */
    },
  }
  return { res, read: () => ({ status, body, headers }) }
}

function buildHandlerRequest(body: unknown, ctx: ConciergeToolContext): RequestLike {
  return {
    method: 'POST',
    body,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${ctx.userJwt}`,
      // Prevent the sibling rate-limiter from starving our internal call.
      'x-forwarded-for': `concierge:${ctx.userId}`,
    },
  }
}

async function runIntegration(
  handler: (req: RequestLike, res: ResponseLike) => Promise<void>,
  req: RequestLike,
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const { res, read } = captureHandlerResponse()
  try {
    await handler(req, res)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
  const { status, body } = read()
  if (status >= 200 && status < 300) {
    const data = (body && typeof body === 'object' && 'data' in (body as object)
      ? (body as { data: unknown }).data
      : body) as unknown
    return { ok: true, data }
  }
  const message =
    body && typeof body === 'object' && 'error' in (body as object)
      ? String((body as { error: unknown }).error)
      : `HTTP ${status}`
  return { ok: false, error: message }
}

/** Normalise Uber price/time arrays into a single low/high/eta shape. */
function summariseUber(data: unknown): { lowEstimate: number | null; highEstimate: number | null; eta: number | null; currency?: string } {
  const obj = asRecord(data)
  const prices = Array.isArray(obj.priceEstimates) ? (obj.priceEstimates as Array<Record<string, unknown>>) : []
  const times = Array.isArray(obj.timeEstimates) ? (obj.timeEstimates as Array<Record<string, unknown>>) : []
  // Prefer UberX where present.
  const preferred =
    prices.find((p) => typeof p.display_name === 'string' && /uberx/i.test(p.display_name as string)) ??
    prices[0]
  const eta = times.length > 0 ? Math.round(Number(times[0].estimate ?? 0) / 60) : null
  const currency = preferred?.currency_code ? String(preferred.currency_code) : undefined
  return {
    lowEstimate: typeof preferred?.low_estimate === 'number' ? preferred.low_estimate : null,
    highEstimate: typeof preferred?.high_estimate === 'number' ? preferred.high_estimate : null,
    eta,
    currency,
  }
}

/** Normalise Lyft cost_estimates + eta_estimates into the same shape. */
function summariseLyft(data: unknown): { lowEstimate: number | null; highEstimate: number | null; eta: number | null; currency?: string } {
  const obj = asRecord(data)
  const costs = Array.isArray(obj.costEstimates) ? (obj.costEstimates as Array<Record<string, unknown>>) : []
  const etas = Array.isArray(obj.etaEstimates) ? (obj.etaEstimates as Array<Record<string, unknown>>) : []
  const preferred =
    costs.find((c) => typeof c.ride_type === 'string' && /standard|lyft/i.test(c.ride_type as string)) ??
    costs[0]
  const etaSec = etas.length > 0 ? Number(etas[0].eta_seconds ?? 0) : 0
  // Lyft returns cents, convert to dollars for a uniform shape with Uber.
  const low = typeof preferred?.estimated_cost_cents_min === 'number' ? (preferred.estimated_cost_cents_min as number) / 100 : null
  const high = typeof preferred?.estimated_cost_cents_max === 'number' ? (preferred.estimated_cost_cents_max as number) / 100 : null
  const currency = preferred?.currency ? String(preferred.currency) : undefined
  return {
    lowEstimate: low,
    highEstimate: high,
    eta: etaSec > 0 ? Math.round(etaSec / 60) : null,
    currency,
  }
}

export async function estimateRideshareTool(
  input: RideshareInput,
  ctx: ConciergeToolContext,
): Promise<ToolCallResult> {
  const pickup = asLatLngLoose(input.pickup)
  const dropoff = asLatLngLoose(input.dropoff)
  if (!pickup || !dropoff) {
    return errJson('bad_input', 'pickup and dropoff {lat, lng} required')
  }

  const body = { pickup, dropoff }
  const [uberRes, lyftRes] = await Promise.all([
    runIntegration(uberHandler, buildHandlerRequest(body, ctx)),
    runIntegration(lyftHandler, buildHandlerRequest(body, ctx)),
  ])

  if (!uberRes.ok && !lyftRes.ok) {
    logger.warn?.('estimate_rideshare both providers failed', {
      extra: { uber: uberRes.error, lyft: lyftRes.error },
    })
  }

  return okJson({
    pickup,
    dropoff,
    uber: uberRes.ok ? summariseUber(uberRes.data) : { error: uberRes.error ?? 'unavailable' },
    lyft: lyftRes.ok ? summariseLyft(lyftRes.data) : { error: lyftRes.error ?? 'unavailable' },
  })
}

/* -------------------------------------------------------------------------- */
/* check_surge                                                                */
/* -------------------------------------------------------------------------- */

interface CheckSurgeInput {
  venueId?: string
  atTime?: string
}

export async function checkSurgeTool(
  input: CheckSurgeInput,
  ctx: ConciergeToolContext,
): Promise<ToolCallResult> {
  const venueId = typeof input.venueId === 'string' ? input.venueId.trim() : ''
  if (!venueId) return errJson('bad_input', 'venueId is required')

  const atTime = typeof input.atTime === 'string' ? input.atTime : new Date().toISOString()
  const at = new Date(atTime)
  if (Number.isNaN(at.getTime())) return errJson('bad_input', 'atTime is not a valid ISO 8601 datetime')

  const supa = createUserClient(ctx.userJwt)
  const { data, error } = await supa
    .from('pulses')
    .select('id, venue_id, energy_rating, created_at, expires_at')
    .eq('venue_id', venueId)
    .order('created_at', { ascending: false })
    .limit(300)

  if (error) {
    logger.error?.('check_surge supabase failed', { extra: { error: error.message } })
    return errJson('db_error', error.message)
  }

  const rows = Array.isArray(data) ? (data as PulseRow[]) : []
  const pulses = rows.map(pulseFromRow)
  const patterns = analyzeVenuePatterns(venueId, pulses)
  const prediction: SurgePrediction = predictSurge(
    venueId,
    patterns,
    at.getHours(),
    at.getDay(),
  )

  return okJson({
    venueId,
    atTime,
    predictedEnergy: prediction.predictedEnergyLevel,
    predictedPeakTime: prediction.predictedPeakTime,
    confidence: prediction.confidence,
    label: prediction.label,
    basedOn: prediction.basedOn,
    sampleSize: pulses.length,
  })
}

/* -------------------------------------------------------------------------- */
/* check_moderation                                                           */
/* -------------------------------------------------------------------------- */

interface CheckModerationInput {
  content?: string
  kind?: ContentKind
}

export function checkModerationTool(input: CheckModerationInput): ToolCallResult {
  const content = typeof input.content === 'string' ? input.content : ''
  const kind: ContentKind =
    typeof input.kind === 'string' && ['pulse', 'comment', 'profile_bio', 'venue_description'].includes(input.kind)
      ? (input.kind as ContentKind)
      : 'comment'

  const result: ModerationResult = checkContent({ content, kind })
  return okJson({
    allowed: result.allowed,
    reasons: result.reasons,
    severity: result.severity,
    sanitized: result.sanitized,
  })
}

/* -------------------------------------------------------------------------- */
/* Dispatcher                                                                 */
/* -------------------------------------------------------------------------- */

const TOOL_NAMES: ReadonlySet<ToolName> = new Set<ToolName>([
  'search_venues',
  'build_plan',
  'estimate_rideshare',
  'check_surge',
  'check_moderation',
])

export function isKnownTool(name: string): name is ToolName {
  return TOOL_NAMES.has(name as ToolName)
}

/**
 * Dispatch a concierge tool call to its real implementation. All errors
 * thrown by a handler are caught and returned as `{ error }` content —
 * callers should not need to wrap in a try/catch, but doing so is
 * harmless.
 */
export async function executeToolCall(
  name: string,
  input: Record<string, unknown>,
  ctx: ConciergeToolContext,
): Promise<ToolCallResult> {
  try {
    switch (name) {
      case 'search_venues':
        return await searchVenuesTool(input as SearchVenuesInput, ctx)
      case 'build_plan':
        return await buildPlanTool(input as BuildPlanInput, ctx)
      case 'estimate_rideshare':
        return await estimateRideshareTool(input as RideshareInput, ctx)
      case 'check_surge':
        return await checkSurgeTool(input as CheckSurgeInput, ctx)
      case 'check_moderation':
        return checkModerationTool(input as CheckModerationInput)
      default:
        return errJson('unknown_tool', `No implementation for tool: ${name}`)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error?.('tool dispatcher failed', { extra: { tool: name, error: message } })
    return errJson('tool_exception', message)
  }
}
