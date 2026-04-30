# Live Activities & Widgets — Scaffolding Plan

Pulse has two native surfaces that extend beyond the in-app experience:

1. **Live Activities** (iOS) / **Ongoing Notifications** (Android) — show active state like "tonight's plan" and "safety session heartbeat" on the lock screen.
2. **Home-screen Widgets** — surface "what's trending in 1 mi" without opening the app.

Capacitor does not auto-generate either of these. We lay out the directory + pseudo-code but leave Swift/Kotlin compilation to follow-up PRs that will go through full native review.

## iOS — Live Activity & Widget (`ios/App/PulseWidget/`)

### Files in this scaffold
- `PulseWidget.swift.template` — SwiftUI widget skeleton for "tonight's trending"
- `PulseLiveActivity.swift.template` — ActivityKit activity for an active safety session
- `PulseWidgetBundle.swift.template` — widget bundle entry point
- `Info.plist.template` — widget extension metadata
- `README.md` — manual Xcode steps to turn these into a real target

### Data flow
1. React app writes the current session payload to the shared App Group (`group.com.pulse.nightlife.shared`) via `@capacitor/preferences` (configured in `capacitor.config.ts`).
2. Swift widget reads from `UserDefaults(suiteName: "group.com.pulse.nightlife.shared")`.
3. Live Activity is started / updated / ended via ActivityKit APIs invoked from a Capacitor plugin (TBD in follow-up epic).

### Manual Xcode steps
Documented in `ios/App/PulseWidget/README.md` inside the scaffolding dir. The high-level steps:
1. In Xcode → File → New → Target → Widget Extension. Name `PulseWidget`. Include Live Activity.
2. Set the App Group capability for both the main app and the widget extension.
3. Copy/rename the `.template` files into the new target's sources.
4. Wire `ActivityAttributes` to a matching TypeScript type that the client serializes.

## Android — Widget (`android/app/src/main/java/com/pulse/nightlife/widget/`)

### Files
- `PulseWidgetProvider.kt.template` — `AppWidgetProvider` skeleton
- `pulse_widget_info.xml.template` — widget metadata
- `widget_layout.xml.template` — initial layout
- `README.md` — manual wiring steps

### Data flow (Android)
1. React writes widget payload to `@capacitor/preferences` (backed by `SharedPreferences`).
2. `PulseWidgetProvider.onUpdate()` reads those prefs and renders the compact layout.
3. For live session updates, a foreground service posts an `Ongoing` notification with up-to-date heartbeat.

## Placeholder strings
Every `.template` file contains `// TODO(widget):` markers where copy / bindings need to be added. The text used in the scaffolding:
- "Tonight's trending in {neighborhood}"
- "{venueName} — {pulseScore}"
- "Safety session: {elapsed} · {crewMemberCount} crew"

## Follow-ups (not in this PR)
- [ ] Compile-time wiring: turn `.template` into real `.swift` / `.kt` files as separate PRs
- [ ] Capacitor plugin bridging for ActivityKit start / update / end
- [ ] Image assets for widget family sizes (`systemSmall`, `systemMedium`, `accessoryRectangular`)
- [ ] Android Glance migration for API 31+ widgets
