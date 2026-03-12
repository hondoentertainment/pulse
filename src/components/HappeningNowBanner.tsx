"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import type { Venue } from "@/lib/types"

interface HappeningNowBannerProps {
  venues: Venue[]
  userLocation: { lat: number; lng: number } | null
  onVenueClick: (venue: Venue) => void
}

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3958.8 // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function getEnergyEmoji(pulseScore: number): string {
  if (pulseScore >= 85) return "⚡"
  if (pulseScore >= 70) return "🔥"
  return "😌"
}

export default function HappeningNowBanner({
  venues,
  userLocation,
  onVenueClick,
}: HappeningNowBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  const [dismissedVenueIds, setDismissedVenueIds] = useState<Set<string>>(
    () => new Set()
  )
  const [isPaused, setIsPaused] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number | null>(null)
  const scrollPositionRef = useRef(0)

  const qualifyingVenues = useMemo(() => {
    if (!userLocation) return []
    return venues.filter((venue) => {
      if (venue.pulseScore < 60) return false
      const distance = haversineDistance(
        userLocation.lat,
        userLocation.lng,
        venue.location.lat,
        venue.location.lng
      )
      return distance <= 5
    })
  }, [venues, userLocation])

  const hasNewVenues = useMemo(() => {
    return qualifyingVenues.some((v) => !dismissedVenueIds.has(v.id))
  }, [qualifyingVenues, dismissedVenueIds])

  // Reset dismissed state when new qualifying venues appear
  useEffect(() => {
    if (dismissed && hasNewVenues) {
      setDismissed(false)
    }
  }, [hasNewVenues, dismissed])

  const handleDismiss = useCallback(() => {
    setDismissed(true)
    setDismissedVenueIds(new Set(qualifyingVenues.map((v) => v.id)))
  }, [qualifyingVenues])

  // Auto-scroll animation
  useEffect(() => {
    const scrollEl = scrollRef.current
    if (!scrollEl || isPaused || qualifyingVenues.length < 2) return

    const speed = 0.5 // pixels per frame

    const animate = () => {
      scrollPositionRef.current += speed
      if (scrollPositionRef.current >= scrollEl.scrollWidth / 2) {
        scrollPositionRef.current = 0
      }
      scrollEl.scrollLeft = scrollPositionRef.current
      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isPaused, qualifyingVenues.length])

  const isVisible = !dismissed && qualifyingVenues.length >= 2

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: -48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -48, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className={cn(
            "sticky top-0 z-40 h-12 flex items-center",
            "bg-gradient-to-r from-primary/10 to-accent/10",
            "backdrop-blur-md border-b border-white/10"
          )}
        >
          <div
            ref={scrollRef}
            className="flex-1 overflow-hidden whitespace-nowrap"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            onTouchStart={() => setIsPaused(true)}
            onTouchEnd={() => setIsPaused(false)}
          >
            <div className="inline-flex items-center gap-3 px-3">
              {/* Duplicate for seamless loop */}
              {[...qualifyingVenues, ...qualifyingVenues].map((venue, index) => (
                <button
                  key={`${venue.id}-${index}`}
                  onClick={() => onVenueClick(venue)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1 rounded-full",
                    "bg-white/10 hover:bg-white/20 transition-colors",
                    "text-sm font-medium text-foreground",
                    "shrink-0 cursor-pointer"
                  )}
                >
                  <span>{venue.name}</span>
                  <span>{getEnergyEmoji(venue.pulseScore)}</span>
                  <span className="text-xs text-muted-foreground">
                    {venue.pulseScore}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className={cn(
              "shrink-0 p-2 mr-1 rounded-full",
              "hover:bg-white/10 transition-colors",
              "text-muted-foreground hover:text-foreground"
            )}
            aria-label="Dismiss happening now banner"
          >
            <X size={16} weight="bold" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
