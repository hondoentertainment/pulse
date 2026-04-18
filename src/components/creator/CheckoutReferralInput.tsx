import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { applyReferralCode } from '@/lib/creators-client'

/**
 * Minimal referral code input, intended to be passed as the `referralSlot`
 * prop of TicketPurchaseSheet.  Submits the code before the user pays so
 * the pending attribution exists when `attribute-purchase` runs.
 */
export function CheckoutReferralInput() {
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [applied, setApplied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleApply = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await applyReferralCode(code)
      setApplied(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  if (applied) {
    return (
      <p className="text-xs text-green-400" role="status">
        Referral code applied.
      </p>
    )
  }

  return (
    <div className="space-y-1">
      <label htmlFor="checkout-referral" className="text-xs text-muted-foreground">
        Referral code (optional)
      </label>
      <div className="flex gap-2">
        <Input
          id="checkout-referral"
          placeholder="ABCDEF"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={8}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={code.length < 6 || submitting}
          onClick={handleApply}
        >
          {submitting ? '...' : 'Apply'}
        </Button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
