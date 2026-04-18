/**
 * POST /api/concierge/chat
 *
 * Authenticated, rate-limited (5 msgs/min/user). Accepts a conversation,
 * runs the Anthropic tool-use loop, returns a JSON blob with the final
 * assistant text plus any structured tool outputs. SSE streaming is
 * stubbed for v1 — see docs/ai-concierge.md "Future migration" for the
 * token-level streaming plan.
 *
 * Env vars:
 *   - ANTHROPIC_API_KEY             (required)
 *   - CONCIERGE_MODEL               (default: "claude-sonnet-4-6")
 *   - CONCIERGE_SESSION_CENTS_CAP   (default: 20)
 *   - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (for auth + persistence)
 */
import {
  jsonError,
  methodNotAllowed,
  readHeader,
  setCors,
  type RequestLike,
  type ResponseLike,
} from '../_lib/http'
import { requireUser } from '../_lib/auth'
import { rateLimit } from '../_lib/rate-limit'
import { byteLength, isObject, isString, requireArray, requireString } from '../_lib/validate'
import { getServerSupabase } from '../_lib/supabase-server'
import {
  callClaude,
  estimateCostCents,
  type AnthropicMessage,
  type ToolCallContext,
  type ToolCallResult,
} from '../_lib/anthropic'
import { CONCIERGE_TOOLS, buildSystemBlocks } from '../_lib/concierge-prompts'

const DEFAULT_MODEL = 'claude-sonnet-4-6'
const DEFAULT_CAP_CENTS = 20
const MAX_MESSAGES = 20
const MAX_MESSAGE_BYTES = 8 * 1024

interface ConciergeRequestBody {
  messages: AnthropicMessage[]
  sessionId: string
  userContext?: {
    location?: { lat: number; lng: number }
    friends?: string[]
    preferences?: Record<string, unknown>
  }
}

function parseBody(value: unknown): { ok: true; value: ConciergeRequestBody } | { ok: false; error: string } {
  if (!isObject(value)) return { ok: false, error: 'body must be a JSON object' }
  const sessionId = requireString(value.sessionId, 'sessionId', 64)
  if (!sessionId.ok) return sessionId

  const messages = requireArray(
    value.messages,
    'messages',
    MAX_MESSAGES,
    (v, idx) => {
      if (!isObject(v)) return { ok: false as const, error: `messages[${idx}] must be an object` }
      if (v.role !== 'user' && v.role !== 'assistant') {
        return { ok: false as const, error: `messages[${idx}].role must be 'user' or 'assistant'` }
      }
      // Content can be a plain string or an array of content blocks.
      if (isString(v.content)) {
        if (byteLength(v.content) > MAX_MESSAGE_BYTES) {
          return { ok: false as const, error: `messages[${idx}].content exceeds ${MAX_MESSAGE_BYTES} bytes` }
        }
        return { ok: true as const, value: { role: v.role, content: v.content } as AnthropicMessage }
      }
      if (Array.isArray(v.content)) {
        const serialized = JSON.stringify(v.content)
        if (byteLength(serialized) > MAX_MESSAGE_BYTES) {
          return { ok: false as const, error: `messages[${idx}].content exceeds ${MAX_MESSAGE_BYTES} bytes` }
        }
        return { ok: true as const, value: { role: v.role, content: v.content } as AnthropicMessage }
      }
      return { ok: false as const, error: `messages[${idx}].content must be string or array` }
    },
  )
  if (!messages.ok) return messages

  return {
    ok: true,
    value: {
      sessionId: sessionId.value,
      messages: messages.value,
      userContext: isObject(value.userContext)
        ? (value.userContext as ConciergeRequestBody['userContext'])
        : undefined,
    },
  }
}

/* -------------------------------------------------------------------------- */
/* Tool dispatch                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Tool implementations proxy into the existing engines. Kept intentionally
 * minimal and defensive — these run server-side where we trust the data
 * layer but never the model's input.
 *
 * For v1 many handlers return stubs marked `{ stub: true }` so the loop
 * is exercised end-to-end; they are wired to the real engines in
 * follow-up tickets. See docs/ai-concierge.md.
 */
async function handleToolCall(ctx: ToolCallContext): Promise<ToolCallResult> {
  try {
    switch (ctx.name) {
      case 'search_venues':
        return okJson({
          stub: true,
          note: 'wired to server-side listVenues in follow-up',
          filters: ctx.input,
          results: [],
        })
      case 'build_plan':
        return okJson({
          stub: true,
          note: 'wired to generateNightPlan in follow-up',
          brief: ctx.input,
          plan: null,
        })
      case 'estimate_rideshare':
        return okJson({
          stub: true,
          note: 'wired to uber/lyft integrations in follow-up',
          pickup: ctx.input.pickup,
          dropoff: ctx.input.dropoff,
          estimateUsd: null,
          etaMinutes: null,
        })
      case 'check_surge':
        return okJson({
          stub: true,
          note: 'wired to predictSurge in follow-up',
          venueId: ctx.input.venueId,
          atTime: ctx.input.atTime,
          surge: null,
        })
      case 'check_moderation':
        return okJson({
          stub: true,
          note: 'wired to checkContent in follow-up',
          content: ctx.input.content,
          flagged: false,
        })
      default:
        return { content: JSON.stringify({ error: `Unknown tool: ${ctx.name}` }), isError: true }
    }
  } catch (err) {
    return {
      content: JSON.stringify({ error: (err as Error).message }),
      isError: true,
    }
  }
}

function okJson(payload: unknown): ToolCallResult {
  return { content: JSON.stringify(payload) }
}

/* -------------------------------------------------------------------------- */
/* Session + cost tracking                                                    */
/* -------------------------------------------------------------------------- */

interface SessionState {
  totalCostCents: number
  capCents: number
}

async function loadOrCreateSession(sessionId: string, userId: string): Promise<SessionState> {
  const supa = getServerSupabase()
  const capCents = parseInt(process.env.CONCIERGE_SESSION_CENTS_CAP ?? '', 10) || DEFAULT_CAP_CENTS
  try {
    const { data } = await supa
      .from('concierge_sessions')
      .select('id,total_input_tokens,total_output_tokens,total_cost_cents')
      .eq('id', sessionId)
      .maybeSingle()
    if (data) {
      return { totalCostCents: Number(data.total_cost_cents ?? 0), capCents }
    }
    await supa
      .from('concierge_sessions')
      .insert({ id: sessionId, user_id: userId })
    return { totalCostCents: 0, capCents }
  } catch {
    // Supabase may be unconfigured in local/dev; fail open with a fresh bucket.
    return { totalCostCents: 0, capCents }
  }
}

async function persistTurn(args: {
  sessionId: string
  userId: string
  turnMessages: AnthropicMessage[]
  costCents: number
  tokensIn: number
  tokensOut: number
}): Promise<void> {
  const supa = getServerSupabase()
  try {
    const rows = args.turnMessages.map((m) => ({
      session_id: args.sessionId,
      role: m.role,
      content: m.content as unknown as Record<string, unknown>,
    }))
    if (rows.length > 0) {
      await supa.from('concierge_messages').insert(rows)
    }
    await supa
      .from('concierge_sessions')
      .update({
        total_input_tokens: args.tokensIn,
        total_output_tokens: args.tokensOut,
        total_cost_cents: args.costCents,
      })
      .eq('id', args.sessionId)
      .eq('user_id', args.userId)
  } catch {
    // Persistence failures should not break the response to the user.
  }
}

/* -------------------------------------------------------------------------- */
/* Handler                                                                    */
/* -------------------------------------------------------------------------- */

export default async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  setCors(res)
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST', 'OPTIONS'])
    return
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    jsonError(res, 500, 'ANTHROPIC_API_KEY is not configured')
    return
  }

  const user = await requireUser(req)
  if (!user) {
    jsonError(res, 401, 'Authentication required')
    return
  }

  const rl = rateLimit(`concierge:${user.id}`, 5, 60_000)
  if (!rl.allowed) {
    res.setHeader('Retry-After', Math.ceil((rl.resetAtMs - Date.now()) / 1000).toString())
    jsonError(res, 429, 'Too many messages — slow down')
    return
  }

  const parsed = parseBody(req.body)
  if (!parsed.ok) {
    jsonError(res, 400, parsed.error)
    return
  }

  const session = await loadOrCreateSession(parsed.value.sessionId, user.id)
  if (session.totalCostCents >= session.capCents) {
    jsonError(res, 402, 'Session spend cap reached', {
      capCents: session.capCents,
      spentCents: session.totalCostCents,
    })
    return
  }

  const model = process.env.CONCIERGE_MODEL || DEFAULT_MODEL
  const acceptHeader = readHeader(req, 'accept') ?? ''
  const wantsSse = acceptHeader.includes('text/event-stream')

  try {
    const result = await callClaude({
      apiKey,
      model,
      system: buildSystemBlocks(),
      tools: CONCIERGE_TOOLS,
      messages: parsed.value.messages,
      maxTokens: 2048,
      onToolCall: handleToolCall,
    })

    const costCents = estimateCostCents(result.totalUsage, model) + session.totalCostCents
    await persistTurn({
      sessionId: parsed.value.sessionId,
      userId: user.id,
      turnMessages: result.messages,
      costCents,
      tokensIn: result.totalUsage.input_tokens,
      tokensOut: result.totalUsage.output_tokens,
    })

    const payload = {
      sessionId: parsed.value.sessionId,
      text: result.text,
      messages: result.messages,
      stopReason: result.finalResponse.stop_reason,
      iterations: result.iterations,
      usage: result.totalUsage,
      costCents,
      capCents: session.capCents,
      model,
    }

    if (wantsSse) {
      // Minimal SSE envelope — a single `message` event with the full
      // JSON payload. Token-level streaming is a follow-up (see docs).
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
      res.setHeader('Cache-Control', 'no-cache, no-transform')
      res.setHeader('Connection', 'keep-alive')
      res.status(200)
      res.write(`event: message\ndata: ${JSON.stringify(payload)}\n\n`)
      res.write('event: done\ndata: {}\n\n')
      res.end()
      return
    }

    res.status(200).json(payload)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    jsonError(res, 502, 'Concierge upstream error', { detail: message })
  }
}
