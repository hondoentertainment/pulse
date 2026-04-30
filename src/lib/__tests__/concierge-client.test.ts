import { describe, it, expect } from 'vitest'
import { parseSseChunk, streamConciergeChat, type ConciergeDelta } from '../concierge-client'

describe('parseSseChunk', () => {
  it('parses a single message event', () => {
    const buffer = 'event: message\ndata: {"hello":"world"}\n\n'
    const { events, rest } = parseSseChunk(buffer)
    expect(events).toEqual([{ event: 'message', data: '{"hello":"world"}' }])
    expect(rest).toBe('')
  })

  it('parses multiple events in one chunk', () => {
    const buffer =
      'event: text\ndata: {"text":"hi"}\n\n' +
      'event: text\ndata: {"text":" there"}\n\n' +
      'event: done\ndata: {}\n\n'
    const { events, rest } = parseSseChunk(buffer)
    expect(events).toHaveLength(3)
    expect(events[0].event).toBe('text')
    expect(events[2].event).toBe('done')
    expect(rest).toBe('')
  })

  it('keeps incomplete trailing data as "rest"', () => {
    const buffer = 'event: text\ndata: {"text":"hi"}\n\nevent: text\ndata: {"tex'
    const { events, rest } = parseSseChunk(buffer)
    expect(events).toHaveLength(1)
    expect(rest.startsWith('event: text')).toBe(true)
  })

  it('defaults to "message" event when none is given', () => {
    const buffer = 'data: {"x":1}\n\n'
    const { events } = parseSseChunk(buffer)
    expect(events[0].event).toBe('message')
  })

  it('concatenates multi-line data', () => {
    const buffer = 'event: message\ndata: line1\ndata: line2\n\n'
    const { events } = parseSseChunk(buffer)
    expect(events[0].data).toBe('line1\nline2')
  })

  it('ignores comment lines', () => {
    const buffer = ': heartbeat\nevent: message\ndata: {"ok":true}\n\n'
    const { events } = parseSseChunk(buffer)
    expect(events[0].data).toBe('{"ok":true}')
  })
})

/* ------------------------------------------------------------------------ */
/* Integration: streamConciergeChat with a mocked fetch                     */
/* ------------------------------------------------------------------------ */

function sseResponse(frames: string[]): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const f of frames) controller.enqueue(encoder.encode(f))
      controller.close()
    },
  })
  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  })
}

describe('streamConciergeChat', () => {
  it('yields events from an SSE stream', async () => {
    const mockFetch = (async (): Promise<Response> =>
      sseResponse([
        'event: text\ndata: {"text":"hello"}\n\n',
        'event: message\ndata: {"sessionId":"s1","text":"hello","messages":[],"stopReason":"end_turn","iterations":1,"usage":{"input_tokens":1,"output_tokens":1},"costCents":0.1,"capCents":20,"model":"claude-sonnet-4-6"}\n\n',
        'event: done\ndata: {}\n\n',
      ])) as unknown as typeof fetch

    const deltas: ConciergeDelta[] = []
    for await (const d of streamConciergeChat(
      { sessionId: 's1', messages: [{ role: 'user', content: 'hi' }] },
      { fetchImpl: mockFetch },
    )) {
      deltas.push(d)
    }

    const kinds = deltas.map((d) => d.kind)
    expect(kinds).toContain('text')
    expect(kinds).toContain('message')
    expect(kinds[kinds.length - 1]).toBe('done')
  })

  it('falls back to JSON when the server does not stream', async () => {
    const mockFetch = (async (): Promise<Response> =>
      new Response(
        JSON.stringify({
          sessionId: 's1',
          text: 'json fallback',
          messages: [],
          stopReason: 'end_turn',
          iterations: 1,
          usage: { input_tokens: 1, output_tokens: 1 },
          costCents: 0.1,
          capCents: 20,
          model: 'claude-sonnet-4-6',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )) as unknown as typeof fetch

    const deltas: ConciergeDelta[] = []
    for await (const d of streamConciergeChat(
      { sessionId: 's1', messages: [{ role: 'user', content: 'hi' }] },
      { fetchImpl: mockFetch },
    )) {
      deltas.push(d)
    }
    expect(deltas[0].kind).toBe('message')
    expect(deltas[deltas.length - 1].kind).toBe('done')
  })

  it('yields an error delta on non-2xx', async () => {
    const mockFetch = (async (): Promise<Response> =>
      new Response('upstream boom', {
        status: 502,
        headers: { 'content-type': 'text/plain' },
      })) as unknown as typeof fetch

    const deltas: ConciergeDelta[] = []
    for await (const d of streamConciergeChat(
      { sessionId: 's1', messages: [{ role: 'user', content: 'hi' }] },
      { fetchImpl: mockFetch },
    )) {
      deltas.push(d)
    }
    expect(deltas).toHaveLength(1)
    expect(deltas[0].kind).toBe('error')
  })
})
