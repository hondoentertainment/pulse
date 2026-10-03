import { formatHereNowCount, type HereNowFriend } from '@/lib/here-now'

interface HereNowCountProps {
  count: number
  friends?: readonly HereNowFriend[]
}

export function HereNowCount({ count, friends = [] }: HereNowCountProps) {
  const names = friends
    .map((friend) => friend.username)
    .filter((name): name is string => Boolean(name))
    .slice(0, 3)
  return (
    <div className="text-[13px] text-muted-foreground">
      <span className="font-semibold text-foreground">{formatHereNowCount(count)}</span>
      {names.length > 0 && (
        <span className="ml-2">· {names.join(', ')}</span>
      )}
    </div>
  )
}
