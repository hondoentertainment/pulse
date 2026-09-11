# Uber UX Targets

## Purpose

Ship the eight Figma frames on [Uber UX Targets](https://www.figma.com/design/wsJG3tGvfsLuUcVRfKpqS4?node-id=6-2) (`node-id=6-2`, page **Uber UX Targets**) into Pulse’s venue + map shell. Guests browse the map without auth. Signal is not restored.

## Preconditions

- Latest `main` (guest map discovery from #83).
- Feature flag `venueInbox` on for owner reply/dismiss.

## Mapping

| # | Figma frame | In-app surface | Acceptance |
|---|-------------|----------------|------------|
| 1 | Map · Trust at a glance | Map cards + Surging rail via `TrustGlanceRow` / `buildTrustGlance` | Freshness · GPS ✓ / Unverified · Why surging / Soft signal |
| 2 | Create · One-thumb | `CreatePulseDialog` opened from a map pin | ≤3 taps (pin → energy → Post · 1 tap); draft in `pulse-draft`; photo optional |
| 3 | Map · Live presence | `MapLiveReviewToast` + pin bloom + `SurgingNearbyList` | “just went Electric” toast; bloom on arrival; rail updates without refresh |
| 4 | Home · For tonight | `TonightHomeHeader` on map tab | `Tonight · {neighborhood}` + time + saves; Start here / Also heating up |
| 5 | Share · Deep link | `/venue/:id?from=share` + `/api/share/venue` + `/api/share/og` | I’m here · open map; OG image matches the card |
| 6 | Venue · Owner inbox v2 | `/venue/:id/inbox` | Tonight’s queue; Reviews + Reports; Reply / Dismiss report for verified claims |
| 7 | Reliability · Empty + offline | `OfflineBanner` + `MapHomeSkeleton` + queued draft | Offline copy, Keep browsing, skeleton matches map, draft never lost |
| 8 | First session · Cold start | Onboarding + `ColdStartTip` | Launch 33 first; All Seattle tip; Start Exploring; map skeleton under 2s path |

Plus: guest check-in / live review / live intel **redirect to `/auth`** (`getWriteAuthRedirect` + `closeComposerForAuthRedirect`). Toast-only is not acceptable — the composer must close.

See [next-steps.md](next-steps.md) for #84–#87 + PWA / trust chips / ops / funnel / catalog.

Visual overlay after those frames: [Uber × X UX](uber-x-ux.md) (pure black / hairline timeline + Pulse energy accent).

## Procedure

1. Open `/` as a guest — map + Launch 33 / All Seattle / Near me.
2. Tap a pin → Cancel + Post composer (sign-in redirect if no session).
3. Share a venue URL → crawler hits `/api/share/venue` (OG + image) → human lands on `?from=share`.
4. Verified owner opens inbox → reply / dismiss tonight’s queue.
5. Toggle offline → banner + Keep browsing; drafts persist.

## Verification

- [ ] `npm test` covers trust, tonight, draft, inbox, share, guest `/auth` redirect
- [ ] Guests can browse `/` and `/venue/:id` without AuthGate
- [ ] Guest check-in / post / intel navigates to `/auth`
- [ ] No Signal shell or `VITE_APP_MODE`

## Ownership

- Owner: Pulse product / map + live reviews
- Last reviewed: 2026-09-11
