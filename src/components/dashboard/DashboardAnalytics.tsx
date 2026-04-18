import { Card } from '@/components/ui/card'
import {
  ChartBar, Lightning, TrendUp, Fire,
  Users, CurrencyDollar, Share, Copy, Check,
} from '@phosphor-icons/react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { motion } from 'framer-motion'
import type { Venue, Pulse, EnergyRating } from '@/lib/types'
import { ENERGY_CONFIG } from '@/lib/types'
import type { VenueOwnerDashboard } from '@/lib/venue-owner'
import type { RevenueMetrics } from '@/lib/venue-platform'
import { isPlanFeatureAvailable } from '@/lib/venue-platform'
import type { PlanTier, VenuePlatformAccount, SocialContent } from '@/lib/venue-platform'
import { CompetitorBenchmark } from '@/components/CompetitorBenchmark'
import { StaffScheduler } from '@/components/StaffScheduler'

// ---------------------------------------------------------------------------
// Overview Tab
// ---------------------------------------------------------------------------

interface OverviewTabProps {
  dashboard: VenueOwnerDashboard
  trendColor: string
  TrendIcon: typeof TrendUp
  venue: Venue
  venues: Venue[]
  hourlyData: { hour: string; pulses: number; energy: number }[]
  revenue: RevenueMetrics
  revenuePeriod: '7d' | '30d' | '90d'
  onSetRevenuePeriod: (p: '7d' | '30d' | '90d') => void
  socialPosts: SocialContent[]
  copiedPostId: string | null
  onGenerateSocialPost: (type: 'highlight' | 'event' | 'milestone') => void
  onCopyPost: (post: SocialContent) => void
}

export function OverviewTab({
  dashboard,
  trendColor,
  TrendIcon,
  venue,
  venues,
  hourlyData,
  revenue,
  revenuePeriod,
  onSetRevenuePeriod,
  socialPosts,
  copiedPostId,
  onGenerateSocialPost,
  onCopyPost,
}: OverviewTabProps) {
  return (
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
                onClick={() => onSetRevenuePeriod(p)}
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
              onClick={() => onGenerateSocialPost(type)}
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
                    onClick={() => onCopyPost(post)}
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
  )
}

// ---------------------------------------------------------------------------
// Analytics Tab
// ---------------------------------------------------------------------------

interface AnalyticsTabProps {
  dashboard: VenueOwnerDashboard
  hourlyData: { hour: string; pulses: number; energy: number }[]
  dowData: { day: string; pulses: number; energy: number }[]
  venue: Venue
  venues: Venue[]
  pulses: Pulse[]
  account: VenuePlatformAccount
  onSetAccount: React.Dispatch<React.SetStateAction<VenuePlatformAccount>>
  onUpgradePlan: (plan: PlanTier) => void
}

export function AnalyticsTab({
  dashboard,
  hourlyData,
  dowData,
  venue,
  venues,
  pulses,
  account,
  onSetAccount,
  onUpgradePlan,
}: AnalyticsTabProps) {
  return (
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
              // handled by parent via toast
              return
            }
            onSetAccount(prev => ({
              ...prev,
              competitorVenues: [...prev.competitorVenues, id],
            }))
          }}
          onRemoveCompetitor={(id) => {
            onSetAccount(prev => ({
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
            onClick={() => onUpgradePlan('pro')}
            className="px-4 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Upgrade to Pro — $99/mo
          </button>
        </Card>
      )}
    </motion.div>
  )
}
