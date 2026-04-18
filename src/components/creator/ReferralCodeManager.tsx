import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  createReferralCode,
  listReferralCodes,
  deactivateReferralCode,
} from '@/lib/creators-client'
import type { ReferralCode } from '@/lib/data/creators'
import { Plus, Trash } from '@phosphor-icons/react'

/**
 * Creator-side list + create/deactivate UI for referral codes.
 */
export function ReferralCodeManager() {
  const [codes, setCodes] = useState<ReferralCode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listReferralCodes()
      setCodes(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleCreate = async () => {
    setCreating(true)
    try {
      const newCode = await createReferralCode()
      setCodes((prev) => [newCode, ...prev])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCreating(false)
    }
  }

  const handleDeactivate = async (code: string) => {
    try {
      await deactivateReferralCode(code)
      setCodes((prev) =>
        prev.map((c) => (c.code === code ? { ...c, is_active: false } : c))
      )
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">Your referral codes</h3>
        <Button
          size="sm"
          onClick={handleCreate}
          disabled={creating}
          aria-label="Create referral code"
        >
          <Plus size={16} className="mr-1" /> New code
        </Button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading codes...</p>
      ) : codes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No codes yet. Create one to start earning on referred purchases.
        </p>
      ) : (
        <ul className="space-y-2">
          {codes.map((c) => (
            <li
              key={c.code}
              className="bg-card border border-border rounded-lg p-3 flex items-center justify-between"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <code className="font-mono text-base font-bold">{c.code}</code>
                  {c.is_active ? (
                    <Badge variant="default" className="text-[10px]">
                      active
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">
                      inactive
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {c.uses_count} uses
                  {c.max_uses ? ` / ${c.max_uses}` : ''}
                  {c.venue_id ? ' · venue-scoped' : ''}
                </p>
              </div>
              {c.is_active && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeactivate(c.code)}
                  aria-label={`Deactivate code ${c.code}`}
                >
                  <Trash size={16} />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
