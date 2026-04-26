/**
 * Capacitor Configuration — Pulse native wrappers
 *
 * Canonical config for the iOS + Android Capacitor shells.
 * Web bundle does NOT import this file — it is only consumed by the Capacitor CLI.
 *
 * To customize for a different org / bundle ID:
 *   1. Change `appId` to your reverse-DNS identifier (e.g. com.yourco.pulse)
 *   2. Change `appName` to match your storefront listing
 *   3. Update `server.hostname` + `ios.associatedDomains` for Universal Links
 *   4. Re-run `bun run cap:sync` to propagate changes to native projects
 */
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.pulse.nightlife',
  appName: 'Pulse',
  webDir: 'dist',
  bundledWebRuntime: false,

  // Dev server — when live-reloading from `bun run dev`, set CAPACITOR_LIVE_RELOAD_URL
  server: {
    // Production: served from the bundled webDir. The `androidScheme` keeps
    // cookies/session storage compatible with HTTPS-only APIs.
    androidScheme: 'https',
    iosScheme: 'pulse',
    // When developing against a live server, override via env:
    //   CAPACITOR_LIVE_RELOAD_URL=http://192.168.0.10:5000 bun run cap:sync
    url: process.env.CAPACITOR_LIVE_RELOAD_URL || undefined,
    cleartext: !!process.env.CAPACITOR_LIVE_RELOAD_URL,
    // Universal link domain — replace with the actual production domain.
    // The domain must host /.well-known/apple-app-site-association for iOS
    // and an assetlinks.json for Android App Links.
    hostname: 'app.pulse.nightlife',
  },

  android: {
    // minSdk must be >= 22 for Capacitor 6
    minWebViewVersion: 60,
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: process.env.NODE_ENV !== 'production',
    backgroundColor: '#0B0B10',
  },

  ios: {
    // Universal Links (CFBundleURLSchemes) — must match Associated Domains entitlement:
    //   applinks:app.pulse.nightlife
    //   applinks:pulse.nightlife
    scheme: 'Pulse',
    contentInset: 'always',
    limitsNavigationsToAppBoundDomains: false,
    backgroundColor: '#0B0B10',
    // PushNotifications + BackgroundModes handled via Info.plist (see docs/native/setup.md)
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: false, // we hide manually in use-native-chrome
      backgroundColor: '#0B0B10',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0B0B10',
      overlaysWebView: false,
    },
    PushNotifications: {
      // iOS: supports 'alert' | 'badge' | 'sound'. Provisional auth granted
      // separately at request-time via Platform.push.register().
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_pulse',
      iconColor: '#A855F7',
      sound: 'pulse_chime.wav',
    },
    Geolocation: {
      // Background location requires UIBackgroundModes=location on iOS
      // and ACCESS_BACKGROUND_LOCATION on Android. See docs/native/setup.md.
    },
    Camera: {
      // Photo library + camera usage descriptions live in Info.plist / Manifest.
    },
    BarcodeScanner: {
      // Used for venue check-in QR codes. Ships via @capacitor-community/barcode-scanner
      // which is added in docs/native/setup.md (optional plugin).
    },
    App: {
      // Deep links: `pulse://...` scheme + Universal Links domain above.
      // Handled at runtime by src/hooks/use-deep-links.ts
    },
    Preferences: {
      group: 'com.pulse.nightlife.shared', // for App Group / widget data sharing
    },
  },

  // Custom URL scheme for deep links: pulse://<path>
  // e.g. pulse://venue/abc123, pulse://pulse/xyz789
  // Universal Links (https://app.pulse.nightlife/*) handled via Associated Domains.
}

export default config
