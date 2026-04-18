# Native Apps — Setup Guide

This guide takes Pulse from scaffold to a signed iOS / Android build.

## 0. Prerequisites
- macOS (for iOS builds). Xcode ≥ 15, Command Line Tools installed.
- Android Studio Hedgehog or newer, Android SDK 34, JDK 17.
- Bun 1.1+ (or npm — scripts alias `cap` via `bunx` / `npx`).

## 1. Install Capacitor dev deps
The deps are already declared in `package.json` as devDependencies. After pulling:

```bash
bun install
```

No runtime deps are added to the web bundle — Capacitor lives behind dynamic imports in `src/lib/platform/`.

## 2. Add native projects (one-time, do NOT commit blindly)
Capacitor materializes full native projects under `ios/` and `android/`. We intentionally do not check those in with the initial scaffold PR — they contain Xcode signing settings that should be reviewed on a per-team basis.

```bash
# From repo root
bun run build      # fills dist/ so cap can seed the WebView
bunx cap add ios
bunx cap add android
bunx cap sync
```

Commit the generated `ios/` and `android/` folders in a follow-up PR once the defaults have been reviewed.

## 3. Customize app identity
- Bundle id: edit `capacitor.config.ts` → `appId`. Default `com.pulse.nightlife`.
- Display name: `appName`. Default `Pulse`.
- Re-run `bunx cap sync` after any config change.

## 4. iOS-specific setup
1. Open the project: `bun run cap:open:ios` (runs `cap open ios`).
2. In Xcode, select a Team for signing under *Signing & Capabilities*.
3. Enable capabilities:
   - **Push Notifications** (adds APNs entitlement)
   - **Background Modes** → *Location updates*, *Remote notifications*, *Background fetch*
   - **Associated Domains** → `applinks:app.pulse.nightlife`
   - **App Groups** → `group.com.pulse.nightlife.shared` (for widget/Live Activity data sharing)
4. Add usage strings to `ios/App/App/Info.plist`:
   - `NSLocationWhenInUseUsageDescription`
   - `NSLocationAlwaysAndWhenInUseUsageDescription`
   - `NSCameraUsageDescription`
   - `NSPhotoLibraryUsageDescription`
   - `NSUserNotificationUsageDescription`
5. For the widget + Live Activity targets, see `docs/native/live-activities.md` and the scaffolding under `ios/App/PulseWidget/`.

## 5. Android-specific setup
1. Open: `bun run cap:open:android`.
2. Edit `android/app/src/main/AndroidManifest.xml`:
   - Add permissions: `ACCESS_FINE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`, `CAMERA`, `POST_NOTIFICATIONS`, `FOREGROUND_SERVICE_LOCATION`.
   - Add intent filter for `pulse://` scheme and `https://app.pulse.nightlife` App Links.
3. Place the Firebase `google-services.json` in `android/app/` (NEVER commit — ignored by default).
4. Configure `build.gradle` for signing. Key store in `~/.gradle/pulse-release.keystore` (path — never commit).
5. Widget provider template lives at `android/app/src/main/java/com/pulse/nightlife/widget/PulseWidgetProvider.kt.template`. Rename to `.kt` and register in manifest when ready.

## 6. Universal Links / App Links
Host these files on `app.pulse.nightlife`:
- `/.well-known/apple-app-site-association` — iOS (no extension; `application/json` content-type). Include the team id + bundle id.
- `/.well-known/assetlinks.json` — Android. Include the SHA-256 of your release signing cert.

Example `apple-app-site-association`:
```json
{
  "applinks": {
    "details": [{ "appIDs": ["TEAMID.com.pulse.nightlife"], "components": [{ "/": "/venue/*" }, { "/": "/pulse/*" }, { "/": "/crew/*" }, { "/": "/event/*" }] }]
  }
}
```

## 7. Push provider config
### FCM (Android)
1. Create Firebase project → add Android app with bundle `com.pulse.nightlife`.
2. Download `google-services.json` → `android/app/`.
3. Copy the **Server Key** (legacy) or set up an OAuth2 service account for HTTP v1. Store as `FCM_SERVER_KEY` in your server env.

### APNs (iOS)
1. In Apple Developer → Keys → create a new Auth Key with APNs enabled.
2. Download the `.p8` file. Place it on your server (or secret store) and point `APNS_KEY_FILE` to it.
3. Record the Key ID as `APNS_KEY_ID` and your Team ID as `APNS_TEAM_ID`.
4. Bundle id: set `APNS_BUNDLE_ID=com.pulse.nightlife`.
5. Use `APNS_HOST=api.sandbox.push.apple.com` for dev, `api.push.apple.com` for prod.

## 8. Env var reference
See `.env.example` (updated) for placeholders. Server-only (NEVER expose to the web bundle):

| Variable                | Purpose                                    |
|-------------------------|--------------------------------------------|
| `SUPABASE_URL`          | Server-side data access                    |
| `SUPABASE_SERVICE_ROLE` | Service-role key for push token lookups    |
| `FCM_SERVER_KEY`        | FCM send key (Android)                     |
| `FCM_PROJECT_ID`        | Firebase project id (HTTP v1 migration)    |
| `APNS_KEY_ID`           | Apple push key id                          |
| `APNS_TEAM_ID`          | Apple developer team id                    |
| `APNS_KEY_FILE`         | Path to `.p8` file                         |
| `APNS_BUNDLE_ID`        | Overrides default `com.pulse.nightlife`    |
| `APNS_HOST`             | `api.push.apple.com` or sandbox variant    |

## 9. Release via fastlane (follow-up)
Not yet wired. Planned integration:
- iOS: [fastlane match](https://docs.fastlane.tools/actions/match/) for certs, `deliver` for App Store Connect submissions, `gym` for builds.
- Android: `supply` for Play Store, `gradle` + `signing.properties` for release builds.

Track the work in the follow-up "native-release-automation" epic.

## 10. Useful scripts
```bash
bun run cap:build       # vite build + cap sync
bun run cap:ios         # open + run on iOS simulator
bun run cap:android     # open + run on Android emulator
bun run cap:open:ios    # open Xcode workspace
bun run cap:open:android # open Android Studio project
bun run cap:sync        # sync web assets + plugins into native projects
```
