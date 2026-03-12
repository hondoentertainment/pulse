import { useState, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  ArrowLeft, ChartBar, Users, Megaphone, GearSix, Lightning,
  TrendUp, TrendDown, Minus, Crown, CurrencyDollar, CalendarBlank,
  UserCirclePlus, Trash, Share, Copy, Check,
  ClockCountdown, Fire, UsersThree,
} from '@phosphor-icons/react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { motion, AnimatePresence } from 'framer-motion'
import type { Venue, Pulse, EnergyRating } from '@/lib/types'
import { ENERGY_CONFIG } from '@/lib/types'
import { buildOwnerDashboard } from '@/lib/venue-owner'
import {
  type VenuePlatformAccount, type PlanTier, type TeamMember,
  type Campaign, type SocialContent,
  PLAN_CONFIG, createPlatformAccount, addTeamMember, removeTeamMember,
  isPlanFeatureAvailable, getRevenueMetrics, createCampaign,
  getCampaignROI, getCampaignCTR, generateSocialPost,
} from '@/lib/venue-platform'
import { CompetitorBenchmark } from '@/components/CompetitorBenchmark'
import { StaffScheduler } from '@/components/StaffScheduler'
import { GuestCRM } from '@/components/GuestCRM'
import { toast } from 'sonner'

interface VenuePlatformDashboardProps {
  venue: Venue
  venues: Venue[]
  pulses: Pulse[]
  currentUserId: string
  onBack: () => void
}

export function VenuePlatformDashboard({
  venue,
  venues,
  pulses,
  currentUserId,
  onBack,
}: VenuePlatformDashboardProps) {
  const [account, setAccount] = useState<VenuePlatformAccount>(() =>
    createPlatformAccount(venue.id, currentUserId, 'Owner', 'owner@venue.com', 'pro')
  )
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => [
    {
      id: 'camp-demo-1', venueId: venue.id, name: 'Weekend Spotlight',
      type: 'promoted_listing', status: 'active', budget: 200, spent: 87,
      impressions: 4500, clicks: 312, conversions: 45,
      startDate: new Date(Date.now() - 5 * 86400000).toISOString(),
      endDate: new Date(Date.now() + 9 * 86400000).toISOString(),
      createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    },
    {
      id: 'camp-demo-2', venueId: venue.id, name: 'Happy Hour Push',
      type: 'happy_hour', status: 'completed', budget: 100, spent: 100,
      impressions: 8200, clicks: 520, conversions: 78,
      startDate: new Date(Date.now() - 14 * 86400000).toISOString(),
      endDate: new Date(Date.now() - 7 * 86400000).toISOString(),
      createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
    },
  ])
  const [revenuePeriod, setRevenuePeriod] = useState<'7d' | '30d' | '90d'>('7d')
  const [socialPosts, setSocialPosts] = useState<SocialContent[]>([])
  const [copiedPostId, setCopiedPostId] = useState<string | null>(null)

  // New team member form
  const [showAddMember, setShowAddMember] = useState(false)
  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberEmail, setNewMemberEmail] = useState('')
  const [newMemberRole, setNewMemberRole] = useState<'manager' | 'staff'>('staff')

  const dashboard = useMemo(() => buildOwnerDashboard(venue, pulses), [venue, pulses])
  const revenue = useMemo(() => getRevenueMetrics(venue.id, revenuePeriod, pulses), [venue.id, revenuePeriod, pulses])

  const TrendIcon = dashboard.trend === 'up' ? TrendUp : dashboard.trend === 'down' ? TrendDown : Minus
  const trendColor = dashboard.trend === 'up' ? 'text-green-400' : dashboard.trend === 'down' ? 'text-red-400' : 'text-muted-foreground'

  // Build hourly traffic data for chart
  const hourlyData = useMemo(() => {
    const hours: { hour: string; pulses: number; energy: number }[] = []
    for (let h = 10; h <= 26; h++) {
      const hour = h > 23 ? h - 24 : h
      const label = hour === 0 ? '12a' : hour === 12 ? '12p' : hour > 12 ? `${hour - 12}p` : `${hour}a`
      const hourPulses = dashboard.peakHours.filter(ph => ph.hour === hour)
      const avgCount = hourPulses.length > 0
        ? hourPulses.reduce((s, ph) => s + ph.averagePulseCount, 0) / hourPulses.length
        : 0
      const avgEnergy = hourPulses.length > 0
        ? hourPulses.reduce((s, ph) => s + ph.averageEnergy, 0) / hourPulses.length
        : 0
      hours.push({ hour: label, pulses: Math.round(avgCount * 10) / 10, energy: Math.round(avgEnergy * 100) / 100 })
    }
    return hours
  }, [dashboard.peakHours])

  // Day of week data
  const dowData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return days.map((day, i) => {
      const dayPeaks = dashboard.peakHours.filter(ph => ph.dayOfWeek === i)
      return {
        day,
        pulses: dayPeaks.reduce((s, ph) => s + ph.averagePulseCount, 0),
        energy: dayPeaks.length > 0
          ? Math.round(dayPeaks.reduce((s, ph) => s + ph.averageEnergy, 0) / dayPeaks.length * 100) / 100
          : 0,
      }
    })
  }, [dashboard.peakHours])

  const handleUpgradePlan = (plan: PlanTier) => {
    setAccount(prev => ({
      ...prev,
      plan,
      features: PLAN_CONFIG[plan].features,
    }))
    toast.success(`Upgraded to ${PLAN_CONFIG[plan].name} plan`)
  }

  const handleAddTeamMember = () => {
    if (!newMemberName || !newMemberEmail) return
    const updated = addTeamMember(
      account,
      `user-team-${Date.now()}`,
      newMemberName,
      newMemberEmail,
      newMemberRole
    )
    if (updated.teamMembers.length === account.teamMembers.length) {
      toast.error('Team member limit reached', {
        description: `Upgrade to add more members`,
      })
      return
    }
    setAccount(updated)
    setNewMemberName('')
    setNewMemberEmail('')
    setShowAddMember(false)
    toast.success('Team member added')
  }

  const handleRemoveTeamMember = (userId: string) => {
    setAccount(removeTeamMember(account, userId))
    toast.success('Team member removed')
  }

  const handleCreateCampaign = () => {
    const now = new Date()
    const campaign = createCampaign(
      venue.id,
      `New Campaign ${campaigns.length + 1}`,
      'promoted_listing',
      100,
      now.toISOString(),
      new Date(now.getTime() + 14 * 86400000).toISOString()
    )
    setCampaigns(prev => [campaign, ...prev])
    toast.success('Campaign created')
  }

  const handleGenerateSocialPost = (type: 'highlight' | 'event' | 'milestone') => {
    const post = generateSocialPost(venue.id, type, venue, pulses)
    setSocialPosts(prev => [post, ...prev])
    toast.success('Social post generated')
  }

  const handleCopyPost = async (post: SocialContent) => {
    const text = `${post.text}\n\n${post.hashtags.join(' ')}`
    try {
      await navigator.clipboard.writeText(text)
      setCopiedPostId(post.id)
      toast.success('Copied to clipboard')
      setTimeout(() => setCopiedPostId(null), 2000)
    } catch {
      toast.error('Failed to copy')
    }
  }

  const users = useMemo(() => {
    const userIds = new Set(pulses.filter(p => p.venueId === venue.id).map(p => p.userId))
    return Array.from(userIds).map(id => ({ id, username: `user_${id.slice(-4)}` }))
  }, [pulses, venue.id])

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <button onClick={onBack} className="p-1 hover:bg-muted/50 rounded-md transition-colors">
            <ArrowLeft size={20} className="text-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-foreground truncate">{venue.name}</h1>
            <p className="text-[10px] text-muted-foreground">Venue Platform Dashboard</p>
          </div>
          <Badge className="bg-accent/20 text-accent text-[10px]">
            {PLAN_CONFIG[account.plan].name}
          </Badge>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 pb-24">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full grid grid-cols-6 mb-4">
            <TabsTrigger value="overview" className="text-[10px] px-1">Overview</TabsTrigger>
            <TabsTrigger value="analytics" className="text-[10px] px-1">Analytics</TabsTrigger>
            <TabsTrigger value="guests" className="text-[10px] px-1">Guests</TabsTrigger>
            <TabsTrigger value="campaigns" className="text-[10px] px-1">Campaigns</TabsTrigger>
            <TabsTrigger value="team" className="text-[10px] px-1">Team</TabsTrigger>
            <TabsTrigger value="settings" className="text-[10px] px-1">Settings</TabsTrigger>
          </TabsList>

          {/* ─── OVERVIEW TAB ─── */}
          <TabsContent value="overview">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-2">
                <Card className="p-3 bg-card/80 border-border">
                  <div className="flex items-center justify-between mb-1">
                    <Fire size={14} className="text-orange-400" />
                    <div className={`flex items-center gap-0.5 text-[10px] ${trendColor}`}>
                      <TrendIcon size={10} />
                      {dashboard.scoreDelta > 0 ? '+' : ''}{dashboard.scoreDelta}
                    </div>
                  </div>
                  <p className="text-xl font-bold text-foreground">{dashboard.currentScore}</p>
                  <p className="text-[10px] text-muted-foreground">Pulse Score</p>
                </Card>

                <Card className="p-3 bg-card/80 border-border">
                  <Users size={14} className="text-blue-400 mb-1" />
                  <p className="text-xl font-bold text-foreground">{dashboard.uniqueVisitors7d}</p>
                  <p className="text-[10px] text-muted-foreground">Visitors (7d)</p>
                </Card>

                <Card className="p-3 bg-card/80 border-border">
                  <CurrencyDollar size={14} className="text-green-400 mb-1" />
                  <p className="text-xl font-bold text-foreground">
                    ${revenue.estimatedTotalRevenue.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Est. Revenue ({revenuePeriod})</p>
                </Card>

                <Card className="p-3 bg-card/80 border-border">
                  <TrendUp size={14} className="text-accent mb-1" />
                  <p className="text-xl font-bold text-foreground">#{
                    [...venues].sort((a, b) => b.pulseScore - a.pulseScore)
                      .findIndex(v => v.id === venue.id) + 1
                  }</p>
                  <p className="text-[10px] text-muted-foreground">Trending Rank</p>
                </Card>
              </div>

              {/* Mini sparkline chart */}
              <Card className="p-4 bg-card/80 border-border">
                <h3 className="text-xs font-bold text-foreground mb-2">Hourly Traffic</h3>
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={hourlyData} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
                      <defs>
                        <linearGradient id="pulseGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="hour" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '11px',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="pulses"
                        stroke="hsl(var(--primary))"
                        fill="url(#pulseGrad)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Energy Distribution */}
              <Card className="p-4 bg-card/80 border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Lightning size={14} weight="fill" className="text-accent" />
                  <h3 className="text-xs font-bold text-foreground">Energy Distribution</h3>
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    Avg: {dashboard.averageEnergy.toFixed(1)}/3
                  </span>
                </div>
                <div className="flex gap-1 h-6 rounded-full overflow-hidden">
                  {(['electric', 'buzzing', 'chill', 'dead'] as EnergyRating[]).map(rating => {
                    const count = dashboard.energyDistribution[rating]
                    const total = Object.values(dashboard.energyDistribution).reduce((a, b) => a + b, 0)
                    const pct = total > 0 ? (count / total) * 100 : 0
                    if (pct === 0) return null
                    return (
                      <div
                        key={rating}
                        style={{ width: `${pct}%`, backgroundColor: ENERGY_CONFIG[rating].color }}
                        className="h-full"
                        title={`${ENERGY_CONFIG[rating].label}: ${count}`}
                      />
                    )
                  })}
                </div>
                <div className="flex justify-between mt-1">
                  {(['electric', 'buzzing', 'chill', 'dead'] as EnergyRating[]).map(rating => (
                    <span key={rating} className="text-[9px] text-muted-foreground">
                      {ENERGY_CONFIG[rating].emoji} {dashboard.energyDistribution[rating]}
                    </span>
                  ))}
                </div>
              </Card>

              {/* Revenue by Day */}
              <Card className="p-4 bg-card/80 border-border">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-foreground">Revenue by Day</h3>
                  <div className="flex gap-1">
                    {(['7d', '30d', '90d'] as const).map(p => (
                      <button
                        key={p}
                        onClick={() => setRevenuePeriod(p)}
                        className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
                          revenuePeriod === p
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenue.revenueByDay} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
                      <XAxis dataKey="day" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `$${v}`} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '11px',
                        }}
                        formatter={(value: number) => [`$${value}`, 'Revenue']}
                      />
                      <Bar dataKey="revenue" fill="oklch(0.60 0.15 150)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <div className="text-center">
                    <p className="text-xs font-bold text-foreground">${revenue.estimatedTicketRevenue.toLocaleString()}</p>
                    <p className="text-[9px] text-muted-foreground">Tickets</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold text-foreground">${revenue.estimatedTableRevenue.toLocaleString()}</p>
                    <p className="text-[9px] text-muted-foreground">Tables</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold text-foreground">{revenue.promoROI}x</p>
                    <p className="text-[9px] text-muted-foreground">Promo ROI</p>
                  </div>
                </div>
              </Card>

              {/* Social Content Generator */}
              <Card className="p-4 bg-card/80 border-border">
                <div className="flex items-center gap-2 mb-3">
                  <Share size={14} className="text-accent" />
                  <h3 className="text-xs font-bold text-foreground">Social Content</h3>
                </div>
                <div className="flex gap-2 mb-3">
                  {(['highlight', 'event', 'milestone'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => handleGenerateSocialPost(type)}
                      className="flex-1 py-1.5 text-[10px] font-medium rounded-md bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors capitalize"
                    >
                      {type}
                    </button>
                  ))}
                </div>
                {socialPosts.length > 0 && (
                  <div className="space-y-2">
                    {socialPosts.slice(0, 3).map(post => (
                      <div key={post.id} className="p-2 bg-background/50 rounded-md">
                        <p className="text-xs text-foreground mb-1">{post.text}</p>
                        <div className="flex items-center justify-between">
                          <p className="text-[9px] text-accent">{post.hashtags.join(' ')}</p>
                          <button
                            onClick={() => handleCopyPost(post)}
                            className="p-1 hover:bg-muted/50 rounded transition-colors"
                          >
                            {copiedPostId === post.id ? (
                              <Check size={12} className="text-green-400" />
                            ) : (
                              <Copy size={12} className="text-muted-foreground" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </motion.div>
          </TabsContent>

          {/* ─── ANALYTICS TAB ─── */}
          <TabsContent value="analytics">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Hourly Traffic */}
              <Card className="p-4 bg-card/80 border-border">
                <h3 className="text-xs font-bold text-foreground mb-3">Hourly Traffic Pattern</h3>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={hourlyData} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
                      <defs>
                        <linearGradient id="pulseGrad2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="hour" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '11px',
                        }}
                      />
                      <Area type="monotone" dataKey="pulses" stroke="hsl(var(--primary))" fill="url(#pulseGrad2)" strokeWidth={2} name="Pulses" />
                      <Area type="monotone" dataKey="energy" stroke="oklch(0.70 0.22 60)" fill="oklch(0.70 0.22 60 / 0.1)" strokeWidth={2} name="Energy" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Day of Week */}
              <Card className="p-4 bg-card/80 border-border">
                <h3 className="text-xs font-bold text-foreground mb-3">Day-of-Week Patterns</h3>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dowData} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '11px',
                        }}
                      />
                      <Bar dataKey="pulses" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Pulses" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Top Hashtags */}
              {dashboard.topHashtags.length > 0 && (
                <Card className="p-4 bg-card/80 border-border">
                  <h3 className="text-xs font-bold text-foreground mb-3">Top Hashtags</h3>
                  <div className="space-y-1.5">
                    {dashboard.topHashtags.slice(0, 8).map((tag, i) => {
                      const maxCount = dashboard.topHashtags[0]?.count ?? 1
                      const barWidth = (tag.count / maxCount) * 100
                      return (
                        <div key={tag.tag} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                          <span className="text-xs text-foreground font-medium w-24 truncate">#{tag.tag}</span>
                          <div className="flex-1 h-3 bg-background/50 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${barWidth}%` }}
                              transition={{ duration: 0.5, delay: i * 0.05 }}
                              className="h-full bg-accent/40 rounded-full"
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground w-6 text-right">{tag.count}</span>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              )}

              {/* Competitor Comparison */}
              {isPlanFeatureAvailable(account.plan, 'competitor_benchmarking') && (
                <CompetitorBenchmark
                  venue={venue}
                  venues={venues}
                  pulses={pulses}
                  competitorIds={account.competitorVenues}
                  onAddCompetitor={(id) => {
                    if (account.competitorVenues.length >= 3) {
                      toast.error('Maximum 3 competitors')
                      return
                    }
                    setAccount(prev => ({
                      ...prev,
                      competitorVenues: [...prev.competitorVenues, id],
                    }))
                  }}
                  onRemoveCompetitor={(id) => {
                    setAccount(prev => ({
                      ...prev,
                      competitorVenues: prev.competitorVenues.filter(c => c !== id),
                    }))
                  }}
                />
              )}

              {/* Staff Scheduling */}
              {isPlanFeatureAvailable(account.plan, 'staff_insights') && (
                <StaffScheduler venueId={venue.id} pulses={pulses} />
              )}

              {!isPlanFeatureAvailable(account.plan, 'full_analytics') && (
                <Card className="p-6 bg-card/80 border-border text-center">
                  <ChartBar size={32} weight="thin" className="text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-foreground font-medium mb-1">Unlock Full Analytics</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    Upgrade to Pro for competitor benchmarking, staff insights, and more
                  </p>
                  <button
                    onClick={() => handleUpgradePlan('pro')}
                    className="px-4 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                  >
                    Upgrade to Pro — $99/mo
                  </button>
                </Card>
              )}
            </motion.div>
          </TabsContent>

          {/* ─── GUESTS TAB ─── */}
          <TabsContent value="guests">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {isPlanFeatureAvailable(account.plan, 'crm') ? (
                <GuestCRM venueId={venue.id} pulses={pulses} users={users} />
              ) : (
                <Card className="p-6 bg-card/80 border-border text-center">
                  <Users size={32} weight="thin" className="text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-foreground font-medium mb-1">Guest CRM</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    Track guest visits, spending, and preferences with Pro
                  </p>
                  <button
                    onClick={() => handleUpgradePlan('pro')}
                    className="px-4 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                  >
                    Upgrade to Pro — $99/mo
                  </button>
                </Card>
              )}
            </motion.div>
          </TabsContent>

          {/* ─── CAMPAIGNS TAB ─── */}
          <TabsContent value="campaigns">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">Campaigns</h3>
                <button
                  onClick={handleCreateCampaign}
                  className="text-xs text-accent hover:underline"
                >
                  + New Campaign
                </button>
              </div>

              {campaigns.map(campaign => {
                const roi = getCampaignROI(campaign)
                const ctr = getCampaignCTR(campaign)
                const spentPct = campaign.budget > 0 ? Math.round((campaign.spent / campaign.budget) * 100) : 0

                return (
                  <Card key={campaign.id} className="p-4 bg-card/80 border-border">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="text-xs font-bold text-foreground">{campaign.name}</h4>
                        <p className="text-[10px] text-muted-foreground capitalize">{campaign.type.replace('_', ' ')}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[9px] ${
                          campaign.status === 'active' ? 'text-green-400 border-green-400/30' :
                          campaign.status === 'completed' ? 'text-blue-400 border-blue-400/30' :
                          campaign.status === 'paused' ? 'text-yellow-400 border-yellow-400/30' :
                          'text-muted-foreground'
                        }`}
                      >
                        {campaign.status}
                      </Badge>
                    </div>

                    {/* Budget progress */}
                    <div className="mb-3">
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                        <span>${campaign.spent} spent</span>
                        <span>${campaign.budget} budget</span>
                      </div>
                      <div className="h-1.5 bg-background/50 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${Math.min(100, spentPct)}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div>
                        <p className="text-xs font-bold text-foreground">{campaign.impressions.toLocaleString()}</p>
                        <p className="text-[9px] text-muted-foreground">Impressions</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">{campaign.clicks}</p>
                        <p className="text-[9px] text-muted-foreground">Clicks</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">{ctr}%</p>
                        <p className="text-[9px] text-muted-foreground">CTR</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">{roi}x</p>
                        <p className="text-[9px] text-muted-foreground">ROI</p>
                      </div>
                    </div>
                  </Card>
                )
              })}

              {campaigns.length === 0 && (
                <Card className="p-6 bg-card/80 border-border text-center">
                  <Megaphone size={32} weight="thin" className="text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No campaigns yet</p>
                </Card>
              )}
            </motion.div>
          </TabsContent>

          {/* ─── TEAM TAB ─── */}
          <TabsContent value="team">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Team Members</h3>
                  <p className="text-[10px] text-muted-foreground">
                    {account.teamMembers.length}/{PLAN_CONFIG[account.plan].maxTeamMembers} members
                  </p>
                </div>
                <button
                  onClick={() => setShowAddMember(true)}
                  className="text-xs text-accent hover:underline"
                >
                  + Add Member
                </button>
              </div>

              {/* Add member form */}
              <AnimatePresence>
                {showAddMember && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <Card className="p-4 bg-card/80 border-border space-y-2">
                      <Input
                        placeholder="Name"
                        value={newMemberName}
                        onChange={(e) => setNewMemberName(e.target.value)}
                        className="h-8 text-xs bg-background"
                      />
                      <Input
                        placeholder="Email"
                        value={newMemberEmail}
                        onChange={(e) => setNewMemberEmail(e.target.value)}
                        className="h-8 text-xs bg-background"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => setNewMemberRole('manager')}
                          className={`flex-1 py-1.5 text-xs rounded-md transition-colors ${
                            newMemberRole === 'manager'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted/50 text-muted-foreground'
                          }`}
                        >
                          Manager
                        </button>
                        <button
                          onClick={() => setNewMemberRole('staff')}
                          className={`flex-1 py-1.5 text-xs rounded-md transition-colors ${
                            newMemberRole === 'staff'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted/50 text-muted-foreground'
                          }`}
                        >
                          Staff
                        </button>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setShowAddMember(false)}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleAddTeamMember}
                          className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                        >
                          Add
                        </button>
                      </div>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Team list */}
              {account.teamMembers.map(member => (
                <Card key={member.userId} className="p-3 bg-card/80 border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                      {member.role === 'owner' ? (
                        <Crown size={18} className="text-yellow-400" />
                      ) : (
                        <UsersThree size={18} className="text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground">{member.name}</p>
                      <p className="text-[10px] text-muted-foreground">{member.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[9px] capitalize">{member.role}</Badge>
                      {member.role !== 'owner' && (
                        <button
                          onClick={() => handleRemoveTeamMember(member.userId)}
                          className="p-1 hover:bg-destructive/20 rounded transition-colors"
                        >
                          <Trash size={12} className="text-destructive" />
                        </button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </motion.div>
          </TabsContent>

          {/* ─── SETTINGS TAB ─── */}
          <TabsContent value="settings">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Plan Selection */}
              <h3 className="text-sm font-bold text-foreground">Plan & Billing</h3>
              {(['free', 'pro', 'enterprise'] as PlanTier[]).map(plan => {
                const config = PLAN_CONFIG[plan]
                const isActive = account.plan === plan
                return (
                  <Card
                    key={plan}
                    className={`p-4 border-border ${
                      isActive ? 'bg-primary/10 border-primary/30' : 'bg-card/80'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="text-xs font-bold text-foreground">{config.name}</h4>
                        <p className="text-[10px] text-muted-foreground">{config.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-foreground">
                          {config.price === 0 ? 'Free' : `$${config.price}`}
                        </p>
                        {config.price > 0 && (
                          <p className="text-[9px] text-muted-foreground">/month</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {config.features.slice(0, 5).map(f => (
                        <Badge key={f} variant="outline" className="text-[8px] px-1 py-0 capitalize">
                          {f.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                      {config.features.length > 5 && (
                        <Badge variant="outline" className="text-[8px] px-1 py-0">
                          +{config.features.length - 5} more
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">
                        Up to {config.maxTeamMembers} team member{config.maxTeamMembers > 1 ? 's' : ''}
                      </span>
                      {isActive ? (
                        <Badge className="bg-primary text-primary-foreground text-[9px]">Current Plan</Badge>
                      ) : (
                        <button
                          onClick={() => handleUpgradePlan(plan)}
                          className="text-xs text-accent hover:underline"
                        >
                          {config.price > PLAN_CONFIG[account.plan].price ? 'Upgrade' : 'Switch'}
                        </button>
                      )}
                    </div>
                  </Card>
                )
              })}

              {/* Billing Info */}
              <Card className="p-4 bg-card/80 border-border">
                <h4 className="text-xs font-bold text-foreground mb-2">Billing</h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Billing Cycle</span>
                    <span className="text-foreground capitalize">{account.billingCycle}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Monthly Cost</span>
                    <span className="text-foreground">${PLAN_CONFIG[account.plan].price}/mo</span>
                  </div>
                </div>
              </Card>

              {/* Notification Preferences placeholder */}
              <Card className="p-4 bg-card/80 border-border">
                <h4 className="text-xs font-bold text-foreground mb-2">Notifications</h4>
                <div className="space-y-2">
                  {['Daily summary email', 'Weekly analytics report', 'Real-time alerts for surges', 'Campaign updates'].map(pref => (
                    <div key={pref} className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{pref}</span>
                      <div className="w-8 h-4 rounded-full bg-primary/60 relative cursor-pointer">
                        <div className="absolute right-0.5 top-0.5 w-3 h-3 rounded-full bg-primary-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
