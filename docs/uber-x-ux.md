# Uber × X UX

## Purpose

Map Pulse’s venue + map shell to a hybrid of **Uber product UX** (map-first discovery, one-thumb CTAs) and **X (Twitter) feed UX** (timeline density, hairline chrome). Guests still browse. Writes stay auth-gated. Signal is not restored. Realtime live updates stay on.

Figma pages:

- **Uber × X** — [node 7:2](https://www.figma.com/design/wsJG3tGvfsLuUcVRfKpqS4?node-id=7-2)
- **Uber UX Targets** — [node 6:2](https://www.figma.com/design/wsJG3tGvfsLuUcVRfKpqS4?node-id=6-2) restyled into the same chrome (behavior unchanged)

## Preconditions

- Branch based on `cursor/next-steps-84-87-cfdd` (next-steps #84–#87 + Uber UX).
- Feature flag `venueInbox` on for owner reply/dismiss.
- Do not invent venues or drop `signal_*` tables.

## Style tokens

| Token | Value | Role |
|-------|--------|------|
| `--background` | `#000000` | Pure black chrome (X) |
| `--card` | `#0a0a0a` | Near-black surfaces |
| `--border` | `#2f3336` | Hairline separators |
| `--foreground` | `#E7E9EA` | Primary text |
| `--muted-foreground` | `#71767B` | Meta (@handle, time) |
| `--primary` | `#FF2D78` | Pulse energy accent (not Twitter blue) |
| Selected pills / venue CTA | inverted white / black | Figma 7 Launch 33 + I’m here · Pulse |
| Energy Dead / Chill / Buzzing / Electric | existing | Outline chips on timeline; inverted when selected |

Shared class groups live in `src/lib/ux-chrome.ts`. Prefer those over one-off hex.

## Screen → file / route checklist

### A) Uber × X (Figma 7:2) — pixel-intent

| # | Frame | Pixel-intent | Route / file |
|---|-------|--------------|--------------|
| 1 | Map · Uber×X (`7:5`) | Start-aligned Tonight / Live / Map; **Launch 33 / All Seattle / Surging** inverted pills; full-bleed `#14171c` map (~320px); **Surging nearby** pulse rows (avatar · name · @handle · time · body · vibe chips · ⚡/💬/share); Uber FAB kept. Location denied still renders Seattle pins via `resolveMapCamera` / `MapEmptyOverlay`. | `/` Map — `TonightHomeHeader`, `MapInventoryPills`, `InteractiveMap`, `SurgingNearbyList` |
| 2 | Tonight · For you (`7:76`) | For you / Following / Near underline; **Start here** kicker; same X pulse rows; Following honest-empty; Near geo or Launch 33 | `/` Tonight — `TonightHomeHeader`, `TonightEmptyState`, `LiveReviewFeedCard` |
| 3 | Venue · Live timeline (`7:155`) | 28px name; `{hood} · Open now · Verified`; 40px pink score; inverted **I’m here · Pulse**; muted Live now + timeline | `/venue/:id` — `VenuePage`, `LiveNowStrip` |
| 4 | Compose · one-thumb (`7:212`) | **Cancel** + pink **Post**; hairline; avatar + `Name · near venue ✓` chip; 20px muted placeholder; vibe pills (selected inverted) | Create Pulse — `CreatePulseDialog`, `ComposerVenueChip`, `EnergyPills` |

### B) Uber UX Targets (Figma 6:2) — same chrome, same behavior

| # | Frame | Route / surface | File |
|---|-------|-----------------|------|
| 5 | Trust at a glance (#89) | Map hover + Surging rows | `TrustPinChips`, `TrustGlanceRow`, `SurgingNearbyList` |
| 6 | One-thumb create | Pin / FAB / I’m here · Pulse | `CreatePulseDialog` |
| 7 | Live presence | `/` **Live** + map toast | `LivePulseTimeline`, `MapLiveReviewToast` |
| 8 | For tonight (personal) | `/` **Tonight** | `TonightHomeHeader` + `buildTonightHome` |
| 9 | Share that converts | `/venue/:id?from=share` | `ShareArrivalCard`, `/api/share/venue`, `/api/share/og` |
| 10 | Owner inbox v2 | `/venue/:id/inbox` | `VenueInboxPage`, `VenueInboxRoute` |
| 11 | Offline / reliability | App shell | `OfflineBanner`, `MapHomeSkeleton`, `pulse-draft` |
| 12 | First-session cold start | Onboarding + map tip | `OnboardingFlow`, `ColdStartTip` |

### C) Wired app routes

| Surface | Route | File |
|---------|-------|------|
| Auth gate / magic-link | `/auth` (guest writes) | `AuthGate` (hairline write-gate + Keep browsing), `getWriteAuthRedirect` |
| Ops moderation | `/ops` | `OpsQueuePage` |
| Install / PWA (#90) | Map home card | `InstallAffordance` |
| Empty states (map → venue → pulse) | Tonight / Live / venue / generic | `TonightEmptyState`, `LivePulseTimeline`, `EmptyState` |

## Interaction rules

1. Guests browse `/` and `/venue/:id`. Guest create / check-in / intel still `getWriteAuthRedirect` → `/auth` and `closeComposerForAuthRedirect`.
2. Map tab default surface is **Map** so cold-start stays Launch 33 / map-first.
3. Tonight **For you / Following / Near** never invent venues — they rank, filter saves, or sort the existing Seattle catalog.
4. Venue primary CTA is **I’m here · Pulse** (inverted). Composer is **Cancel + Post** with **Post · 1 tap** still one-thumb at the bottom.
5. Action row (Boost / Reply / Share) is icon-only. Reply/Share open the same venue or review the card already opened.
6. Realtime: map toast, pin bloom, Surging rail, Live now still subscribe to existing pulse channels.

## Procedure

1. Open `/` as a guest — black chrome, Tonight / Live / Map underline, Launch 33 pills, FAB.
2. Map (default) → pin → Cancel + Post composer (sign-in redirect if no session; composer closes).
3. Tonight → For you / Following / Near with `@handle` + trust chips.
4. Live → city timeline of last-90-min reviews, or honest empty copy.
5. Venue → 28px name, score card, I’m here · Pulse, Live now timeline.
6. Toggle offline → banner + Keep browsing; drafts persist.

## Verification

- [ ] `npm test` covers handle slugs, FeedTabBar, Tonight tabs, Live timeline, guest `/auth`
- [ ] Guests can browse `/` and `/venue/:id` without AuthGate
- [ ] Guest check-in / post / intel navigates to `/auth`
- [ ] No Signal shell or `VITE_APP_MODE`
- [ ] No Twitter-blue accent unless already branded (Pulse pink only)

## Ownership

- Owner: Pulse product / map + live reviews
- Last reviewed: 2026-09-11
