import { useState } from 'react'
import { useSupabaseAuth } from '@/hooks/use-supabase-auth'
import { Lightning, Envelope, CircleNotch } from '@phosphor-icons/react'
import { motion } from 'framer-motion'

export function AuthGate() {
  const { signInWithOAuth, signInWithOtp, authError, isLoading } = useSupabaseAuth()

  const [email, setEmail] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [localLoading, setLocalLoading] = useState(false)

  const busy = isLoading || localLoading

  const handleGoogle = async () => {
    setLocalLoading(true)
    await signInWithOAuth('google')
    // OAuth redirects, so loading stays true until redirect completes
  }

  const handleMagicLink = async () => {
    if (!email.trim()) return
    setLocalLoading(true)
    await signInWithOtp(email.trim())
    setLocalLoading(false)
    setOtpSent(true)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-8"
      >
        {/* Logo / branding */}
        <div className="text-center space-y-3">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent mx-auto flex items-center justify-center">
            <Lightning size={40} weight="fill" className="text-white" />
          </div>
          <h1 className="text-3xl font-bold">Welcome to Pulse</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to discover what's buzzing near you
          </p>
        </div>

        {/* Error display */}
        {authError && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {authError}
          </div>
        )}

        {/* Magic link sent confirmation */}
        {otpSent && !authError && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary text-center"
          >
            Check your email for the magic link!
          </motion.div>
        )}

        {/* Google OAuth */}
        <button
          onClick={handleGoogle}
          disabled={busy}
          className="w-full flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-gradient-to-r from-primary to-accent px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:shadow-primary/40 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
        >
          {busy ? (
            <CircleNotch size={20} className="animate-spin" />
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
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

        {/* Divider */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-xs text-muted-foreground uppercase tracking-wider">or</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Magic link email */}
        <div className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setOtpSent(false) }}
            placeholder="your@email.com"
            disabled={busy}
            className="w-full rounded-2xl border border-white/10 bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all disabled:opacity-50"
          />
          <button
            onClick={handleMagicLink}
            disabled={busy || !email.trim()}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-gradient-to-r from-primary/80 to-accent/80 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent/20 transition-all hover:shadow-accent/35 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
          >
            {busy ? (
              <CircleNotch size={20} className="animate-spin" />
            ) : (
              <Envelope size={20} weight="bold" />
            )}
            Send Magic Link
          </button>
        </div>

        <p className="text-center text-xs text-muted-foreground leading-relaxed">
          By continuing you agree to Pulse's Terms of Service and Privacy Policy.
        </p>
      </motion.div>
    </div>
  )
}
