import { useState } from 'react'
import { useSupabaseAuth } from '@/hooks/use-supabase-auth'
import { Button } from '@/components/ui/button'
import { Brain, ChartLine, Lightning, ShieldCheck } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

const easeOut = [0.22, 1, 0.36, 1] as const

export function LoginScreen() {
  const { signIn } = useSupabaseAuth()
  const [loading, setLoading] = useState(false)

  const handleStart = async () => {
    setLoading(true)
    try {
      await signIn()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not start tracking')
      setLoading(false)
    }
  }

  return (
    <main
      className="min-h-dvh overflow-x-hidden bg-background text-foreground [background-image:radial-gradient(circle_at_20%_-10%,color-mix(in_oklch,var(--primary)_22%,transparent),transparent_28rem),radial-gradient(circle_at_90%_20%,color-mix(in_oklch,var(--accent)_16%,transparent),transparent_24rem)] px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] pt-[calc(1.25rem+env(safe-area-inset-top,0px))]"
      aria-labelledby="login-title"
    >
      <div className="mx-auto flex min-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2.5rem)] w-full max-w-md flex-col">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: easeOut }}
          className="flex items-center gap-2"
        >
          <span className="text-xl font-bold tracking-tight [font-family:var(--font-heading)]">Pulse</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-card/80 px-3 py-1 text-xs font-bold text-primary backdrop-blur-sm">
            <Lightning size={14} weight="fill" aria-hidden />
            Signal
          </span>
        </motion.div>

        <div className="mt-8 flex flex-1 flex-col justify-center sm:mt-12">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: easeOut, delay: 0.04 }}
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
            transition={{ duration: 0.4, ease: easeOut, delay: 0.08 }}
            className="mt-8"
          >
            <Button
              size="lg"
              className="h-14 w-full rounded-2xl text-base font-black shadow-lg shadow-primary/25"
              onClick={handleStart}
              disabled={loading}
            >
              {loading ? 'Starting…' : 'Continue'}
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">First insight right after your first check-in.</p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: easeOut, delay: 0.1 }}
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
