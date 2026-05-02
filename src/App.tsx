import { lazy, Suspense } from 'react'

import { SupabaseAuthProvider, useSupabaseAuth } from '@/hooks/use-supabase-auth'
import { Lightning } from '@phosphor-icons/react'

const LoginScreen = lazy(() => import('@/components/LoginScreen').then((m) => ({ default: m.LoginScreen })))
const SignalApp = lazy(() => import('@/components/signal/SignalApp').then((m) => ({ default: m.SignalApp })))

function AppLoadingFallback({ label }: { label: string }) {
  return (
    <main
      className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-6 text-foreground [background-image:radial-gradient(circle_at_20%_0%,color-mix(in_oklch,var(--primary)_18%,transparent),transparent_28rem),radial-gradient(circle_at_85%_15%,color-mix(in_oklch,var(--accent)_14%,transparent),transparent_24rem)]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary animate-pulse">
          <Lightning size={28} weight="fill" aria-hidden />
        </div>
        <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      </div>
      <div className="flex w-full max-w-[200px] flex-col gap-2" aria-hidden>
        <div className="h-2.5 w-full rounded-full bg-muted animate-pulse" />
        <div className="h-2.5 w-[80%] rounded-full bg-muted/70 animate-pulse" />
      </div>
    </main>
  )
}

const pageFallback = <AppLoadingFallback label="Loading Pulse…" />

function AppContent() {
  const { session, isLoading: authLoading } = useSupabaseAuth()

  if (authLoading) {
    return <AppLoadingFallback label="Restoring session…" />
  }

  if (!session) {
    return (
      <Suspense fallback={pageFallback}>
        <LoginScreen />
      </Suspense>
    )
  }

  return (
    <Suspense fallback={pageFallback}>
      <SignalApp />
    </Suspense>
  )
}

function App() {
  return (
    <SupabaseAuthProvider>
      <AppContent />
    </SupabaseAuthProvider>
  )
}

export default App
