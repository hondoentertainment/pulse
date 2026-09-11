# Uber × X UX

## Purpose

Map Pulse’s venue + map shell to a hybrid of **Uber product UX** (map-first discovery, one-thumb CTAs) and **X (Twitter) feed UX** (timeline density, hairline chrome). Guests still browse. Writes stay auth-gated. Signal is not restored. Realtime live updates stay on.

Figma Uber frames remain the discovery baseline: [Uber UX Targets](uber-ux.md). This doc is the visual/interaction overlay shipped after #88 / #94.

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
| Energy Dead / Chill / Buzzing / Electric | existing | Used sparingly on pills + chips |

Shared class groups live in `src/lib/ux-chrome.ts`. Prefer those over one-off hex.

## Mapping

| Surface | Uber keep | X add | Components |
|---------|-----------|-------|------------|
| Map home | Floating Launch 33 / All Seattle / energy pills, map canvas, Surging rail, FAB, cold-start | `Tonight · {hood}` header + underline **Tonight / Live / Map** tabs; default **Map** for Launch 33 first paint | `TonightHomeHeader`, `FeedTabBar`, `FilterPill`, `MapInventoryPills`, `MapEnergyPills`, `InteractiveMap`, `SurgingNearbyList` |
| Tonight / For you | Start here + heating up from real catalog | Timeline rows: avatar · **name** · `@venue` · kicker; trust chips stay | `TonightHomeHeader`, `TonightEmptyState`, `TrustPinChips` |
| Live now | Realtime last-90-min reviews only | X timeline of venue pulses + Boost / Reply / Share icon row | `LivePulseTimeline`, `LiveNowStrip`, `LiveReviewFeedCard`, `PulseActionRow` |
| Venue page | Mid-energy score, **Check in · Create live review** CTA | `@handle` under title; Live now + History as timeline; full `PulseCard` still opens on tap | `VenuePage`, `LiveNowStrip`, `LiveReviewFeedCard` |
| Create pulse | One-thumb **Post · 1 tap**, energy pills, draft never lost | Focused composer, venue chip as attachment, character count, hairline caption | `CreatePulseDialog`, `ComposerVenueChip`, `EnergyPills` |
| Auth / empty / offline | Guest browse; writes → `/auth`; Keep browsing | Same black chrome + hairline; pink CTA, no gradient wall | `AuthGate`, `OfflineBanner`, `EmptyState`, `MapHomeSkeleton` |
| Bottom nav / FAB | Large tap targets, one-thumb compose | Hairline top, white active + pink underline (no filled pink pill); FAB pink shadow only | `BottomNav`, `AppRoutes` FAB |

## Interaction rules

1. Guests browse `/` and `/venue/:id`. Guest create / check-in / intel still `getWriteAuthRedirect` → `/auth` and `closeComposerForAuthRedirect`.
2. Map tab default surface is **Map** so cold-start stays Launch 33 / map-first.
3. Tonight and Live never invent venues — they rank or list the existing Seattle catalog + live pulses.
4. Action row (Boost / Reply / Share) is icon-only. Reply/Share open the same venue or review the card already opened.
5. Realtime: map toast, pin bloom, Surging rail, Live now still subscribe to existing pulse channels.

## Procedure

1. Open `/` as a guest — black chrome, Tonight / Live / Map underline, Launch 33 pills, FAB.
2. Map (default) → pin → Quick pulse (sign-in redirect if no session; composer closes).
3. Tonight → For you cards with `@handle` + trust chips.
4. Live → city timeline of last-90-min reviews, or honest empty copy.
5. Venue → Uber score + CTA, X Live now / History.
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
