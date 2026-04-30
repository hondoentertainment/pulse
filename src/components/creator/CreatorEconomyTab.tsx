import { useState } from 'react'
import { ApplyForCreatorSheet } from './ApplyForCreatorSheet'
import { ReferralCodeManager } from './ReferralCodeManager'
import { CreatorEarningsSummary } from './CreatorEarningsSummary'
import { PayoutHistoryList } from './PayoutHistoryList'
import { Button } from '@/components/ui/button'

interface Props {
  userId: string
}

/**
 * Composite tab for the creator-economy surfaces.  Wired into the existing
 * CreatorDashboard as a new "Creator" tab when VITE_CREATOR_ECONOMY_ENABLED.
 */
export function CreatorEconomyTab({ userId }: Props) {
  const [applyOpen, setApplyOpen] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Creator earnings</h2>
        <Button size="sm" variant="outline" onClick={() => setApplyOpen(true)}>
          Apply for verification
        </Button>
      </div>

      <CreatorEarningsSummary userId={userId} />

      <div className="space-y-4">
        <ReferralCodeManager />
      </div>

      <div className="space-y-3">
        <h3 className="font-bold">Payout history</h3>
        <PayoutHistoryList userId={userId} />
      </div>

      <ApplyForCreatorSheet open={applyOpen} onOpenChange={setApplyOpen} />
    </div>
  )
}
