import { useState } from 'react'
import { TrackedHashtag, Venue } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Plus, Trash, Hash, Sparkle } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { DEMO_HASHTAGS } from '@/lib/demo-hashtags'

interface HashtagManagerProps {
  trackedHashtags: TrackedHashtag[]
  venues: Venue[]
  onAdd: (hashtag: Omit<TrackedHashtag, 'id' | 'createdAt' | 'updatedAt'>) => void
  onRemove: (id: string) => void
  onToggleActive: (id: string, active: boolean) => void
  onUpdateVenueMapping: (id: string, venueId: string | undefined) => void
}

export function HashtagManager({
  trackedHashtags,
  venues,
  onAdd,
  onRemove,
  onToggleActive,
  onUpdateVenueMapping: _onUpdateVenueMapping
}: HashtagManagerProps) {
  const [newHashtag, setNewHashtag] = useState('')
  const [selectedVenue, setSelectedVenue] = useState<string>('')

  const handleAdd = () => {
    if (!newHashtag.trim()) {
      toast.error('Hashtag cannot be empty')
      return
    }

    const cleanHashtag = newHashtag.trim().replace(/^#/, '')
    
    const exists = trackedHashtags.some(h => 
      h.hashtag.toLowerCase() === cleanHashtag.toLowerCase()
    )
    
    if (exists) {
      toast.error('Hashtag already tracked')
      return
    }

    onAdd({
      hashtag: cleanHashtag,
      venueId: selectedVenue || undefined,
      active: true
    })

    setNewHashtag('')
    setSelectedVenue('')
    toast.success(`Tracking #${cleanHashtag}`)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Hash size={24} weight="bold" className="text-primary" />
          Tracked Hashtags
        </CardTitle>
        <CardDescription>
          Configure hashtags to track from X/Twitter and map them to venues
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="new-hashtag">New Hashtag</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Hash 
                  size={16} 
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" 
                />
                <Input
                  id="new-hashtag"
                  placeholder="nightlife"
                  value={newHashtag}
                  onChange={(e) => setNewHashtag(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="venue-mapping">Venue Mapping (Optional)</Label>
            <Select value={selectedVenue} onValueChange={setSelectedVenue}>
              <SelectTrigger id="venue-mapping">
                <SelectValue placeholder="Select venue or leave unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {venues.map((venue) => (
                  <SelectItem key={venue.id} value={venue.id}>
                    {venue.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {DEMO_HASHTAGS.filter(
            dh => !trackedHashtags.some(th => th.hashtag.toLowerCase() === dh.hashtag.toLowerCase())
          ).length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-muted-foreground">
                <Sparkle size={14} weight="fill" />
                Suggestions
              </Label>
              <div className="flex flex-wrap gap-2">
                {DEMO_HASHTAGS.filter(
                  dh => !trackedHashtags.some(th => th.hashtag.toLowerCase() === dh.hashtag.toLowerCase())
                ).map((dh) => (
                  <Badge
                    key={dh.hashtag}
                    variant="outline"
                    className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => {
                      setNewHashtag(dh.hashtag)
                    }}
                  >
                    #{dh.hashtag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <Button onClick={handleAdd} className="w-full">
            <Plus size={16} weight="bold" className="mr-2" />
            Add Hashtag
          </Button>
        </div>

        {trackedHashtags.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground">Active Tracking</h4>
              <div className="space-y-2">
                {trackedHashtags.map((hashtag) => {
                  const venue = venues.find(v => v.id === hashtag.venueId)
                  
                  return (
                    <div
                      key={hashtag.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card/50"
                    >
                      <Switch
                        checked={hashtag.active}
                        onCheckedChange={(checked) => onToggleActive(hashtag.id, checked)}
                      />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-semibold">#{hashtag.hashtag}</span>
                          {venue && (
                            <Badge variant="secondary" className="text-xs">
                              {venue.name}
                            </Badge>
                          )}
                          {!venue && (
                            <Badge variant="outline" className="text-xs">
                              Unassigned
                            </Badge>
                          )}
                        </div>
                        {hashtag.lastPolledAt && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Last polled: {new Date(hashtag.lastPolledAt).toLocaleTimeString()}
                          </p>
                        )}
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          onRemove(hashtag.id)
                          toast.success(`Removed #${hashtag.hashtag}`)
                        }}
                      >
                        <Trash size={16} weight="bold" className="text-destructive" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {trackedHashtags.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Hash size={48} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm">No hashtags tracked yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
