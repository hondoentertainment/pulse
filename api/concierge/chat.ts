/**
 * POST /api/concierge/chat
 *
 * Authenticated, rate-limited (5 msgs/min/user). Accepts a conversation,
 * runs the Anthropic tool-use loop, returns a JSON blob (or SSE envelope)
 * with the final assistant text plus structured tool outputs.
 *
 * Tool calls dispatch to real backend implementations via
 * `api/_lib/concierge-tools` — see `docs/ai-concierge.md` for the
 * backend contracts.
 *
 * Env vars:
 *   - ANTHROPIC_API_KEY             (required)
 *   - CONCIERGE_MODEL               (default: "claude-sonnet-4-6")
 *   - CONCIERGE_SESSION_CENTS_CAP   (default: 20)
 *   - SUPABASE_URL / SUPABASE_ANON_KEY (for auth + persistence)
 */
import {
  fail,
  methodNotAllowed,
  readHeader,
  setCors,
  type RequestLike,
  type ResponseLike,
} from '../_lib/http'
import { requireAuth } from '../_lib/auth'
import { rateLimit } from '../_lib/rate-limit'
import { createUserClient } from '../_lib/supabase-server'
import {
  callClaude,
  estimateCostCents,
  type AnthropicMessage,
  type ToolCallContext,
  type ToolCallResult,
} from '../_lib/anthropic'
import { CONCIERGE_TOOLS, buildSystemBlocks } from '../_lib/concierge-prompts'
import { executeToolCall, type ConciergeToolContext } from '../_lib/concierge-tools'

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

/* -------------------------------------------------------------------------- */
/* Local validation helpers                                                   */
/* -------------------------------------------------------------------------- */

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const isString = (v: unknown): v is string => typeof v === 'string'

function byteLength(s: string): number {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s).byteLength
  // Fallback for runtimes without TextEncoder.
  let bytes = 0
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i)
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : 3
  }
  return bytes
}

function parseBody(value: unknown): { ok: true; value: ConciergeRequestBody } | { ok: false; error: string } {
  if (!isObject(value)) return { ok: false, error: 'body must be a JSON object' }
  if (!isString(value.sessionId) || value.sessionId.trim().length === 0 || value.sessionId.length > 64) {
    return { ok: false, error: 'sessionId must be a non-empty string up to 64 chars' }
  }
  if (!Array.isArray(value.messages)) {
    return { ok: false, error: 'messages must be an array' }
  }
  if (value.messages.length === 0 || value.messages.length > MAX_MESSAGES) {
    return { ok: false, error: `messages must contain between 1 and ${MAX_MESSAGES} entries` }
  }
  const parsedMessages: AnthropicMessage[] = []
  for (let i = 0; i < value.messages.length; i++) {
    const raw = value.messages[i]
    if (!isObject(raw)) return { ok: false, error: `messages[${i}] must be an object` }
    if (raw.role !== 'user' && raw.role !== 'assistant') {
      return { ok: false, error: `messages[${i}].role must be 'user' or 'assistant'` }
    }
    if (isString(raw.content)) {
      if (byteLength(raw.content) > MAX_MESSAGE_BYTES) {
        return { ok: false, error: `messages[${i}].content exceeds ${MAX_MESSAGE_BYTES} bytes` }
      }
      parsedMessages.push({ role: raw.role, content: raw.content })
      continue
    }
    if (Array.isArray(raw.content)) {
      const serialized = JSON.stringify(raw.content)
      if (byteLength(serialized) > MAX_MESSAGE_BYTES) {
        return { ok: false, error: `messages[${i}].content exceeds ${MAX_MESSAGE_BYTES} bytes` }
      }
      parsedMessages.push({ role: raw.role, content: raw.content as AnthropicMessage['content'] })
      continue
    }
    return { ok: false, error: `messages[${i}].content must be string or array` }
  }

  const userContext = isObject(value.userContext)
    ? (value.userContext as ConciergeRequestBody['userContext'])
    : undefined

  return {
    ok: true,
    value: {
      sessionId: value.sessionId,
      messages: parsedMessages,
      userContext,
    },
  }
}

/* -------------------------------------------------------------------------- */
/* Session + cost tracking                                                    */
/* -------------------------------------------------------------------------- */

interface SessionState {
  totalCostCents: number
  capCents: number
}

async function loadOrCreateSession(
  sessionId: string,
  userId: string,
  jwt: string,
): Promise<SessionState> {
  const supa = createUserClient(jwt)
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
    await supa.from('concierge_sessions').insert({ id: sessionId, user_id: userId })
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
  jwt: string
}): Promise<void> {
  const supa = createUserClient(args.jwt)
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

// Vercel Node runtime exposes `res.write` on the underlying ServerResponse
// but ResponseLike does not model it — cast narrowly when streaming SSE.
type WritableResponse = ResponseLike & {
  write?: (chunk: string) => void
}

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
    fail(res, 500, 'not_configured', 'ANTHROPIC_API_KEY is not configured')
    return
  }

  const auth = requireAuth(req)
  if (!auth.ok) {
    fail(res, auth.status, auth.code, auth.message)
    return
  }
  const { userId, token: userJwt } = auth.context

  const rl = rateLimit(`concierge:${userId}`, 5, 60_000)
  if (!rl.allowed) {
    if (rl.retryAfterSeconds !== undefined) {
      res.setHeader('Retry-After', String(rl.retryAfterSeconds))
    }
    fail(res, 429, 'rate_limited', 'Too many messages — slow down')
    return
  }

  const parsed = parseBody(req.body)
  if (!parsed.ok) {
    fail(res, 400, 'bad_request', parsed.error)
    return
  }

  const session = await loadOrCreateSession(parsed.value.sessionId, userId, userJwt)
  if (session.totalCostCents >= session.capCents) {
    fail(res, 402, 'cap_reached', 'Session spend cap reached', {
      capCents: session.capCents,
      spentCents: session.totalCostCents,
    })
    return
  }

  const model = process.env.CONCIERGE_MODEL || DEFAULT_MODEL
  const acceptHeader = readHeader(req, 'accept') ?? ''
  const wantsSse = acceptHeader.includes('text/event-stream')

  const toolContext: ConciergeToolContext = {
    userId,
    userJwt,
    userContext: parsed.value.userContext,
  }

  const onToolCall = async (ctx: ToolCallContext): Promise<ToolCallResult> => {
    return executeToolCall(ctx.name, ctx.input, toolContext)
  }

  try {
    const result = await callClaude({
      apiKey,
      model,
      system: buildSystemBlocks(),
      tools: CONCIERGE_TOOLS,
      messages: parsed.value.messages,
      maxTokens: 2048,
      onToolCall,
    })

    const costCents = estimateCostCents(result.totalUsage, model) + session.totalCostCents
    await persistTurn({
      sessionId: parsed.value.sessionId,
      userId,
      turnMessages: result.messages,
      costCents,
      tokensIn: result.totalUsage.input_tokens,
      tokensOut: result.totalUsage.output_tokens,
      jwt: userJwt,
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
      const streamRes = res as WritableResponse
      if (typeof streamRes.write === 'function') {
        streamRes.write(`event: message\ndata: ${JSON.stringify(payload)}\n\n`)
        streamRes.write('event: done\ndata: {}\n\n')
        res.end()
        return
      }
      // Fallback: runtime does not support chunked writes — degrade to JSON.
      res.json(payload)
      return
    }

    res.status(200).json(payload)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    fail(res, 502, 'upstream_error', 'Concierge upstream error', { detail: message })
  }
}
