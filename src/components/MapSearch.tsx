import { useCallback, useState, useEffect, useMemo, useRef } from 'react'
import { Venue } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MagnifyingGlass, MapPin, X, Microphone } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { PulseScore } from '@/components/PulseScore'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useVoiceSearch } from '@/hooks/use-voice-search'
import { toast } from 'sonner'
import { getSmartVenueSort } from '@/lib/contextual-intelligence'
import { getDayType, getTimeOfDay } from '@/lib/time-contextual-scoring'
import type { User } from '@/lib/types'

interface MapSearchProps {
  venues: Venue[]
  onVenueSelect: (venue: Venue) => void
  userLocation: { lat: number; lng: number } | null
}

export function MapSearch({ venues, onVenueSelect, userLocation }: MapSearchProps) {
  const [query, setQuery] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const {
    isListening,
    transcript,
    isSupported,
    error,
    startListening,
    stopListening,
    resetTranscript
  } = useVoiceSearch()

  const calculateDistance = useCallback((
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 3958.8
    const φ1 = (lat1 * Math.PI) / 180
    const φ2 = (lat2 * Math.PI) / 180
    const Δφ = ((lat2 - lat1) * Math.PI) / 180
    const Δλ = ((lon2 - lon1) * Math.PI) / 180

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c
  }, [])

  const filteredVenues = query.trim()
    ? venues.filter((venue) => {
      const searchQuery = query.toLowerCase()
      const matchesName = venue.name.toLowerCase().includes(searchQuery)
      const matchesCategory = venue.category?.toLowerCase().includes(searchQuery)
      return matchesName || matchesCategory
    })
    : []

  const sortedResults = userLocation
    ? (() => {
      const now = new Date()
      const neutralUser: User = {
        id: 'anonymous-search',
        username: 'guest',
        profilePhoto: '',
        friends: [],
        favoriteVenues: [],
        followedVenues: [],
        createdAt: now.toISOString(),
        venueCheckInHistory: {},
      }
      const contextualOrder = getSmartVenueSort(
        [...filteredVenues],
        neutralUser,
        getTimeOfDay(now),
        getDayType(now)
      )
      const contextualRank = new Map(contextualOrder.map((venue, index) => [venue.id, index]))
      return contextualOrder.sort((a, b) => {
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
        const rankA = contextualRank.get(a.id) ?? contextualOrder.length
        const rankB = contextualRank.get(b.id) ?? contextualOrder.length
        const scoreA = distA * 0.7 + rankA * 0.3
        const scoreB = distB * 0.7 + rankB * 0.3
        return scoreA - scoreB
      })
    })()
    : filteredVenues

  const suggestedVenues = useMemo(() => {
    const ranked = [...venues].sort((a, b) => {
      if (userLocation) {
        const distA = calculateDistance(userLocation.lat, userLocation.lng, a.location.lat, a.location.lng)
        const distB = calculateDistance(userLocation.lat, userLocation.lng, b.location.lat, b.location.lng)
        if (Math.abs(distA - distB) > 0.2) return distA - distB
      }
      return b.pulseScore - a.pulseScore
    })

    return ranked.slice(0, 4)
  }, [calculateDistance, venues, userLocation])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    if (transcript && !isListening) {
      setQuery(transcript)
      setIsFocused(true)
      inputRef.current?.focus()
    }
  }, [transcript, isListening])

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

    if (isListening) {
      stopListening()
    } else {
      startListening()
      toast.success('Listening...', {
        description: 'Try: "Coffee", "Electric", or "Neumos"',
        duration: 3000
      })
    }
  }

  const formatDistance = (miles: number): string => {
    if (miles < 0.1) return 'Nearby'
    if (miles < 1) return `${(miles * 5280).toFixed(0)} ft`
    return `${miles.toFixed(1)} mi`
  }

  const showResults = isFocused && query.trim().length > 0
  const showSuggestions = isFocused && query.trim().length === 0 && suggestedVenues.length > 0

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
          placeholder={isListening ? 'Listening...' : 'Search venues, vibes, or categories'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setTimeout(() => setIsFocused(false), 200)
          }}
          onKeyDown={handleKeyDown}
          className={cn(
            'pl-10 bg-background/70 backdrop-blur-sm border-border/80 h-11 focus:ring-2 focus:ring-accent transition-all shadow-none',
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

      <AnimatePresence>
        {(showResults || showSuggestions) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-2 z-50"
          >
            <Card className="bg-card/98 backdrop-blur-md border-border shadow-2xl overflow-hidden">
              {showSuggestions ? (
                <div className="p-2">
                  <div className="px-2 pb-2 pt-1">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                      Suggested nearby
                    </p>
                  </div>
                  <div className="grid gap-1">
                    {suggestedVenues.map((venue) => {
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
                          className="w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left hover:bg-muted/50"
                        >
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0">
                            <MapPin size={20} weight="fill" className="text-accent" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-sm truncate">{venue.name}</h4>
                            <div className="flex items-center gap-2 mt-0.5">
                              {venue.category && (
                                <span className="text-xs text-muted-foreground uppercase font-mono">
                                  {venue.category}
                                </span>
                              )}
                              {distance !== undefined && (
                                <>
                                  {venue.category && (
                                    <span className="text-xs text-muted-foreground">•</span>
                                  )}
                                  <span className="text-xs text-muted-foreground">
                                    {formatDistance(distance)}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <PulseScore score={venue.pulseScore} size="xs" showLabel={false} />
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : sortedResults.length > 0 ? (
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
                                <span className="text-xs text-muted-foreground">•</span>
                              )}
                              {distance !== undefined && (
                                <span className="text-xs text-muted-foreground">
                                  {formatDistance(distance)}
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
