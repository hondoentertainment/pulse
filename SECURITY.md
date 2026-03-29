# Security Policy

## Status

Pulse is currently a prototype application and is not yet deployed as a hardened production system. Some features still rely on mock data, client-managed state, and prototype-only integrations. Treat the repository accordingly when evaluating risk.

## Supported Versions

This repository does not currently publish versioned security support windows. Security fixes should be applied to the active working branch and carried forward before any public release.

## Reporting a Vulnerability

**Do not report security issues in public GitHub issues, pull requests, or discussions.**

Report vulnerabilities privately to the repository maintainers through your normal private channel for this project. Include:

- A short description of the issue and affected area
- The files, components, or endpoints involved
- Reproduction steps
- Any proof of concept or screenshots
- The expected impact
- Suggested mitigations if you have them

If this project is made public later, replace this section with a dedicated security contact before launch.

## Current Security Priorities

The most important security gaps in the current prototype, ordered by risk:

### 1. Authentication and Authorization

There is not yet a production-grade auth and session boundary for user, admin, venue-owner, or developer surfaces. Supabase Auth is integrated (`src/hooks/use-supabase-auth.tsx`) but not enforced across all routes and actions.

**What needs to happen:**
- Enforce auth on all write operations (pulse creation, reactions, follows, moderation)
- Implement role-based access control (user, venue owner, admin)
- Add session expiry and refresh token rotation
- Gate admin surfaces (moderation, analytics dashboards) behind server-verified roles

### 2. Server-Side Secret Handling

API key creation and webhook signing logic exist as library code today (`src/lib/public-api.ts`) and must move behind trusted server routes before launch.

**What needs to happen:**
- Move all API key generation to server-side Supabase Edge Functions
- Implement webhook HMAC signing on the server
- Ensure no secrets are bundled into the client build
- Audit `src/lib/` for any hardcoded keys or tokens

### 3. Client-Side Third-Party Calls

External services such as reverse geocoding (OpenStreetMap Nominatim) are called directly from the browser, exposing usage patterns and bypassing rate controls.

**What needs to happen:**
- Proxy geocoding through a server endpoint with caching
- Move Spotify, Uber, and Lyft integrations behind server routes
- Apply server-side rate limiting to all proxied external calls

### 4. Input Validation and Sanitization

User-generated content (pulse captions, hashtags, search queries) flows through the UI. Content moderation exists (`src/lib/content-moderation.ts`) but runs client-side.

**What needs to happen:**
- Server-side content validation before persistence
- Sanitize all user input to prevent XSS
- Validate media uploads (file type, size, dimensions) on the server
- Rate limit content creation per user

### 5. Prototype Persistence

Some app state is stored in client-managed layers (Spark KV, localStorage) and needs a clearer split between secure server state, local preferences, and offline cache.

**What needs to happen:**
- Server-authoritative state for venues, pulses, users, and notifications
- Client-side cache only for offline support and UI preferences
- Clear cache invalidation on auth state changes (logout, session expiry)

### 6. Dependency Hygiene

Dependencies should be audited regularly, and known vulnerabilities should be triaged before each release candidate.

**Current tooling:**
- `npm audit --audit-level=high` runs as part of `npm run release-check`
- CI pipeline includes dependency audit step

**What needs to happen:**
- Enable Dependabot or Renovate for automated dependency updates
- Review and pin critical dependency versions
- Audit transitive dependencies for supply-chain risk

## Secure Development Expectations

Before a production launch, this repository should have:

- [ ] Private vulnerability reporting and incident ownership
- [ ] Secret management outside the client bundle
- [ ] Rate limiting and abuse controls on public-facing endpoints
- [ ] Audit logs for privileged actions (moderation, admin changes)
- [ ] Error monitoring and alerting (Sentry is integrated, needs verification)
- [ ] Dependency and supply-chain review
- [ ] Content Security Policy (CSP) headers
- [ ] HTTPS-only enforcement
- [ ] A documented response plan for account abuse, privacy incidents, and service outages

## Security-Relevant Files

| File | Description |
|------|-------------|
| `src/hooks/use-supabase-auth.tsx` | Authentication flow |
| `src/lib/public-api.ts` | API key and webhook prototype (needs server migration) |
| `src/lib/content-moderation.ts` | Content moderation logic |
| `src/lib/rate-limiter.ts` | Client-side rate limiting |
| `src/lib/payment-processing.ts` | Payment processing prototype (needs PCI review) |
| `supabase/` | Supabase configuration |
| `public/privacy.html` | Privacy policy |
