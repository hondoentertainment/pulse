import { motion } from 'framer-motion'
import { MapPin, Bell, Star, Lightning, Plus } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { ReactNode } from 'react'
import { UX_CTA } from '@/lib/ux-chrome'

type EmptyStateVariant = 'no-pulses' | 'no-notifications' | 'no-favorites' | 'no-nearby' | 'offline'

interface EmptyStateConfig {
    icon: ReactNode
    title: string
    description: string
    ctaText?: string
}

const variants: Record<EmptyStateVariant, EmptyStateConfig> = {
    'no-pulses': {
        icon: <Lightning size={48} weight="duotone" className="text-primary" />,
        title: "No pulses yet",
        description: "Be the first to share the vibe! Post a pulse and let others know what's happening.",
        ctaText: "Drop a Pulse"
    },
    'no-notifications': {
        icon: <Bell size={48} weight="duotone" className="text-muted-foreground" />,
        title: "All caught up!",
        description: "When friends post pulses or react to yours, you'll see it here."
    },
    'no-favorites': {
        icon: <Star size={48} weight="duotone" className="text-primary" />,
        title: "No favorites yet",
        description: "Star venues you love to keep track of their energy levels.",
        ctaText: "Explore Venues"
    },
    'no-nearby': {
        icon: <MapPin size={48} weight="duotone" className="text-muted-foreground" />,
        title: "No venues nearby",
        description: "We couldn't find any venues in your area. Try expanding your search."
    },
    'offline': {
        icon: <Lightning size={48} weight="duotone" className="text-destructive" />,
        title: "You're offline",
        description: "Check your connection and try again."
    }
}

interface EmptyStateProps {
    variant: EmptyStateVariant
    onAction?: () => void
}

export function EmptyState({ variant, onAction }: EmptyStateProps) {
    const config = variants[variant]

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center px-8 py-16 text-center"
        >
            <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.1 }}
                className="mb-6 rounded-full border border-border bg-card p-6"
            >
                {config.icon}
            </motion.div>

            <h3 className="mb-2 text-xl font-bold">{config.title}</h3>
            <p className="mb-6 max-w-[250px] text-[15px] text-muted-foreground">
                {config.description}
            </p>

            {config.ctaText && onAction && (
                <Button onClick={onAction} className={`${UX_CTA} gap-2`}>
                    <Plus size={18} weight="bold" />
                    {config.ctaText}
                </Button>
            )}
        </motion.div>
    )
}
