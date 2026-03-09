import { useState, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { TrackedHashtag, Venue, Pulse } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { HashtagManager } from './HashtagManager'
import { SocialPulseGraph } from './SocialPulseGraph'
import { CorrelationOverlayChart } from './CorrelationOverlayChart'
import { CorrelationInsights } from './CorrelationInsights'
import { 
  useSocialPulseIngestion, 
  useSocialPulseWindows,
  useVenuePulseWindows,
  usePulseCorrelations
} from '@/hooks/use-social-pulse'
import { 
  ChartLine,
  ArrowLeft,
  Hash,
  Lightning,
  Clock
} from '@phosphor-icons/react'

interface SocialPulseDashboardProps {
  venues: Venue[]
  pulses: Pulse[]
  onBack: () => void
}

export function SocialPulseDashboard({ venues, pulses, onBack }: SocialPulseDashboardProps) {
  const [trackedHashtags, setTrackedHashtags] = useKV<TrackedHashtag[]>('trackedHashtags', [])
  const [selectedHashtag, setSelectedHashtag] = useState<string>('all')
  const [selectedVenue, setSelectedVenue] = useState<string>('all')
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const { socialPosts } = useSocialPulseIngestion(
    trackedHashtags || [],
    venues,
    60000
  )

  const socialWindows = useSocialPulseWindows(
    socialPosts || [],
    trackedHashtags || []
  )

  const venueWindows = useVenuePulseWindows(
    pulses,
    venues
  )

  const correlations = usePulseCorrelations(
    socialWindows || [],
    venueWindows || [],
    trackedHashtags || []
  )

  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(new Date())
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  const handleAddHashtag = (hashtag: Omit<TrackedHashtag, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newHashtag: TrackedHashtag = {
      ...hashtag,
      id: `hashtag-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    setTrackedHashtags((current) => [...(current || []), newHashtag])
  }

  const handleRemoveHashtag = (id: string) => {
    setTrackedHashtags((current) => (current || []).filter(h => h.id !== id))
  }

  const handleToggleActive = (id: string, active: boolean) => {
    setTrackedHashtags((current) =>
      (current || []).map(h =>
        h.id === id ? { ...h, active, updatedAt: new Date().toISOString() } : h
      )
    )
  }

  const handleUpdateVenueMapping = (id: string, venueId: string | undefined) => {
    setTrackedHashtags((current) =>
      (current || []).map(h =>
        h.id === id ? { ...h, venueId, updatedAt: new Date().toISOString() } : h
      )
    )
  }

  const filteredSocialWindows = selectedHashtag === 'all'
    ? socialWindows || []
    : (socialWindows || []).filter(w => w.hashtag === selectedHashtag)

  const filteredVenueWindows = selectedVenue === 'all'
    ? venueWindows || []
    : (venueWindows || []).filter(w => w.venueId === selectedVenue)

  const filteredCorrelations = selectedVenue === 'all'
    ? correlations || []
    : (correlations || []).filter(c => c.venueId === selectedVenue)

  const activeHashtags = (trackedHashtags || []).filter(h => h.active)
  const totalPosts = (socialPosts || []).length
  const recentPosts = (socialPosts || []).filter(p => 
    new Date(p.timestamp) > new Date(Date.now() - 60 * 60 * 1000)
  ).length

  const timeSinceUpdate = Math.floor((Date.now() - lastUpdate.getTime()) / 1000)

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-40 bg-card/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft size={20} weight="bold" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                  <ChartLine size={32} weight="bold" className="text-accent" />
                  <span className="bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
                    Social Pulse
                  </span>
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Real-time correlation between social media and venue activity
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Last Update</div>
                <div className="flex items-center gap-1.5 text-sm font-mono">
                  <Clock size={14} className="text-accent" />
                  <span>{timeSinceUpdate}s ago</span>
                </div>
              </div>
              <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            </div>
          </div>

          <div className="flex gap-4 mt-4">
            <Card className="flex-1">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Hash size={20} weight="fill" />
                    <span className="text-sm">Active Hashtags</span>
                  </div>
                  <div className="text-2xl font-bold">{activeHashtags.length}</div>
                </div>
              </CardContent>
            </Card>

            <Card className="flex-1">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Lightning size={20} weight="fill" />
                    <span className="text-sm">Total Posts</span>
                  </div>
                  <div className="text-2xl font-bold">{totalPosts}</div>
                </div>
              </CardContent>
            </Card>

            <Card className="flex-1">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock size={20} weight="fill" />
                    <span className="text-sm">Last Hour</span>
                  </div>
                  <div className="text-2xl font-bold text-accent">{recentPosts}</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="correlations">Correlations</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="flex gap-4">
              <div className="flex-1">
                <Select value={selectedHashtag} onValueChange={setSelectedHashtag}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select hashtag" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Hashtags</SelectItem>
                    {activeHashtags.map((hashtag) => (
                      <SelectItem key={hashtag.id} value={hashtag.hashtag}>
                        #{hashtag.hashtag}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Select value={selectedVenue} onValueChange={setSelectedVenue}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select venue" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Venues</SelectItem>
                    {venues.map((venue) => (
                      <SelectItem key={venue.id} value={venue.id}>
                        {venue.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SocialPulseGraph
                windows={filteredSocialWindows}
                hashtag={selectedHashtag === 'all' ? undefined : selectedHashtag}
                windowSize="5min"
              />

              <CorrelationOverlayChart
                socialWindows={filteredSocialWindows}
                venueWindows={filteredVenueWindows}
                venueId={selectedVenue === 'all' ? undefined : selectedVenue}
              />
            </div>
          </TabsContent>

          <TabsContent value="correlations" className="space-y-6">
            <CorrelationInsights
              correlations={filteredCorrelations}
              venues={venues}
            />
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <HashtagManager
              trackedHashtags={trackedHashtags || []}
              venues={venues}
              onAdd={handleAddHashtag}
              onRemove={handleRemoveHashtag}
              onToggleActive={handleToggleActive}
              onUpdateVenueMapping={handleUpdateVenueMapping}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
