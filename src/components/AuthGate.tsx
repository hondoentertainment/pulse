import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSupabaseAuth } from '@/hooks/use-supabase-auth'
import { track } from '@/lib/observability/analytics'
import { WRITE_AUTH_COPY } from '@/lib/guest-discovery'
import { Lightning, Envelope, CircleNotch, WarningCircle } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { UX_CTA, UX_HAIRLINE } from '@/lib/ux-chrome'

export function AuthGate() {
  const { signInWithOAuth, signInWithOtp, authError, isLoading } = useSupabaseAuth()

  const [email, setEmail] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [localLoading, setLocalLoading] = useState(false)

  const busy = isLoading || localLoading

  useEffect(() => {
    track('funnel_step', { step: 'auth', guest: true })
    track('auth_started', { method: 'redirect' })
  }, [])

  const handleGoogle = async () => {
    setLocalLoading(true)
    track('auth_started', { method: 'google' })
    try {
      await signInWithOAuth('google')
    } finally {
      setLocalLoading(false)
    }
  }

  const handleMagicLink = async () => {
    if (!email.trim()) return
    setLocalLoading(true)
    try {
      await signInWithOtp(email.trim())
      setOtpSent(true)
    } catch {
      setOtpSent(false)
    } finally {
      setLocalLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background px-4 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] pt-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center space-y-6"
      >
        <div
          role="status"
          className={`flex gap-3 rounded-2xl ${UX_HAIRLINE} border bg-destructive/10 px-4 py-3`}
        >
          <WarningCircle size={20} weight="fill" className="mt-0.5 shrink-0 text-destructive" />
          <div>
            <p className="text-[15px] font-bold text-foreground">{WRITE_AUTH_COPY.create.title}</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{WRITE_AUTH_COPY.create.description}</p>
          </div>
        </div>

        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary">
            <Lightning size={22} weight="fill" className="text-primary-foreground" />
          </div>
          <h1 className="text-[28px] font-bold tracking-tight text-foreground">Welcome to Pulse</h1>
          <p className="text-[15px] leading-5 text-muted-foreground">
            Sign in to create pulses, post live reviews, or manage your venue
          </p>
        </div>

        {authError && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {authError}
          </div>
        )}

        {otpSent && !authError && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`rounded-xl ${UX_HAIRLINE} border bg-card px-4 py-3 text-center text-sm text-foreground`}
          >
            Check your email for the magic link!
          </motion.div>
        )}

        <button
          onClick={handleGoogle}
          disabled={busy}
          className={`${UX_CTA} flex items-center justify-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50`}
        >
          {busy ? (
            <CircleNotch size={20} className="animate-spin" />
          ) : (
            <svg viewBox="0 0 24 24" width={20} height={20} className="h-5 w-5 shrink-0" aria-hidden>
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
          )}
          Continue with Google
        </button>

        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <div className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setOtpSent(false) }}
            placeholder="your@email.com"
            disabled={busy}
            className="h-12 w-full rounded-full border border-border bg-card px-4 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
          />
          <button
            onClick={handleMagicLink}
            disabled={busy || !email.trim()}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-border bg-card text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50"
          >
            {busy ? (
              <CircleNotch size={20} className="animate-spin" />
            ) : (
              <Envelope size={20} weight="bold" />
            )}
            Send Magic Link
          </button>
        </div>

        <Link
          to="/"
          className="flex h-11 items-center justify-center text-[15px] font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Keep browsing the map
        </Link>

        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          By continuing you agree to Pulse's Terms of Service and Privacy Policy.
        </p>
      </motion.div>
    </div>
  )
}
