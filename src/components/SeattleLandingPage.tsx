import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { markWelcomeSeen } from '@/lib/welcome-gate'
import { setDocumentMeta } from '@/lib/document-meta'
import { VALUE_PROP } from '@/lib/value-prop'

/**
 * Fundable first impression: brand + one promise + one CTA + full-bleed atmosphere.
 * Value prop for end users — not a feature grid.
 */
export function SeattleLandingPage() {
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    setDocumentMeta({
      title: VALUE_PROP.titleWelcome,
      description: VALUE_PROP.descriptionDefault,
      url: typeof window !== 'undefined' ? `${window.location.origin}/welcome` : '/welcome',
      type: 'website',
    })
  }, [])

  const enterApp = () => {
    markWelcomeSeen()
  }

  return (
    <div className="relative min-h-[100dvh] overflow-hidden text-white">
      {/* Full-bleed hero plane */}
      <div className="absolute inset-0" aria-hidden>
        <img
          src="/screenshots/tonight.png"
          alt=""
          className="h-full w-full object-cover object-center scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/85 to-[#0a0a0f]/45" />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(90% 60% at 50% 0%, rgba(245,158,11,0.22), transparent 55%)',
          }}
        />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-lg flex-col px-6 pb-10 pt-[max(2.75rem,env(safe-area-inset-top))]">
        {/* First viewport: brand, headline, sentence, CTAs only */}
        <div className="flex flex-1 flex-col justify-end pb-6">
          <motion.p
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="font-[family-name:var(--font-display,Space_Grotesk,sans-serif)] text-6xl font-bold tracking-tight text-[#f59e0b] sm:text-7xl"
          >
            {VALUE_PROP.brand}
          </motion.p>

          <motion.h1
            initial={reduceMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.06 }}
            className="mt-5 max-w-[18ch] text-[1.85rem] font-semibold leading-[1.15] tracking-tight sm:text-4xl"
          >
            {VALUE_PROP.headline}
          </motion.h1>

          <motion.p
            initial={reduceMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.12 }}
            className="mt-4 max-w-[36ch] text-base leading-relaxed text-white/75"
          >
            {VALUE_PROP.subhead}
          </motion.p>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.18 }}
            className="mt-9 flex flex-col gap-3"
          >
            <Link
              to="/"
              onClick={enterApp}
              className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#f59e0b] px-6 text-base font-semibold text-[#0a0a0f] transition hover:bg-[#fbbf24] active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f59e0b] touch-manipulation"
            >
              {VALUE_PROP.primaryCta}
            </Link>
            <Link
              to="/map"
              onClick={enterApp}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/20 bg-white/5 px-6 text-sm font-medium text-white/90 backdrop-blur-sm transition hover:bg-white/10 touch-manipulation"
            >
              {VALUE_PROP.secondaryCta}
            </Link>
          </motion.div>
        </div>

        {/* Below fold — one job: explain the loop */}
        <motion.section
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="border-t border-white/10 pt-8"
          aria-labelledby="how-it-works-heading"
        >
          <h2
            id="how-it-works-heading"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45"
          >
            How it works
          </h2>
          <p className="mt-3 text-sm text-white/55">{VALUE_PROP.differentiator}</p>
          <ol className="mt-5 space-y-4">
            {VALUE_PROP.steps.map((step, i) => (
              <li key={step.title} className="text-sm leading-relaxed text-white/70">
                <span className="font-semibold text-white">
                  {i + 1}. {step.title}
                </span>
                <span className="text-white/55"> — {step.body}</span>
              </li>
            ))}
          </ol>
          <p className="mt-8 text-xs text-white/35">
            <a href="/privacy.html" className="underline-offset-2 hover:underline hover:text-white/55">
              Privacy
            </a>
            {' · '}
            <a href="/terms.html" className="underline-offset-2 hover:underline hover:text-white/55">
              Terms
            </a>
            {' · '}
            {VALUE_PROP.market} first
          </p>
        </motion.section>
      </div>
    </div>
  )
}
