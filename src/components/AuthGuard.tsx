import { ReactNode } from 'react';
import { useSupabaseAuth } from '@/hooks/use-supabase-auth';

/**
 * AuthGuard — Route-level authentication and role enforcement.
 *
 * Wrap any subtree that requires a signed-in user (and, optionally, a
 * specific role) with this component.  Renders `fallback` (or a default
 * sign-in prompt) when the guard is not satisfied.
 *
 * Usage:
 *   <AuthGuard>
 *     <ProtectedPage />
 *   </AuthGuard>
 *
 *   <AuthGuard requiredRole="admin" fallback={<div>Not authorised</div>}>
 *     <AdminDashboard />
 *   </AuthGuard>
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AppRole = 'user' | 'venue_owner' | 'admin';

interface AuthGuardProps {
  children: ReactNode;
  /** When set the signed-in user must have at least this role. */
  requiredRole?: AppRole;
  /** Rendered instead of children when the guard fails. */
  fallback?: ReactNode;
}

// ---------------------------------------------------------------------------
// Role helpers
// ---------------------------------------------------------------------------

/**
 * Role precedence — higher index = higher privilege.
 * An 'admin' satisfies a requirement of 'venue_owner' or 'user'.
 */
const ROLE_ORDER: AppRole[] = ['user', 'venue_owner', 'admin'];

function hasRequiredRole(userRole: AppRole | undefined, required: AppRole): boolean {
  if (!userRole) return false;
  return ROLE_ORDER.indexOf(userRole) >= ROLE_ORDER.indexOf(required);
}

/**
 * Derive the user's application role from their Supabase profile metadata.
 *
 * The role is read from `user.user_metadata.role` (set server-side when the
 * account is created or elevated). Falls back to 'user' for all authenticated
 * accounts that have no explicit role claim.
 */
function deriveRole(
  userMetadata: Record<string, unknown> | undefined,
): AppRole | undefined {
  if (!userMetadata) return undefined;
  const raw = userMetadata['role'];
  if (raw === 'admin' || raw === 'venue_owner' || raw === 'user') return raw;
  // Any authenticated user is at minimum a 'user'
  return 'user';
}

// ---------------------------------------------------------------------------
// Default UI fragments
// ---------------------------------------------------------------------------

function SignInPrompt() {
  const { signIn } = useSupabaseAuth();
  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex flex-col items-center justify-center gap-4 p-8 text-center"
    >
      <p className="text-sm text-muted-foreground">
        You need to be signed in to view this content.
      </p>
      <button
        onClick={signIn}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Sign In
      </button>
    </div>
  );
}

function UnauthorisedMessage() {
  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex flex-col items-center justify-center gap-2 p-8 text-center"
    >
      <p className="text-sm text-destructive">
        You don&apos;t have permission to view this content.
      </p>
    </div>
  );
}

function LoadingPlaceholder() {
  return (
    <div
      aria-busy="true"
      aria-label="Checking authentication…"
      className="flex items-center justify-center p-8"
    >
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// AuthGuard component
// ---------------------------------------------------------------------------

export function AuthGuard({ children, requiredRole, fallback }: AuthGuardProps) {
  const { user, isLoading } = useSupabaseAuth();

  // While Supabase resolves the initial session, show a neutral loader to
  // avoid a flash of unauthenticated UI.
  if (isLoading) {
    return <LoadingPlaceholder />;
  }

  // Not signed in at all.
  if (!user) {
    return fallback ? <>{fallback}</> : <SignInPrompt />;
  }

  // Role check (only when the caller requests a specific role).
  if (requiredRole) {
    const userRole = deriveRole(user.user_metadata);
    if (!hasRequiredRole(userRole, requiredRole)) {
      return fallback ? <>{fallback}</> : <UnauthorisedMessage />;
    }
  }

  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// Hook: convenient access to role info
// ---------------------------------------------------------------------------

/**
 * Returns the current user's derived application role, or undefined when not
 * signed in. Useful for conditional rendering without wrapping entire trees.
 */
export function useAppRole(): AppRole | undefined {
  const { user } = useSupabaseAuth();
  if (!user) return undefined;
  return deriveRole(user.user_metadata);
}
