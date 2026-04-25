# Pulse Safety Kit - PRD

**Status:** Draft (2026-04-17)
**Owner:** Trust & Safety / Growth (Under-30, esp. women retention)
**Feature flag:** `VITE_SAFETY_KIT_ENABLED` (default ON in dev, default OFF in prod
until T&S sign-off).

## 1. Problem & opportunity

Google Maps, Yelp, and Partiful help users find places and plan nights, but none
offer a first-class *safety layer*. Our toughest retention cohort - users under
30, particularly women - consistently cite "getting home safely" as the single
biggest anxiety of going out. We can differentiate by bundling four primitives
into a single, calm, one-handed "Safety Kit":

1. **Safe-walk timer** - arm a countdown from venue A to B, auto-alert contacts
   if it expires without a check-in.
2. **Share-my-night** - lightweight group plan sharing: "here's where we'll be".
3. **Panic button** - 3-second hold to broadcast last known location + SMS +
   push to trusted contacts (not 911 - see legal).
4. **Verified rideshare handoff** - log Uber/Lyft ride metadata (pickup/dropoff,
   status) so a trusted contact can follow along.

## 2. User stories

- As a solo walker, I tap **Start Safe Walk**, pick my destination, set an ETA,
  and choose 1-3 contacts. If I haven't tapped "I'm safe" by the ETA, those
  contacts get an SMS + push with my last location.
- As a friend receiving a share, I get a single link with a live map of my
  friend's walk; it stops updating when she ends the session.
- As a user whose gut says something is wrong, I can press-and-hold a big red
  button (3s) to immediately alert all verified contacts, including a map link.
- As a user booking a ride, I can tap "Trusted ride" to log the trip and share
  the dropoff ETA with contacts without installing anything extra.
- As a user who just added a contact, I can verify them via a 6-digit SMS OTP so
  I know the number is reachable before I ever rely on it.

## 3. Entities

| Entity | Purpose |
| --- | --- |
| `emergency_contacts` | User's verified contacts (name, E.164 phone, relationship, verified_at, preferred_contact_method). |
| `safety_sessions` | A single safety event (`kind`: safe_walk / share_night / panic) with `state` lifecycle. |
| `safety_pings` | Time-series location + battery + network quality while a session is active. |
| `trusted_rides` | Rideshare metadata (uber/lyft ride id, pickup/dropoff, status). |
| OTP verification cache | Short-lived (10 min) 6-digit codes; stored in a narrow table with per-contact TTL. |

## 4. Flows

### 4.1 Arm safe-walk timer
1. User opens `SafetyHomeCard`, taps "Start Safe Walk".
2. Sheet collects destination (venue or freeform address), ETA (default 20 min),
   contacts.
3. Client calls `POST /api/safety/session/start` -> returns session id + state
   `armed`.
4. On success, client switches to state `active` by starting
   `navigator.geolocation.watchPosition` and pinging
   `POST /api/safety/session/ping` (rate-limited to 1/5s).
5. `ActiveSessionBanner` is sticky at the top of the home screen with remaining
   time, end button, extend button, panic button.

### 4.2 Auto-alert on expiry
1. Vercel cron hits `GET /api/safety/cron/check-expired` every 60s.
2. Cron finds sessions where `state = 'active'` and `expected_end_at < now()`.
3. Flips to `alerted`, writes `contacts_notified`, invokes Twilio SMS + Realtime
   push for every verified contact in the session's contact snapshot.

### 4.3 Share-my-night
- `ShareNightSheet` creates a session with kind `share_night` (longer TTL, lower
  ping frequency, no auto-alert - just a read-only share link for contacts).

### 4.4 Panic (manual trigger)
- User holds `PanicButton` for 3s (hold-to-fire defeats pocket dials).
- Client calls `POST /api/safety/session/trigger` with or without an existing
  session id; server creates/updates session in `alerted` state, writes audit
  entry, notifies contacts.

### 4.5 Rideshare handoff
- `TrustedRideCta` lives inside existing integrations (render-guard only; does
  NOT modify integrations code). When user taps it, client writes a
  `trusted_rides` row and optionally spawns a `share_night` session scoped to
  the ride.

## 5. UX guardrails

- **False-positive minimization:** 3-second hold for panic, 10-second "are you
  sure?" on timer expiry (in-app toast) before SMS goes out (v1 sends
  immediately; v2 adds 60s grace window). Contacts must be verified via OTP
  before they receive SMS.
- **Battery:** ping every 30s when active (configurable), coalesce if device
  reports low battery (<20%) to 60s, back off to 120s under 10%.
- **Dark-mode friendly:** colors drawn from existing `bg-background`,
  `text-foreground`, `border-border` tokens - no hardcoded hex.
- **One-handed:** primary action buttons are 56px+ tall, live in the lower
  half of the sheet. Panic button is full-width and 80px tall.
- **Permission handling:** if `geolocation` permission is denied, we surface a
  calm callout ("Pulse can't get your location - SMS to contacts will still
  work but without a map link") - no silent retries, no coercion.
- **Observability:** client uses existing `analytics`; no new telemetry plumbing.

## 6. Legal & privacy

- This is NOT an emergency service. The panic button does NOT call 911 or any
  PSAP. The UI labels it "Alert my contacts" and the onboarding sheet forces
  users to acknowledge that.
- SMS sent via Twilio with an opt-in footer ("Reply STOP to unsubscribe").
  Emergency contacts are asked to opt-in during verification.
- Location pings retained for 30 days, then auto-purged by a scheduled job
  (documented in `docs/safety-kit.md`). Panic audit rows retained 2 years for
  legal defensibility.
- RLS is strictly owner-only. A separate `safety_responder` claim on
  `app_metadata.role` exposes triage access (documented in migration).
- GDPR/CCPA: export and delete covered by the existing Data Export in Settings
  because all rows are scoped to `user_id`.

## 7. Success metrics (90-day target)

- **Activation:** 8% of MAU add at least one verified emergency contact.
- **Engagement:** 20% of users who add a contact start at least one
  `safe_walk` session within 14 days.
- **Retention:** +3pp W4 retention for users <30 who activate Safety Kit vs
  control.
- **Quality:** <2% panic false-positive rate (measured by same-user cancel
  within 60s of trigger).
- **Latency:** P95 Twilio SMS dispatch <5s from trigger.

## 8. Out of scope (v1)

- Native e911 / RapidSOS integration.
- WearOS / Apple Watch apps.
- Fall detection / inactivity triggers.
- Voice activation / Siri Shortcuts.
- Multi-party live video.

## 9. Follow-up tickets

- SAFETY-101: e911 / RapidSOS partnership integration.
- SAFETY-102: Aggressive battery profile + motion-based ping coalescing.
- SAFETY-103: Apple Watch + WearOS quick-trigger complications.
- SAFETY-104: 60-second grace window before auto-alert dispatches.
- SAFETY-105: Contact receipt UI (has my contact seen the alert?).
