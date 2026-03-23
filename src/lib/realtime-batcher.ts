/**
 * RealtimeBatcher — Presence Batching Middleware
 *
 * When a venue goes viral and 500 users react simultaneously, Supabase broadcasts
 * 500 individual WebSocket payloads. Flushing each one into React state individually
 * would lock the main thread and drop frames.
 *
 * This middleware accumulates incoming events into time-bucketed batches and flushes
 * them to the React state pipeline at a configurable interval (default: 2 seconds),
 * collapsing duplicate operations and respecting standard frame budgets.
 */

export type BatchEventType = 'pulse_insert' | 'pulse_update' | 'reaction' | 'presence' | 'venue_update'

export interface BatchEvent<T = unknown> {
  type: BatchEventType
  key: string          // Dedup key (e.g. pulseId, venueId)
  payload: T
  timestamp: number
}

export interface BatchFlush<T = unknown> {
  events: BatchEvent<T>[]
  droppedCount: number // Number of duplicate events collapsed
  batchDurationMs: number
}

type FlushCallback<T = unknown> = (batch: BatchFlush<T>) => void

const DEFAULT_INTERVAL_MS = 2000
const MAX_BUFFER_SIZE = 500

export class RealtimeBatcher<T = unknown> {
  private buffer: Map<string, BatchEvent<T>> = new Map()
  private droppedCount = 0
  private batchStartTime = Date.now()
  private intervalId: ReturnType<typeof setInterval> | null = null
  private flushCallback: FlushCallback<T> | null = null
  private intervalMs: number

  constructor(intervalMs = DEFAULT_INTERVAL_MS) {
    this.intervalMs = intervalMs
  }

  /**
   * Start the batching timer. Events will be flushed at each interval tick.
   */
  start(callback: FlushCallback<T>): void {
    this.flushCallback = callback
    this.batchStartTime = Date.now()

    if (this.intervalId) clearInterval(this.intervalId)
    this.intervalId = setInterval(() => this.flush(), this.intervalMs)
  }

  /**
   * Stop the batching timer and flush any remaining events.
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.flush()
    this.flushCallback = null
  }

  /**
   * Enqueue an incoming realtime event. Duplicate keys within the same
   * batch window are collapsed — only the latest payload is retained.
   */
  push(event: BatchEvent<T>): void {
    if (this.buffer.has(event.key)) {
      this.droppedCount++
    }
    // Always keep the latest event for a given key
    this.buffer.set(event.key, event)

    // Safety valve: flush immediately if buffer is dangerously large
    if (this.buffer.size >= MAX_BUFFER_SIZE) {
      this.flush()
    }
  }

  /**
   * Immediately flush all buffered events to the callback.
   */
  flush(): void {
    if (this.buffer.size === 0 && this.droppedCount === 0) return

    const events = Array.from(this.buffer.values())
    const batch: BatchFlush<T> = {
      events,
      droppedCount: this.droppedCount,
      batchDurationMs: Date.now() - this.batchStartTime,
    }

    this.buffer.clear()
    this.droppedCount = 0
    this.batchStartTime = Date.now()

    this.flushCallback?.(batch)
  }

  /**
   * Get the current buffer size (for diagnostics).
   */
  get pending(): number {
    return this.buffer.size
  }
}

/**
 * Singleton instances for each event category.
 * Separating by type allows independent flush cadences if needed.
 */
export const reactionBatcher = new RealtimeBatcher(2000)   // Reactions: 2s ticks
export const presenceBatcher = new RealtimeBatcher(3000)    // Presence: 3s ticks (less urgent)
export const pulseBatcher = new RealtimeBatcher(1500)       // New pulses: 1.5s ticks (important)
