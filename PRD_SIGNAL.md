# Pulse Signal — Product Requirements

> **This is the spec for the shipping product.** Pulse Signal is what
> `VITE_APP_MODE=signal` (the production default) serves. The venue
> discovery product is specified separately in [PRD.md](PRD.md) and ships only
> under `VITE_APP_MODE=venue`.

**One line:** A ten-second daily check-in that turns how you felt into patterns
you can act on.

---

## 1. Problem & positioning

Most well-being apps fail in one of two ways: they ask for too much (long
journals, dozens of metrics) so people quit in a week, or they collect data and
hand back a chart with no interpretation. Either way the user never learns
anything about themselves.

Pulse Signal takes the opposite bet:

- **Logging must cost ~10 seconds.** Four sliders and a couple of tags. No prose.
- **Every entry must buy insight.** The app's job is not to store your data —
  it's to tell you *what lifts you and what drains you*.

**Target user:** someone who suspects their energy/mood/focus follows a pattern
(sleep, exercise, social load, stress) but has no way to see it.

**Not competing on:** clinical assessment, therapy, medical claims, or social
features. Signal is private, single-player, and non-diagnostic.

## 2. Core loop

1. **Check in** — rate energy, mood, stress, and sleep quality (1–10), tag the day
2. **Get a signal** — one 0–100 score, a plain-language insight, one recommendation
3. **Keep the streak** — a daily nudge; streak + 7-day average make consistency visible
4. **See patterns emerge** — after ~a week, tag correlations and weekly recaps appear

Steps 1–3 are the habit. Step 4 is the payoff that makes the habit worth keeping.
**The product only works if users reach step 4**, so time-to-first-insight is the
metric that matters most.

### Experience qualities

1. **Fast** — the check-in must never feel like a chore; sliders, not forms
2. **Honest** — no fake precision, no insight the data can't support, no dark patterns
3. **Private** — personal data, owner-only access, exportable and deletable

## 3. Scoring model

The signal score is a 0–100 composite of the four inputs
(`src/lib/signal-score.ts`):

| Input | Weight | Direction |
|-------|--------|-----------|
| Energy | 0.36 | higher is better |
| Mood | 0.34 | higher is better |
| Sleep quality | 0.22 | higher is better |
| Stress | 0.18 | **penalty** |

Buckets: **Recovery mode** (<40) · **Steady** (40–69) · **Peak signal** (70+).

This is a deliberately simple, explainable heuristic — not a validated clinical
instrument, and it must never be presented as one.

## 4. Feature surface

### 4.1 Shipping today

| Feature | Notes |
|---------|-------|
| **Onboarding** | Pick a tracking focus (energy/mood/focus/sleep) and a goal; sets the framing for insights |
| **Daily check-in** | Four sliders + up to 3 tags; haptics; one entry surfaces as "today is logged" |
| **First-win moment** | Celebratory dialog after the first entry — the earliest proof of value |
| **Insight + recommendation** | Rule-based, goal-aware and trend-aware copy on Home |
| **Trends** | 7-day chart, average, direction, streak |
| **History** | Reverse-chronological log of every check-in |
| **Auth** | Supabase (magic link / OAuth) with a guest/bypass path when unconfigured |

### 4.2 Built, pending merge

Delivered on `claude/admiring-mendel-y01z7i`; not yet on `main`.

| Feature | Notes |
|---------|-------|
| **Pattern discovery** | Per-tag correlation: mean score on days tagged vs. not → "lifts you / drains you". Gated to 4+ entries |
| **Personal records** | Best score, longest streak, total check-ins, best weekday |
| **Weekly summary** | Count, average, best day, top-lift tag, delta vs. last week. Gated to 3+ entries in window |
| **CSV export** | Full history, local dates, paginated remote fetch so nothing is truncated |
| **Daily reminders** | Real notification permission + scheduled local notification + in-app nudge on miss |
| **Pilot waitlist** | Captures an email into `signal_pilot_signups` |

### 4.3 Explicitly out of scope

Social feeds, friend comparison, streak-loss shaming, clinical scoring,
diagnosis, medication tracking, and anything that turns a private log into a
performance.

## 5. Data & privacy

- **Storage:** `signal_entries` (one row per check-in) and `signal_profiles`
  (focus/goal/reminder), both owner-only under RLS keyed on `auth.uid()`, with
  `anon` privileges revoked. See migration `20260725000000_signal_core.sql`.
- **Local-first:** entries persist to local storage and sync when configured, so
  the app is fully usable offline and before sign-in.
- **Portability:** CSV export of the complete history is a first-class feature,
  not an afterthought — it is the user's data.
- **Non-negotiable:** no selling or sharing of personal check-in data; no
  third-party analytics carrying raw entry values.

## 6. Success metrics

The habit is the product, so retention beats acquisition at every stage.

| Metric | Why it matters | Target |
|--------|----------------|--------|
| **D1 / D7 / D30 retention** | The core loop is daily; D7 is the real signal | D7 ≥ 40% |
| **Time-to-first-insight** | Users must reach step 4 to understand the value | ≤ 7 days for 60% of activated users |
| **Check-ins per active week** | Density drives pattern quality | ≥ 4 |
| **Onboarding → first check-in** | The first-win moment is the activation gate | ≥ 70% |
| **Median check-in duration** | The 10-second promise | ≤ 20s |
| **Pilot signup rate** | Willingness to pay, pre-build | measurable at all (was 0 before capture existed) |

## 7. Known gaps / roadmap

Ordered by impact:

1. ~~**No database tables**~~ — fixed by `20260725000000_signal_core.sql`. Must be
   applied to the production project before launch or the app stays local-only.
2. **Reminders can't fire when the app is fully closed.** Local scheduling covers
   open/backgrounded; true delivery needs a real VAPID key and a server-side
   scheduler reading `signal_profiles.reminder_enabled` + `reminder_time`.
3. **Insights are rule-based.** Copy is hand-written heuristics. Once enough data
   exists, correlation-driven personalised recommendations are the natural step.
4. **No account deletion flow.** Export exists; self-serve delete does not.
5. **No monetisation.** The Pro pilot list is capture-only; there is no paid tier,
   pricing, or entitlement.
6. **Single-entry-per-day is assumed but not enforced.** The schema permits
   multiple; `getTodayEntry` takes the first match.

## 8. Open questions

- Does the streak mechanic help or harm? Streak loss is a known churn trigger for
  well-being apps — is a "grace day" needed?
- Is the fixed tag vocabulary (`calm/clear/tired/stressed/social/active`) rich
  enough for meaningful correlation, or do users need custom tags?
- What earns money — deeper insight, longer history, or export/integrations?
- Should the venue product be retired outright, or kept as a separate app?
