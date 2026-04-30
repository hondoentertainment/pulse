/**
 * Client-side transport for the AI Night Concierge.
 *
 * Consumes SSE from `POST /api/concierge/chat` when the server streams,
 * falls back to JSON when it doesn't. Exposes an async iterator of
 * `ConciergeDelta` objects so UI code can render progressively.
 */

export interface ConciergeChatRequest {
  sessionId: string
  messages: Array<{ role: 'user' | 'assistant'; content: unknown }>
  userContext?: {
    location?: { lat: number; lng: number }
    friends?: string[]
    preferences?: Record<string, unknown>
  }
  authToken?: string
}

export interface ConciergeFinalPayload {
  sessionId: string
  text: string
  messages: Array<{ role: string; content: unknown }>
  stopReason: string
  iterations: number
  usage: {
    input_tokens: number
    output_tokens: number
    cache_read_input_tokens?: number
    cache_creation_input_tokens?: number
  }
  costCents: number
  capCents: number
  model: string
}

export type ConciergeDelta =
  | { kind: 'message'; payload: ConciergeFinalPayload }
  | { kind: 'text'; text: string }
  | { kind: 'tool_call'; name: string; input: unknown }
  | { kind: 'done' }
  | { kind: 'error'; message: string; status?: number }

/**
 * Parse a sequence of SSE lines from a string buffer. Returns the parsed
 * events plus any leftover (incomplete) buffer. Exported for testing.
 */
export function parseSseChunk(buffer: string): { events: Array<{ event: string; data: string }>; rest: string } {
  const events: Array<{ event: string; data: string }> = []
  let rest = buffer
  while (true) {
    const sep = rest.indexOf('\n\n')
    if (sep === -1) break
    const raw = rest.slice(0, sep)
    rest = rest.slice(sep + 2)
    let eventName = 'message'
    const dataLines: string[] = []
    for (const line of raw.split('\n')) {
      if (line.startsWith('event:')) eventName = line.slice(6).trim()
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
      // comments (`:`) and retry/id lines are ignored
    }
    if (dataLines.length > 0) {
      events.push({ event: eventName, data: dataLines.join('\n') })
    }
  }
  return { events, rest }
}

/**
 * Streaming fetch wrapper. Yields `ConciergeDelta`s as they arrive.
 *
 * When the server responds with JSON rather than SSE (e.g. fallback
 * mode), emits a single `message` delta followed by `done`.
 */
export async function* streamConciergeChat(
  req: ConciergeChatRequest,
  opts: { endpoint?: string; fetchImpl?: typeof fetch } = {},
): AsyncGenerator<ConciergeDelta, void, unknown> {
  const endpoint = opts.endpoint ?? '/api/concierge/chat'
  const f = opts.fetchImpl ?? fetch

  let response: Response
  try {
    response = await f(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'text/event-stream',
        ...(req.authToken ? { authorization: `Bearer ${req.authToken}` } : {}),
      },
      body: JSON.stringify({
        sessionId: req.sessionId,
        messages: req.messages,
        userContext: req.userContext,
      }),
    })
  } catch (err) {
    yield { kind: 'error', message: (err as Error).message }
    return
  }

  if (!response.ok) {
    let detail = ''
    try {
      detail = await response.text()
    } catch {
      /* noop */
    }
    yield { kind: 'error', message: detail || `HTTP ${response.status}`, status: response.status }
    return
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('text/event-stream') || !response.body) {
    // JSON fallback
    try {
      const json = (await response.json()) as ConciergeFinalPayload
      yield { kind: 'message', payload: json }
    } catch (err) {
      yield { kind: 'error', message: (err as Error).message }
      return
    }
    yield { kind: 'done' }
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const { events, rest } = parseSseChunk(buffer)
      buffer = rest
      for (const ev of events) {
        if (ev.event === 'done') {
          yield { kind: 'done' }
          return
        }
        try {
          const parsed = JSON.parse(ev.data)
          if (ev.event === 'message') {
            yield { kind: 'message', payload: parsed as ConciergeFinalPayload }
          } else if (ev.event === 'text') {
            yield { kind: 'text', text: String(parsed.text ?? '') }
          } else if (ev.event === 'tool_call') {
            yield { kind: 'tool_call', name: String(parsed.name ?? ''), input: parsed.input }
          }
        } catch (err) {
          yield { kind: 'error', message: (err as Error).message }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
  yield { kind: 'done' }
}
