# Native Release Checklist

Walk this list before tagging `native-*` and kicking off a store submission.

## Version + metadata
- [ ] Bump version in `package.json`
- [ ] Bump `CFBundleShortVersionString` in `ios/App/App/Info.plist`
- [ ] Bump `versionName` + `versionCode` in `android/app/build.gradle`
- [ ] Update changelog + release notes (store-facing)

## Web bundle
- [ ] `bun run build` — no new warnings, no new chunks beyond baseline
- [ ] `bun run test` — unit tests pass
- [ ] `bun run lint` — lint clean
- [ ] Sanity-check that no `@capacitor/*` package shows up in `dist/` by inspecting the build report

## Native projects
- [ ] `bun run cap:sync` succeeds cleanly
- [ ] iOS: open in Xcode, verify signing team is correct
- [ ] iOS: verify capabilities (Push, Background Modes, Associated Domains, App Groups) are checked
- [ ] Android: verify `google-services.json` is present and points at the correct Firebase project
- [ ] Android: `gradle signingReport` matches the SHA-256 in `assetlinks.json`

## Push
- [ ] APNs auth key valid, not expired (keys last 10 years — still confirm)
- [ ] FCM project has the correct package name allow-listed
- [ ] `push_tokens` table migrated in prod Supabase
- [ ] Smoke test: log in on a test device, confirm a row is written to `push_tokens`
- [ ] Smoke test: send a test push via `sendPushToUser()` from a serverless shell

## Deep links
- [ ] `https://app.pulse.nightlife/.well-known/apple-app-site-association` returns 200, `application/json`
- [ ] `https://app.pulse.nightlife/.well-known/assetlinks.json` returns 200
- [ ] Open `pulse://venue/123` on a test device — deep link hook routes to the venue page
- [ ] Open `https://app.pulse.nightlife/venue/123` on a test device — Universal Link opens the app (iOS) or App Link opens the app (Android)

## Background location + safety
- [ ] Safety session keeps firing location updates with the app backgrounded for ≥ 15 minutes
- [ ] Android foreground-service notification visible while background location active
- [ ] Location permission rationale screen shown before invoking `always` permission

## Live Activities (once enabled)
- [ ] Starting a safety session pins a Live Activity to the lock screen
- [ ] Activity updates when pulse score changes at the venue
- [ ] Ending the session removes the activity within 5 s

## Store-listing assets
- [ ] iOS screenshots: 6.7", 6.1", 5.5" (3 each)
- [ ] Android screenshots: phone + tablet sets
- [ ] Privacy policy URL live
- [ ] Data-safety form submitted (Play Store)
- [ ] Privacy nutrition label submitted (App Store Connect)

## Final gates
- [ ] TestFlight build to internal testers → passes smoke
- [ ] Play Internal Test track → passes smoke
- [ ] Rollback plan: previous build archived, known-good tag noted in runbook
- [ ] On-call knows the release window
