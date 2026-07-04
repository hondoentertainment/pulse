import type { ReactNode } from 'react'
import { isE2EAuthBypassEnabled, isVisualPreviewEnabled } from '@/lib/supabase'
import { USE_SUPABASE_BACKEND } from '@/lib/data'

/**
 * Blocks production boots that would silently fall back to mock fixtures.
 * E2E (`VITE_E2E_AUTH_BYPASS`) and visual preview builds are exempt.
 */
export function ProductionConfigGuard({ children }: { children: ReactNode }) {
  const isProd = import.meta.env.PROD
  const allowMock =
    isE2EAuthBypassEnabled ||
    isVisualPreviewEnabled ||
    import.meta.env.VITE_ALLOW_MOCK_BACKEND === 'true'

  if (!isProd || USE_SUPABASE_BACKEND || allowMock) {
    return <>{children}</>
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-destructive">Configuration error</p>
      <h1 className="text-2xl font-bold tracking-tight">Pulse is not configured for production</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        This deployment is missing live Supabase credentials. Set{' '}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">VITE_SUPABASE_URL</code> and{' '}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">VITE_SUPABASE_ANON_KEY</code> in
        Vercel Production, or explicitly allow mock data with{' '}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">VITE_ALLOW_MOCK_BACKEND=true</code>{' '}
        (not recommended for public launch).
      </p>
    </main>
  )
}
