import { useState } from 'react'
import {
  CREW_TONIGHT_COPY,
  canSaveCrewTonight,
  toggleCrewMember,
} from '@/lib/crew-tonight'

export function CrewTonightPicker({
  followedPeople,
  ownerId,
  pinned,
  onSave,
  onInvite,
}: {
  followedPeople: { id: string; username: string }[]
  ownerId?: string
  pinned: boolean
  onSave: (memberIds: string[]) => void
  onInvite: () => void
}) {
  const [picked, setPicked] = useState<string[]>([])
  if (!pinned) {
    return <p className="text-[13px] text-muted-foreground">{CREW_TONIGHT_COPY.needPin}</p>
  }
  if (followedPeople.length < 2) {
    return <p className="text-[13px] text-muted-foreground">{CREW_TONIGHT_COPY.needPeople}</p>
  }
  return (
    <section className="space-y-2" aria-label={CREW_TONIGHT_COPY.cta}>
      <p className="text-[13px] font-semibold text-muted-foreground">{CREW_TONIGHT_COPY.cta}</p>
      <div className="flex flex-wrap gap-2">
        {followedPeople.map((person) => {
          const selected = picked.includes(person.id)
          return (
            <button
              key={person.id}
              type="button"
              aria-pressed={selected}
              className="h-8 rounded-full border border-border px-3 text-[12px] font-semibold"
              onClick={() => setPicked(toggleCrewMember(picked, person.id, followedPeople.map((row) => row.id), ownerId))}
            >
              {person.username}
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!canSaveCrewTonight(picked)}
          className="h-9 rounded-full border border-border px-3 text-[13px] font-semibold disabled:opacity-50"
          onClick={() => onSave(picked)}
        >
          Save crew
        </button>
        <button
          type="button"
          className="h-9 rounded-full border border-border px-3 text-[13px] font-semibold"
          onClick={onInvite}
        >
          Invite link
        </button>
      </div>
    </section>
  )
}
