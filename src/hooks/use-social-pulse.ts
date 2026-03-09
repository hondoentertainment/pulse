import { useKV } from '@github/spark/hooks'
import { useEffect, useRef } from 'react'
import { 
  SocialPost, 
  TrackedHashtag, 
  SocialPulseWindow,
  VenuePulseWindow,
  PulseCorrelation,
  TimeWindowSize,
  Pulse,
  Venue
} from '@/lib/types'
import { TwitterIngestionService, processIngestedPosts, deduplicatePosts } from '@/lib/twitter-ingestion'
import { 
  createSocialPulseWindow, 
  createVenuePulseWindow,
  calculateCorrelation,
  mapSocialPostToVenue
} from '@/lib/social-pulse-engine'

export function useSocialPulseIngestion(
  trackedHashtags: TrackedHashtag[],
  venues: Venue[],
  pollingIntervalMs: number = 60000
) {
  const [socialPosts, setSocialPosts] = useKV<SocialPost[]>('socialPosts', [])
  const twitterService = useRef(new TwitterIngestionService())

  useEffect(() => {
    if (!trackedHashtags || trackedHashtags.length === 0) return

    const poll = async () => {
      const activeHashtags = trackedHashtags.filter(h => h.active)
      
      for (const hashtag of activeHashtags) {
        const existingPostIds = new Set((socialPosts || []).map(p => p.postId))
        
        try {
          const newPosts = await twitterService.current.pollHashtag(hashtag, existingPostIds)
          const processedPosts = processIngestedPosts(newPosts)
          
          const hashtagVenueMap = new Map<string, string>()
          trackedHashtags.forEach(h => {
            if (h.venueId) {
              hashtagVenueMap.set(h.hashtag, h.venueId)
            }
          })
          
          const postsWithVenues = processedPosts.map(post => ({
            ...post,
            venueId: mapSocialPostToVenue(post, venues || [], hashtagVenueMap)
          }))
          
          if (postsWithVenues.length > 0) {
            setSocialPosts((current) => {
              const deduplicated = deduplicatePosts(current || [], postsWithVenues)
              return [...(current || []), ...deduplicated]
            })
          }
        } catch (error) {
          console.error(`Failed to poll hashtag ${hashtag.hashtag}:`, error)
        }
      }
    }

    poll()
    const interval = setInterval(poll, pollingIntervalMs)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackedHashtags, venues, pollingIntervalMs])

  return { socialPosts, setSocialPosts }
}

export function useSocialPulseWindows(
  socialPosts: SocialPost[],
  trackedHashtags: TrackedHashtag[]
) {
  const [windows, setWindows] = useKV<SocialPulseWindow[]>('socialPulseWindows', [])

  useEffect(() => {
    if (!socialPosts || socialPosts.length === 0) return

    const calculateWindows = () => {
      const now = new Date()
      const newWindows: SocialPulseWindow[] = []
      
      const windowConfigs: { size: TimeWindowSize; minutes: number }[] = [
        { size: '5min', minutes: 5 },
        { size: '15min', minutes: 15 },
        { size: '60min', minutes: 60 }
      ]

      for (const hashtag of trackedHashtags) {
        if (!hashtag.active) continue
        
        const hashtagPosts = socialPosts.filter(p => p.hashtag === hashtag.hashtag)
        
        for (const config of windowConfigs) {
          const startTime = new Date(now.getTime() - config.minutes * 60 * 1000)
          const window = createSocialPulseWindow(
            hashtag.hashtag,
            hashtagPosts,
            config.size,
            startTime,
            now,
            hashtag.venueId
          )
          newWindows.push(window)
        }
      }
      
      setWindows((current) => {
        const cutoffTime = new Date(now.getTime() - 4 * 60 * 60 * 1000)
        const recentWindows = (current || []).filter(w => 
          new Date(w.createdAt) > cutoffTime
        )
        return [...recentWindows, ...newWindows]
      })
    }

    calculateWindows()
    const interval = setInterval(calculateWindows, 5 * 60 * 1000)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socialPosts, trackedHashtags])

  return windows
}

export function useVenuePulseWindows(
  pulses: Pulse[],
  venues: Venue[]
) {
  const [windows, setWindows] = useKV<VenuePulseWindow[]>('venuePulseWindows', [])

  useEffect(() => {
    if (!pulses || !venues || venues.length === 0) return

    const calculateWindows = () => {
      const now = new Date()
      const newWindows: VenuePulseWindow[] = []
      
      const windowConfigs: { size: TimeWindowSize; minutes: number }[] = [
        { size: '5min', minutes: 5 },
        { size: '15min', minutes: 15 },
        { size: '60min', minutes: 60 }
      ]

      for (const venue of venues) {
        for (const config of windowConfigs) {
          const startTime = new Date(now.getTime() - config.minutes * 60 * 1000)
          const window = createVenuePulseWindow(
            venue.id,
            pulses,
            venue,
            config.size,
            startTime,
            now
          )
          newWindows.push(window)
        }
      }
      
      setWindows((current) => {
        const cutoffTime = new Date(now.getTime() - 4 * 60 * 60 * 1000)
        const recentWindows = (current || []).filter(w => 
          new Date(w.createdAt) > cutoffTime
        )
        return [...recentWindows, ...newWindows]
      })
    }

    calculateWindows()
    const interval = setInterval(calculateWindows, 5 * 60 * 1000)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulses, venues])

  return windows
}

export function usePulseCorrelations(
  socialWindows: SocialPulseWindow[],
  venueWindows: VenuePulseWindow[],
  trackedHashtags: TrackedHashtag[]
) {
  const [correlations, setCorrelations] = useKV<PulseCorrelation[]>('pulseCorrelations', [])

  useEffect(() => {
    if (!socialWindows || !venueWindows || !trackedHashtags) return

    const calculateCorrelations = () => {
      const newCorrelations: PulseCorrelation[] = []
      
      const venuesWithHashtags = trackedHashtags
        .filter(h => h.active && h.venueId)
        .map(h => h.venueId!)
      
      const uniqueVenueIds = [...new Set(venuesWithHashtags)]
      
      for (const venueId of uniqueVenueIds) {
        const socialWindows60 = socialWindows
          .filter(w => w.venueId === venueId && w.windowSize === '5min')
          .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
          .slice(-12)
        
        const venueWindows60 = venueWindows
          .filter(w => w.venueId === venueId && w.windowSize === '5min')
          .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
          .slice(-12)
        
        if (socialWindows60.length >= 6 && venueWindows60.length >= 6) {
          const correlation60 = calculateCorrelation(
            socialWindows60,
            venueWindows60,
            venueId,
            '60min'
          )
          newCorrelations.push(correlation60)
        }
        
        const socialWindows120 = socialWindows
          .filter(w => w.venueId === venueId && w.windowSize === '5min')
          .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
          .slice(-24)
        
        const venueWindows120 = venueWindows
          .filter(w => w.venueId === venueId && w.windowSize === '5min')
          .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
          .slice(-24)
        
        if (socialWindows120.length >= 12 && venueWindows120.length >= 12) {
          const correlation120 = calculateCorrelation(
            socialWindows120,
            venueWindows120,
            venueId,
            '120min'
          )
          newCorrelations.push(correlation120)
        }
      }
      
      setCorrelations((current) => {
        const cutoffTime = new Date(Date.now() - 2 * 60 * 60 * 1000)
        const recentCorrelations = (current || []).filter(c => 
          new Date(c.calculatedAt) > cutoffTime
        )
        return [...recentCorrelations, ...newCorrelations]
      })
    }

    calculateCorrelations()
    const interval = setInterval(calculateCorrelations, 10 * 60 * 1000)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socialWindows, venueWindows, trackedHashtags])

  return correlations
}
