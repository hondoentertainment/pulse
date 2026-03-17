import { useState, useEffect, useRef, useCallback } from 'react'

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message: string
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

declare global {
  interface Window {
    SpeechRecognition: {
      new (): SpeechRecognition
    }
    webkitSpeechRecognition: {
      new (): SpeechRecognition
    }
  }
}

/** Maximum voice input duration in milliseconds */
const MAX_LISTEN_DURATION_MS = 10_000

/**
 * The 3 supported voice command types:
 * 1. search  — search venue by name (e.g. "Find The Blue Bar")
 * 2. filter  — filter by category (e.g. "Show bars", "Show live music")
 * 3. navigate — navigate to a view (e.g. "Open trending", "Go to map")
 */
export type VoiceCommandType = 'search' | 'filter' | 'navigate'

export interface ParsedVoiceCommand {
  type: VoiceCommandType
  /** The extracted argument (venue name, category, or view name) */
  value: string
  /** Original raw transcript */
  raw: string
}

/** Example commands shown in the UI when voice search activates */
export const VOICE_COMMAND_EXAMPLES = [
  { text: "Find bars nearby", type: 'search' as VoiceCommandType },
  { text: "Show live music", type: 'filter' as VoiceCommandType },
  { text: "Open trending", type: 'navigate' as VoiceCommandType },
]

/** Fallback message when voice input cannot be parsed */
export const VOICE_FALLBACK_MESSAGE =
  "I didn't catch that. Try saying 'Find [venue name]' or 'Show [category]'"

const NAVIGATE_TARGETS = ['trending', 'discover', 'map', 'notifications', 'profile']

const FILTER_CATEGORIES = [
  'bars', 'bar', 'nightclub', 'nightclubs', 'club', 'clubs',
  'restaurant', 'restaurants', 'food',
  'cafe', 'cafes', 'coffee',
  'lounge', 'lounges', 'brewery', 'breweries',
  'live music', 'music', 'gallery', 'galleries',
]

/**
 * Parse a raw transcript into a structured voice command.
 * Returns null if the input cannot be parsed into one of the 3 supported types.
 */
export function parseVoiceInput(transcript: string): ParsedVoiceCommand | null {
  const text = transcript.toLowerCase().trim()
  if (!text) return null

  // 1. Navigate commands: "open trending", "go to map", "navigate to profile"
  for (const target of NAVIGATE_TARGETS) {
    if (
      text.includes(`open ${target}`) ||
      text.includes(`go to ${target}`) ||
      text.includes(`navigate to ${target}`) ||
      text.includes(`switch to ${target}`)
    ) {
      return { type: 'navigate', value: target, raw: transcript }
    }
  }

  // 2. Filter commands: "show bars", "filter nightclubs", "show live music"
  for (const cat of FILTER_CATEGORIES) {
    if (
      text.includes(`show ${cat}`) ||
      text.includes(`filter ${cat}`) ||
      text.includes(`display ${cat}`) ||
      text.includes(`only ${cat}`)
    ) {
      return { type: 'filter', value: cat, raw: transcript }
    }
  }

  // 3. Search commands: "find <name>", "search <name>", "look for <name>"
  const searchPatterns = [
    /(?:find|search|search for|look for|look up)\s+(.+)/i,
  ]
  for (const pattern of searchPatterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      return { type: 'search', value: match[1].trim(), raw: transcript }
    }
  }

  // If text includes "nearby" with a category-like word, treat as filter
  for (const cat of FILTER_CATEGORIES) {
    if (text.includes(cat)) {
      return { type: 'filter', value: cat, raw: transcript }
    }
  }

  return null
}

export function useVoiceSearch() {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [isSupported, setIsSupported] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showFirstUseTooltip, setShowFirstUseTooltip] = useState(false)
  const [hasUsedVoiceBefore, setHasUsedVoiceBefore] = useState(() => {
    try { return localStorage.getItem('pulse_voice_used') === '1' } catch { return false }
  })
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

    if (SpeechRecognition) {
      setIsSupported(true)
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = 'en-US'

      recognition.onstart = () => {
        setIsListening(true)
        setError(null)
      }

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interimTranscript = ''
        let finalTranscript = ''

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' '
          } else {
            interimTranscript += transcript
          }
        }

        setTranscript(finalTranscript || interimTranscript)
      }

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        setIsListening(false)
        clearListenTimeout()

        if (event.error === 'no-speech') {
          setError('No speech detected. Please try again.')
        } else if (event.error === 'audio-capture') {
          setError('Microphone not available')
        } else if (event.error === 'not-allowed') {
          setError('Microphone permission denied')
        } else {
          setError('Voice recognition error. Please try again.')
        }
      }

      recognition.onend = () => {
        setIsListening(false)
        clearListenTimeout()
      }

      recognitionRef.current = recognition
    } else {
      setIsSupported(false)
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
      clearListenTimeout()
    }
  }, [])

  const clearListenTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      setTranscript('')
      setError(null)

      // Show first-use tooltip if this is the first time
      if (!hasUsedVoiceBefore) {
        setShowFirstUseTooltip(true)
        setHasUsedVoiceBefore(true)
        try { localStorage.setItem('pulse_voice_used', '1') } catch { /* noop */ }
      }

      try {
        recognitionRef.current.start()

        // Enforce 10-second maximum listening duration
        timeoutRef.current = setTimeout(() => {
          if (recognitionRef.current) {
            recognitionRef.current.stop()
          }
        }, MAX_LISTEN_DURATION_MS)
      } catch {
        setError('Could not start voice recognition')
        setIsListening(false)
      }
    }
  }, [isListening, hasUsedVoiceBefore])

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop()
      clearListenTimeout()
    }
  }, [isListening, clearListenTimeout])

  const resetTranscript = useCallback(() => {
    setTranscript('')
    setError(null)
  }, [])

  const dismissFirstUseTooltip = useCallback(() => {
    setShowFirstUseTooltip(false)
  }, [])

  return {
    isListening,
    transcript,
    isSupported,
    error,
    startListening,
    stopListening,
    resetTranscript,
    showFirstUseTooltip,
    dismissFirstUseTooltip,
    parseVoiceInput,
  }
}
