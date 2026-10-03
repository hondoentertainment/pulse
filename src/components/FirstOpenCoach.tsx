import {
  FIRST_OPEN_COACH_DISMISS,
  FIRST_OPEN_COACH_LINE,
} from '@/lib/first-open-coach'

interface FirstOpenCoachProps {
  onDismiss: () => void
}

export function FirstOpenCoach({ onDismiss }: FirstOpenCoachProps) {
  return (
    <div
      role="status"
      className="flex items-center gap-3 border-y border-border py-2"
      aria-label="First session"
    >
      <p className="min-w-0 flex-1 text-[13px] leading-5 text-muted-foreground">
        {FIRST_OPEN_COACH_LINE}
      </p>
      <button
        type="button"
        onClick={onDismiss}
        className="h-11 shrink-0 px-2 text-[13px] font-semibold text-foreground"
      >
        {FIRST_OPEN_COACH_DISMISS}
      </button>
    </div>
  )
}
