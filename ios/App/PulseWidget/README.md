# PulseWidget — iOS Widget & Live Activity scaffolding

This folder is a **placeholder**. It contains `.template` files that describe the intended layout of the widget extension target, but is NOT compiled by Xcode until a human performs the following manual steps.

## Manual Xcode setup

1. Open `ios/App/App.xcworkspace` in Xcode.
2. **File → New → Target… → Widget Extension.**
   - Product Name: `PulseWidget`
   - Include Live Activity: **YES** (checked)
   - Bundle Identifier: `com.pulse.nightlife.PulseWidget`
   - Team: your development team
3. Drag the `.template` files from this folder into the new target's *Compile Sources* phase (rename each from `.template` → `.swift`).
4. Enable the **App Groups** capability on BOTH the main app target and the widget target. Group id: `group.com.pulse.nightlife.shared`. This must match the `Preferences.group` value in `capacitor.config.ts`.
5. On the main app target, enable the **Push Notifications** and **Background Modes → Remote notifications** capabilities (already listed in `docs/native/setup.md`).
6. Add an entry to the main app's `Info.plist`:
   - `NSSupportsLiveActivities` = `YES`
   - `NSSupportsLiveActivitiesFrequentUpdates` = `YES` (only if necessary — consumes power budget)

## File map

| File (template)                        | Becomes                         | Purpose                                   |
|----------------------------------------|----------------------------------|-------------------------------------------|
| `PulseWidgetBundle.swift.template`     | `PulseWidgetBundle.swift`       | Entry point, lists widgets + activities   |
| `PulseWidget.swift.template`           | `PulseWidget.swift`             | "Tonight's trending" home-screen widget   |
| `PulseLiveActivity.swift.template`     | `PulseLiveActivity.swift`       | Safety-session Live Activity              |
| `Info.plist.template`                  | `Info.plist`                    | Widget extension metadata                 |

## Shared data contract

The React app writes JSON to `UserDefaults(suiteName: "group.com.pulse.nightlife.shared")` via `@capacitor/preferences`. Keys:

- `widget:trending` → `{ neighborhood: string, venues: Array<{ name: string, score: number }> }`
- `liveactivity:safety` → `{ sessionId: string, elapsedSeconds: number, crewCount: number, lastPing: string }`

Keep these schemas in sync with `src/lib/platform/types.ts` when widget bridging ships.
