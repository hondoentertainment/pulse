import { useEffect, useState } from 'react'
import { CaretLeft, ChatCircle } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { listMySessions, type ConciergeSessionRow } from '@/lib/data/concierge'

interface SessionHistoryPageProps {
  onBack: () => void
  onOpenSession: (sessionId: string) => void
}

export function SessionHistoryPage({ onBack, onOpenSession }: SessionHistoryPageProps) {
  const [sessions, setSessions] = useState<ConciergeSessionRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      const rows = await listMySessions(30)
      if (active) {
        setSessions(rows)
        setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="mx-auto max-w-md space-y-3 p-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back">
          <CaretLeft className="size-5" />
        </Button>
        <h1 className="text-lg font-semibold">Concierge history</h1>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!loading && sessions.length === 0 && (
        <p className="text-sm text-muted-foreground">No concierge sessions yet.</p>
      )}

      <div className="space-y-2">
        {sessions.map((s) => (
          <Card
            key={s.id}
            className="cursor-pointer transition-colors hover:bg-muted/40"
            onClick={() => onOpenSession(s.id)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <ChatCircle className="size-4 text-primary" />
                {new Date(s.started_at).toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>Model: {s.model ?? '—'}</span>
              <span>In: {s.total_input_tokens.toLocaleString()}</span>
              <span>Out: {s.total_output_tokens.toLocaleString()}</span>
              <span>Cost: {Number(s.total_cost_cents).toFixed(2)}¢</span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
