import { useState, useEffect, useRef } from 'react'
import { Venue } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MagnifyingGlass, MapPin, X, Microphone, Info } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { PulseScore } from '@/components/PulseScore'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useVoiceSearch, parseVoiceInput, VOICE_COMMAND_EXAMPLES, VOICE_FALLBACK_MESSAGE } from '@/hooks/use-voice-search'
import { toast } from 'sonner'

interface MapSearchProps {
  venues: Venue[]
  onVenueSelect: (venue: Venue) => void
  userLocation: { lat: number; lng: number } | null
  /** Optional callback for navigate commands (e.g. "Open trending") */
  onNavigate?: (view: string) => void
}

export function MapSearch({ venues, onVenueSelect, userLocation, onNavigate }: MapSearchProps) {
  const [query, setQuery] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [voiceParseFailure, setVoiceParseFailure] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const {
    isListening,
    transcript,
    isSupported,
    error,
    startListening,
    stopListening,
    resetTranscript,
    showFirstUseTooltip,
    dismissFirstUseTooltip,
  } = useVoiceSearch()

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 3958.8
    const p1 = (lat1 * Math.PI) / 180
    const p2 = (lat2 * Math.PI) / 180
    const dp = ((lat2 - lat1) * Math.PI) / 180
    const dl = ((lon2 - lon1) * Math.PI) / 180

    const a =
      Math.sin(dp / 2) * Math.sin(dp / 2) +
      Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c
  }

  const filteredVenues = query.trim()
    ? venues.filter((venue) => {
        const searchQuery = query.toLowerCase()
        const matchesName = venue.name.toLowerCase().includes(searchQuery)
        const matchesCategory = venue.category?.toLowerCase().includes(searchQuery)
        return matchesName || matchesCategory
      })
    : []

  const sortedResults = userLocation
    ? filteredVenues.sort((a, b) => {
        const distA = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          a.location.lat,
          a.location.lng
        )
        const distB = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          b.location.lat,
          b.location.lng
        )
        return distA - distB
      })
    : filteredVenues

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Process voice transcript through guardrailed parser
  useEffect(() => {
    if (transcript && !isListening) {
      setVoiceParseFailure(false)
      const parsed = parseVoiceInput(transcript)

      if (parsed) {
        switch (parsed.type) {
          case 'search':
            // Set query to the extracted venue name
            setQuery(parsed.value)
            setIsFocused(true)
            inputRef.current?.focus()
            break
          case 'filter':
            // Set query to the category for filtering
            setQuery(parsed.value)
            setIsFocused(true)
            inputRef.current?.focus()
            break
          case 'navigate':
            if (onNavigate) {
              onNavigate(parsed.value)
            } else {
              toast.info(`Navigate to: ${parsed.value}`, {
                description: 'Navigation via voice is available from the main screen',
              })
            }
            break
        }
      } else {
        // Fallback: could not parse into supported command type
        setVoiceParseFailure(true)
        toast.error('Command not recognized', {
          description: VOICE_FALLBACK_MESSAGE,
          duration: 4000,
        })
        // Still set raw transcript as search query as a best-effort fallback
        setQuery(transcript)
        setIsFocused(true)
        inputRef.current?.focus()
      }
    }
  }, [transcript, isListening, onNavigate])

  useEffect(() => {
    if (error) {
      toast.error('Voice search error', {
        description: error
      })
    }
  }, [error])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (sortedResults.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, sortedResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && sortedResults[selectedIndex]) {
      e.preventDefault()
      handleSelectVenue(sortedResults[selectedIndex])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setIsFocused(false)
      inputRef.current?.blur()
    }
  }

  const handleSelectVenue = (venue: Venue) => {
    onVenueSelect(venue)
    setQuery('')
    setIsFocused(false)
    inputRef.current?.blur()
  }

  const handleClear = () => {
    setQuery('')
    setVoiceParseFailure(false)
    resetTranscript()
    inputRef.current?.focus()
  }

  const handleVoiceSearch = () => {
    if (!isSupported) {
      toast.error('Voice search not supported', {
        description: 'Your browser does not support voice recognition'
      })
      return
    }

    setVoiceParseFailure(false)

    if (isListening) {
      stopListening()
    } else {
      startListening()
      toast.success('Listening...', {
        description: 'Try: "Find bars nearby" or "Show live music"',
        duration: 2000
      })
    }
  }

  const formatDistanceDisplay = (miles: number): string => {
    if (miles < 0.1) return 'Nearby'
    if (miles < 1) return `${(miles * 5280).toFixed(0)} ft`
    return `${miles.toFixed(1)} mi`
  }

  const showResults = isFocused && query.trim().length > 0

  return (
    <div className="relative w-full">
      <div className="relative">
        <MagnifyingGlass
          size={20}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          weight="bold"
        />
        <Input
          ref={inputRef}
          type="text"
          placeholder={isListening ? 'Listening...' : 'Search venues...'}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setVoiceParseFailure(false) }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setTimeout(() => setIsFocused(false), 200)
          }}
          onKeyDown={handleKeyDown}
          className={cn(
            'pl-10 bg-card/95 backdrop-blur-sm border-border h-11 focus:ring-2 focus:ring-accent transition-all',
            query ? 'pr-20' : 'pr-12',
            isListening && 'ring-2 ring-accent animate-pulse'
          )}
        />
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {query && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={handleClear}
            >
              <X size={16} weight="bold" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className={cn(
              'h-8 w-8 transition-colors',
              isListening && 'bg-accent text-accent-foreground animate-pulse',
              !isSupported && 'opacity-50 cursor-not-allowed'
            )}
            onClick={handleVoiceSearch}
            disabled={!isSupported}
          >
            <Microphone
              size={18}
              weight={isListening ? 'fill' : 'bold'}
              className={isListening ? 'animate-pulse' : ''}
            />
          </Button>
        </div>
      </div>

      {/* First-use tooltip explaining supported commands */}
      <AnimatePresence>
        {showFirstUseTooltip && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="absolute top-full left-0 right-0 mt-2 z-50"
          >
            <Card className="bg-accent/5 backdrop-blur-md border-accent/20 shadow-lg p-3">
              <div className="flex items-start gap-2">
                <Info size={16} weight="fill" className="text-accent mt-0.5 flex-shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <p className="text-xs font-semibold text-accent">Voice Search Commands</p>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Say one of these commands (10 second limit):
                  </p>
                  <ul className="text-[11px] text-muted-foreground space-y-0.5">
                    {VOICE_COMMAND_EXAMPLES.map((ex) => (
                      <li key={ex.text} className="flex items-center gap-1.5">
                        <span className="text-accent">*</span>
                        <span>&ldquo;{ex.text}&rdquo;</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={dismissFirstUseTooltip}
                    className="text-[10px] h-6 px-2 text-accent hover:text-accent-foreground"
                  >
                    Got it
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inline example commands shown when voice is active and no results yet */}
      <AnimatePresence>
        {isListening && !query && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="absolute top-full left-0 right-0 mt-2 z-50"
          >
            <Card className="bg-card/98 backdrop-blur-md border-border shadow-lg p-3">
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">Try saying:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                {VOICE_COMMAND_EXAMPLES.map((ex) => (
                  <li key={ex.text} className="flex items-center gap-2">
                    <span className="text-accent font-medium text-[10px]">Try:</span>
                    <span>&ldquo;{ex.text}&rdquo;</span>
                  </li>
                ))}
              </ul>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fallback message when voice command was not recognized */}
      <AnimatePresence>
        {voiceParseFailure && !isListening && !showResults && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="absolute top-full left-0 right-0 mt-2 z-50"
          >
            <Card className="bg-amber-500/5 backdrop-blur-md border-amber-500/20 shadow-lg p-3">
              <p className="text-xs text-amber-400">
                {VOICE_FALLBACK_MESSAGE}
              </p>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showResults && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-2 z-50"
          >
            <Card className="bg-card/98 backdrop-blur-md border-border shadow-2xl overflow-hidden">
              {sortedResults.length > 0 ? (
                <ScrollArea className="max-h-[300px]">
                  <div className="p-1">
                    {sortedResults.map((venue, index) => {
                      const distance = userLocation
                        ? calculateDistance(
                            userLocation.lat,
                            userLocation.lng,
                            venue.location.lat,
                            venue.location.lng
                          )
                        : undefined

                      return (
                        <button
                          key={venue.id}
                          onClick={() => handleSelectVenue(venue)}
                          onMouseEnter={() => setSelectedIndex(index)}
                          className={cn(
                            'w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left',
                            selectedIndex === index
                              ? 'bg-accent/10 border border-accent/20'
                              : 'hover:bg-muted/50'
                          )}
                        >
                          <div className="flex-shrink-0">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                              <MapPin size={20} weight="fill" className="text-accent" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-sm truncate">{venue.name}</h4>
                            <div className="flex items-center gap-2 mt-0.5">
                              {venue.category && (
                                <span className="text-xs text-muted-foreground uppercase font-mono">
                                  {venue.category}
                                </span>
                              )}
                              {distance !== undefined && venue.category && (
                                <span className="text-xs text-muted-foreground">*</span>
                              )}
                              {distance !== undefined && (
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceDisplay(distance)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            <PulseScore score={venue.pulseScore} size="xs" showLabel={false} />
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </ScrollArea>
              ) : (
                <div className="p-6 text-center">
                  <p className="text-sm text-muted-foreground">No venues found</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Try searching by name or category
                  </p>
                </div>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
