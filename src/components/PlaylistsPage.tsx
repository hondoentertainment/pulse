import { useState } from 'react'
import { Venue, Pulse, User } from '@/lib/types'
import {
  PulsePlaylist,
  PRESET_MOODS,
  createPlaylist,
  togglePlaylistLike,
  getPlaylistsByMood,
  generatePlaylistCard,
  suggestMood,
} from '@/lib/playlists'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Heart, MusicNotes, Plus, ShareNetwork } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

interface PlaylistsPageProps {
  currentUser: User
  playlists: PulsePlaylist[]
  pulses: Pulse[]
  venues: Venue[]
  onBack: () => void
  onPlaylistsUpdate: (playlists: PulsePlaylist[]) => void
}

export function PlaylistsPage({
  currentUser,
  playlists,
  pulses,
  venues,
  onBack,
  onPlaylistsUpdate,
}: PlaylistsPageProps) {
  const [selectedMood, setSelectedMood] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')

  const userPlaylists = playlists.filter(p => p.createdBy === currentUser.id)
  const moodPlaylists = selectedMood
    ? getPlaylistsByMood(playlists, selectedMood)
    : playlists.filter(p => p.published)

  const handleCreate = () => {
    if (!newTitle.trim()) return
    const userPulses = pulses.filter(p => p.userId === currentUser.id)
    const mood = suggestMood(userPulses, venues)
    const playlist = createPlaylist(newTitle.trim(), newDescription.trim(), 'user', currentUser.id, {
      mood,
      tags: [mood],
    })
    onPlaylistsUpdate([...playlists, { ...playlist, published: true }])
    setNewTitle('')
    setNewDescription('')
    setShowCreate(false)
    toast.success('Playlist created!')
  }

  const handleLike = (playlistId: string) => {
    onPlaylistsUpdate(
      playlists.map(p => (p.id === playlistId ? togglePlaylistLike(p, currentUser.id) : p))
    )
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-secondary">
            <ArrowLeft size={20} />
          </button>
          <MusicNotes size={24} weight="fill" className="text-primary" />
          <h1 className="text-lg font-bold flex-1">Playlists & Mood Boards</h1>
          <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
            <Plus size={16} className="mr-1" />
            New
          </Button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-5">
        {/* Create Form */}
        {showCreate && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
            <Card className="p-4 space-y-3 border-primary/30">
              <h3 className="font-bold text-sm">Create New Playlist</h3>
              <input
                type="text"
                placeholder="Playlist name..."
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                className="w-full bg-secondary/50 rounded-lg px-3 py-2 text-sm border border-border focus:border-primary outline-none"
              />
              <input
                type="text"
                placeholder="Description (optional)"
                value={newDescription}
                onChange={e => setNewDescription(e.target.value)}
                className="w-full bg-secondary/50 rounded-lg px-3 py-2 text-sm border border-border focus:border-primary outline-none"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleCreate} disabled={!newTitle.trim()}>
                  Create
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Mood Filter */}
        <div className="space-y-2">
          <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wide">Browse by Mood</h3>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setSelectedMood(null)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                !selectedMood
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-muted-foreground border border-border'
              }`}
            >
              All
            </button>
            {PRESET_MOODS.map(mood => (
              <button
                key={mood.value}
                onClick={() => setSelectedMood(selectedMood === mood.value ? null : mood.value)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  selectedMood === mood.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-muted-foreground border border-border'
                }`}
              >
                {mood.emoji} {mood.label}
              </button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Your Playlists */}
        {userPlaylists.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-bold">Your Playlists</h3>
            {userPlaylists.map((playlist, i) => (
              <PlaylistCardUI
                key={playlist.id}
                playlist={playlist}
                pulses={pulses}
                currentUserId={currentUser.id}
                onLike={() => handleLike(playlist.id)}
                index={i}
              />
            ))}
          </div>
        )}

        {/* Browse Playlists */}
        <div className="space-y-3">
          <h3 className="font-bold">{selectedMood ? `${PRESET_MOODS.find(m => m.value === selectedMood)?.emoji || ''} ${PRESET_MOODS.find(m => m.value === selectedMood)?.label || 'Playlists'}` : 'All Playlists'}</h3>
          {moodPlaylists.length > 0 ? (
            moodPlaylists.map((playlist, i) => (
              <PlaylistCardUI
                key={playlist.id}
                playlist={playlist}
                pulses={pulses}
                currentUserId={currentUser.id}
                onLike={() => handleLike(playlist.id)}
                index={i}
              />
            ))
          ) : (
            <Card className="p-8 text-center">
              <MusicNotes size={40} className="text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No playlists yet</p>
              <p className="text-xs text-muted-foreground mt-1">Create one to start curating your favorite pulses</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function PlaylistCardUI({
  playlist,
  pulses,
  currentUserId,
  onLike,
  index,
}: {
  playlist: PulsePlaylist
  pulses: Pulse[]
  currentUserId: string
  onLike: () => void
  index: number
}) {
  const card = generatePlaylistCard(playlist, pulses)
  const isLiked = playlist.likes.includes(currentUserId)
  const moodConfig = PRESET_MOODS.find(m => m.value === playlist.mood)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card className="overflow-hidden">
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm">{card.title}</h4>
                {moodConfig && (
                  <Badge variant="outline" className="text-xs">
                    {moodConfig.emoji} {moodConfig.label}
                  </Badge>
                )}
              </div>
              {card.description && (
                <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
              )}
            </div>
          </div>

          {/* Preview photos */}
          {card.previewPhotos.length > 0 && (
            <div className="flex gap-1 rounded-lg overflow-hidden">
              {card.previewPhotos.slice(0, 4).map((photo, j) => (
                <img
                  key={j}
                  src={photo}
                  alt=""
                  className="h-16 flex-1 object-cover"
                />
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{card.pulseCount} pulse{card.pulseCount !== 1 ? 's' : ''}</span>
              <span>{playlist.likes.length} like{playlist.likes.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(card.shareText)
                    toast.success('Share text copied!')
                  }
                }}
                className="p-1.5 rounded-full hover:bg-secondary"
              >
                <ShareNetwork size={16} className="text-muted-foreground" />
              </button>
              <button
                onClick={onLike}
                className="p-1.5 rounded-full hover:bg-secondary"
              >
                <Heart
                  size={16}
                  weight={isLiked ? 'fill' : 'regular'}
                  className={isLiked ? 'text-red-500' : 'text-muted-foreground'}
                />
              </button>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
