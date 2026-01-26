import { PresenceData } from '@/lib/types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { motion } from 'framer-motion'
import { Users } from '@phosphor-icons/react'
import { applyJitter } from '@/lib/presence-engine'

interface WhoIsHereRowProps {
    presence: PresenceData
    onClick: () => void
}

export function WhoIsHereRow({ presence, onClick }: WhoIsHereRowProps) {
    if (presence.isSuppressed) return null

    const totalFriends = presence.friendsHereNowCount + presence.friendsNearbyCount
    const hasFamiliarFaces = presence.familiarFacesCount > 0

    return (
        <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={onClick}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-accent/5 border border-accent/20 hover:bg-accent/10 transition-colors group"
        >
            <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                    {presence.prioritizedAvatars.map((url, i) => (
                        <Avatar key={i} className="w-8 h-8 border-2 border-background ring-1 ring-accent/10">
                            <AvatarImage src={url} />
                            <AvatarFallback className="bg-muted text-[10px]">??</AvatarFallback>
                        </Avatar>
                    ))}
                    {presence.prioritizedAvatars.length === 0 && (
                        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center border-2 border-background">
                            <Users size={16} className="text-accent" />
                        </div>
                    )}
                </div>

                <div className="text-left">
                    <p className="text-sm font-bold text-foreground">
                        {totalFriends > 0
                            ? `${applyJitter(totalFriends)} friend${totalFriends === 1 ? '' : 's'} here`
                            : hasFamiliarFaces
                                ? `${applyJitter(presence.familiarFacesCount)} familiar faces`
                                : 'See who\'s here'}
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">
                        Presence is approximate
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-accent/10">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                    <span className="text-[10px] font-bold text-accent uppercase font-mono">Live</span>
                </div>
            </div>
        </motion.button>
    )
}
