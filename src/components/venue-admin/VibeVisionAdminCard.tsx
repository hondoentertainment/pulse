/**
 * Admin telemetry + batch QA for photo vibe assessment.
 */
import { useCallback, useEffect, useState } from 'react'
import { Sparkle } from '@phosphor-icons/react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'

interface VibeVisionStats {
  hours: number
  total: number
  blocked: number
  lowConfidence: number
  avgConfidence: number | null
  totalCostCents: number
  byEnergy: Record<string, number>
  bySource: Record<string, number>
  recent: Array<{
    id: string
    energy_rating?: string
    confidence?: number
    safe?: boolean
    source?: string
    created_at?: string
    venue_id?: string
  }>
  confidenceThreshold: number
  note?: string
}

interface BatchResult {
  imageUrl: string
  ok: boolean
  energyRating?: string
  confidence?: number
  summary?: string
  safe?: boolean
  error?: string
}

interface VibeVisionAdminCardProps {
  authToken: string | null
}

export function VibeVisionAdminCard({ authToken }: VibeVisionAdminCardProps) {
  const [stats, setStats] = useState<VibeVisionStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [batchUrls, setBatchUrls] = useState('')
  const [batchBusy, setBatchBusy] = useState(false)
  const [batchResults, setBatchResults] = useState<BatchResult[]>([])

  const loadStats = useCallback(async () => {
    if (!authToken) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/vibe-vision?hours=24', {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as { data: VibeVisionStats }
      setStats(json.data)
    } catch (err) {
      toast.error('Failed to load vibe vision stats', {
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setLoading(false)
    }
  }, [authToken])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  const runBatch = async () => {
    if (!authToken) return
    const imageUrls = batchUrls
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter((s) => /^https?:\/\//i.test(s))
      .slice(0, 10)

    if (imageUrls.length === 0) {
      toast.error('Paste 1–10 https image URLs (one per line)')
      return
    }

    setBatchBusy(true)
    setBatchResults([])
    try {
      const res = await fetch('/api/admin/vibe-vision', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageUrls }),
      })
      const json = (await res.json()) as { data?: { results: BatchResult[] }; error?: { message?: string } }
      if (!res.ok) throw new Error(json.error?.message ?? `HTTP ${res.status}`)
      setBatchResults(json.data?.results ?? [])
      toast.success(`Assessed ${json.data?.results?.length ?? 0} photos`)
      void loadStats()
    } catch (err) {
      toast.error('Batch assess failed', {
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setBatchBusy(false)
    }
  }

  return (
    <Card className="space-y-4 p-4" data-testid="vibe-vision-admin-card">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <Sparkle weight="fill" className="size-4 text-primary" />
          Vibe Vision
        </h2>
        <Button type="button" variant="outline" size="sm" onClick={() => void loadStats()} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>

      {stats ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="24h assesses" value={String(stats.total)} />
          <Stat label="Blocked" value={String(stats.blocked)} />
          <Stat label="Low confidence" value={String(stats.lowConfidence)} />
          <Stat
            label="Spend (¢)"
            value={stats.totalCostCents.toFixed(2)}
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {loading ? 'Loading telemetry…' : 'No telemetry yet — run a staging assess first.'}
        </p>
      )}

      {stats && stats.avgConfidence != null && (
        <p className="text-xs text-muted-foreground">
          Avg confidence {(stats.avgConfidence * 100).toFixed(0)}% · apply threshold{' '}
          {(stats.confidenceThreshold * 100).toFixed(0)}%
          {stats.note ? ` · ${stats.note}` : ''}
        </p>
      )}

      {stats && Object.keys(stats.byEnergy).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(stats.byEnergy).map(([energy, count]) => (
            <Badge key={energy} variant="outline">
              {energy}: {count}
            </Badge>
          ))}
        </div>
      )}

      <div className="space-y-2 border-t pt-3">
        <label className="text-sm font-medium">Batch assess (scout QA)</label>
        <Textarea
          value={batchUrls}
          onChange={(e) => setBatchUrls(e.target.value)}
          rows={3}
          placeholder={'https://…/venue1.jpg\nhttps://…/venue2.jpg'}
          className="font-mono text-xs"
        />
        <Button type="button" onClick={() => void runBatch()} disabled={batchBusy || !authToken}>
          {batchBusy ? 'Assessing…' : 'Run batch'}
        </Button>
      </div>

      {batchResults.length > 0 && (
        <ul className="max-h-48 space-y-2 overflow-y-auto text-xs">
          {batchResults.map((r) => (
            <li key={r.imageUrl} className="rounded-md border p-2">
              <p className="truncate font-mono text-[10px] text-muted-foreground">{r.imageUrl}</p>
              {r.ok ? (
                <p>
                  {r.energyRating} · {Math.round((r.confidence ?? 0) * 100)}%
                  {r.safe === false ? ' · blocked' : ''} — {r.summary}
                </p>
              ) : (
                <p className="text-destructive">{r.error}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}
