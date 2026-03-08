import { UserPlus, UsersThree, MapPin } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { FriendSuggestion } from '@/lib/social-graph'
import { formatSuggestionReason } from '@/lib/social-graph'
import { motion } from 'framer-motion'

interface FriendSuggestionsProps {
  suggestions: FriendSuggestion[]
  onAddFriend: (userId: string) => void
}

export function FriendSuggestions({ suggestions, onAddFriend }: FriendSuggestionsProps) {
  if (suggestions.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <UsersThree size={18} weight="fill" className="text-accent" />
        <h3 className="text-sm font-bold text-foreground">People You May Know</h3>
      </div>

      <div className="grid gap-2">
        {suggestions.slice(0, 5).map((suggestion, i) => (
          <motion.div
            key={suggestion.user.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="p-3 bg-card/80 border-border">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={suggestion.user.profilePhoto} />
                  <AvatarFallback className="bg-muted text-xs">
                    {suggestion.user.username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {suggestion.user.username}
                  </p>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    {suggestion.reason.type === 'co_located' && <MapPin size={10} weight="fill" />}
                    {suggestion.reason.type === 'mutual_friends' && <UsersThree size={10} weight="fill" />}
                    {formatSuggestionReason(suggestion.reason)}
                  </p>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs border-accent/50 text-accent hover:bg-accent/10"
                  onClick={() => onAddFriend(suggestion.user.id)}
                >
                  <UserPlus size={14} weight="bold" className="mr-1" />
                  Add
                </Button>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
