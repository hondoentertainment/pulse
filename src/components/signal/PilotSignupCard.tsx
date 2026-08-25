import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { submitPilotSignup } from '@/lib/signal-pilot'
import { trackEvent } from '@/lib/analytics'
import { useSupabaseAuth } from '@/hooks/use-supabase-auth'

export function PilotSignupCard() {
  const { user, session } = useSupabaseAuth()
  const [email, setEmail] = useState(user?.email ?? '')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    setSubmitting(true)
    trackEvent({ type: 'signal_research_cta_click', timestamp: Date.now(), target: 'pro_pilot' })
    const result = await submitPilotSignup({
      email,
      source: 'pro_pilot',
      userId: user?.id,
      accessToken: session?.access_token,
    })
    setSubmitting(false)
    trackEvent({ type: 'signal_pilot_signup', timestamp: Date.now(), status: result.status })
    if (result.status === 'failed') {
      toast.error('Could not join the list', { description: result.message })
      return
    }
    toast.success(result.status === 'already_registered' ? 'Already registered' : 'You are on the list', {
      description: result.message,
    })
  }

  return (
    <section className="space-y-3 rounded-[2rem] border border-border bg-card p-5">
      <p className="font-black">Pulse Pro pilot</p>
      <p className="text-sm text-muted-foreground">
        Leave an email if you want early access. We store it so we can actually contact you.
      </p>
      <label className="block text-sm font-semibold" htmlFor="pilot-email">
        Email
      </label>
      <input
        id="pilot-email"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@email.com"
        className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-base outline-none ring-primary/30 placeholder:text-muted-foreground focus:border-primary focus:ring-2"
      />
      <Button
        variant="secondary"
        className="h-12 w-full rounded-2xl"
        disabled={submitting}
        onClick={() => void handleSubmit()}
      >
        {submitting ? 'Saving…' : 'Join the pilot list'}
      </Button>
    </section>
  )
}
