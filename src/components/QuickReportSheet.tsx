import { useState } from 'react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  Clock, Ticket, MusicNotes, Users, TShirt, CheckCircle, PaperPlaneTilt
} from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { DressCode } from '@/lib/live-intelligence'

interface QuickReportSheetProps {
  open: boolean
  onClose: () => void
  venueName: string
  onSubmitWaitTime: (minutes: number) => void
  onSubmitCoverCharge: (amount: number | null, note?: string) => void
  onSubmitMusicGenre: (genre: string) => void
  onSubmitCrowdLevel: (level: number) => void
  onSubmitDressCode: (code: DressCode) => void
  onSubmitNowPlaying: (track: string, artist: string) => void
}

type ReportSection = 'wait' | 'cover' | 'music' | 'crowd' | 'dress' | null

const WAIT_PRESETS = [
  { label: 'No wait', value: 0 },
  { label: '5 min', value: 5 },
  { label: '10 min', value: 10 },
  { label: '15 min', value: 15 },
  { label: '30+ min', value: 30 },
]

const GENRE_OPTIONS = [
  'House', 'Hip-Hop', 'Top 40', 'R&B', 'Latin', 'Techno',
  'Jazz', 'Rock', 'EDM', 'Country', 'Reggaeton', 'Pop'
]

const DRESS_OPTIONS: { label: string; value: DressCode }[] = [
  { label: 'Casual', value: 'casual' },
  { label: 'Smart Casual', value: 'smart-casual' },
  { label: 'Dressy', value: 'dressy' },
  { label: 'Formal', value: 'formal' },
]

const CROWD_EMOJIS = [
  { emoji: '🦗', label: 'Empty', range: [0, 15] },
  { emoji: '😌', label: 'Chill', range: [16, 35] },
  { emoji: '👥', label: 'Moderate', range: [36, 55] },
  { emoji: '🔥', label: 'Busy', range: [56, 75] },
  { emoji: '🤯', label: 'Packed', range: [76, 100] },
]

function getCrowdEmoji(level: number) {
  return CROWD_EMOJIS.find(e => level >= e.range[0] && level <= e.range[1]) || CROWD_EMOJIS[0]
}

export function QuickReportSheet({
  open,
  onClose,
  venueName,
  onSubmitWaitTime,
  onSubmitCoverCharge,
  onSubmitMusicGenre,
  onSubmitCrowdLevel,
  onSubmitDressCode,
  onSubmitNowPlaying,
}: QuickReportSheetProps) {
  const [activeSection, setActiveSection] = useState<ReportSection>(null)
  const [submitted, setSubmitted] = useState<Set<string>>(new Set())

  // Cover charge state
  const [isFree, setIsFree] = useState(false)
  const [coverAmount, setCoverAmount] = useState('')
  const [coverNote, setCoverNote] = useState('')

  // Crowd level state
  const [crowdLevel, setCrowdLevel] = useState(50)

  // Music state
  const [trackName, setTrackName] = useState('')
  const [artistName, setArtistName] = useState('')

  const handleSubmit = (type: string) => {
    setSubmitted(prev => new Set(prev).add(type))
    setActiveSection(null)
    // Brief animation before allowing next report
  }

  const handleClose = () => {
    setActiveSection(null)
    setSubmitted(new Set())
    setIsFree(false)
    setCoverAmount('')
    setCoverNote('')
    setCrowdLevel(50)
    setTrackName('')
    setArtistName('')
    onClose()
  }

  const allSubmitted = submitted.size > 0

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="rounded-t-3xl border-t-accent/20 bg-card max-h-[85vh] overflow-y-auto">
        <SheetHeader className="pb-2">
          <div className="mx-auto w-12 h-1.5 rounded-full bg-muted/30 mb-2" />
          <SheetTitle className="text-xl font-bold">
            Report Live Intel
          </SheetTitle>
          <SheetDescription className="text-sm">
            Help others know what's happening at {venueName}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3 pb-6">
          {/* Thank you banner */}
          <AnimatePresence>
            {allSubmitted && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-3 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                  <CheckCircle size={20} weight="fill" className="text-green-400" />
                  <div>
                    <p className="text-sm font-bold text-green-400">Thanks for reporting!</p>
                    <p className="text-xs text-muted-foreground">Your intel helps the community</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quick report buttons when no section is active */}
          {activeSection === null && (
            <div className="grid grid-cols-2 gap-2">
              {/* Wait Time */}
              <button
                onClick={() => setActiveSection('wait')}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xl border transition-all text-left',
                  submitted.has('wait')
                    ? 'bg-green-500/5 border-green-500/20'
                    : 'bg-secondary/50 border-border hover:border-accent/30'
                )}
              >
                <Clock size={20} weight="fill" className="text-orange-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Wait Time</p>
                  {submitted.has('wait') && (
                    <p className="text-[10px] text-green-400">Reported</p>
                  )}
                </div>
              </button>

              {/* Cover */}
              <button
                onClick={() => setActiveSection('cover')}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xl border transition-all text-left',
                  submitted.has('cover')
                    ? 'bg-green-500/5 border-green-500/20'
                    : 'bg-secondary/50 border-border hover:border-accent/30'
                )}
              >
                <Ticket size={20} weight="fill" className="text-green-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Cover</p>
                  {submitted.has('cover') && (
                    <p className="text-[10px] text-green-400">Reported</p>
                  )}
                </div>
              </button>

              {/* Crowd Level */}
              <button
                onClick={() => setActiveSection('crowd')}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xl border transition-all text-left',
                  submitted.has('crowd')
                    ? 'bg-green-500/5 border-green-500/20'
                    : 'bg-secondary/50 border-border hover:border-accent/30'
                )}
              >
                <Users size={20} weight="fill" className="text-blue-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Crowd</p>
                  {submitted.has('crowd') && (
                    <p className="text-[10px] text-green-400">Reported</p>
                  )}
                </div>
              </button>

              {/* Music */}
              <button
                onClick={() => setActiveSection('music')}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xl border transition-all text-left',
                  submitted.has('music')
                    ? 'bg-green-500/5 border-green-500/20'
                    : 'bg-secondary/50 border-border hover:border-accent/30'
                )}
              >
                <MusicNotes size={20} weight="fill" className="text-purple-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Music</p>
                  {submitted.has('music') && (
                    <p className="text-[10px] text-green-400">Reported</p>
                  )}
                </div>
              </button>

              {/* Dress Code */}
              <button
                onClick={() => setActiveSection('dress')}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xl border transition-all col-span-2 text-left',
                  submitted.has('dress')
                    ? 'bg-green-500/5 border-green-500/20'
                    : 'bg-secondary/50 border-border hover:border-accent/30'
                )}
              >
                <TShirt size={20} weight="fill" className="text-pink-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Dress Code</p>
                  {submitted.has('dress') && (
                    <p className="text-[10px] text-green-400">Reported</p>
                  )}
                </div>
              </button>
            </div>
          )}

          {/* Wait Time Section */}
          <AnimatePresence mode="wait">
            {activeSection === 'wait' && (
              <motion.div
                key="wait"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-3"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={20} weight="fill" className="text-orange-400" />
                  <h4 className="font-bold">How long is the wait?</h4>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {WAIT_PRESETS.map(preset => (
                    <Button
                      key={preset.value}
                      variant="outline"
                      size="sm"
                      className="h-12"
                      onClick={() => {
                        onSubmitWaitTime(preset.value)
                        handleSubmit('wait')
                      }}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={() => setActiveSection(null)}
                >
                  Back
                </Button>
              </motion.div>
            )}

            {/* Cover Charge Section */}
            {activeSection === 'cover' && (
              <motion.div
                key="cover"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Ticket size={20} weight="fill" className="text-green-400" />
                  <h4 className="font-bold">What's the cover?</h4>
                </div>

                <div className="flex items-center gap-3">
                  <Switch checked={isFree} onCheckedChange={setIsFree} />
                  <Label className="text-sm">Free entry</Label>
                </div>

                {!isFree && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Amount ($)</Label>
                    <Input
                      type="number"
                      placeholder="20"
                      value={coverAmount}
                      onChange={e => setCoverAmount(e.target.value)}
                      className="bg-secondary"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Note (optional)</Label>
                  <Input
                    placeholder="e.g. Free before 11pm"
                    value={coverNote}
                    onChange={e => setCoverNote(e.target.value)}
                    className="bg-secondary"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1"
                    onClick={() => setActiveSection(null)}
                  >
                    Back
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      const amount = isFree ? null : (parseInt(coverAmount) || 0)
                      onSubmitCoverCharge(amount, coverNote || undefined)
                      handleSubmit('cover')
                    }}
                  >
                    <PaperPlaneTilt size={16} className="mr-1" />
                    Submit
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Crowd Level Section */}
            {activeSection === 'crowd' && (
              <motion.div
                key="crowd"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Users size={20} weight="fill" className="text-blue-400" />
                  <h4 className="font-bold">How crowded is it?</h4>
                </div>

                <div className="text-center space-y-2">
                  <motion.span
                    key={getCrowdEmoji(crowdLevel).emoji}
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    className="text-4xl block"
                  >
                    {getCrowdEmoji(crowdLevel).emoji}
                  </motion.span>
                  <p className="text-sm font-bold">{getCrowdEmoji(crowdLevel).label}</p>
                  <p className="text-xs text-muted-foreground">{crowdLevel}% full</p>
                </div>

                <Slider
                  value={[crowdLevel]}
                  onValueChange={([v]) => setCrowdLevel(v)}
                  min={0}
                  max={100}
                  step={5}
                />

                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1"
                    onClick={() => setActiveSection(null)}
                  >
                    Back
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      onSubmitCrowdLevel(crowdLevel)
                      handleSubmit('crowd')
                    }}
                  >
                    <PaperPlaneTilt size={16} className="mr-1" />
                    Submit
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Music Section */}
            {activeSection === 'music' && (
              <motion.div
                key="music"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <MusicNotes size={20} weight="fill" className="text-purple-400" />
                  <h4 className="font-bold">What's playing?</h4>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Genre</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {GENRE_OPTIONS.map(genre => (
                      <button
                        key={genre}
                        onClick={() => {
                          onSubmitMusicGenre(genre)
                          handleSubmit('music')
                        }}
                        className="px-3 py-1.5 rounded-full text-xs font-medium bg-secondary border border-border hover:border-purple-400/50 hover:bg-purple-500/10 transition-all"
                      >
                        {genre}
                      </button>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Now Playing (optional)</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Track name"
                      value={trackName}
                      onChange={e => setTrackName(e.target.value)}
                      className="bg-secondary"
                    />
                    <Input
                      placeholder="Artist"
                      value={artistName}
                      onChange={e => setArtistName(e.target.value)}
                      className="bg-secondary"
                    />
                  </div>
                  {trackName && artistName && (
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        onSubmitNowPlaying(trackName, artistName)
                        handleSubmit('music')
                        setTrackName('')
                        setArtistName('')
                      }}
                    >
                      <PaperPlaneTilt size={16} className="mr-1" />
                      Submit Track
                    </Button>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={() => setActiveSection(null)}
                >
                  Back
                </Button>
              </motion.div>
            )}

            {/* Dress Code Section */}
            {activeSection === 'dress' && (
              <motion.div
                key="dress"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-3"
              >
                <div className="flex items-center gap-2 mb-2">
                  <TShirt size={20} weight="fill" className="text-pink-400" />
                  <h4 className="font-bold">What's the dress code?</h4>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {DRESS_OPTIONS.map(option => (
                    <Button
                      key={option.value}
                      variant="outline"
                      size="sm"
                      className="h-12"
                      onClick={() => {
                        onSubmitDressCode(option.value)
                        handleSubmit('dress')
                      }}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={() => setActiveSection(null)}
                >
                  Back
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </SheetContent>
    </Sheet>
  )
}
