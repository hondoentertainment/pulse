/**
 * use-native-chrome — configure native status bar + dismiss splash screen.
 *
 * Web is a no-op. On native, sets the status bar style to match Pulse's
 * dark theme and hides the splash once React has rendered.
 */
import { useEffect } from 'react'
import { isNative, loadNativeModule } from '@/lib/platform'

interface StatusBarModule {
  StatusBar: {
    setStyle: (opts: { style: string }) => Promise<void>
    setBackgroundColor?: (opts: { color: string }) => Promise<void>
  }
  Style: { Dark: string; Light: string; Default: string }
}

interface SplashModule {
  SplashScreen: {
    hide: (opts?: { fadeOutDuration?: number }) => Promise<void>
  }
}

export function useNativeChrome(): void {
  useEffect(() => {
    if (!isNative()) return
    let cancelled = false

    ;(async () => {
      try {
        const sbMod = await loadNativeModule<StatusBarModule>('@capacitor/status-bar').catch(() => null)
        if (!cancelled && sbMod) {
          try {
            await sbMod.StatusBar.setStyle({ style: sbMod.Style.Dark })
            await sbMod.StatusBar.setBackgroundColor?.({ color: '#0B0B10' })
          } catch {
            /* some platforms (iOS) ignore backgroundColor */
          }
        }

        const splashMod = await loadNativeModule<SplashModule>('@capacitor/splash-screen').catch(() => null)
        if (!cancelled && splashMod) {
          try {
            await splashMod.SplashScreen.hide({ fadeOutDuration: 200 })
          } catch {
            /* no-op */
          }
        }
      } catch (err) {
        console.warn('[native-chrome] setup failed', err)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])
}
