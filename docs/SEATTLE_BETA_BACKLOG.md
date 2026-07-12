# Seattle Beta Backlog (PRD v1.0)

Canonical product spec: [PRD-v1.0-SEATTLE-MVP.md](./PRD-v1.0-SEATTLE-MVP.md).  
Implementation status tracked against PRD §14–§18 acceptance criteria.

**North-star metric:** Decision Conversion Rate — qualified sessions → Go / directions / save / share / arrival within 30 minutes.

---

## P0 — MVP must-have (Phase 2 beta)

| ID | Work item | PRD ref | Status | Owner |
|----|-----------|---------|--------|-------|
| P0-1 | **Tonight golden path** — vibe picker → ranked feed → PRD explanations → Go/directions/save | §4.2, REC-01–05 | **In progress** — `TonightTab`, `tonight-feed.ts` | Eng |
| P0-2 | **Decision analytics** — session + conversion events + dashboard query | §8.1, §2.1 | **In progress** — `decision-analytics.ts` | Eng |
| P0-3 | **Venue shell as production default** | §3, §15 | **Done** — `app-mode.ts`, `prod-vercel-env.md` | Eng |
| P0-4 | **Seattle inventory** — 25–40 curated venues, 3–5 neighborhoods | §3.1, §15.1 | **Not started** | Product + Eng |
| P0-5 | **Unified signal engine** — reports → decay → confidence → trend (versioned) | §5, §6.5 | **Partial** — score in `pulse-engine.ts`; needs model config table | Eng |
| P0-6 | **Map + list parity** — energy, confidence, trend, freshness on map pins | MAP-01–05 | **Partial** | Eng |
| P0-7 | **Venue detail “Worth going?”** block | §6.4 | **Not started** | Eng |
| P0-8 | **3-tap energy report** on venue detail (not only full pulse create) | RPT-01 | **Partial** — full pulse dialog exists | Eng |
| P0-9 | **Arrival prompt + mismatch feedback** | RPT-05–06, §7.2 | **Not started** | Eng |
| P0-10 | **Guest browse** without account | ONB-01 | **Partial** — visual preview / demo; prod auth TBD | Eng |
| P0-11 | **Admin: signal suppress + Scout approval** | §13, §6.7 | **Not started** | Eng |
| P0-12 | **Sponsorship integrity audit** — labeled, separated from organic rank | §10, §18 | **Mostly done** — UI labels; needs contract tests | Eng |

---

## P1 — Should-have (closed pilot)

| ID | Work item | PRD ref | Status |
|----|-----------|---------|--------|
| P1-1 | Scout program — apply, approve, tier, weekly quota | §6.7, §15.2 | Not started |
| P1-2 | Limited energy alerts with confidence threshold | §6.6 | Partial — surge notifications exist |
| P1-3 | Energy timeline on venue detail | §14 | Not started |
| P1-4 | Venue portal pilot (5–10 operators) | §6.8, §15.1 phase 3 | Partial — `OwnerDashboardPage` |
| P1-5 | Shareable shortlist for groups | §14 | Not started |
| P1-6 | WCAG 2.2 AA audit on Tonight + Map + reporting | §11.4 | Not started |

---

## P2 — Later (explicit non-goals for beta)

- Ticketing, reservations, POS, transportation integrations (keep feature flags off)
- Multi-city expansion before density gates met
- Pulse Signal as public launch surface (separate research deploy)
- Creator economy, AI concierge, Safety Kit SMS

---

## Acceptance tests (PRD §18)

| Criterion | Automated check |
|-----------|-----------------|
| Tonight feed + vibe filter | `e2e/tonight.spec.ts` |
| Mark-all-read notifications | `e2e/notifications.spec.ts` |
| Decision explanation copy | `decision-explanations.test.ts` |
| Tonight ranking | `tonight-feed.test.ts` |
| Conversion analytics | `decision-analytics.test.ts` |
| Auth on write APIs | `write-api-auth.test.ts` |
| Supabase data path | `npm run smoke:supabase` + `e2e/supabase-data.spec.ts` |

---

## GitHub issues (create from this backlog)

Run from repo root (requires `gh` auth):

```bash
gh issue create --title "P0-4: Curate Seattle venue inventory (25-40 venues)" --body "PRD §3.1. Seed Supabase with Capitol Hill, Belltown, Fremont, Ballard, Downtown venues. Exit: geo-gate with VITE_LAUNCHED_CITIES=Seattle,WA." --label "p0,seattle,product"

gh issue create --title "P0-5: Versioned signal engine (decay, confidence, trend)" --body "PRD §5. Unify pulse reports + live intel into VenueSignal with model_configuration version. 30s propagation SLA." --label "p0,engineering"

gh issue create --title "P0-7: Venue detail Worth going? summary" --body "PRD §6.4. Single block: verdict, confidence, freshness, friction, source mix." --label "p0,ux"

gh issue create --title "P0-9: Arrival prompt + mismatch loop" --body "PRD RPT-05/06. Post-Go arrival window, one-tap confirm/correct, mismatch_reported analytics." --label "p0,engineering"

gh issue create --title "P1-1: Scout program MVP" --body "PRD §6.7. Application, approval, tier, reputation from corroboration not volume." --label "p1,product"

gh issue create --title "P1-6: WCAG 2.2 AA — Tonight + Map" --body "PRD §11.4. Keyboard nav, screen reader, no color-only state." --label "p1,a11y"
```

---

## Expansion gates (PRD §15.1, §20.10)

Do **not** expand geography until all are true for **8 consecutive weeks**:

- Decision conversion ≥ 35%
- Fresh venue coverage ≥ 70% (&lt;90 min evidence)
- Week-4 retention ≥ 25%
- Misleading signal rate &lt; 10%
- Scout weekly participation ≥ 50% (once program live)
