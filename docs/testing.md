# Testing Guide

How to run, write, and debug tests in Pulse.

---

## Test stack

| Layer | Tool | Location |
|-------|------|----------|
| Unit / component | Vitest + Testing Library | `src/**/__tests__/` |
| E2E smoke | Playwright | `e2e/` |
| Coverage | Vitest v8 | `coverage/` (CI artifact) |

Config: `vite.config.ts` (Vitest), `playwright.config.ts` (E2E).

---

## Running tests

```bash
# All unit tests (once)
npm run test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Single file
npx vitest run src/lib/__tests__/pulse-engine.test.ts

# E2E smoke (builds + preview server automatically)
npm run test:smoke

# Full release gate
npm run release-check   # lint + test + build + audit
```

### E2E environment

Playwright starts a preview server via `webServer` in `playwright.config.ts`:

- Builds with `VITE_E2E_AUTH_BYPASS=true`
- Clears Supabase env (mock mode)
- Default URL: `http://127.0.0.1:4176`
- Override: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173`

### Local API testing

Unit tests mock API calls. For integration tests against real `/api/*` routes:

```bash
npx vercel dev   # serves API + frontend
```

---

## Test layout

```
src/lib/__tests__/          # Domain logic (34+ files)
src/hooks/__tests__/        # Hook tests
src/components/__tests__/   # Component tests
src/__tests__/integration/  # Cross-module integration
api/_lib/__tests__/         # Server helper tests
api/**/__tests__/           # Route handler tests
e2e/smoke.spec.ts           # Browser smoke scenarios
```

---

## Writing unit tests

### Library modules

```typescript
import { describe, it, expect } from 'vitest'
import { calculatePulseScore } from '../pulse-engine'

describe('calculatePulseScore', () => {
  it('returns 0 when no recent pulses', () => {
    expect(calculatePulseScore([])).toBe(0)
  })
})
```

**Conventions:**
- File: `src/lib/__tests__/<module>.test.ts`
- Mock external deps (fetch, Supabase), not internal modules
- Use `describe` groups for related cases
- Clear names: `it('returns empty array when no venues match filter')`

### Components

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VenueCard } from '../VenueCard'

it('shows venue name', () => {
  render(<VenueCard venue={mockVenue} />)
  expect(screen.getByText('The Electric Room')).toBeInTheDocument()
})
```

**Conventions:**
- Test user-visible behavior, not implementation
- Use `getByRole` over `getByTestId` when possible
- File: `src/components/__tests__/<Component>.test.tsx`

### Hooks with env deps

```typescript
import { vi } from 'vitest'

vi.stubEnv('VITE_SUPABASE_URL', '')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
```

See `src/lib/__tests__/data-toggle.test.ts` for backend toggle patterns.

### Server routes

```typescript
// api/_lib/__tests__/ticket-verify.test.ts
import { verifyTicketHmac } from '../ticket-verify'
```

Pass mock `RequestLike` / `ResponseLike` objects.

---

## E2E smoke scenarios

`e2e/smoke.spec.ts` covers:

1. App loads without crash
2. Auth bypass / guest sign-in
3. Onboarding flow (if shown)
4. Main shell navigation
5. Map tab renders venues
6. Venue page opens
7. Pulse creation dialog
8. Notifications and profile tabs

Helpers: `ensureSignedIn()`, `completeOnboarding()`.

### Debugging E2E failures

```bash
# Run headed with inspector
npx playwright test --headed --debug

# View last report
npx playwright show-report
```

CI uploads `playwright-report` as an artifact on failure.

---

## Coverage thresholds

CI enforces floors on `src/lib/**` (see [CI Gates](ci-gates.md)):

| Metric | Floor |
|--------|-------|
| Statements | 35% |
| Branches | 33% |
| Functions | 42% |
| Lines | 34% |

Raise thresholds in `vite.config.ts` as coverage grows.

---

## CI integration

Every PR to `main` runs (`.github/workflows/ci.yml`):

| Job | Command |
|-----|---------|
| lint | `npm run lint` |
| test | `npm run test` |
| build | `npm run build` |
| smoke-preview | `npm run test:smoke` (continue-on-error) |
| dependency-audit | `npm audit --audit-level=high` |

Deploy workflow runs build + smoke before Vercel deploy.

Details: [GitHub Workflows](github-workflows.md).

---

## What to test

| Priority | What |
|----------|------|
| High | Scoring, auth, payments, safety, moderation |
| Medium | Recommendations, trending, offline queue |
| Lower | Presentational components with no logic |

Do not add tests that only assert rendering without behavior.

---

## Related docs

- [CONTRIBUTING.md](../CONTRIBUTING.md) — test conventions
- [CI Gates](ci-gates.md) — required checks
- [RELEASE_CHECKS.md](../RELEASE_CHECKS.md) — pre-deploy manual smoke
- [Getting Started](getting-started.md) — verify setup with tests
