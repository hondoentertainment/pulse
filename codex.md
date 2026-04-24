# Codex Guide

## Project Snapshot

Pulse is a mobile-first nightlife discovery app built with React, TypeScript, and Vite. The product mixes venue discovery, live energy scoring, pulses, maps, crews, events, and social features.

This codebase is in the middle of a transition from prototype behavior toward a more production-shaped app:
- Supabase auth and data access have been introduced
- Capacitor support is being added for native mobile builds
- Some flows still rely on mock data, local state, or seeded demo content

## Primary Stack

- React 19
- TypeScript
- Vite 7
- Tailwind CSS 4
- Vitest
- Playwright
- Supabase
- Capacitor

## Important Commands

```bash
npm install
npm run dev
npm run build
npm run test
npm run test:smoke
npm run lint
npm run release-check
```

## Main App Surfaces

- `src/App.tsx`
  Main app shell, auth gate, onboarding gate, route switching, modal mounting.
- `src/hooks/use-app-state.tsx`
  Central client state orchestration, data hydration, location handling, feature flags, derived collections.
- `src/hooks/use-app-handlers.ts`
  User interaction handlers and state mutations.
- `src/hooks/use-supabase-auth.tsx`
  Supabase session and profile context.
- `src/lib/native-bridge.ts`
  Platform-aware wrappers for Capacitor vs web APIs.
- `src/components/*`
  Feature UI for discovery, venue pages, onboarding, auth, and supporting flows.

## Current Reality

- Auth exists, but the product still has prototype-era assumptions in surrounding state and data flows.
- Venue, pulse, and social features are partly server-backed and partly seeded locally.
- Location is now bridged through native/web abstractions, but fallback behavior still exists.
- Playwright smoke coverage exists, but deeper critical-path coverage is still limited.

## Recommended Engineering Direction

1. Finish the auth-to-profile-to-app-state integration so the signed-in user consistently drives all user-facing state.
2. Replace remaining mock or seeded domain data with durable Supabase-backed reads and writes.
3. Tighten native/mobile readiness by validating Capacitor lifecycle, permissions, and push/location flows on-device.
4. Expand end-to-end coverage around login, onboarding, venue exploration, and pulse creation.
5. Keep server boundaries clear by moving sensitive or third-party work behind Supabase functions or API routes.

## Working Notes For Future Codex Sessions

- Check `git status` before editing because this repo often has in-progress work.
- Avoid reverting unrelated local changes.
- Prefer small, verifiable changes because several major migrations are happening at once.
- When making product recommendations, ground them in the auth, Supabase, and Capacitor transition already underway.

