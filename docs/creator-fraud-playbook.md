# Creator Fraud Playbook

## Signals to watch

### Self-referral
* `creator_user_id == referred_user_id` on any attribution — should be
  impossible (blocked at `apply-referral.ts` and again at
  `attribute-purchase.ts`).  If you see one, treat the creator account as
  compromised and void **all** their held attributions.

### Cluster IPs
* More than 5 attribution events from the same /24 CIDR in 24h.  Query:
  ```sql
  SELECT code, COUNT(DISTINCT referred_user_id)
  FROM referral_attributions ra
  JOIN auth.sessions s ON s.user_id = ra.referred_user_id
  WHERE ra.created_at > NOW() - INTERVAL '24 hours'
  GROUP BY code
  HAVING COUNT(DISTINCT referred_user_id) > 5;
  ```
* Investigate manually before voiding.

### Velocity
* A single code seeing >50 attributions in 1h.  Auto-deactivate the code
  (set `is_active=false`) and alert ops.

### New-account ratio
* If >70% of a code's referred users were created <24h before using the
  code, flag for review.

### Refund/chargeback rate
* If a code's linked tickets refund at >10%, void **unpaid** attributions
  for that code and claw back paid ones.

## Claw-back procedure

1. **Identify** the attributions to reverse:
   ```sql
   SELECT id, status, commission_cents, attributed_ticket_id
   FROM referral_attributions
   WHERE code = '<CODE>' AND status IN ('held', 'paid');
   ```
2. **Void `held` rows** (never paid out):
   ```sql
   UPDATE referral_attributions
   SET status = 'voided', resolved_at = NOW()
   WHERE id = ANY('<ids>');
   ```
3. **For `paid` rows**, issue a Stripe reversal against the
   `creator_payouts.stripe_transfer_id`, then mark the payout as `failed`
   and the underlying attributions as `voided`.  If there's insufficient
   balance, raise a negative balance on the Connect account and notify
   finance.
4. **Disable the code**:
   ```sql
   UPDATE referral_codes SET is_active = false WHERE code = '<CODE>';
   ```
5. **Notify the creator** with a reason and an appeals window.

## Hard-stop triggers
Ops should immediately disable `VITE_CREATOR_ECONOMY_ENABLED` (kill switch)
and freeze payouts if:
* A single creator's held balance exceeds $10k within 24h.
* More than 100 attributions land in 10 minutes across all codes.
* Any self-referral is detected end-to-end (means a code path is broken).
