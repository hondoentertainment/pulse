/**
 * Thin wrapper around the Anthropic REST API (Messages endpoint).
 *
 * We intentionally avoid adding `@anthropic-ai/sdk` as a runtime dep —
 * this handler ships on the Edge and the SDK is Node-only. All calls go
 * through `fetch()`.
 *
 * Env vars:
 *   - ANTHROPIC_API_KEY (required)
 *
 * Model default: `claude-sonnet-4-6`. Override via the `model` argument
 * (the concierge uses env `CONCIERGE_MODEL`). Opus 4.7 (`claude-opus-4-7`)
 * is the documented upgrade path for heavy planning — on Opus 4.7 do NOT
 * pass `temperature`, `top_p`, `top_k`, or `thinking.budget_tokens`; use
 * `thinking: {type: 'adaptive'}` instead.
 *
 * Prompt caching is wired via `cache_control: { type: 'ephemeral' }` on
 * the caller's system blocks and tool definitions — see
 * `concierge-prompts.ts`.
 */

const ANTHROPIC_VERSION = '2023-06-01'
const ENDPOINT = 'https://api.anthropic.com/v1/messages'

export interface AnthropicTextBlock {
  type: 'text'
  text: string
  cache_control?: { type: 'ephemeral'; ttl?: '5m' | '1h' }
}

export interface AnthropicToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

export interface AnthropicToolResultBlock {
  type: 'tool_result'
  tool_use_id: string
  content: string | Array<{ type: 'text'; text: string }>
  is_error?: boolean
}

export type AnthropicContentBlock =
  | AnthropicTextBlock
  | AnthropicToolUseBlock
  | AnthropicToolResultBlock

export interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string | AnthropicContentBlock[]
}

export interface AnthropicToolDef {
  name: string
  description: string
  input_schema: Record<string, unknown>
  cache_control?: { type: 'ephemeral' }
}

export interface AnthropicUsage {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}

export interface AnthropicResponse {
  id: string
  type: 'message'
  role: 'assistant'
  model: string
  content: AnthropicContentBlock[]
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence' | string
  usage: AnthropicUsage
}

export interface ToolCallContext {
  name: string
  input: Record<string, unknown>
  toolUseId: string
}

export interface ToolCallResult {
  content: string
  isError?: boolean
}

export type ToolHandler = (ctx: ToolCallContext) => Promise<ToolCallResult>

export interface CallClaudeParams {
  apiKey: string
  model: string
  messages: AnthropicMessage[]
  system?: string | AnthropicTextBlock[]
  tools?: AnthropicToolDef[]
  maxTokens?: number
  onToolCall?: ToolHandler
  /** Hard cap on iterations of the tool-use loop. */
  maxIterations?: number
  /** Optional fetch override for tests. */
  fetchImpl?: typeof fetch
}

export interface CallClaudeResult {
  finalResponse: AnthropicResponse
  /** The whole conversation including tool results, for persistence. */
  messages: AnthropicMessage[]
  /** Summed usage across every turn in the tool-use loop. */
  totalUsage: AnthropicUsage
  /** Concatenation of every `text` block emitted across the loop. */
  text: string
  iterations: number
}

/** Sum usage across every call made in the tool-use loop. */
function addUsage(a: AnthropicUsage, b: AnthropicUsage): AnthropicUsage {
  return {
    input_tokens: a.input_tokens + b.input_tokens,
    output_tokens: a.output_tokens + b.output_tokens,
    cache_creation_input_tokens:
      (a.cache_creation_input_tokens ?? 0) + (b.cache_creation_input_tokens ?? 0),
    cache_read_input_tokens:
      (a.cache_read_input_tokens ?? 0) + (b.cache_read_input_tokens ?? 0),
  }
}

async function postMessage(
  params: CallClaudeParams,
  messages: AnthropicMessage[],
): Promise<AnthropicResponse> {
  const fetchImpl = params.fetchImpl ?? fetch
  const body: Record<string, unknown> = {
    model: params.model,
    max_tokens: params.maxTokens ?? 4096,
    messages,
  }
  if (params.system) body.system = params.system
  if (params.tools && params.tools.length > 0) body.tools = params.tools

  const response = await fetchImpl(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': params.apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new AnthropicError(`Anthropic API ${response.status}: ${text}`, response.status)
  }
  return (await response.json()) as AnthropicResponse
}

export class AnthropicError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'AnthropicError'
    this.status = status
  }
}

/**
 * Run the tool-use loop until Claude emits a final (non-`tool_use`) turn
 * or `maxIterations` is reached. Returns the final response plus the
 * accumulated conversation and usage.
 */
export async function callClaude(params: CallClaudeParams): Promise<CallClaudeResult> {
  const maxIterations = params.maxIterations ?? 8
  const working: AnthropicMessage[] = [...params.messages]
  let totalUsage: AnthropicUsage = {
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
  }
  let iterations = 0
  let lastResponse: AnthropicResponse | null = null

  while (iterations < maxIterations) {
    iterations += 1
    const response = await postMessage(params, working)
    lastResponse = response
    totalUsage = addUsage(totalUsage, response.usage)

    // Append the assistant turn verbatim — tool_use blocks must be preserved.
    working.push({ role: 'assistant', content: response.content })

    if (response.stop_reason !== 'tool_use') break

    const toolUses = response.content.filter(
      (b): b is AnthropicToolUseBlock => b.type === 'tool_use',
    )
    if (toolUses.length === 0) break
    if (!params.onToolCall) {
      throw new AnthropicError('Model requested a tool but no onToolCall handler was provided', 500)
    }

    const toolResults: AnthropicToolResultBlock[] = []
    for (const toolUse of toolUses) {
      const result = await params.onToolCall({
        name: toolUse.name,
        input: toolUse.input,
        toolUseId: toolUse.id,
      })
      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: result.content,
        is_error: result.isError,
      })
    }
    working.push({ role: 'user', content: toolResults })
  }

  if (!lastResponse) {
    throw new AnthropicError('callClaude exited without a response', 500)
  }

  const text = lastResponse.content
    .filter((b): b is AnthropicTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')

  return {
    finalResponse: lastResponse,
    messages: working,
    totalUsage,
    text,
    iterations,
  }
}

/**
 * Approximate cost in cents given Sonnet 4.6 pricing:
 * $3 / 1M input, $15 / 1M output. Cache reads at ~0.1× input;
 * cache writes at 1.25× input. See `shared/prompt-caching.md`.
 */
export function estimateCostCents(usage: AnthropicUsage, model: string): number {
  const rates = model.startsWith('claude-opus')
    ? { input: 500, output: 2500 } // Opus: $5 / $25 per 1M
    : { input: 300, output: 1500 } // Sonnet: $3 / $15 per 1M (default)
  const cacheRead = usage.cache_read_input_tokens ?? 0
  const cacheWrite = usage.cache_creation_input_tokens ?? 0
  const normalInput = usage.input_tokens
  const input = normalInput * rates.input + cacheWrite * rates.input * 1.25 + cacheRead * rates.input * 0.1
  const output = usage.output_tokens * rates.output
  // rates are in "cents per 1M tokens"; convert
  return (input + output) / 1_000_000
}
