# Pulse — Recommended Next Steps

> Generated 2026-04-04 from a full codebase audit. Prioritized by impact and unblock potential.

## Current Health Snapshot

| Metric | Status |
|--------|--------|
| **Build** | Passes (chunk warning: `react-vendor` ~672 KB) |
| **Lint** | Warnings present (unused vars/imports) |
| **Unit tests (lib/)** | 519 passing, 1 failing (`interactive-map` clustering) |
| **Component tests** | 6 of 7 suites failing (icon mock gap) |
| **E2E** | Smoke suite passing |
| **Backend** | Mock data only — Supabase schema exists but not wired |

---

## Immediate Priority: Fix Test Suite (1-2 days)

### 1. Fix component test icon mock

**Root cause:** The Phosphor icon proxy mock in tests doesn't export all icons used by components (e.g., `Users`, `Crown`, `Heart` in `GuestCRM.tsx`). This breaks **6 of 7 component test suites** — not actual component bugs.

**Fix:** Update the icon mock (likely in `vitest.setup.ts` or a shared mock file) to use `importOriginal` so all Phosphor icons are available:

```ts
vi.mock("@phosphor-icons/react", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual };
});
```

Or add the missing icon exports (`Users`, `Crown`, `Heart`, `TrendUp`, `TrendDown`, etc.) to the existing mock.

**Impact:** Fixes 28 of the 29 failing tests in one change.

### 2. Fix interactive-map clustering test

**Root cause:** `clusterVenueRenderPoints` clustering test has a flaky distance/grouping assertion.

**File:** `src/lib/__tests__/interactive-map.test.ts`

**Action:** Review the test's coordinate inputs and clustering radius — likely needs a tolerance adjustment or the clustering algorithm changed without updating the test.

---

## Short-Term: Code Health (1 week)

### 3. Lint cleanup

- Fix unused imports/vars flagged by ESLint (or prefix with `_`)
- Target: zero lint errors, warnings below 20
- Prevents lint noise from hiding real issues

### 4. Dead code audit

Candidates with no component consumers:
- `src/lib/white-label.ts` — white-label theming (unused)
- `src/lib/public-api.ts` — API key generation (client-side, should be server-side or removed)
- `src/lib/twitter-ingestion.ts` — Twitter data pipeline (prototype only)

**Impact:** Reduces bundle size and maintenance surface.

### 5. Bundle size optimization

| Target | Action |
|--------|--------|
| Sentry (~257 KB) | Lazy-load after first render |
| Three.js | Defer until 3D features accessed |
| Index chunk (~202 KB) | Route-split sub-pages (settings, achievements, events) |
| `react-vendor` (~672 KB) | Audit — may need React import optimization |

---

## Medium-Term: Architecture (2-3 weeks)

### 6. Split monolithic state provider

`src/hooks/use-app-state.tsx` manages all app state in one provider. Split into:
- **VenueContext** — venue data, selections, filters
- **SocialContext** — crews, friends, follows, reactions
- **UIContext** — tabs, modals, navigation state

This reduces re-renders and makes the codebase easier to reason about.

### 7. Replace mock data with API layer

- `src/lib/mock-data.ts` (~280 KB) contains hardcoded venue/user data
- `src/lib/global-venues.ts`, `src/lib/us-venues.ts` are static datasets
- Wire TanStack Query (already configured via `query-client.ts`) to Supabase
- Move mock data to test fixtures only

### 8. Route-based code splitting

Sub-pages that should be lazy-loaded:
- Settings, Achievements, Events, Playlists, Night Planner
- Venue Owner Dashboard, Creator Dashboard, Moderation Queue
- Crew Page, Insights Page

---

## Medium-Long Term: Backend & Production (4-6 weeks)

### 9. Supabase backend wiring

Supabase schema and migrations exist in `supabase/` but aren't connected to the app:

- [ ] Wire auth enforcement on all protected routes
- [ ] Implement CRUD for venues, pulses, reactions, stories via Edge Functions
- [ ] Enable real-time subscriptions for live venue scores
- [ ] Move geocoding, API key management, webhook signing server-side
- [ ] Enforce RLS policies for multi-tenant data access

### 10. Security hardening

Critical items before any public launch:
- [ ] Server-side content moderation (currently client-only)
- [ ] Move API secrets out of client bundle (`public-api.ts`)
- [ ] Server-side rate limiting
- [ ] Input sanitization on all user content (captions, hashtags, media)
- [ ] CSP headers and HTTPS-only enforcement
- [ ] Auth token rotation and session management

### 11. Integration tests for critical flows

- Supabase auth flow (OAuth + magic link)
- Offline queue sync (queue → Supabase when back online)
- Real-time subscription lifecycle
- Pulse creation end-to-end

---

## Suggested Execution Order

| # | Task | Effort | Unblocks |
|---|------|--------|----------|
| 1 | Fix icon mock (28 tests) | 30 min | Green CI |
| 2 | Fix interactive-map test | 1 hr | Green CI |
| 3 | Lint cleanup | 1 day | Clean CI output |
| 4 | Dead code audit | 1 day | Smaller bundle |
| 5 | Bundle optimization | 1-2 days | Performance |
| 6 | State management split | 1-2 weeks | Scalability |
| 7 | API layer + mock removal | 2-3 weeks | Real product |
| 8 | Route code splitting | 1 week | Performance |
| 9 | Supabase backend | 3-4 weeks | Launch readiness |
| 10 | Security hardening | 1-2 weeks | Public launch |
| 11 | Integration tests | 1-2 weeks | Confidence |

---

## Related Docs

- [NEXT_PHASES.md](NEXT_PHASES.md) — detailed phase plan
- [ARCHITECTURE.md](ARCHITECTURE.md) — system design
- [PRODUCTION_ROLLOUT.md](PRODUCTION_ROLLOUT.md) — rollout plan
- [SECURITY.md](SECURITY.md) — security priorities
- [RELEASE_CHECKS.md](RELEASE_CHECKS.md) — pre-deploy checklist
