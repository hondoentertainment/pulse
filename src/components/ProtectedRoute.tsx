import { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useSupabaseAuth } from '@/hooks/use-supabase-auth'
import { CircleNotch } from '@phosphor-icons/react'

interface ProtectedRouteProps {
  /** The content to render when the user is authenticated */
  children: ReactNode
  /** Where to redirect unauthenticated users (defaults to "/auth") */
  redirectTo?: string
  /** Optional fallback while auth state is loading */
  loadingFallback?: ReactNode
}

/**
 * Route guard component that checks authentication state.
 *
 * Wraps any route content and redirects unauthenticated users to a sign-in page.
 * In placeholder/demo mode (no Supabase credentials), it renders children
 * directly to allow development without a backend.
 *
 * Usage:
 * ```tsx
 * <Route path="/profile" element={
 *   <ProtectedRoute>
 *     <ProfilePage />
 *   </ProtectedRoute>
 * } />
 * ```
 */
export function ProtectedRoute({
  children,
  redirectTo = '/auth',
  loadingFallback,
}: ProtectedRouteProps) {
  const { user, isLoading, isPlaceholder } = useSupabaseAuth()
  const location = useLocation()

  // In placeholder/demo mode, skip auth checks so the app is usable
  // during development without a Supabase backend.
  if (isPlaceholder) {
    return <>{children}</>
  }

  // Show a loading state while the auth session is being resolved
  if (isLoading) {
    return (
      <>
        {loadingFallback ?? (
          <div className="min-h-screen flex items-center justify-center bg-background">
            <CircleNotch
              size={32}
              weight="bold"
              className="text-primary animate-spin"
            />
          </div>
        )}
      </>
    )
  }

  // Redirect unauthenticated users, preserving the intended destination
  if (!user) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />
  }

  return <>{children}</>
}
