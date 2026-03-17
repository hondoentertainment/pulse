import { ArrowLeft } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { PLAN_CONFIG } from '@/lib/venue-platform'
import type { PlanTier } from '@/lib/venue-platform'

interface DashboardHeaderProps {
  venueName: string
  plan: PlanTier
  onBack: () => void
}

export function DashboardHeader({ venueName, plan, onBack }: DashboardHeaderProps) {
  return (
    <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3">
      <div className="flex items-center gap-3 max-w-2xl mx-auto">
        <button onClick={onBack} className="p-1 hover:bg-muted/50 rounded-md transition-colors">
          <ArrowLeft size={20} className="text-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-foreground truncate">{venueName}</h1>
          <p className="text-[10px] text-muted-foreground">Venue Platform Dashboard</p>
        </div>
        <Badge className="bg-accent/20 text-accent text-[10px]">
          {PLAN_CONFIG[plan].name}
        </Badge>
      </div>
    </div>
  )
}
