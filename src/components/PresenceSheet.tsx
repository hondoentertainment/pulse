import { PresenceData, User } from '@/lib/types'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Users, MapPin, Clock, ShieldCheck } from '@phosphor-icons/react'
import { applyJitter } from '@/lib/presence-engine'

interface PresenceSheetProps {
    open: boolean
    onClose: () => void
    presence: PresenceData
    currentUser: User | null
    onUpdateSettings: (settings: User['presenceSettings']) => void
}

export function PresenceSheet({ open, onClose, presence, currentUser, onUpdateSettings }: PresenceSheetProps) {
    if (!currentUser) return null

    const settings = currentUser.presenceSettings || {
        enabled: true,
        visibility: 'everyone',
        hideAtSensitiveVenues: true
    }

    const handleToggle = (enabled: boolean) => {
        onUpdateSettings({ ...settings, enabled })
    }

    return (
        <Sheet open={open} onOpenChange={onClose}>
            <SheetContent side="bottom" className="rounded-t-3xl border-t-accent/20 bg-card p-6 h-[50vh]">
                <SheetHeader>
                    <div className="mx-auto w-12 h-1.5 rounded-full bg-muted/30 mb-4" />
                    <SheetTitle className="text-2xl font-bold flex items-center gap-2">
                        <Users size={28} className="text-accent" />
                        Who's Here Now
                    </SheetTitle>
                    <SheetDescription className="text-sm font-mono uppercase tracking-tight">
                        Presence data is aggregated and jittered for privacy.
                    </SheetDescription>
                </SheetHeader>

                <div className="mt-8 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl bg-secondary/50 border border-border space-y-1">
                            <p className="text-3xl font-bold text-accent">
                                {applyJitter(presence.friendsHereNowCount + presence.friendsNearbyCount)}
                            </p>
                            <p className="text-xs text-muted-foreground uppercase font-mono">Friends Nearby</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-secondary/50 border border-border space-y-1">
                            <p className="text-3xl font-bold text-foreground">
                                {applyJitter(presence.familiarFacesCount)}
                            </p>
                            <p className="text-xs text-muted-foreground uppercase font-mono">Familiar Faces</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10">
                        <ShieldCheck size={20} className="text-primary" />
                        <p className="text-[11px] text-muted-foreground leading-tight">
                            We never show your exact coordinates. You appear only if ≥2 people are detected to prevent singling anyone out.
                        </p>
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between py-2">
                        <div className="space-y-0.5">
                            <Label className="text-sm font-bold">Show me in Who's Here</Label>
                            <p className="text-xs text-muted-foreground">Control if you appear in presence counts</p>
                        </div>
                        <Switch
                            checked={settings.enabled}
                            onCheckedChange={handleToggle}
                            className="data-[state=checked]:bg-accent"
                        />
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}
