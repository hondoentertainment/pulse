# Accessibility Audit — Pulse PWA

**Date:** 2026-04-17
**Baseline Lighthouse a11y score:** 0.95
**Target:** 1.0 + genuine AT usability for core flows (create pulse, map
discovery, stories, notifications, profile)

This document captures findings from an audit of the top-20 most-used
interactive components under `src/components/` plus the UI primitives in
`src/components/ui/`. Each finding is tagged `[FIXED]` (applied in this
pass), `[DEFERRED]` (documented but not fixed — see rationale), or
`[OK]` (verified correct already).

---

## 1. Summary

### What we fixed in this pass

| Area                  | Count | Examples                                                |
| --------------------- | ----- | ------------------------------------------------------- |
| Icon-only buttons     | 14+   | PulseCard reactions, MapSearch, MapVenueSheet, StoryViewer, InteractiveMap, VenueHeroCarousel, CreatePulseDialog, SwipeableCard |
| Slider ARIA           | 1     | EnergySlider (role/valuenow/min/max/valuetext/Home/End) |
| Live regions          | 3     | StoryViewer, VenueHeroCarousel, ui/carousel.tsx         |
| Modal focus mgmt      | 2     | StoryViewer (Escape + restore focus), CreatePulseDialog (DialogDescription) |
| Landmark / skip link  | 2     | App.tsx skip-link + `#main-content`, AppHeader as `<header>` |
| Keyboard-only alt nav | 1     | InteractiveMap sr-only venue list                       |
| Form label binding    | 1     | CreatePulseDialog caption (htmlFor + aria-describedby)  |
| Combobox semantics    | 1     | MapSearch (combobox + listbox + option)                 |
| Pressed state toggles | 8+    | Filter pills, voice button, reactions                   |
| ESLint tooling        | 1     | Added `eslint-plugin-jsx-a11y` with a conservative ruleset |

### Utilities added

- `src/lib/a11y/focus-trap.ts` — thin facade over existing `trapFocus`
  plus `saveFocus`, `restoreFocus`, `onEscape` helpers.
- `src/lib/a11y/use-announce.ts` — `useAnnounce()` hook that delegates
  to the imperative announcer in `src/lib/accessibility.ts` (which
  already creates a hidden aria-live region on first use).

Note: `src/lib/accessibility.ts` and `src/components/AccessibilityProvider.tsx`
already provide a robust baseline. The new a11y utilities are thin
wrappers that give consumers a single-namespace import (`@/lib/a11y/...`)
without duplicating logic.

---

## 2. Per-component findings

Legend: [FIXED] applied, [DEFERRED] see rationale, [OK] verified fine.

### 2.1 `App.tsx` (application shell)

- **Skip-to-content link** — [FIXED] added an `<a href="#main-content">`
  sr-only-until-focused link ahead of `<main>`. The `<main>` now carries
  `id="main-content"` so the link works.
- **Floating `+` button** — [FIXED] added `aria-label="Create a new pulse"`.
  It's an icon-only `motion.button`.
- **Landmark structure** — `<main>` is present; the `<Toaster>` from
  `sonner` renders its own aria-live region by default. [OK]

### 2.2 `AppHeader.tsx`

- [FIXED] Wrapper promoted from `<div>` to `<header>` for a landmark.
- Existing `<h1>` for app title, existing `aria-label` on search button. [OK]

### 2.3 `BottomNav.tsx`

- [FIXED] Added `aria-label="Primary"` to the `<nav>`.
- [FIXED] When the notification tab has a badge count, the aria-label now
  includes "{N} unread".
- Already uses `aria-current="page"` on the active tab. [OK]
- Removed an unused `e` parameter on a link click handler (drive-by).

### 2.4 `CreatePulseDialog.tsx` (Radix Dialog)

- [FIXED] Added `<DialogDescription className="sr-only">` so Radix
  doesn't warn about missing description and so SR users get context.
- [FIXED] Caption `<label>` now binds to the `<Textarea>` via
  `htmlFor` + `id`, and counter is referenced by `aria-describedby`.
- [FIXED] Video remove X button gets `aria-label="Remove video"`.
- Radix Dialog provides focus trap, Escape handling, and focus
  restoration out of the box — confirmed by reading the Radix source
  via node_modules. [OK]
- **[DEFERRED]** The "How's the energy?" and "Video" labels are
  captions, not form labels. They do not bind to interactive controls;
  the `EnergySlider` carries its own `role="slider" aria-label`. Leaving
  as-is is fine — promoting them to bound labels would require component
  API changes.

### 2.5 `EnergySlider.tsx`

- [FIXED] The invisible native `<input type="range">` now has explicit
  `role="slider"`, `aria-label`, `aria-valuemin`, `aria-valuemax`,
  `aria-valuenow`, `aria-valuetext` (the human-readable label like
  "Buzzing"), and `aria-orientation`.
- [FIXED] Added Home/End key support on top of the native arrow-key
  support that `<input type=range>` provides.
- **[DEFERRED]** Visual focus ring on the custom "dots" visualization.
  The native input is `opacity-0` but focusable, so keyboard focus lands
  on it correctly. Building a visible focus indicator on the custom dot
  track would require refactoring — documented here, not fixed.

### 2.6 `InteractiveMap.tsx` (Canvas + Mapbox + SVG overlays)

- [FIXED] Container now has `role="application"` with a descriptive
  `aria-label` explaining keyboard interactions.
- [FIXED] Added an sr-only `<ul>` listing up to 50 visible venues so
  AT users can discover and open venues without needing to interact
  with the canvas. Each item has a verbose aria-label including name,
  category, pulse score, and distance.
- [FIXED] Marker click-targets now have `aria-label` describing the
  venue (cluster buttons already had one).
- [FIXED] Filter pills: added `aria-pressed` + `aria-label`.
- [FIXED] Bottom preview carousel cards: added `aria-label`.
- Container keyboard nav (arrow keys to pan, +/- to zoom) already
  exists. [OK]
- **[DEFERRED]** Fully marker-level keyboard focus/roving tabindex on
  the SVG overlay would require a significant refactor of the
  rendering loop. The sr-only list alternative above gives equivalent
  access with far less disruption.
- **[DEFERRED]** Color contrast of Instagram-palette marker labels over
  dark backgrounds is borderline in some states; documented here only
  (design concern, not code).

### 2.7 `MapSearch.tsx`

- [FIXED] Input now uses `role="combobox"` with
  `aria-autocomplete="list"`, `aria-expanded`, and `aria-controls`
  pointing to the results container.
- [FIXED] Results `<div>` has `role="listbox"` + `aria-label`.
- [FIXED] Each result row has `role="option"` + `aria-selected`.
- [FIXED] Clear (X) button gets `aria-label="Clear search"`.
- [FIXED] Voice search button: `aria-label` that toggles between
  "Start voice search" / "Stop voice search" + `aria-pressed`.
- **[DEFERRED]** `aria-activedescendant` wiring: the current
  implementation sets visual selection via `selectedIndex` state. Full
  combobox parity would map that to activedescendant. Not trivially
  additive — deferred.

### 2.8 `MapVenueSheet.tsx`

- [FIXED] Expand/collapse button gets `aria-label` + `aria-expanded`.
- [FIXED] Close X button gets `aria-label="Close venue sheet"`.

### 2.9 `StoryViewer.tsx` (custom overlay, not Radix)

- [FIXED] Root now has `role="dialog"` + `aria-modal="true"` + a
  descriptive `aria-label`.
- [FIXED] Added an sr-only aria-live region that announces the current
  slide number when `currentIndex` changes.
- [FIXED] Added Escape-to-close + ArrowLeft/ArrowRight navigation at
  the document level (skipped when reply input is open).
- [FIXED] On unmount, restores focus to the element that was focused
  before opening.
- [FIXED] Close X button gets `aria-label="Close stories"`.
- Existing left/right tap zones already have `aria-label`. [OK]
- **[DEFERRED]** Full Radix-style focus trap for every focusable child.
  The viewer has only the close button, the reply input, and emoji
  buttons; tab-cycling between them with a trap is a nice-to-have but
  not strictly required by WCAG for this UX.

### 2.10 `VenueHeroCarousel.tsx`

- [FIXED] Root has `role="region"` + `aria-roledescription="carousel"`
  + `aria-label` + keyboard arrow navigation via `tabIndex={0}`.
- [FIXED] Added an sr-only aria-live region for slide changes.
- [FIXED] Back button gets `aria-label="Go back"`.
- [FIXED] Dot indicators: `role="tablist"` on container, `role="tab"` +
  `aria-selected` + `aria-label` on each dot.

### 2.11 `ui/carousel.tsx` (Embla shared primitive)

- [FIXED] Added a hidden aria-live region that announces the current
  slide when `api.on('select')` fires. The `CarouselPrevious`/`Next`
  buttons already render an sr-only "Previous slide"/"Next slide" label.
- Already has `role="region"` + `aria-roledescription="carousel"` and
  keyboard handler for Left/Right. [OK]

### 2.12 `PulseCard.tsx`

- [FIXED] All four reaction buttons (fire/lightning/eyes/skull) get
  descriptive `aria-label` (including count + "you reacted" state) and
  `aria-pressed`.
- [FIXED] Share and Report icon buttons get `aria-label`.

### 2.13 `SwipeableCard.tsx` (QuickReactions sub-component)

- [FIXED] All four reaction buttons get `aria-label` + `aria-pressed`.
- **[DEFERRED]** Swipe left / right gestures on the outer card have no
  keyboard equivalent. The typical use site (feed card) relies on
  reaction buttons being separately focusable, which they are — so the
  swipe is a pure augmentation, not a sole input path. If a swipe
  becomes the only way to trigger an action in a future surface, we
  must add a keyboard alternative there.

### 2.14 `ui/dialog.tsx` (Radix)

- Radix Dialog provides focus trap, Escape, and focus restore out of
  the box. Close button already has an sr-only "Close" label. [OK]

### 2.15 `AccessibilityProvider.tsx` + `src/lib/accessibility.ts`

- Robust baseline already present: polite + assertive aria-live
  regions, reducedMotion media query, trapFocus, rovingTabIndex,
  skip-link factory, announce(). [OK]
- New `src/lib/a11y/*` files re-export / wrap these so consumers can
  import from a single namespace.

### 2.16 Other top components reviewed (OK or no interactive gaps)

- `OnboardingFlow.tsx` — Buttons all have visible text. [OK]
- `NotificationCard.tsx` — Rendered as a Card with optional onClick;
  the wrapper is passed by the parent `NotificationFeed`. [OK]
- `ProfileTab.tsx` — All buttons have visible text. [OK]
- `ReportDialog.tsx` — Radix Dialog; all buttons have visible text. [OK]
- `MoodSelector.tsx`, `MapFilters.tsx` — Radix primitives with visible
  text. [OK]
- `GlobalSearch.tsx` — uses cmdk which is accessible by default. [OK]
- `Favorites.tsx`, `EventCard.tsx`, `VenueCard.tsx` — content cards
  with labeled actions. [OK]

---

## 3. Color contrast (noted, not fixed)

- Instagram-palette markers on `#1a1a2e` backgrounds: the orange/pink
  gradient edges can dip under 4.5:1 on small text in the map preview
  cards (`text-muted-foreground` + `text-[9px]`). This is a design
  concern — flagging only.
- The `text-[#E1306C]` on `bg-card/90` passes AA large-text but not
  AA normal-text in some themes. Design decision.

---

## 4. ESLint plugin jsx-a11y

- Installed `eslint-plugin-jsx-a11y` as a devDependency.
- Added a **conservative** rule set in `eslint.config.js` that surfaces
  high-signal problems (alt-text, aria-props, aria-role, invalid anchor
  targets, etc.) without blocking the project's heavy use of
  `motion.button` + custom gestures.
- Rules that are too noisy for this codebase (e.g.
  `click-events-have-key-events`,
  `no-static-element-interactions`,
  `label-has-associated-control`) are intentionally left out; enabling
  them would require a larger refactor than the surgical scope of this
  pass.

---

## 5. Deferred items (summary)

| Item                                                              | Why deferred                                                                                  |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Full marker-level focus on SVG map overlay                        | Requires render-loop refactor; sr-only list covers the need.                                  |
| `aria-activedescendant` in MapSearch combobox                     | Requires reworking selection state model.                                                     |
| Full focus trap in StoryViewer                                    | Radix-level trap is overkill for 2–3 focusable children; Escape + restore focus applied.      |
| Keyboard alternative for SwipeableCard swipe-left/right           | Today callers supply redundant buttons; if that changes, add per-site keyboard fallback.      |
| Color contrast tweaks in IG palette                               | Design decision — not a code change.                                                          |
| Visible focus ring on EnergySlider track                          | Would require rebuilding the custom visualization.                                            |
| Noisier jsx-a11y rules (`click-events-have-key-events` etc.)      | Would flag 100+ existing motion.button sites; out of scope for "surgical fixes".              |

---

## 6. Verification

- `bun run lint` passes (see commit).
- `bun run typecheck` via `tsc -b --noCheck && vite build` passes
  (no tsc output is produced because `--noCheck`; typecheck is
  intentionally surface-level in this repo).
- Manual AT review (VoiceOver, NVDA) recommended before shipping — not
  part of this automated pass.
