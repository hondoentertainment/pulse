import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { motion } from 'framer-motion'
import {
  type PlanTier, type VenuePlatformAccount,
  PLAN_CONFIG,
} from '@/lib/venue-platform'

interface DashboardSettingsProps {
  account: VenuePlatformAccount
  onUpgradePlan: (plan: PlanTier) => void
}

export function DashboardSettings({ account, onUpgradePlan }: DashboardSettingsProps) {
  return (
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
                  onClick={() => onUpgradePlan(plan)}
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
  )
}
