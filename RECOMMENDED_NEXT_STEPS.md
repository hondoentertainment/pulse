# Pulse — Recommended Next Steps

> Regenerated 2026-08-16 from `main` plus open GitHub work. The April 2026
> revision described a broken test suite that is no longer the bottleneck.
> The shipping default on `main` is **Pulse Signal** (`VITE_APP_MODE=signal`).

## Intake Summary

- Total items: 12 (4 new Signal tickets, 6 existing venue tickets, 2 merge/ops items)
- Recommended next action: **[#56](https://github.com/hondoentertainment/pulse/issues/56) — decide Signal vs venue**, then land **[PR #55](https://github.com/hondoentertainment/pulse/pull/55)** so Signal history actually persists

## Current health snapshot

| Metric | Status on `main` (2026-08-16) |
|--------|-------------------------------|
| **Default product** | Pulse Signal (`LoginScreen` → `SignalApp`) |
| **Venue product** | Present, gated by `VITE_APP_MODE=venue` |
| **Signal backend** | Client writes `signal_entries` / `signal_profiles` — **no matching migrations on `main`** |
| **Pilot CTA** | Analytics + toast only; no email stored |
| **Reminders** | Preference toggle; no real delivery when the app is closed |
| **Open PRs** | #42 (CI/docs), #44 (venue-default + commercial roadmap), #55 (Signal DB + PRD) |
| **Open issues** | Venue P0/P1 #48–#53; new Signal tickets #56–#59 |

`#44` and `#55` disagree about which product is the default. Do not start a
large feature on either track until that is resolved.

## Prioritized Queue

### 1. [#56] Decide default product: Signal vs venue — Priority: P0 | Effort: S | Impact: High

- Why now: `main` and PR #55 treat Signal as the shipping product. PR #44
  flips the default to venue and marks Signal legacy. Issues #48–#53 are
  venue P0/P1. Split attention is the most expensive current risk.
- Dependencies: none
- Acceptance criteria:
  - [ ] Written decision in README + this file
  - [ ] Default `VITE_APP_MODE` matches the chosen product
  - [ ] Losing track is archived, flagged, or scheduled — not left implicit
  - [ ] Conflicting PRs/issues are closed or retargeted
- Verification: default E2E suite and README both describe the same app

**Assumption:** until #56 is decided, execute the Signal path below because
that is what `main` already ships.

### 2. Land [PR #55](https://github.com/hondoentertainment/pulse/pull/55) + apply Signal migrations — Priority: P0 | Effort: S | Impact: High

- Why now: Signal is localStorage-only on `main`. Clearing browser data
  destroys streaks and history. PR #55 adds tables, real local reminders,
  pilot capture, pattern insights, CSV export, and `PRD_SIGNAL.md`.
- Dependencies: one approving review (mergeable_state is blocked)
- Acceptance criteria:
  - [ ] PR #55 merged (or equivalent tables + capture shipped)
  - [ ] `20260725000000_signal_core.sql` applied to the production Supabase project
  - [ ] Production has `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_MODE=signal`
- Verification: sign in on two devices; a check-in on A appears on B after refresh

### 3. [#59] Persist Pro pilot waitlist emails — Priority: P1 | Effort: S | Impact: High

- Why now: Settings → “Join the pilot list” stores nothing. You cannot
  price Pulse Pro or run interviews from a toast.
- Dependencies: prefer landing PR #55 instead of re-implementing
- Acceptance criteria:
  - [ ] Form stores a contactable email
  - [ ] Duplicate submit is idempotent (“already registered”)
  - [ ] Failed persist does not show a success-only toast
- Verification: submit twice; one row; second response is already-registered

### 4. [#57] Server-side daily reminder delivery — Priority: P1 | Effort: M | Impact: High

- Why now: D7 retention is the Signal metric. Local scheduling (PR #55)
  cannot fire when the PWA is fully closed. `pwa.ts` still has a placeholder
  VAPID key.
- Dependencies: #55 tables + `signal_profiles.reminder_*`
- Acceptance criteria:
  - [ ] Real VAPID key
  - [ ] Scheduler sends only when today is unlogged
  - [ ] Permission denied/unsupported is shown honestly
- Verification: enable reminder, close the PWA, receive a notification; no
  raw slider values in the payload

### 5. [#58] Morning vs evening check-ins — Priority: P1 | Effort: M | Impact: High

- Why now: Home assumes one entry/day; the schema allows many. Morning vs
  evening is the cheapest differentiated insight Signal can add.
- Dependencies: none for the product rule; persistence (#55) before it
  matters across devices
- Acceptance criteria:
  - [ ] Documented 1/day or 2/day rule
  - [ ] UI and database agree
  - [ ] If 2/day: Trends can compare AM vs PM; streaks stay correct
- Verification: unit tests for window detection + write guard; manual AM
  then PM flow

### 6. Close or rebase stale merge debt — Priority: P1 | Effort: S | Impact: Medium

- Why now: three open PRs are blocking or conflicting.
  - [#55](https://github.com/hondoentertainment/pulse/pull/55) — merge if Signal-first
  - [#44](https://github.com/hondoentertainment/pulse/pull/44) — keep `COMMERCIAL_ROADMAP.md`
    and launch-readiness pieces; **do not** take the default-mode flip unless
    #56 chooses venue
  - [#42](https://github.com/hondoentertainment/pulse/pull/42) — take CI/docs
    fixes only if they still apply on current `main`
- Dependencies: #56
- Acceptance criteria:
  - [ ] Each PR is merged, split, or closed with a reason
- Verification: `main` has one default product and a green required CI suite

---

## Venue track (only if #56 chooses venue)

These already exist. Do not start them while Signal is the default unless
you are explicitly reviving venue mode.

1. [#48](https://github.com/hondoentertainment/pulse/issues/48) P0-4 — Curate Seattle venue inventory (25–40) — P0 | L
2. [#49](https://github.com/hondoentertainment/pulse/issues/49) P0-5 — Versioned venue signal engine — P0 | L
3. [#50](https://github.com/hondoentertainment/pulse/issues/50) P0-7 — Venue detail “Worth going” summary — P0 | M
4. [#51](https://github.com/hondoentertainment/pulse/issues/51) P0-9 — Arrival prompt and mismatch loop — P0 | M
5. [#52](https://github.com/hondoentertainment/pulse/issues/52) P1-1 — Scout program MVP — P1 | L
6. [#53](https://github.com/hondoentertainment/pulse/issues/53) P1-6 — WCAG 2.2 AA on Tonight and Map — P1 | M

If venue is chosen, also take the fundable subset from PR #44’s
`COMMERCIAL_ROADMAP.md`: one district, forecast-vs-live scores, auth + RLS,
no mock data in the core loop.

---

## Later ideas (do not start yet)

Grounded in `PRD_SIGNAL.md` (PR #55) and existing feature PRDs. Not invented.

| Idea | Why wait |
|------|----------|
| Correlation-driven advice + custom tags | Implemented on the #55 branch; land that first |
| Define Pulse Pro pricing / entitlements | Needs a real waitlist (#59) and interview signal |
| Apple Health / Google Fit import | Native + privacy surface; only after the daily loop retains |
| Archive venue code | Decision (#56) first; deletion is reversible only via git |
| AI concierge / ticketing / creator economy / video feed | Flagged Q-roadmap features; they do not help Signal D7 or a one-city venue launch |

## Deliberately not doing

- Social / friend comparison inside Signal (out of scope, PRD_SIGNAL §4.3)
- Clinical or diagnostic scoring
- New venue differentiators (wait-time ML, premium weather) while the
  default app is Signal and venue data is still mock

## Related

- [docs/VENTURE_NEXT_STEPS.md](docs/VENTURE_NEXT_STEPS.md) — weekly habits for Signal
- [PRD.md](PRD.md) — venue-mode product spec
- [PR #55 `PRD_SIGNAL.md`](https://github.com/hondoentertainment/pulse/blob/claude/admiring-mendel-y01z7i/PRD_SIGNAL.md) — shipping Signal spec (not on `main` yet)
- [PR #44 `COMMERCIAL_ROADMAP.md`](https://github.com/hondoentertainment/pulse/blob/claude/tender-babbage-jriomh/COMMERCIAL_ROADMAP.md) — venue fundability plan
