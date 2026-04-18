import { useEffect, useState } from 'react'
import { listMyPayouts, type CreatorPayout } from '@/lib/data/creators'
import { Badge } from '@/components/ui/badge'

function fmtCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString()
}

interface Props {
  userId: string
  pageSize?: number
}

/**
 * Paginated payout list.  Uses simple client-side slicing since the backend
 * already returns in created_at DESC order.
 */
export function PayoutHistoryList({ userId, pageSize = 10 }: Props) {
  const [payouts, setPayouts] = useState<CreatorPayout[]>([])
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        const data = await listMyPayouts(userId)
        setPayouts(data)
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    })()
  }, [userId])

  const paged = payouts.slice(page * pageSize, (page + 1) * pageSize)
  const hasPrev = page > 0
  const hasNext = (page + 1) * pageSize < payouts.length

  if (error) return <p className="text-sm text-red-400">{error}</p>
  if (loading) return <p className="text-sm text-muted-foreground">Loading payouts...</p>
  if (payouts.length === 0) {
    return <p className="text-sm text-muted-foreground">No payouts yet.</p>
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {paged.map((p) => (
          <li
            key={p.id}
            className="bg-card border border-border rounded-lg p-3 flex items-center justify-between"
          >
            <div>
              <p className="text-sm font-medium">{fmtCents(p.net_cents)} net</p>
              <p className="text-xs text-muted-foreground">
                {fmtDate(p.period_start)} – {fmtDate(p.period_end)}
              </p>
            </div>
            <Badge
              variant={p.status === 'paid' ? 'default' : 'outline'}
              className="text-[10px]"
            >
              {p.status}
            </Badge>
          </li>
        ))}
      </ul>

      {(hasPrev || hasNext) && (
        <div className="flex items-center justify-between pt-2">
          <button
            className="text-sm text-primary disabled:text-muted-foreground"
            disabled={!hasPrev}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            ← Prev
          </button>
          <span className="text-xs text-muted-foreground">
            Page {page + 1}
          </span>
          <button
            className="text-sm text-primary disabled:text-muted-foreground"
            disabled={!hasNext}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
