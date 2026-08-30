# Runbook: Pulse Signal closed-app Web Push

## Purpose

Prove the #57 remainder: a granted Web Push subscription receives the daily reminder when the PWA is closed, without slider values in the payload.

## Preconditions

- Production (or a preview that shares prod-like env) has:
  - `VITE_VAPID_PUBLIC_KEY` (client, rebuild required)
  - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (server)
  - optional `VAPID_SUBJECT`
  - `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`
  - migrations through `20260816000002_signal_push_subscriptions.sql`
- Test device can install the PWA and grant notification permission

## Procedure

1. Sign in on the test device. Settings → Daily reminder ON. Grant permission.
2. Confirm a row in `signal_push_subscriptions` for that user.
3. Confirm `signal_profiles.reminder_enabled` is true and `reminder_time` matches local time.
4. Do **not** log today (or use a second account). Close the PWA completely.
5. Wait for the 15-minute cron, or trigger:
   ```bash
   curl -sS -H "Authorization: Bearer $CRON_SECRET" \
     "$PROD_URL/api/signal/reminders/dispatch"
   ```
6. Open the notification. It should land on `/home`.
7. Log today, then trigger dispatch again — that user must not be a candidate.

## Verification

- [ ] Notification arrives with the PWA closed
- [ ] Title/body are reminder copy only
- [ ] Payload / notification data has no `energy`, `mood`, `stress`, `sleep`, `score`, or `tags`
- [ ] Already-logged day is skipped
- [ ] Settings copy stays honest when VAPID or permission is missing

## Rollback / Escalation

- Unset `VAPID_PRIVATE_KEY` to force log-only fan-out.
- Remove the cron path in `vercel.json` to stop scheduled sends.
- Escalate if `signal_push_subscriptions` is empty after a granted permission — check `/api/signal/push-subscribe` 401s and JWT config.

## Ownership

- Owner: Signal product engineer
- Last reviewed: 2026-08-30
