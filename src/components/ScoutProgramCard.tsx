import { useMemo, useState } from 'react'
import { Binoculars } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { SEATTLE_LAUNCH_NEIGHBORHOODS } from '@/lib/seattle-launch-venues'
import {
  getScoutApplication,
  getScoutProfile,
  submitScoutApplication,
  type ScoutApplication,
  type ScoutProfile,
} from '@/lib/scout-program'

interface ScoutProgramCardProps {
  userId: string
  onSubmitted?: (application: ScoutApplication) => void
}

export function ScoutProgramCard({ userId, onSubmitted }: ScoutProgramCardProps) {
  const [statement, setStatement] = useState('')
  const [neighborhoods, setNeighborhoods] = useState<string[]>(['Capitol Hill'])
  const [application, setApplication] = useState<ScoutApplication | undefined>(() => getScoutApplication(userId))
  const [profile, setProfile] = useState<ScoutProfile | undefined>(() => getScoutProfile(userId))

  const canSubmit = statement.trim().length >= 12 && neighborhoods.length > 0 && !application

  const statusCopy = useMemo(() => {
    if (profile?.tier === 'trusted') return `Trusted scout · reputation ${profile.reputation} from corroboration`
    if (profile?.tier === 'scout') return `Approved scout · reputation ${profile.reputation} (corroboration, not volume)`
    if (application?.status === 'submitted') return 'Application in review'
    return 'Help verify Seattle rooms. Reputation comes from corroboration, not how many reports you file.'
  }, [application, profile])

  const toggleNeighborhood = (neighborhood: string) => {
    setNeighborhoods((current) =>
      current.includes(neighborhood)
        ? current.filter((item) => item !== neighborhood)
        : [...current, neighborhood],
    )
  }

  const handleSubmit = () => {
    const next = submitScoutApplication({
      userId,
      city: 'Seattle,WA',
      neighborhoods,
      statement,
    })
    setApplication(next)
    setProfile(getScoutProfile(userId))
    onSubmitted?.(next)
  }

  return (
    <section
      aria-labelledby="scout-program-heading"
      className="rounded-2xl border border-border bg-card/90 p-4"
      data-testid="scout-program"
    >
      <div className="flex items-center gap-2">
        <Binoculars size={20} weight="fill" className="text-primary" aria-hidden />
        <h3 id="scout-program-heading" className="text-lg font-semibold">Scout program</h3>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{statusCopy}</p>

      {profile && (
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg bg-background/60 p-2">
            <dt className="text-muted-foreground">Tier</dt>
            <dd className="font-semibold capitalize">{profile.tier}</dd>
          </div>
          <div className="rounded-lg bg-background/60 p-2">
            <dt className="text-muted-foreground">Corroborated</dt>
            <dd className="font-semibold">{profile.corroboratedCount}</dd>
          </div>
          <div className="rounded-lg bg-background/60 p-2">
            <dt className="text-muted-foreground">Reputation</dt>
            <dd className="font-semibold">{profile.reputation}</dd>
          </div>
        </dl>
      )}

      {!application && (
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            if (canSubmit) handleSubmit()
          }}
        >
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Neighborhoods</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {SEATTLE_LAUNCH_NEIGHBORHOODS.map((neighborhood) => {
                const selected = neighborhoods.includes(neighborhood)
                return (
                  <button
                    key={neighborhood}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleNeighborhood(neighborhood)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      selected ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground'
                    }`}
                  >
                    {neighborhood}
                  </button>
                )
              })}
            </div>
          </fieldset>
          <label className="block text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Why you</span>
            <textarea
              value={statement}
              onChange={(event) => setStatement(event.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              placeholder="I can confirm Capitol Hill door times most Friday nights."
            />
          </label>
          <Button type="submit" disabled={!canSubmit} className="w-full">
            Apply as scout
          </Button>
        </form>
      )}
    </section>
  )
}
