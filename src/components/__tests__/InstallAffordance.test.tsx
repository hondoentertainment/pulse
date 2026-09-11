// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { InstallAffordance } from '@/components/InstallAffordance'
import { INSTALL_DISMISS_STORAGE_KEY } from '@/lib/install-affordance'

vi.mock('@/lib/pwa', () => ({
  getInstallState: () => ({
    canInstall: false,
    isInstalled: false,
    platform: 'desktop' as const,
  }),
  listenForInstallPrompt: () => () => undefined,
  showInstallPrompt: vi.fn(),
}))

describe('InstallAffordance', () => {
  it('shows a non-blocking install path on desktop without beforeinstallprompt', () => {
    window.localStorage.removeItem(INSTALL_DISMISS_STORAGE_KEY)
    render(<InstallAffordance />)
    expect(screen.getByRole('region', { name: 'Install Pulse' })).toBeInTheDocument()
    expect(screen.getByText(/browser menu/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Not now' })).toBeInTheDocument()
  })
})
