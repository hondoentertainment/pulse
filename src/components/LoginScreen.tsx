import { useState } from 'react'
import { useSupabaseAuth } from '@/hooks/use-supabase-auth'
import { trackEvent } from '@/lib/analytics'
import { Button } from '@/components/ui/button'
import { Brain, ChartLine, Lightning, ShieldCheck, Envelope, CircleNotch } from '@phosphor-icons/react'
import { motion, useReducedMotion } from 'framer-motion'
import { toast } from 'sonner'

const easeOut = [0.22, 1, 0.36, 1] as const

export function LoginScreen() {
  const { signIn, signInWithOAuth, signInWithOtp, isPlaceholder, authError, isLoading } = useSupabaseAuth()
  const reduceMotion = useReducedMotion()
  const [loading, setLoading] = useState(false)
  const [loadingGoogle, setLoadingGoogle] = useState(false)
  const [loadingApple, setLoadingApple] = useState(false)
  const [loadingMagic, setLoadingMagic] = useState(false)
  const [email, setEmail] = useState('')
  const [otpSent, setOtpSent] = useState(false)

  const motionTransition = (delay = 0) => ({
    duration: reduceMotion ? 0 : 0.4,
    ease: easeOut,
    delay: reduceMotion ? 0 : delay,
  })
  const headerTransition = { duration: reduceMotion ? 0 : 0.35, ease: easeOut }

  const handleStart = async () => {
    setLoading(true)
    trackEvent({ type: 'signal_auth_continue_click', timestamp: Date.now(), isPlaceholder })
    try {
      await signIn()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not start tracking')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setLoadingGoogle(true)
    trackEvent({ type: 'signal_auth_oauth_click', timestamp: Date.now(), provider: 'google' })
    try {
      await signInWithOAuth('google')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Google sign-in failed')
    } finally {
      setLoadingGoogle(false)
    }
  }

  const handleApple = async () => {
    setLoadingApple(true)
    trackEvent({ type: 'signal_auth_oauth_click', timestamp: Date.now(), provider: 'apple' })
    try {
      await signInWithOAuth('apple')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Apple sign-in failed')
    } finally {
      setLoadingApple(false)
    }
  }

  const handleMagicLink = async () => {
    if (!email.trim()) return
    setLoadingMagic(true)
    setOtpSent(false)
    trackEvent({ type: 'signal_auth_magic_link_request', timestamp: Date.now() })
    try {
      await signInWithOtp(email.trim())
      setOtpSent(true)
      toast.success('Check your email', { description: 'Open the link we sent to finish signing in.' })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not send magic link')
    } finally {
      setLoadingMagic(false)
    }
  }

  const handleGuest = async () => {
    setLoading(true)
    trackEvent({ type: 'signal_auth_guest_click', timestamp: Date.now() })
    try {
      await signIn()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not continue as guest')
    } finally {
      setLoading(false)
    }
  }

  const busy = isLoading || loading || loadingGoogle || loadingApple || loadingMagic

  return (
    <main
      className="min-h-dvh overflow-x-hidden bg-background text-foreground [background-image:radial-gradient(circle_at_20%_-10%,color-mix(in_oklch,var(--primary)_22%,transparent),transparent_28rem),radial-gradient(circle_at_90%_20%,color-mix(in_oklch,var(--accent)_16%,transparent),transparent_24rem)] px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] pt-[calc(1.25rem+env(safe-area-inset-top,0px))]"
      aria-labelledby="login-title"
    >
      <div className="mx-auto flex min-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2.5rem)] w-full max-w-md flex-col">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={headerTransition}
          className="flex items-center gap-2"
        >
          <span className="text-xl font-bold tracking-tight [font-family:var(--font-heading)]">Pulse</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-card/80 px-3 py-1 text-xs font-bold text-primary backdrop-blur-sm">
            <Lightning size={14} weight="fill" aria-hidden />
            Signal
          </span>
        </motion.div>

        {isPlaceholder && (
          <p className="mt-4 rounded-2xl border border-primary/25 bg-primary/10 px-3 py-2 text-center text-xs font-medium text-primary">
            Demo mode: Continue uses a local session until Supabase is configured. Data stays on this device.
          </p>
        )}

        <div className="mt-8 flex flex-1 flex-col justify-center sm:mt-12">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={motionTransition(0.04)}
          >
            <h1 id="login-title" className="text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl">
              Your daily state, in 10 seconds.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              One check-in. Trends, streaks, and one clear next step—no long forms.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={motionTransition(0.08)}
            className="mt-8 space-y-4"
          >
            {authError && !isPlaceholder && (
              <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-center text-xs font-medium text-destructive">
                {authError}
              </p>
            )}

            {isPlaceholder ? (
              <>
                <Button
                  size="lg"
                  className="h-14 w-full rounded-2xl text-base font-black shadow-lg shadow-primary/25"
                  onClick={handleStart}
                  disabled={busy}
                >
                  {loading ? 'Starting…' : 'Continue'}
                </Button>
                <p className="text-center text-xs text-muted-foreground">First insight right after your first check-in.</p>
              </>
            ) : (
              <>
                <Button
                  size="lg"
                  className="h-14 w-full rounded-2xl text-base font-semibold shadow-lg shadow-primary/20"
                  variant="default"
                  onClick={handleGoogle}
                  disabled={busy}
                >
                  {loadingGoogle ? (
                    <CircleNotch className="size-5 animate-spin" aria-hidden />
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" className="mr-2 size-5" aria-hidden>
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
                      Continue with Google
                    </>
                  )}
                </Button>

                <Button
                  size="lg"
                  className="h-14 w-full rounded-2xl text-base font-semibold"
                  variant="secondary"
                  onClick={handleApple}
                  disabled={busy}
                >
                  {loadingApple ? (
                    <CircleNotch className="size-5 animate-spin" aria-hidden />
                  ) : (
                    'Continue with Apple'
                  )}
                </Button>

                <div className="flex items-center gap-3 py-1">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">or email</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <div className="space-y-2">
                  <label htmlFor="login-email" className="sr-only">
                    Email for magic link
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setOtpSent(false) }}
                    placeholder="you@email.com"
                    disabled={busy}
                    className="h-12 w-full rounded-2xl border border-border bg-card px-4 text-sm text-foreground outline-none ring-primary/30 placeholder:text-muted-foreground focus:border-primary focus:ring-2 disabled:opacity-50"
                  />
                  <Button
                    size="lg"
                    className="h-12 w-full rounded-2xl text-sm font-semibold"
                    variant="outline"
                    onClick={handleMagicLink}
                    disabled={busy || !email.trim()}
                  >
                    {loadingMagic ? (
                      <CircleNotch className="size-5 animate-spin" aria-hidden />
                    ) : (
                      <>
                        <Envelope className="mr-2 size-5" weight="bold" aria-hidden />
                        Send magic link
                      </>
                    )}
                  </Button>
                  {otpSent && (
                    <p className="text-center text-xs text-primary">Link sent — check your inbox.</p>
                  )}
                </div>

                <div className="flex items-center gap-3 py-1">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">or</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <Button
                  size="lg"
                  className="h-12 w-full rounded-2xl text-sm font-semibold"
                  variant="ghost"
                  onClick={handleGuest}
                  disabled={busy}
                >
                  {loading ? 'Starting…' : 'Continue as guest'}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Guest mode uses an anonymous Pulse account; upgrade later by signing in from settings.
                </p>
              </>
            )}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={motionTransition(0.1)}
          className="-mx-1 mt-6 shrink-0"
        >
          <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Preview</p>
          <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-1 pl-0.5 pr-4">
            <div className="w-[min(18rem,calc(100vw-2.5rem))] shrink-0 rounded-[1.5rem] border border-border/80 bg-card p-4 shadow-lg">
              <div className="rounded-2xl bg-primary p-4 text-primary-foreground">
                <p className="text-xs font-bold opacity-90">Today&apos;s signal</p>
                <div className="mt-3 flex items-end justify-between gap-2">
                  <div>
                    <p className="text-5xl font-black tabular-nums">82</p>
                    <p className="text-sm font-semibold opacity-90">Trending up</p>
                  </div>
                  <ChartLine size={40} weight="bold" className="opacity-90" aria-hidden />
                </div>
              </div>
            </div>
            <div className="w-[min(16rem,calc(100vw-3rem))] shrink-0 rounded-[1.5rem] border border-border/80 bg-card p-4 shadow-md">
              <div className="flex items-start gap-3">
                <span className="rounded-full bg-primary/15 p-2.5 text-primary">
                  <Brain size={20} weight="fill" aria-hidden />
                </span>
                <div>
                  <p className="font-bold">Insight</p>
                  <p className="mt-1 text-sm text-muted-foreground leading-snug">Sharper after low-stress mornings.</p>
                </div>
              </div>
            </div>
            <div className="w-[min(16rem,calc(100vw-3rem))] shrink-0 rounded-[1.5rem] border border-border/80 bg-card p-4 shadow-md">
              <div className="flex items-start gap-3">
                <span className="rounded-full bg-emerald-500/15 p-2.5 text-emerald-400">
                  <ShieldCheck size={20} weight="fill" aria-hidden />
                </span>
                <div>
                  <p className="font-bold">Streak</p>
                  <p className="mt-1 text-sm text-muted-foreground leading-snug">Daily loop & one recommendation.</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </main>
  )
}
