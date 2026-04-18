# Runbook: Content Moderation Bypass

**Severity default:** SEV-2 if isolated bad content is user-reported. **SEV-1** if you can demonstrate a systemic bypass (same pattern ≥ 5 successful posts, or any CSAM / illegal content).

**Primary owner:** On-call engineer + Trust & Safety DRI.

For illegal content (CSAM, credible threat, doxxing), **contain first, investigate second**, and escalate per `docs/content-safety.md` (if present) — including NCMEC reporting for CSAM.

## 1. Detection

Signals that a bypass is occurring:

- User reports in the in-app moderation queue (`/social-pulse-dashboard`) spiking above baseline.
- Sentry event `moderation.check.allowed_but_reported` increasing (emitted when a `ContentReport` is filed against a pulse that passed moderation).
- Support tickets referencing a repeated phrase or image.

### Log query to quantify scope

Pulses that passed the moderation check but were later reported, in the last 24 h:

```sql
SELECT p.id, p.user_id, p.caption, p.created_at, p.moderation_status,
       cr.reason, cr.created_at AS reported_at
FROM pulses p
JOIN content_reports cr ON cr.target_id = p.id
WHERE p.created_at > now() - interval '24 hours'
  AND p.moderation_status = 'allowed'
ORDER BY p.created_at DESC
LIMIT 200;
```

Pulses matching a suspected bypass phrase pattern:

```sql
SELECT id, user_id, caption, created_at, moderation_status
FROM pulses
WHERE caption ~* '<regex-here>'
  AND created_at > now() - interval '24 hours'
ORDER BY created_at DESC;
```

Look for:

- Repeated caption fragments.
- Zero-width / unicode-obfuscated characters (`\u200b`, `\u200c`, `\u200d`, homoglyphs).
- Unexpected posting velocity from a single user or IP.

## 2. Triage (first 10 min)

1. Declare in `#incidents`:
   ```
   /incident declare sev2 "Suspected moderation bypass — pattern <X>"
   ```
2. Snapshot the offending pulses into the incident doc (IDs + captions) for the T&S team.
3. If there is any CSAM / illegal-content suspicion, **stop user-facing debugging** and go to section 5.

## 3. Emergency Tighten (surgical)

Our moderation rules live in `src/lib/content-moderation.ts` (client-side) and in a Supabase Edge Function (server-side). For an emergency tighten without shipping code:

### 3.1 Add deny-list entries via Supabase

If the rule set is stored in a `moderation_rules` table:

```sql
INSERT INTO moderation_rules (kind, pattern, action, created_by, reason)
VALUES ('regex', '<offending-pattern>', 'block', 'oncall', 'incident <id>');
```

The Edge Function reads this table on every request (or within a 60 s cache). Expect rules to take effect within 1 minute.

### 3.2 Normalization fallback

If the bypass uses unicode obfuscation, set the feature flag:

```bash
vercel env add PULSE_MODERATION_STRICT_NORMALIZE true production
vercel --prod --force
```

This enables NFKC normalization + zero-width character stripping before the moderation check runs.

### 3.3 Rate the suspect user(s)

If a single user or small group is driving the bypass, soft-suspend:

```sql
UPDATE users SET status = 'suspended', suspended_reason = 'incident <id>'
WHERE id IN ('<user-id-1>', '<user-id-2>');
```

Suspended users fail auth at the API layer; their pulses are hidden from feeds but kept in the DB for audit.

## 4. Retroactive Cleanup

1. Mark the affected pulses as removed (**do not hard-delete** — T&S needs the audit trail):

   ```sql
   UPDATE pulses
   SET moderation_status = 'removed',
       moderation_removed_at = now(),
       moderation_removed_reason = 'incident <id> — bypass'
   WHERE id IN (<list>);
   ```

2. Invalidate caches. Pulses have a 90-min decay window, but the venue-level score can linger:
   ```sql
   UPDATE venues SET score_dirty = true WHERE id IN (
     SELECT DISTINCT venue_id FROM pulses WHERE id IN (<list>)
   );
   ```
   The nightly recompute job will fix these; for urgent cases, trigger:
   ```sql
   SELECT recompute_venue_score(id) FROM venues WHERE score_dirty = true;
   ```

3. Notify reporters (via the moderation queue UI) that action was taken.

## 5. Illegal Content Escalation

- **CSAM**: preserve the content hash, remove the image from storage (`supabase storage rm ...`), file an NCMEC report within 24 h, and contact counsel. Do **not** download or re-share.
- **Credible threat / doxxing**: preserve evidence, remove, and contact law enforcement if imminent.
- Reference `docs/content-safety.md` (if present) for the full legal protocol.

## 6. Communications Template

Intentionally minimal — do not advertise the bypass vector.

**Internal:**
```
[T&S] Bypass pattern <X> mitigated. <N> pulses removed, <M> users suspended.
Full write-up in <incident doc link>.
```

**External (only if required, e.g. user directly reported and is affected):**
```
Thanks for the report — the content you flagged has been removed and we've
taken action on the account involved.
```

## 7. Post-incident

- Add a regression test in `src/lib/__tests__/content-moderation.test.ts` that covers the bypass pattern.
- Review whether the rule should be promoted from a DB-row rule to a code-level rule.
- If unicode obfuscation was used, add it to the default normalization pipeline (retire the feature flag).
- Review the efficacy SLO in `docs/slos.md` — if bypasses are trending up, open a Linear epic.
