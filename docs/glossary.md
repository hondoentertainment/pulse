# Glossary

Terms used across Pulse documentation and codebase.

---

## Product terms

| Term | Definition |
|------|------------|
| **Pulse** | A short-lived post at a venue with an energy rating, optional media, and caption. Expires after 90 minutes. |
| **Pulse score** | Live 0–100 energy score for a venue based on recent pulses. |
| **Energy rating** | User-selected vibe level: Dead, Chill, Buzzing, or Electric. |
| **Check-in** | Geo-verified confirmation that a user is physically at a venue. |
| **Venue** | A nightlife location (bar, club, lounge, etc.) in the catalog. |
| **Crew** | A friend group for coordinated check-ins and planning. |
| **Story** | Ephemeral venue or user content with reactions (similar to social stories). |
| **Surge** | Rapid increase in a venue's pulse score — triggers notifications. |
| **Impact notification** | Alert when your pulse pushes a venue across an energy threshold. |
| **My Spots** | Feed of pulses from venues you follow (up to 10). |
| **Signal** | Alternate product shell focused on daily personal check-ins and trends. |

## Scoring terms

| Term | Definition |
|------|------------|
| **Recency factor** | Weight decreasing linearly as a pulse ages toward the 90-minute cutoff. |
| **Velocity bonus** | Extra score points when many pulses arrive in a short window. |
| **Credibility weight** | Multiplier (0.5x–2.0x) based on user trust history. |
| **Score transparency** | "Why this score?" panel showing breakdown without exposing formula. |
| **Pre-trending** | Label for venues building momentum before peak. |
| **Just Popped Off** | Trending category for rapid surges. |

## Technical terms

| Term | Definition |
|------|------------|
| **Spark KV** | `@github/spark` browser storage hooks for prototype app state. |
| **RLS** | Row Level Security — Supabase Postgres policies enforcing per-user access. |
| **Edge Function** | Vercel serverless route under `api/` (not Supabase Edge Functions). |
| **Mock backend** | Local fixtures in `mock-data.ts` when Supabase creds are absent. |
| **Optimistic UI** | Showing pending state immediately before server confirmation. |
| **Feature flag** | `VITE_*` env var gating a feature surface at build time. |
| **Service role** | Supabase key bypassing RLS — server-only, never in client. |
| **Anon key** | Supabase public key safe to expose; RLS still applies. |

## Feature area terms

| Term | Definition |
|------|------------|
| **Safety Kit** | Trusted contacts, safe-walk sessions, panic button, SMS alerts. |
| **AI Concierge** | Claude-powered assistant for night planning. |
| **Creator economy** | Referral codes, commissions, and payouts for creators. |
| **Staff scanner** | Venue door app for QR ticket verification. |
| **Video pulse** | Vertical video post in the video feed. |
| **Live report** | Crowdsourced venue intel (wait time, cover, crowd level). |
| **Wait time** | Estimated door/line wait in minutes with confidence level. |

## Operations terms

| Term | Definition |
|------|------------|
| **SLO** | Service Level Objective — target uptime/latency. |
| **Runbook** | Step-by-step procedure for an operational scenario. |
| **Bad deploy** | Release causing errors — rollback via Vercel promote. |
| **Read-only mode** | `VITE_PULSE_READ_ONLY_MODE` — disables client writes during outage. |
| **Chaos drill** | Planned resilience test (e.g. kill Supabase connection). |

## Abbreviations

| Abbr | Meaning |
|------|---------|
| PWA | Progressive Web App |
| RLS | Row Level Security |
| JWT | JSON Web Token (Supabase session) |
| OTP | One-time password (safety contact verification) |
| HMAC | Hash-based message authentication (ticket QR signing) |
| FCM | Firebase Cloud Messaging (Android push) |
| APNs | Apple Push Notification service |
| E2E | End-to-end (Playwright browser tests) |
| WCAG | Web Content Accessibility Guidelines |

---

## Related docs

- [PRD.md](../PRD.md) — product terminology in context
- [Scoring Algorithm](scoring-algorithm.md) — scoring terms in detail
- [Component Catalog](component-catalog.md) — UI named after these concepts
