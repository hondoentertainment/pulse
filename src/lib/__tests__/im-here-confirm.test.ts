import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requestImHereGlance } from '@/lib/data/im-here-push'
import {
  confirmImHere,
  defaultConfirmImHereDeps,
  type ConfirmImHereDeps,
  type ConfirmImHereInput,
} from '@/lib/im-here-confirm'

const input: ConfirmImHereInput = {
  venueId: 'neumos',
  venueName: 'Neumos',
  signedIn: true,
}

function deps(overrides: Partial<ConfirmImHereDeps> = {}): ConfirmImHereDeps {
  return {
    backendEnabled: true,
    createCheckIn: vi.fn(async () => ({ id: 'check-in' })),
    writePresence: vi.fn(async () => undefined),
    requestGlance: vi.fn(async () => undefined),
    countRecentPresence: vi.fn(async () => 0),
    ...overrides,
  }
}

describe('confirmImHere', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reuses the venue notify glance helper', () => {
    expect(defaultConfirmImHereDeps().requestGlance).toBe(requestImHereGlance)
  })

  it('calls the notify glance once for a signed-in first confirm', async () => {
    const harness = deps()
    const result = await confirmImHere(input, harness)
    expect(result).toEqual({ notified: true, reason: 'confirmed' })
    expect(harness.createCheckIn).toHaveBeenCalledOnce()
    expect(harness.writePresence).toHaveBeenCalledWith({
      venueId: 'neumos',
      lat: undefined,
      lng: undefined,
    })
    expect(harness.requestGlance).toHaveBeenCalledTimes(1)
    expect(harness.requestGlance).toHaveBeenCalledWith({
      venueId: 'neumos',
      venueName: 'Neumos',
    })
  })

  it('does not write or push for a guest', async () => {
    const harness = deps()
    const result = await confirmImHere({ ...input, signedIn: false }, harness)
    expect(result).toEqual({ notified: false, reason: 'guest' })
    expect(harness.createCheckIn).not.toHaveBeenCalled()
    expect(harness.writePresence).not.toHaveBeenCalled()
    expect(harness.requestGlance).not.toHaveBeenCalled()
    expect(harness.countRecentPresence).not.toHaveBeenCalled()
  })

  it('does not send again when this venue was already confirmed inside the window', async () => {
    let rows = 0
    const requestGlance = vi.fn(async () => undefined)
    const harness = deps({
      requestGlance,
      countRecentPresence: vi.fn(async () => rows),
      writePresence: vi.fn(async () => {
        rows += 1
      }),
    })

    const first = await confirmImHere(input, harness)
    const second = await confirmImHere(input, harness)

    expect(first).toEqual({ notified: true, reason: 'confirmed' })
    expect(second).toEqual({ notified: false, reason: 'rate_limited' })
    expect(requestGlance).toHaveBeenCalledTimes(1)
    expect(harness.writePresence).toHaveBeenCalledTimes(2)
  })

  it('still asks for the glance when the presence row did not land', async () => {
    const harness = deps({
      countRecentPresence: vi.fn(async () => 0),
      writePresence: vi.fn(async () => {
        throw new Error('presence down')
      }),
    })
    const result = await confirmImHere(input, harness)
    expect(result).toEqual({ notified: true, reason: 'confirmed' })
    expect(harness.requestGlance).toHaveBeenCalledTimes(1)
  })

  it('does not push when the check-in write fails', async () => {
    const harness = deps({
      createCheckIn: vi.fn(async () => {
        throw new Error('rls')
      }),
    })
    await expect(confirmImHere(input, harness)).rejects.toThrow('rls')
    expect(harness.writePresence).not.toHaveBeenCalled()
    expect(harness.requestGlance).not.toHaveBeenCalled()
  })
})
