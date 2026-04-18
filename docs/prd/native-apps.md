# Native Apps PRD — iOS + Android

Status: scaffold — shipping surface complete at config/abstraction layer. Native binary builds require Xcode / Android Studio.
Owners: Platform team. Last updated: 2026-04-18.

## Problem
The Pulse PWA covers ~80% of the product surface, but nightlife users expect a real app: Lock-screen push, background location fidelity for safety sessions, native camera capture for pulses, Live Activities for tonight's plan, share extensions, and deep-linked invites from DMs. We ship native wrappers around the existing React PWA via Capacitor so we reuse the same product code on all surfaces.

## User stories
- As a Pulse user I install Pulse from the App Store / Play Store, sign in, and receive an immediate push when a friend checks into a trending venue near me.
- As a safety-session member my location stays accurate in the background for up to 6 hours without the app being foregrounded, and my crew sees a Live Activity ticking on the lock screen.
- As a pulse-creator I can snap a photo with the native camera and post in <3s, with optimistic UI and background sync on poor connections.
- As a promoter I send a share link that opens the right venue/event directly in the app (or in the browser if not installed), without a router hop.
- As a power user I can add Pulse to my Home Screen widget for "what's trending in 1 mi right now."

## Platform feature matrix
| Feature              | iOS                                   | Android                                   | Web PWA            |
|----------------------|---------------------------------------|-------------------------------------------|--------------------|
| Push notifications   | APNs via @capacitor/push-notifications | FCM via @capacitor/push-notifications    | Web Push (later)   |
| Background location  | UIBackgroundModes=location (P1)       | ACCESS_BACKGROUND_LOCATION + foreground service (P1) | Foreground only    |
| Native camera        | @capacitor/camera                     | @capacitor/camera                         | `<input capture>`  |
| QR / barcode scanner | @capacitor-community/barcode-scanner  | @capacitor-community/barcode-scanner      | getUserMedia (P2)  |
| Share extension      | Custom UIActivity extension (P2)      | ACTION_SEND intent handler (P2)           | Web Share API      |
| Home-screen widgets  | WidgetKit + SwiftUI (P1)              | AppWidgetProvider + Glance (P1)           | Not applicable     |
| Live Activities      | ActivityKit (P1)                      | Ongoing Notification (P1)                 | Not applicable     |
| Deep links           | `pulse://` + Universal Links          | `pulse://` + App Links                    | Route parsing      |
| App Clip / Instant   | App Clip (P2)                         | Instant App (P2)                          | PWA                |
| Handoff              | NSUserActivity (P2)                   | n/a                                       | n/a                |
| Haptics              | @capacitor/haptics                    | @capacitor/haptics                        | navigator.vibrate  |

## Release plan
- **M0 (this PR):** Capacitor config, platform abstraction, push registration, deep-link handler, safe-area CSS. No native binary.
- **M1:** `npx cap add ios && npx cap add android`. Commit native projects behind a separate PR after review of Xcode / Gradle changes. Connect to TestFlight + Play Internal Testing.
- **M2:** Live Activity (SwiftUI) for active safety session; Android equivalent ongoing-notification. Ship WidgetKit "tonight's trending."
- **M3:** Share extensions, App Clip / Instant App, Handoff.

## Store listing requirements
- **App Store (iOS):** Developer account, App Store Connect listing, 6.7" + 5.5" screenshots, privacy nutrition labels (location: precise + background; identifiers: push token; usage data: analytics), age rating 17+ (social + location), export compliance declaration.
- **Play Store (Android):** Signing key, content rating (IARC), data-safety disclosure (location always + coarse/fine, device identifiers), target API 34+, 2 feature graphic sets, 5 screenshots minimum.
- Usage strings (iOS `Info.plist`): `NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription`, `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSMicrophoneUsageDescription` (if voice filter), `NSUserNotificationUsageDescription`.

## Size budget
- Initial download: iOS ≤ 40 MB, Android ≤ 30 MB (after split APKs / ABI). The WebView payload reuses the bundled `dist/` and caps the web bundle impact at current levels — see [web-bundle-impact](#web-bundle-impact) below.
- OTA updates: can leverage Capacitor Live Updates (Appflow) for non-native patches once enabled.

## Web bundle impact
- Zero static runtime imports of `@capacitor/*` in any file the web bundle reaches. The platform facade (`src/lib/platform/platform.ts`) uses dynamic `import()` with string expressions so Rollup never treats them as hard deps.
- All plugins are declared as **devDependencies** only. `vite build` does not resolve them at all on the web target.
- Verify with `bun run build` — comparing chunk hashes before/after should show no new web-bundle entries.

## Privacy & compliance
- Push token stored server-side (`push_tokens` table, owner-only RLS). No third-party analytics fingerprints the token.
- Background location is opt-in at safety-session start; we surface a plain-language disclosure modal before invoking the always-permission.
- Universal Link domain hosts `/.well-known/apple-app-site-association` + `/.well-known/assetlinks.json`; both files are rate-limited + cacheable for 24 h.

## Risks / open questions
- iOS Live Activities require ActivityKit entitlements and a separate widget extension target — not auto-generated by Capacitor.
- Background location on Android requires Google Play declaration + foreground service notification — see `docs/native/setup.md`.
- APNs ES256 signing is a P0 follow-up (see `api/_lib/push.ts`).
