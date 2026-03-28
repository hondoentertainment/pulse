import { useEffect, useMemo, useState } from 'react'
import { useAppState } from '@/hooks/use-app-state'
import Tilt from 'react-parallax-tilt'
import { useKV } from '@github/spark/hooks'
import { TrackedHashtag, Venue, Pulse } from '@/lib/types'
import { getEvents, getIntegrationActionSummary } from '@/lib/analytics'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { HashtagManager } from './HashtagManager'
import { SocialPulseGraph } from './SocialPulseGraph'
import { CorrelationOverlayChart } from './CorrelationOverlayChart'
import { CorrelationInsights } from './CorrelationInsights'
import { AnalyticsDashboard } from './AnalyticsDashboard'
import {
  useSocialPulseIngestion,
  useSocialPulseWindows,
  useVenuePulseWindows,
  usePulseCorrelations,
} from '@/hooks/use-social-pulse'
import {
  ChartLine,
  ArrowLeft,
  Hash,
  Lightning,
  Clock,
  LinkSimple,
  WarningCircle,
  CheckCircle,
  SlidersHorizontal,
} from '@phosphor-icons/react'
import { toast } from 'sonner'

interface SocialPulseDashboardProps {
  venues: Venue[]
  pulses: Pulse[]
  onBack: () => void
}

interface IntegrationEditorDraft {
  spotifyUrl: string
  playlistName: string
  searchTerm: string
  opentableId: string
  opentableUrl: string
  resyId: string
  resyUrl: string
  googleMapsUrl: string
}

function buildIntegrationDraft(venue: Venue | undefined): IntegrationEditorDraft {
  return {
    spotifyUrl: venue?.integrations?.music?.spotifyUrl ?? '',
    playlistName: venue?.integrations?.music?.playlistName ?? '',
    searchTerm: venue?.integrations?.music?.searchTerm ?? '',
    opentableId: venue?.integrations?.reservations?.opentableId ?? '',
    opentableUrl: venue?.integrations?.reservations?.opentableUrl ?? '',
    resyId: venue?.integrations?.reservations?.resyId ?? '',
    resyUrl: venue?.integrations?.reservations?.resyUrl ?? '',
    googleMapsUrl: venue?.integrations?.maps?.googleMapsUrl ?? '',
  }
}

function toOptionalString(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export function SocialPulseDashboard({ venues, pulses, onBack }: SocialPulseDashboardProps) {
  const [trackedHashtags, setTrackedHashtags] = useKV<TrackedHashtag[]>('trackedHashtags', [])
  const [, setStoredVenues] = useKV<Venue[]>('venues', [])
  const [selectedHashtag, setSelectedHashtag] = useState<string>('all')
  const [selectedVenue, setSelectedVenue] = useState<string>('all')
  const [editorVenueId, setEditorVenueId] = useState<string>(venues[0]?.id ?? 'all')
  const [integrationDraft, setIntegrationDraft] = useState<IntegrationEditorDraft>(() => buildIntegrationDraft(venues[0]))
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const { contentReports, setContentReports, setPulses } = useAppState()

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
    if (!editorVenueId && venues[0]?.id) {
      setEditorVenueId(venues[0].id)
    }
  }, [editorVenueId, venues])

  useEffect(() => {
    const venue = venues.find((entry) => entry.id === editorVenueId) ?? venues[0]
    setIntegrationDraft(buildIntegrationDraft(venue))
  }, [editorVenueId, venues])

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
      updatedAt: new Date().toISOString(),
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
  const integrationSummary = useMemo(
    () => getIntegrationActionSummary(getEvents()),
    [] // lastUpdate is not a dependency of this computation
  )

  const integrationCoverage = useMemo(() => ({
    music: venues.filter(venue => venue.integrations?.music?.spotifyUrl || venue.integrations?.music?.searchTerm).length,
    reservations: venues.filter(
      venue => venue.integrations?.reservations?.opentableId
        || venue.integrations?.reservations?.opentableUrl
        || venue.integrations?.reservations?.resyId
        || venue.integrations?.reservations?.resyUrl
    ).length,
    maps: venues.filter(venue => venue.integrations?.maps?.googleMapsUrl).length,
  }), [venues])

  const editorVenue = venues.find((venue) => venue.id === editorVenueId) ?? venues[0]

  const handleDraftChange = (field: keyof IntegrationEditorDraft, value: string) => {
    setIntegrationDraft((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const handleSaveIntegrationMetadata = () => {
    if (!editorVenue) return

    setStoredVenues((current) => {
      const existing = current || []
      return existing.map((venue) => {
        if (venue.id !== editorVenue.id) return venue

        return {
          ...venue,
          integrations: {
            music: {
              spotifyUrl: toOptionalString(integrationDraft.spotifyUrl),
              playlistName: toOptionalString(integrationDraft.playlistName),
              searchTerm: toOptionalString(integrationDraft.searchTerm),
            },
            reservations: {
              opentableId: toOptionalString(integrationDraft.opentableId),
              opentableUrl: toOptionalString(integrationDraft.opentableUrl),
              resyId: toOptionalString(integrationDraft.resyId),
              resyUrl: toOptionalString(integrationDraft.resyUrl),
            },
            maps: {
              googleMapsUrl: toOptionalString(integrationDraft.googleMapsUrl),
            },
          },
        }
      })
    })

    toast.success(`Saved integration metadata for ${editorVenue.name}`)
  }

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
                  Real-time correlation between social media, venue activity, and integration usage
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

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            <Tilt tiltMaxAngleX={10} tiltMaxAngleY={10} scale={1.02} transitionSpeed={2000}>
              <Card className="h-full border-border/50 shadow-sm hover:border-accent/50 hover:shadow-accent/10 transition-colors">
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
            </Tilt>

            <Tilt tiltMaxAngleX={10} tiltMaxAngleY={10} scale={1.02} transitionSpeed={2000}>
              <Card className="h-full border-border/50 shadow-sm hover:border-accent/50 hover:shadow-accent/10 transition-colors">
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
            </Tilt>

            <Tilt tiltMaxAngleX={10} tiltMaxAngleY={10} scale={1.02} transitionSpeed={2000}>
              <Card className="h-full border-border/50 shadow-sm hover:border-accent/50 hover:shadow-accent/10 transition-colors">
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
            </Tilt>

            <Tilt tiltMaxAngleX={10} tiltMaxAngleY={10} scale={1.02} transitionSpeed={2000}>
              <Card className="h-full border-border/50 shadow-sm hover:border-accent/50 hover:shadow-accent/10 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <LinkSimple size={20} weight="fill" />
                      <span className="text-sm">Integration Clicks</span>
                    </div>
                    <div className="text-2xl font-bold">{integrationSummary.totalActions}</div>
                  </div>
                </CardContent>
              </Card>
            </Tilt>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid grid-cols-6 w-full max-w-5xl">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="correlations">Correlations</TabsTrigger>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
            <TabsTrigger value="seeded">Seeded Analytics</TabsTrigger>
            <TabsTrigger value="moderation">Moderation</TabsTrigger>
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

          <TabsContent value="integrations" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle size={18} weight="fill" className="text-accent" />
                  <p className="text-sm font-medium">Successful opens</p>
                </div>
                <p className="text-3xl font-bold font-mono">{integrationSummary.successCount}</p>
                <p className="text-xs text-muted-foreground">Across music, rideshare, reservations, maps, and shortcuts</p>
              </Card>

              <Card className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <WarningCircle size={18} weight="fill" className="text-yellow-500" />
                  <p className="text-sm font-medium">Blocked or failed</p>
                </div>
                <p className="text-3xl font-bold font-mono">{integrationSummary.failureCount}</p>
                <p className="text-xs text-muted-foreground">Useful for popup blockers and broken partner links</p>
              </Card>

              <Card className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal size={18} weight="fill" className="text-primary" />
                  <p className="text-sm font-medium">Needs setup</p>
                </div>
                <p className="text-3xl font-bold font-mono">{integrationSummary.unavailableCount}</p>
                <p className="text-xs text-muted-foreground">Actions that were unavailable because data or context was missing</p>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6">
              <Card className="p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold">Integration Coverage</h3>
                    <p className="text-sm text-muted-foreground">How many venues currently have seeded or edited metadata</p>
                  </div>
                  <Badge variant="outline">{venues.length} venues</Badge>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Card className="p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Music</p>
                    <p className="text-2xl font-bold font-mono">{integrationCoverage.music}</p>
                  </Card>
                  <Card className="p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Reservations</p>
                    <p className="text-2xl font-bold font-mono">{integrationCoverage.reservations}</p>
                  </Card>
                  <Card className="p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Maps</p>
                    <p className="text-2xl font-bold font-mono">{integrationCoverage.maps}</p>
                  </Card>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">Actions by type</h4>
                  {Object.entries(integrationSummary.actionsByType).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between p-3 rounded-lg bg-secondary/40">
                      <span className="text-sm capitalize">{type}</span>
                      <span className="font-mono font-bold">{count}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">Top providers</h4>
                  {integrationSummary.topProviders.length > 0 ? integrationSummary.topProviders.map((provider) => (
                    <div key={provider.provider} className="flex items-center justify-between p-3 rounded-lg bg-secondary/40">
                      <span className="text-sm">{provider.provider}</span>
                      <span className="font-mono font-bold">{provider.count}</span>
                    </div>
                  )) : (
                    <p className="text-sm text-muted-foreground">No provider traffic yet in this session.</p>
                  )}
                </div>
              </Card>

              <Card className="p-5 space-y-4">
                <div>
                  <h3 className="text-lg font-bold">Recent issues</h3>
                  <p className="text-sm text-muted-foreground">Latest unavailable or failed integration actions</p>
                </div>
                {integrationSummary.recentFailures.length > 0 ? (
                  <div className="space-y-3">
                    {integrationSummary.recentFailures.map((failure) => (
                      <div key={`${failure.timestamp}-${failure.actionId}`} className="rounded-lg border border-border p-3 space-y-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium capitalize">{failure.integrationType}</p>
                          <Badge variant={failure.outcome === 'failed' ? 'destructive' : 'outline'} className="text-[10px]">
                            {failure.outcome}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {venues.find((venue) => venue.id === failure.venueId)?.name ?? failure.venueId}
                          {' · '}
                          {failure.provider ?? failure.actionId}
                        </p>
                        {failure.reason && (
                          <p className="text-xs">{failure.reason}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No failed or unavailable actions yet.</p>
                )}
              </Card>
            </div>

            <Card className="p-5 space-y-5">
              <div>
                <h3 className="text-lg font-bold">Venue Integration Editor</h3>
                <p className="text-sm text-muted-foreground">Adjust partner URLs and IDs without touching code or seed files.</p>
              </div>

              <div className="max-w-md">
                <Label htmlFor="integration-editor-venue">Venue</Label>
                <Select value={editorVenueId} onValueChange={setEditorVenueId}>
                  <SelectTrigger id="integration-editor-venue">
                    <SelectValue placeholder="Select venue" />
                  </SelectTrigger>
                  <SelectContent>
                    {venues.map((venue) => (
                      <SelectItem key={venue.id} value={venue.id}>
                        {venue.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {editorVenue && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="spotify-url">Spotify URL</Label>
                      <Input id="spotify-url" value={integrationDraft.spotifyUrl} onChange={(event) => handleDraftChange('spotifyUrl', event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="playlist-name">Playlist Name</Label>
                      <Input id="playlist-name" value={integrationDraft.playlistName} onChange={(event) => handleDraftChange('playlistName', event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="search-term">Music Search Term</Label>
                      <Input id="search-term" value={integrationDraft.searchTerm} onChange={(event) => handleDraftChange('searchTerm', event.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="opentable-id">OpenTable ID</Label>
                      <Input id="opentable-id" value={integrationDraft.opentableId} onChange={(event) => handleDraftChange('opentableId', event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="opentable-url">OpenTable URL</Label>
                      <Input id="opentable-url" value={integrationDraft.opentableUrl} onChange={(event) => handleDraftChange('opentableUrl', event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="resy-id">Resy ID</Label>
                      <Input id="resy-id" value={integrationDraft.resyId} onChange={(event) => handleDraftChange('resyId', event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="resy-url">Resy URL</Label>
                      <Input id="resy-url" value={integrationDraft.resyUrl} onChange={(event) => handleDraftChange('resyUrl', event.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="google-maps-url">Google Maps URL</Label>
                      <Input id="google-maps-url" value={integrationDraft.googleMapsUrl} onChange={(event) => handleDraftChange('googleMapsUrl', event.target.value)} />
                    </div>

                    <Card className="p-4 bg-secondary/30">
                      <p className="text-sm font-medium">{editorVenue.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{editorVenue.location.address}</p>
                      <p className="text-xs text-muted-foreground mt-3">
                        Empty fields fall back to generated search links. URLs override IDs when both are present.
                      </p>
                    </Card>

                    <Button onClick={handleSaveIntegrationMetadata} className="w-full">
                      Save Venue Integrations
                    </Button>
                  </div>
                </div>
              )}
            </Card>
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

          <TabsContent value="seeded" className="space-y-6">
            <AnalyticsDashboard />
          </TabsContent>

          <TabsContent value="moderation" className="space-y-6">
            <Card className="p-6">
              <h3 className="text-xl font-bold mb-4">Content Moderation Queue</h3>
              {!contentReports || contentReports.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle size={48} className="mx-auto mb-4 opacity-50" />
                  <p>Queue is empty. Everything looks good!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {contentReports.map((report) => {
                    const reportedPulse = pulses.find(p => p.id === report.targetId)
                    return (
                      <div key={report.id} className="p-4 rounded-lg border border-border bg-secondary/20 flex items-start justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="destructive">{report.reason}</Badge>
                            <span className="text-xs text-muted-foreground">{new Date(report.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-sm"><span className="font-semibold">Reporter ID:</span> {report.reporterId}</p>
                          {reportedPulse && (
                            <div className="mt-2 p-3 bg-background rounded-md border border-border/50 text-sm">
                              <p className="font-semibold">{reportedPulse.caption || 'No caption'}</p>
                              <p className="text-xs text-muted-foreground mt-1">Pulse ID: {reportedPulse.id} • User ID: {reportedPulse.userId}</p>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button 
                            variant="default" 
                            size="sm" 
                            onClick={() => {
                              toast.success('Report resolved')
                              setContentReports(current => (current || []).filter(r => r.id !== report.id))
                            }}
                          >
                            Resolve / Ignore
                          </Button>
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => {
                              toast.success('Content removed')
                              setPulses(current => (current || []).filter(p => p.id !== report.targetId))
                              setContentReports(current => (current || []).filter(r => r.id !== report.id))
                            }}
                          >
                            Delete Pulse
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
