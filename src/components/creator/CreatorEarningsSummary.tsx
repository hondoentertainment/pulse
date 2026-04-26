import { useEffect, useMemo, useState } from 'react'
import { getCreatorMe, type CreatorMeResponse } from '@/lib/creators-client'
import { CurrencyDollar, Users, Clock } from '@phosphor-icons/react'

function fmtCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

interface Props {
  userId: string
}

/**
 * Compact lifetime + pipeline summary for a creator.  Intentionally avoids
 * a chart dependency here; the full chart lives in the dashboard (recharts
 * is already available as a vendor chunk).
 */
export function CreatorEarningsSummary({ userId }: Props) {
  const [state, setState] = useState<CreatorMeResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const data = await getCreatorMe()
        setState(data)
      } catch (e) {
        setError((e as Error).message)
      }
    })()
  }, [userId])

  const stats = useMemo(() => state?.stats, [state])

  if (error) return <p className="text-sm text-red-400">{error}</p>
  if (!stats) return <p className="text-sm text-muted-foreground">Loading earnings...</p>

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-card border border-border rounded-xl p-4">
        <CurrencyDollar size={18} weight="fill" className="text-green-400 mb-2" />
        <p className="text-xl font-bold">
          {fmtCents(stats.lifetime_earnings_cents)}
        </p>
        <p className="text-xs text-muted-foreground">Lifetime earnings</p>
      </div>
      <div className="bg-card border border-border rounded-xl p-4">
        <Clock size={18} weight="fill" className="text-yellow-400 mb-2" />
        <p className="text-xl font-bold">{fmtCents(stats.held_cents)}</p>
        <p className="text-xs text-muted-foreground">Held (this period)</p>
      </div>
      <div className="bg-card border border-border rounded-xl p-4">
        <Users size={18} weight="fill" className="text-blue-400 mb-2" />
        <p className="text-xl font-bold">{stats.total_attributions}</p>
        <p className="text-xs text-muted-foreground">Referred purchases</p>
      </div>
      <div className="bg-card border border-border rounded-xl p-4">
        <Clock size={18} weight="fill" className="text-purple-400 mb-2" />
        <p className="text-xl font-bold">{stats.pending_attributions}</p>
        <p className="text-xs text-muted-foreground">Pending attributions</p>
      </div>
    </div>
  )
}
