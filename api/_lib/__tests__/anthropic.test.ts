import { describe, it, expect, vi } from 'vitest'
import {
  callClaude,
  estimateCostCents,
  type AnthropicResponse,
  type ToolCallContext,
} from '../anthropic'

/* ------------------------------------------------------------------------ */
/* Helpers to build mock responses                                          */
/* ------------------------------------------------------------------------ */

function toolUseResponse(opts: {
  toolName: string
  input: Record<string, unknown>
  toolUseId?: string
}): AnthropicResponse {
  return {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-4-6',
    content: [
      { type: 'text', text: 'one moment…' },
      {
        type: 'tool_use',
        id: opts.toolUseId ?? 'toolu_1',
        name: opts.toolName,
        input: opts.input,
      },
    ],
    stop_reason: 'tool_use',
    usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
  }
}

function endTurnResponse(text: string): AnthropicResponse {
  return {
    id: 'msg_final',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-4-6',
    content: [{ type: 'text', text }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 50, output_tokens: 30, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
  }
}

function mockFetch(responses: AnthropicResponse[]): typeof fetch {
  let i = 0
  return (async (): Promise<Response> => {
    const body = responses[i++]
    if (!body) throw new Error('mockFetch ran out of responses')
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as unknown as typeof fetch
}

/* ------------------------------------------------------------------------ */

describe('callClaude tool-use loop', () => {
  it('invokes onToolCall for each tool_use block and feeds results back', async () => {
    const fetchImpl = mockFetch([
      toolUseResponse({ toolName: 'search_venues', input: { vibe: 'dive' } }),
      endTurnResponse('Try Joe\'s Bar.'),
    ])
    const onToolCall = vi.fn(async (ctx: ToolCallContext) => ({
      content: JSON.stringify({ ok: true, for: ctx.name, input: ctx.input }),
    }))

    const result = await callClaude({
      apiKey: 'test-key',
      model: 'claude-sonnet-4-6',
      messages: [{ role: 'user', content: 'find a dive bar' }],
      tools: [
        { name: 'search_venues', description: 'x', input_schema: { type: 'object' } },
      ],
      onToolCall,
      fetchImpl,
    })

    expect(onToolCall).toHaveBeenCalledTimes(1)
    expect(onToolCall.mock.calls[0][0]).toMatchObject({
      name: 'search_venues',
      input: { vibe: 'dive' },
      toolUseId: 'toolu_1',
    })
    expect(result.iterations).toBe(2)
    expect(result.text).toBe("Try Joe's Bar.")
    expect(result.finalResponse.stop_reason).toBe('end_turn')

    // Conversation should contain: original user, assistant(tool_use),
    // user(tool_result), assistant(end_turn).
    expect(result.messages).toHaveLength(4)
    expect(result.messages[1].role).toBe('assistant')
    expect(result.messages[2].role).toBe('user')
    const toolResultBlock = Array.isArray(result.messages[2].content)
      ? result.messages[2].content[0]
      : null
    expect(toolResultBlock).toMatchObject({
      type: 'tool_result',
      tool_use_id: 'toolu_1',
    })
  })

  it('sums usage across every turn', async () => {
    const fetchImpl = mockFetch([
      toolUseResponse({ toolName: 'search_venues', input: {} }),
      endTurnResponse('done'),
    ])
    const result = await callClaude({
      apiKey: 'k',
      model: 'claude-sonnet-4-6',
      messages: [{ role: 'user', content: 'x' }],
      tools: [{ name: 'search_venues', description: '', input_schema: { type: 'object' } }],
      onToolCall: async () => ({ content: '{}' }),
      fetchImpl,
    })
    expect(result.totalUsage.input_tokens).toBe(150)
    expect(result.totalUsage.output_tokens).toBe(50)
  })

  it('stops at maxIterations even if the model keeps calling tools', async () => {
    const fetchImpl = mockFetch([
      toolUseResponse({ toolName: 'search_venues', input: {}, toolUseId: 't1' }),
      toolUseResponse({ toolName: 'search_venues', input: {}, toolUseId: 't2' }),
      toolUseResponse({ toolName: 'search_venues', input: {}, toolUseId: 't3' }),
    ])
    const onToolCall = vi.fn(async () => ({ content: '{}' }))
    const result = await callClaude({
      apiKey: 'k',
      model: 'claude-sonnet-4-6',
      messages: [{ role: 'user', content: 'x' }],
      tools: [{ name: 'search_venues', description: '', input_schema: { type: 'object' } }],
      onToolCall,
      fetchImpl,
      maxIterations: 2,
    })
    expect(result.iterations).toBe(2)
  })

  it('throws a structured error on non-2xx responses', async () => {
    const fetchImpl = (async (): Promise<Response> =>
      new Response('{"error":"rate limited"}', {
        status: 429,
        headers: { 'content-type': 'application/json' },
      })) as unknown as typeof fetch

    await expect(
      callClaude({
        apiKey: 'k',
        model: 'claude-sonnet-4-6',
        messages: [{ role: 'user', content: 'x' }],
        fetchImpl,
      }),
    ).rejects.toThrow(/429/)
  })
})

describe('estimateCostCents', () => {
  it('is non-zero for sonnet pricing', () => {
    const c = estimateCostCents(
      { input_tokens: 1_000_000, output_tokens: 1_000_000 },
      'claude-sonnet-4-6',
    )
    expect(c).toBeGreaterThan(0)
  })

  it('is higher for opus than sonnet', () => {
    const usage = { input_tokens: 10_000, output_tokens: 10_000 }
    const opus = estimateCostCents(usage, 'claude-opus-4-7')
    const sonnet = estimateCostCents(usage, 'claude-sonnet-4-6')
    expect(opus).toBeGreaterThan(sonnet)
  })

  it('discounts cache reads vs fresh input', () => {
    const fresh = estimateCostCents(
      { input_tokens: 100_000, output_tokens: 0 },
      'claude-sonnet-4-6',
    )
    const cached = estimateCostCents(
      { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 100_000 },
      'claude-sonnet-4-6',
    )
    expect(cached).toBeLessThan(fresh)
  })
})
