import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { markWelcomeSeen } from '@/lib/welcome-gate'
import { setDocumentMeta } from '@/lib/document-meta'

/**
 * Seattle-first conversion landing — brand hero, one promise, one CTA.
 * Not a feature dashboard.
 */
export function SeattleLandingPage() {
  useEffect(() => {
    setDocumentMeta({
      title: 'Pulse — Know where to go right now in Seattle',
      description:
        'Live nightlife energy from time-bound reviews. Confidence before you leave the house.',
      url: typeof window !== 'undefined' ? `${window.location.origin}/welcome` : '/welcome',
      type: 'website',
    })
  }, [])

  const enterApp = () => {
    markWelcomeSeen()
  }

  return (
    <div className="relative min-h-[100dvh] overflow-hidden text-foreground">
      <div
        className="absolute inset-0"
        aria-hidden
        style={{
          background:
            'radial-gradient(120% 80% at 50% -10%, rgba(245,158,11,0.28), transparent 55%), linear-gradient(165deg, #0a0a0f 0%, #12121a 45%, #1a1220 100%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        aria-hidden
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-lg flex-col px-6 pb-10 pt-[max(2.5rem,env(safe-area-inset-top))]">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="font-[family-name:var(--font-display,Space_Grotesk,sans-serif)] text-5xl font-bold tracking-tight text-[#f59e0b] sm:text-6xl"
        >
          Pulse
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08 }}
          className="mt-6 max-w-[16ch] text-3xl font-semibold leading-tight tracking-tight sm:text-4xl"
        >
          Know where to go right now
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.16 }}
          className="mt-4 max-w-[34ch] text-base text-muted-foreground"
        >
          Live Seattle nightlife tips that fade in 90 minutes — decide before you waste the night.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.24 }}
          className="mt-10 flex flex-col gap-3"
        >
          <Link
            to="/"
            onClick={enterApp}
            className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#f59e0b] px-6 text-base font-semibold text-[#0a0a0f] transition hover:bg-[#fbbf24] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f59e0b]"
          >
            See Tonight
          </Link>
          <Link
            to="/map"
            onClick={enterApp}
            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-6 text-sm font-medium text-foreground backdrop-blur transition hover:bg-white/10"
          >
            Open the live map
          </Link>
        </motion.div>

        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-auto pt-16"
          aria-labelledby="how-it-works-heading"
        >
          <h2 id="how-it-works-heading" className="text-sm font-semibold uppercase tracking-[0.18em] text-white/50">
            How it works
          </h2>
          <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">1. Pick a vibe</span>
              {' — '}Dead, Chill, Buzzing, or Electric.
            </li>
            <li>
              <span className="font-medium text-foreground">2. Trust the signal</span>
              {' — '}energy, confidence, and freshness on every pick.
            </li>
            <li>
              <span className="font-medium text-foreground">3. Go &amp; report</span>
              {' — '}directions now, one-tap arrival after you land.
            </li>
          </ol>
          <p className="mt-8 text-xs text-white/40">
            <a href="/privacy.html" className="underline-offset-2 hover:underline">
              Privacy
            </a>
            {' · '}
            <a href="/terms.html" className="underline-offset-2 hover:underline">
              Terms
            </a>
          </p>
        </motion.section>
      </div>
    </div>
  )
}
