import { useState, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Users, MagnifyingGlass, UserCircle, CalendarBlank,
  CurrencyDollar, Tag, NotePencil, CaretDown,
  Crown, Warning, UserPlus, Heart,
} from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Pulse } from '@/lib/types'
import {
  buildGuestProfiles,
  getRegulars,
  getVIPGuests,
  getChurningGuests,
  getNewGuests,
  addGuestTag,
  addGuestNote,
  type GuestProfile,
} from '@/lib/venue-platform'

interface GuestCRMProps {
  venueId: string
  pulses: Pulse[]
  users: { id: string; username: string }[]
}

type GuestSegment = 'all' | 'vip' | 'regular' | 'new' | 'at_risk'

const SEGMENT_CONFIG: Record<GuestSegment, { label: string; color: string; icon: typeof Users }> = {
  all: { label: 'All', color: 'text-foreground', icon: Users },
  vip: { label: 'VIP', color: 'text-yellow-400', icon: Crown },
  regular: { label: 'Regular', color: 'text-blue-400', icon: Heart },
  new: { label: 'New', color: 'text-green-400', icon: UserPlus },
  at_risk: { label: 'At Risk', color: 'text-red-400', icon: Warning },
}

export function GuestCRM({ venueId, pulses, users }: GuestCRMProps) {
  const [search, setSearch] = useState('')
  const [activeSegment, setActiveSegment] = useState<GuestSegment>('all')
  const [selectedGuest, setSelectedGuest] = useState<GuestProfile | null>(null)
  const [guestProfiles, setGuestProfiles] = useState<GuestProfile[]>(() =>
    buildGuestProfiles(venueId, pulses, users)
  )
  const [newTag, setNewTag] = useState('')
  const [editingNotes, setEditingNotes] = useState(false)
  const [noteText, setNoteText] = useState('')

  const segments = useMemo(() => {
    const vips = getVIPGuests(guestProfiles)
    const regulars = getRegulars(guestProfiles)
    const newGuests = getNewGuests(guestProfiles)
    const atRisk = getChurningGuests(guestProfiles, 30)
    return {
      all: guestProfiles,
      vip: vips,
      regular: regulars,
      new: newGuests,
      at_risk: atRisk,
    }
  }, [guestProfiles])

  const filteredGuests = useMemo(() => {
    let list = segments[activeSegment]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(g =>
        g.username.toLowerCase().includes(q) ||
        g.tags.some(t => t.toLowerCase().includes(q))
      )
    }
    return list
  }, [segments, activeSegment, search])

  const handleAddTag = (guest: GuestProfile) => {
    if (!newTag.trim()) return
    const updated = addGuestTag(guest, newTag.trim())
    setGuestProfiles(prev =>
      prev.map(g => g.userId === guest.userId ? updated : g)
    )
    setSelectedGuest(updated)
    setNewTag('')
  }

  const handleSaveNote = (guest: GuestProfile) => {
    const updated = addGuestNote(guest, noteText)
    setGuestProfiles(prev =>
      prev.map(g => g.userId === guest.userId ? updated : g)
    )
    setSelectedGuest(updated)
    setEditingNotes(false)
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A'
    const d = new Date(dateStr)
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
  }

  const formatCurrency = (amount: number) => `$${amount.toLocaleString()}`

  // Guest detail modal
  if (selectedGuest) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <button
          onClick={() => { setSelectedGuest(null); setEditingNotes(false) }}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <CaretDown size={12} className="rotate-90" />
          Back to guests
        </button>

        {/* Guest Header */}
        <Card className="p-4 bg-card/80 border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <UserCircle size={28} className="text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-foreground">{selectedGuest.username}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                {selectedGuest.isVIP && (
                  <Badge className="bg-yellow-500/20 text-yellow-400 text-[9px]">VIP</Badge>
                )}
                <span className="text-[10px] text-muted-foreground">
                  {selectedGuest.visits.length} visits
                </span>
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 bg-background/50 rounded-md">
              <CurrencyDollar size={14} className="text-green-400 mx-auto mb-0.5" />
              <p className="text-sm font-bold text-foreground">{formatCurrency(selectedGuest.totalSpend)}</p>
              <p className="text-[9px] text-muted-foreground">Total Spend</p>
            </div>
            <div className="text-center p-2 bg-background/50 rounded-md">
              <CurrencyDollar size={14} className="text-blue-400 mx-auto mb-0.5" />
              <p className="text-sm font-bold text-foreground">{formatCurrency(selectedGuest.averageSpend)}</p>
              <p className="text-[9px] text-muted-foreground">Avg Spend</p>
            </div>
            <div className="text-center p-2 bg-background/50 rounded-md">
              <CalendarBlank size={14} className="text-accent mx-auto mb-0.5" />
              <p className="text-sm font-bold text-foreground">{selectedGuest.visits.length}</p>
              <p className="text-[9px] text-muted-foreground">Visits</p>
            </div>
          </div>
        </Card>

        {/* Visit Details */}
        <Card className="p-4 bg-card/80 border-border">
          <h4 className="text-xs font-bold text-foreground mb-2">Visit Info</h4>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">First Visit</span>
              <span className="text-foreground">{formatDate(selectedGuest.firstVisit)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Visit</span>
              <span className="text-foreground">{formatDate(selectedGuest.lastVisit)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Favorite Nights</span>
              <span className="text-foreground">{selectedGuest.favoriteNights.join(', ') || 'N/A'}</span>
            </div>
          </div>
        </Card>

        {/* Tags */}
        <Card className="p-4 bg-card/80 border-border">
          <div className="flex items-center gap-2 mb-2">
            <Tag size={14} className="text-accent" />
            <h4 className="text-xs font-bold text-foreground">Tags</h4>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {selectedGuest.tags.map(tag => (
              <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Add tag..."
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTag(selectedGuest)}
              className="h-7 text-xs bg-background flex-1"
            />
            <button
              onClick={() => handleAddTag(selectedGuest)}
              className="text-xs text-accent hover:underline shrink-0"
            >
              Add
            </button>
          </div>
        </Card>

        {/* Notes */}
        <Card className="p-4 bg-card/80 border-border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <NotePencil size={14} className="text-accent" />
              <h4 className="text-xs font-bold text-foreground">Notes</h4>
            </div>
            {!editingNotes && (
              <button
                onClick={() => { setEditingNotes(true); setNoteText(selectedGuest.notes) }}
                className="text-[10px] text-accent hover:underline"
              >
                Edit
              </button>
            )}
          </div>
          {editingNotes ? (
            <div className="space-y-2">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="w-full h-20 p-2 text-xs bg-background border border-border rounded-md resize-none text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Add notes about this guest..."
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setEditingNotes(false)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSaveNote(selectedGuest)}
                  className="text-xs text-accent hover:underline"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {selectedGuest.notes || 'No notes yet'}
            </p>
          )}
        </Card>

        {/* Recent Visits */}
        <Card className="p-4 bg-card/80 border-border">
          <h4 className="text-xs font-bold text-foreground mb-2">Recent Visits</h4>
          <div className="space-y-1">
            {selectedGuest.visits.slice(-10).reverse().map((visit, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-border/50 last:border-0">
                <span className="text-muted-foreground">{formatDate(visit.date)}</span>
                <Badge variant="outline" className="text-[9px]">{visit.energyRating}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Segment Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {(Object.entries(SEGMENT_CONFIG) as [GuestSegment, typeof SEGMENT_CONFIG['all']][]).map(([key, config]) => {
          const Icon = config.icon
          const count = segments[key].length
          return (
            <button
              key={key}
              onClick={() => setActiveSegment(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
                activeSegment === key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}
            >
              <Icon size={12} />
              {config.label}
              <span className={`${activeSegment === key ? 'text-primary-foreground/70' : 'text-muted-foreground/50'}`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search guests or tags..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-xs bg-card pl-8"
        />
      </div>

      {/* Guest List */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {filteredGuests.map((guest, i) => (
            <motion.div
              key={guest.userId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: i * 0.03 }}
            >
              <Card
                className="p-3 bg-card/80 border-border hover:border-primary/30 transition-colors cursor-pointer"
                onClick={() => setSelectedGuest(guest)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <UserCircle size={22} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground truncate">{guest.username}</span>
                      {guest.isVIP && (
                        <Crown size={12} className="text-yellow-400 shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">{guest.visits.length} visits</span>
                      <span className="text-[10px] text-muted-foreground">{formatCurrency(guest.totalSpend)} spent</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-muted-foreground">Last visit</p>
                    <p className="text-xs text-foreground">{formatDate(guest.lastVisit)}</p>
                  </div>
                </div>
                {guest.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {guest.tags.map(tag => (
                      <Badge key={tag} variant="outline" className="text-[9px] px-1.5 py-0">{tag}</Badge>
                    ))}
                  </div>
                )}
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredGuests.length === 0 && (
          <Card className="p-6 bg-card/80 border-border text-center">
            <Users size={32} weight="thin" className="text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {search ? 'No guests match your search' : 'No guests in this segment yet'}
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}
