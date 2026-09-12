import { useEffect, useState } from 'react'
import {
  INSTALL_AFFORDANCE_COPY,
  dismissInstallAffordance,
  installAffordancePath,
  isInstallAffordanceDismissed,
  shouldShowInstallAffordance,
} from '@/lib/install-affordance'
import { getInstallState, listenForInstallPrompt, showInstallPrompt } from '@/lib/pwa'
import { offerPushNotifyAfter } from '@/lib/push-notify-affordance'

interface InstallAffordanceProps {
  onInstalled?: () => void
}

export function InstallAffordance({ onInstalled }: InstallAffordanceProps = {}) {
  const [visible, setVisible] = useState(false)
  const [path, setPath] = useState<'prompt' | 'ios' | 'menu'>('menu')

  useEffect(() => {
    const dismissed = isInstallAffordanceDismissed()
    const refresh = () => {
      const state = getInstallState()
      setPath(installAffordancePath(state))
      setVisible(shouldShowInstallAffordance({ ...state, dismissed }))
    }
    refresh()
    return listenForInstallPrompt(refresh)
  }, [])

  if (!visible) return null

  const hide = () => {
    dismissInstallAffordance()
    setVisible(false)
  }

  const hint = path === 'ios'
    ? INSTALL_AFFORDANCE_COPY.iosHint
    : path === 'menu'
      ? INSTALL_AFFORDANCE_COPY.menuHint
      : INSTALL_AFFORDANCE_COPY.body

  return (
    <section className="rounded-xl border border-border bg-card p-3.5" aria-label="Install Pulse">
      <h2 className="text-sm font-semibold text-foreground">{INSTALL_AFFORDANCE_COPY.headline}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      <div className="mt-3 flex gap-2">
        {path === 'prompt' && (
          <button
            type="button"
            className="h-10 flex-1 rounded-full bg-primary text-sm font-semibold text-primary-foreground"
            onClick={() => {
              void showInstallPrompt()
              offerPushNotifyAfter('install')
              onInstalled?.()
              hide()
            }}
          >
            {INSTALL_AFFORDANCE_COPY.cta}
          </button>
        )}
        <button
          type="button"
          className="h-10 rounded-full bg-muted px-3 text-sm font-semibold text-foreground"
          onClick={hide}
        >
          Not now
        </button>
      </div>
    </section>
  )
}
