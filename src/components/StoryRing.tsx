import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { PulseStory } from '@/lib/stories'
import { getStoryRings } from '@/lib/stories'
import { motion } from 'framer-motion'

interface StoryRingProps {
  stories: PulseStory[]
  currentUserId: string
  onStoryClick: (userId: string) => void
}

export function StoryRing({ stories, currentUserId, onStoryClick }: StoryRingProps) {
  const rings = getStoryRings(stories, currentUserId)

  if (rings.length === 0) return null

  return (
    <div className="flex gap-3 overflow-x-auto py-2 px-4 scrollbar-hide">
      {rings.map((ring, i) => (
        <motion.button
          key={ring.userId}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.05 }}
          onClick={() => onStoryClick(ring.userId)}
          className="flex flex-col items-center gap-1 shrink-0"
          aria-label={`${ring.username}'s story${ring.hasUnviewed ? ' (new)' : ''}`}
        >
          <div
            className={cn(
              "rounded-full p-[2px]",
              ring.hasUnviewed
                ? "bg-gradient-to-br from-accent via-purple-500 to-pink-500"
                : "bg-muted"
            )}
          >
            <Avatar className="h-14 w-14 border-2 border-background">
              <AvatarImage src={ring.profilePhoto} />
              <AvatarFallback className="bg-muted text-xs">
                {ring.username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
          <span className="text-[10px] text-muted-foreground max-w-[60px] truncate">
            {ring.username}
          </span>
        </motion.button>
      ))}
    </div>
  )
}
