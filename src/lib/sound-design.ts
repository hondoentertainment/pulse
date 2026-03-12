export type SoundType =
  | 'tap'
  | 'checkin'
  | 'reaction'
  | 'notification'
  | 'energy_surge'
  | 'success'
  | 'error'

export interface SoundDesign {
  play: (sound: SoundType) => void
  setEnabled: (enabled: boolean) => void
  isEnabled: () => boolean
}

const STORAGE_KEY = 'pulse_sounds_enabled'
const MASTER_VOLUME = 0.15

function getStoredPreference(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === null) return true
    return stored === 'true'
  } catch {
    return true
  }
}

function setStoredPreference(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled))
  } catch {
    // localStorage may be unavailable
  }
}

type SoundGenerator = (ctx: AudioContext, destination: AudioNode) => void

function playTap(ctx: AudioContext, destination: AudioNode): void {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'sine'
  osc.frequency.setValueAtTime(1800, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.01)

  gain.gain.setValueAtTime(MASTER_VOLUME, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.01)

  osc.connect(gain)
  gain.connect(destination)

  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 0.01)
}

function playCheckin(ctx: AudioContext, destination: AudioNode): void {
  const now = ctx.currentTime

  // First note
  const osc1 = ctx.createOscillator()
  const gain1 = ctx.createGain()
  osc1.type = 'sine'
  osc1.frequency.setValueAtTime(523.25, now) // C5
  gain1.gain.setValueAtTime(MASTER_VOLUME, now)
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
  osc1.connect(gain1)
  gain1.connect(destination)
  osc1.start(now)
  osc1.stop(now + 0.1)

  // Second note (higher)
  const osc2 = ctx.createOscillator()
  const gain2 = ctx.createGain()
  osc2.type = 'sine'
  osc2.frequency.setValueAtTime(659.25, now + 0.08) // E5
  gain2.gain.setValueAtTime(0.001, now)
  gain2.gain.setValueAtTime(MASTER_VOLUME, now + 0.08)
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.2)
  osc2.connect(gain2)
  gain2.connect(destination)
  osc2.start(now + 0.08)
  osc2.stop(now + 0.2)
}

function playReaction(ctx: AudioContext, destination: AudioNode): void {
  const now = ctx.currentTime
  const bufferSize = ctx.sampleRate * 0.05
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)

  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2))
  }

  const source = ctx.createBufferSource()
  source.buffer = buffer

  const bandpass = ctx.createBiquadFilter()
  bandpass.type = 'bandpass'
  bandpass.frequency.setValueAtTime(2000, now)
  bandpass.Q.setValueAtTime(5, now)

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(MASTER_VOLUME, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05)

  source.connect(bandpass)
  bandpass.connect(gain)
  gain.connect(destination)

  source.start(now)
  source.stop(now + 0.05)
}

function playNotification(ctx: AudioContext, destination: AudioNode): void {
  const now = ctx.currentTime

  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(1046.5, now) // C6

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(MASTER_VOLUME, now)
  gain.gain.setValueAtTime(MASTER_VOLUME * 0.8, now + 0.05)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3)

  // Simulated reverb via delay
  const delay = ctx.createDelay()
  delay.delayTime.setValueAtTime(0.08, now)

  const delayGain = ctx.createGain()
  delayGain.gain.setValueAtTime(0.3, now)

  osc.connect(gain)
  gain.connect(destination)
  gain.connect(delay)
  delay.connect(delayGain)
  delayGain.connect(destination)

  osc.start(now)
  osc.stop(now + 0.3)
}

function playEnergySurge(ctx: AudioContext, destination: AudioNode): void {
  const now = ctx.currentTime
  const duration = 0.2
  const bufferSize = Math.floor(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)

  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1
  }

  const source = ctx.createBufferSource()
  source.buffer = buffer

  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(400, now)
  filter.frequency.exponentialRampToValueAtTime(4000, now + duration)
  filter.Q.setValueAtTime(2, now)

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.001, now)
  gain.gain.linearRampToValueAtTime(MASTER_VOLUME, now + 0.05)
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration)

  source.connect(filter)
  filter.connect(gain)
  gain.connect(destination)

  source.start(now)
  source.stop(now + duration)
}

function playSuccess(ctx: AudioContext, destination: AudioNode): void {
  const now = ctx.currentTime
  const notes = [523.25, 659.25, 783.99] // C5, E5, G5

  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const startTime = now + i * 0.12

    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, startTime)

    gain.gain.setValueAtTime(0.001, now)
    gain.gain.setValueAtTime(MASTER_VOLUME, startTime)
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15)

    osc.connect(gain)
    gain.connect(destination)

    osc.start(startTime)
    osc.stop(startTime + 0.15)
  })
}

function playError(ctx: AudioContext, destination: AudioNode): void {
  const now = ctx.currentTime

  const osc = ctx.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(120, now)
  osc.frequency.linearRampToValueAtTime(80, now + 0.15)

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(MASTER_VOLUME * 0.7, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15)

  // Low-pass to soften the sawtooth harshness
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(400, now)

  osc.connect(filter)
  filter.connect(gain)
  gain.connect(destination)

  osc.start(now)
  osc.stop(now + 0.15)
}

const SOUND_MAP: Record<SoundType, SoundGenerator> = {
  tap: playTap,
  checkin: playCheckin,
  reaction: playReaction,
  notification: playNotification,
  energy_surge: playEnergySurge,
  success: playSuccess,
  error: playError,
}

export function createSoundDesign(): SoundDesign {
  let audioContext: AudioContext | null = null
  let enabled = getStoredPreference()

  function getContext(): AudioContext {
    if (audioContext === null) {
      audioContext = new AudioContext()
    }
    return audioContext
  }

  return {
    play(sound: SoundType): void {
      if (!enabled) return

      try {
        const ctx = getContext()

        // Resume context if suspended (browser autoplay policy)
        if (ctx.state === 'suspended') {
          void ctx.resume()
        }

        const generator = SOUND_MAP[sound]
        generator(ctx, ctx.destination)
      } catch {
        // Silently fail - audio is non-critical
      }
    },

    setEnabled(value: boolean): void {
      enabled = value
      setStoredPreference(value)
    },

    isEnabled(): boolean {
      return enabled
    },
  }
}
