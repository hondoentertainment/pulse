import { Venue } from '@/lib/types'
import { PromotedVenue, getCampaignMetrics, isPromotionActive } from '@/lib/promoted-discoveries'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PulseScore } from '@/components/PulseScore'
import { Megaphone, TrendUp, Eye, CursorClick } from '@phosphor-icons/react'
import { motion } from 'framer-motion'

interface PromotedVenueCardProps {
  venue: Venue
  promotion: PromotedVenue
  onClick: () => void
  index?: number
}

export function PromotedVenueCard({ venue, promotion, onClick, index = 0 }: PromotedVenueCardProps) {
  const isActive = isPromotionActive(promotion)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card
        className="overflow-hidden cursor-pointer hover:border-primary/30 transition-all relative"
        onClick={onClick}
      >
        <div className="absolute top-2 right-2 z-10">
          <Badge
            variant="outline"
            className="text-[10px] bg-background/80 backdrop-blur-sm border-yellow-500/40 text-yellow-500"
          >
            <Megaphone size={10} className="mr-1" />
            Sponsored
          </Badge>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <PulseScore score={venue.pulseScore} size="sm" showLabel={false} />
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-sm truncate">{venue.name}</h4>
              <p className="text-xs text-muted-foreground">
                {venue.category}{venue.city ? ` · ${venue.city}` : ''}
              </p>
              {promotion.campaignName && (
                <p className="text-xs text-primary mt-1">{promotion.campaignName}</p>
              )}
            </div>
          </div>

          {isActive && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Eye size={12} />
                {promotion.impressions.toLocaleString()}
              </span>
              <span className="flex items-center gap-1">
                <CursorClick size={12} />
                {promotion.clicks.toLocaleString()}
              </span>
              {promotion.conversions > 0 && (
                <span className="flex items-center gap-1">
                  <TrendUp size={12} className="text-green-500" />
                  {promotion.conversions}
                </span>
              )}
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  )
}

interface PromotedDashboardProps {
  promotions: PromotedVenue[]
  venues: Venue[]
}

export function PromotedDashboard({ promotions, venues }: PromotedDashboardProps) {
  const activePromos = promotions.filter(isPromotionActive)
  const totalMetrics = promotions.reduce(
    (acc, p) => {
      const m = getCampaignMetrics(p)
      return {
        impressions: acc.impressions + m.impressions,
        clicks: acc.clicks + m.clicks,
        conversions: acc.conversions + m.conversions,
        spent: acc.spent + m.spent,
        remaining: acc.remaining + m.remaining,
      }
    },
    { impressions: 0, clicks: 0, conversions: 0, spent: 0, remaining: 0 }
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Megaphone size={20} weight="fill" className="text-yellow-500" />
        <h3 className="font-bold">Promoted Venues</h3>
        <Badge variant="outline" className="text-xs">
          {activePromos.length} active
        </Badge>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3 text-center">
          <p className="text-lg font-bold">{totalMetrics.impressions.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Impressions</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-lg font-bold">{totalMetrics.clicks.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Clicks</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-lg font-bold">${totalMetrics.spent.toFixed(0)}</p>
          <p className="text-xs text-muted-foreground">Spent</p>
        </Card>
      </div>

      {/* Campaign list */}
      {promotions.map(promo => {
        const venue = venues.find(v => v.id === promo.venueId)
        if (!venue) return null
        const metrics = getCampaignMetrics(promo)
        const active = isPromotionActive(promo)

        return (
          <Card key={promo.id} className={`p-3 space-y-2 ${!active ? 'opacity-50' : ''}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{promo.campaignName}</p>
                <p className="text-xs text-muted-foreground">{venue.name}</p>
              </div>
              <Badge variant={active ? 'default' : 'outline'} className="text-xs">
                {active ? 'Active' : 'Ended'}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>CTR: {metrics.ctr}%</span>
              <span>Conv: {metrics.conversionRate}%</span>
              <span>${metrics.spent.toFixed(2)} / ${promo.budget.toFixed(2)}</span>
            </div>
            {active && (
              <div className="w-full bg-secondary rounded-full h-1.5">
                <div
                  className="bg-primary rounded-full h-1.5 transition-all"
                  style={{ width: `${Math.min(100, (promo.spent / promo.budget) * 100)}%` }}
                />
              </div>
            )}
          </Card>
        )
      })}

      {promotions.length === 0 && (
        <Card className="p-6 text-center">
          <Megaphone size={32} className="text-muted-foreground/50 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No promoted venues yet</p>
        </Card>
      )}
    </div>
  )
}
