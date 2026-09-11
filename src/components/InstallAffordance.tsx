import { useEffect, useState } from 'react'
import {
  INSTALL_AFFORDANCE_COPY,
  dismissInstallAffordance,
  isInstallAffordanceDismissed,
  shouldShowInstallAffordance,
} from '@/lib/install-affordance'
import { getInstallState, listenForInstallPrompt, showInstallPrompt } from '@/lib/pwa'

export function InstallAffordance() {
  const [visible, setVisible] = useState(false)
  const [ios, setIos] = useState(false)

  useEffect(() => {
    const dismissed = isInstallAffordanceDismissed()
    const refresh = () => {
      const state = getInstallState()
      setIos(state.platform === 'ios')
      setVisible(shouldShowInstallAffordance({ ...state, dismissed }))
    }
    refresh()
    return listenForInstallPrompt(refresh)
  }, [])

  if (!visible) return null

  return (
    <section className="rounded-[18px] bg-[#17171C] p-3.5" aria-label="Install Pulse">
      <h2 className="text-sm font-semibold text-white">{INSTALL_AFFORDANCE_COPY.headline}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{INSTALL_AFFORDANCE_COPY.body}</p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="h-10 flex-1 rounded-2xl bg-primary text-sm font-semibold text-primary-foreground"
          onClick={() => {
            void showInstallPrompt()
            dismissInstallAffordance()
            setVisible(false)
          }}
        >
          {ios ? INSTALL_AFFORDANCE_COPY.iosHint : INSTALL_AFFORDANCE_COPY.cta}
        </button>
        <button
          type="button"
          className="h-10 rounded-2xl bg-[#1F1F24] px-3 text-sm font-semibold text-white"
          onClick={() => {
            dismissInstallAffordance()
            setVisible(false)
          }}
        >
          Not now
        </button>
      </div>
    </section>
  )
}
