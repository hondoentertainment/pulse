import { useState, useMemo } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { TrendUp, TrendDown, Minus } from '@phosphor-icons/react'
import type { Venue, Pulse } from '@/lib/types'
import {
  type VenuePlatformAccount, type PlanTier, type Campaign, type SocialContent,
  PLAN_CONFIG, createPlatformAccount, addTeamMember, removeTeamMember,
  getRevenueMetrics, createCampaign, generateSocialPost,
} from '@/lib/venue-platform'
import { buildOwnerDashboard } from '@/lib/venue-owner'
import { toast } from 'sonner'

import { DashboardHeader } from './DashboardHeader'
import { OverviewTab, AnalyticsTab } from './DashboardAnalytics'
import { CampaignsTab, GuestsTab, TeamTab } from './DashboardBoostControls'
import { DashboardSettings } from './DashboardSettings'

// ---------------------------------------------------------------------------
// Types (same public API)
// ---------------------------------------------------------------------------

interface VenuePlatformDashboardProps {
  venue: Venue
  venues: Venue[]
  pulses: Pulse[]
  currentUserId: string
  onBack: () => void
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

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

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        venueName={venue.name}
        plan={account.plan}
        onBack={onBack}
      />

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

          <TabsContent value="overview">
            <OverviewTab
              dashboard={dashboard}
              trendColor={trendColor}
              TrendIcon={TrendIcon}
              venue={venue}
              venues={venues}
              hourlyData={hourlyData}
              revenue={revenue}
              revenuePeriod={revenuePeriod}
              onSetRevenuePeriod={setRevenuePeriod}
              socialPosts={socialPosts}
              copiedPostId={copiedPostId}
              onGenerateSocialPost={handleGenerateSocialPost}
              onCopyPost={handleCopyPost}
            />
          </TabsContent>

          <TabsContent value="analytics">
            <AnalyticsTab
              dashboard={dashboard}
              hourlyData={hourlyData}
              dowData={dowData}
              venue={venue}
              venues={venues}
              pulses={pulses}
              account={account}
              onSetAccount={setAccount}
              onUpgradePlan={handleUpgradePlan}
            />
          </TabsContent>

          <TabsContent value="guests">
            <GuestsTab
              venue={venue}
              pulses={pulses}
              account={account}
              onUpgradePlan={handleUpgradePlan}
            />
          </TabsContent>

          <TabsContent value="campaigns">
            <CampaignsTab
              campaigns={campaigns}
              onCreateCampaign={handleCreateCampaign}
            />
          </TabsContent>

          <TabsContent value="team">
            <TeamTab
              account={account}
              showAddMember={showAddMember}
              onSetShowAddMember={setShowAddMember}
              newMemberName={newMemberName}
              onSetNewMemberName={setNewMemberName}
              newMemberEmail={newMemberEmail}
              onSetNewMemberEmail={setNewMemberEmail}
              newMemberRole={newMemberRole}
              onSetNewMemberRole={setNewMemberRole}
              onAddTeamMember={handleAddTeamMember}
              onRemoveTeamMember={handleRemoveTeamMember}
            />
          </TabsContent>

          <TabsContent value="settings">
            <DashboardSettings
              account={account}
              onUpgradePlan={handleUpgradePlan}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
