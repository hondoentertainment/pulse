# Accessibility Audit

This document tracks the accessibility posture of Pulse across surfaces that
matter for users who rely on assistive technology or who have sensory /
mobility needs.

## Inventory of accessible surfaces

| Surface | Axe-audited | Keyboard nav | Screen reader | Notes |
| --- | --- | --- | --- | --- |
| `AccessibilityProvider` | Yes | n/a | n/a | Applies reduced-motion + high-contrast preferences globally. |
| `BottomNav` | Yes | Yes | Yes | `aria-label` on each tab, `aria-current="page"` on the active tab. |
| `MapFilters` | Yes | Yes | Yes | See Accessibility filter section below. |
| `VenueCard` | Partial | Yes | Yes | New dress-code / cover / wait-time badges expose `aria-label`s. |
| `VenuePage` | Partial | Yes | Yes | Details section lists accessibility features as a visible chip row. |
| `PulseCard` | Yes | Yes | Yes | Reactions expose `aria-pressed`. |

## Accessibility filter (differentiator pack, 2026-04-17)

Location: `src/components/filters/AccessibilityFilter.tsx`, integrated into
`src/components/MapFilters.tsx` as a collapsible "Accessibility" section.

### Features filterable

The filter surfaces the following structured tokens (mirrors the
`venues.accessibility_features` column and the `AccessibilityFeature` union
in `src/lib/types.ts`):

- `wheelchair_accessible` — Wheelchair accessible
- `step_free_entry` — Step-free entry
- `accessible_restroom` — Accessible restroom
- `gender_neutral_restroom` — Gender-neutral restroom
- `sensory_friendly` — Sensory-friendly
- `quiet_hours` — Quiet hours
- `service_animal_friendly` — Service-animal friendly
- `signer_on_request` — Signer on request
- `braille_menu` — Braille menu

### Interaction & semantics

- Root element is `role="group"` with `aria-label="Filter venues by
  accessibility features"`.
- Each chip is a `<button role="switch">` with `aria-pressed` toggled to
  reflect selection and `aria-label` set to the human-readable feature name.
- Space and Enter toggle selection while focused.
- A visible `focus-visible:ring-2 focus-visible:ring-[#E1306C]` outline is
  applied; the chips never rely on colour alone to indicate state (the
  toggled state is additionally distinguished by a gradient fill).
- Emoji glyphs adjacent to each label are wrapped in `aria-hidden="true"` so
  screen readers announce only the canonical label.

### Persistence

Selections are mirrored to `sessionStorage` under the key
`pulse.filters.accessibility` so navigating between surfaces in the same tab
preserves the current filter. No cross-session or cross-device persistence.

### Filtering logic

A venue passes the accessibility filter when the user-selected set is a
subset of `venue.accessibilityFeatures`. Empty selection always passes.
Helper: `venuePassesAccessibilityFilter()` in `AccessibilityFilter.tsx`.

### Feature flag

`VITE_ACCESSIBILITY_FILTER_ENABLED` (default on). When `off`, the
collapsible section is hidden entirely; filter logic defaults to "no
selection".

## Outstanding work

- Audit the new Details section in `VenuePage.tsx` for contrast on light
  themes.
- Add a live-region toast when a filter selection excludes every loaded
  venue so screen-reader users are informed rather than landing on an empty
  list without context.
- Wire an admin UI for editing `accessibility_features` on a venue (see
  `docs/differentiators.md` follow-up tickets).
