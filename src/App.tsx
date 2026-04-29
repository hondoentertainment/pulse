import { lazy, Suspense } from 'react'

import { AppStateProvider, useAppState } from '@/hooks/use-app-state'
import { SupabaseAuthProvider, useSupabaseAuth } from '@/hooks/use-supabase-auth'
import type { OnboardingPreferences } from '@/components/OnboardingFlow'

const OnboardingFlow = lazy(() => import('@/components/OnboardingFlow').then(m => ({ default: m.OnboardingFlow })))
const LoginScreen = lazy(() => import('@/components/LoginScreen').then(m => ({ default: m.LoginScreen })))
const AppShell = lazy(() => import('@/components/AppShell').then(m => ({ default: m.AppShell })))

const pageFallback = (
  <main className="min-h-screen bg-background flex items-center justify-center" role="status" aria-live="polite">
    <p className="text-muted-foreground">Loading...</p>
  </main>
)

function AppContent() {
  const { hasCompletedOnboarding, setHasCompletedOnboarding } = useAppState()
  const { session, isLoading: authLoading, updateProfile } = useSupabaseAuth()

  if (authLoading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center" role="status" aria-live="polite">
        <p className="text-muted-foreground">Loading Session...</p>
      </main>
    )
  }

  if (!session) {
    return (
      <Suspense fallback={pageFallback}>
        <LoginScreen />
      </Suspense>
    )
  }

  if (hasCompletedOnboarding === false) {
    return (
      <Suspense fallback={pageFallback}>
        <OnboardingFlow
          onComplete={(prefs: OnboardingPreferences) => {
            void updateProfile({ favoriteCategories: prefs.favoriteCategories })
            setHasCompletedOnboarding(true)
          }}
        />
      </Suspense>
    )
  }

  return (
    <Suspense fallback={pageFallback}>
      <AppShell />
    </Suspense>
  )
}

function App() {
  return (
    <SupabaseAuthProvider>
      <AppStateProvider>
        <AppContent />
      </AppStateProvider>
    </SupabaseAuthProvider>
  )
}

export default App
