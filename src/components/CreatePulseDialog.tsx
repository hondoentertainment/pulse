import { useState, useRef, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { EnergySlider } from './EnergySlider'
import { EnergyPills } from './EnergyPills'
import { EnergyRating, Venue, Hashtag, HashtagSuggestionContext } from '@/lib/types'
import { X, CheckCircle, Hash } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { compressVideo, formatFileSize, getCompressionRatio } from '@/lib/video-compression'
import { screenContent } from '@/lib/content-moderation'
import { moderateServer } from '@/lib/moderation-client'
import { track } from '@/lib/observability/analytics'
import { suggestHashtags, getTimeOfDay, getDayOfWeek } from '@/lib/seeded-hashtags'
import { useKV } from '@github/spark/hooks'
import {
  evaluateLocationProof,
  validateLiveReviewCaption,
  type LocationProof,
} from '@/lib/live-reviews'
import {
  clearPulseDraft,
  QUICK_PULSE_CAPTION_MAX,
  readPulseDraft,
  writePulseDraft,
} from '@/lib/pulse-draft'
import { ComposerVenueChip } from '@/components/ux/ComposerVenueChip'
import { UX_CTA } from '@/lib/ux-chrome'

interface CreatePulseDialogProps {
  open: boolean
  onClose: () => void
  venue: Venue | null
  userLocation?: { lat: number; lng: number } | null
  onSubmit: (data: {
    energyRating: EnergyRating
    caption: string
    photos: string[]
    video?: string
    hashtags?: string[]
    kind: 'review' | 'pulse'
    locationVerified: boolean
  }) => void
}

export function CreatePulseDialog({
  open,
  onClose,
  venue,
  userLocation = null,
  onSubmit
}: CreatePulseDialogProps) {
  const [energyRating, setEnergyRating] = useState<EnergyRating>('chill')
  const [caption, setCaption] = useState('')
  const [selectedHashtags, setSelectedHashtags] = useState<string[]>([])
  const [energyPhotos, setEnergyPhotos] = useState<Record<EnergyRating, string | null>>({
    dead: null,
    chill: null,
    buzzing: null,
    electric: null
  })
  const [video, setVideo] = useState<string | null>(null)
  const [videoDuration, setVideoDuration] = useState<number>(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCompressing, setIsCompressing] = useState(false)
  const [compressionProgress, setCompressionProgress] = useState(0)
  const [originalSize, setOriginalSize] = useState<number>(0)
  const [compressedSize, setCompressedSize] = useState<number>(0)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const hasSubmittedFirstPulse = useRef<boolean>(false)
  const [allHashtags] = useKV<Hashtag[]>('hashtags', [])
  const [suggestedGroups, setSuggestedGroups] = useState<{ hashtags: Hashtag[]; label: string }[]>([])

  useEffect(() => {
    if (!open || !venue) return
    const draft = readPulseDraft()
    if (draft && draft.venueId === venue.id) {
      setEnergyRating(draft.energyRating)
      setCaption(draft.caption)
    }
  }, [open, venue])

  useEffect(() => {
    if (!open || !venue) return
    writePulseDraft({
      venueId: venue.id,
      energyRating,
      caption,
    })
  }, [open, venue, energyRating, caption])

  useEffect(() => {
    if (venue && allHashtags && allHashtags.length > 0) {
      const now = new Date()
      const context: HashtagSuggestionContext = {
        venueCategory: venue.category,
        timeOfDay: getTimeOfDay(now.getHours()),
        dayOfWeek: getDayOfWeek(now),
        pulseScore: venue.pulseScore,
        energyRating
      }
      
      const suggestions = suggestHashtags(context, allHashtags, 5)
      setSuggestedGroups(suggestions)
    }
  }, [venue, energyRating, allHashtags])

  const toggleHashtag = (hashtagName: string) => {
    setSelectedHashtags(prev => {
      if (prev.includes(hashtagName)) {
        return prev.filter(h => h !== hashtagName)
      }
      if (prev.length >= 5) {
        toast.error('Maximum 5 hashtags', {
          description: 'Remove one to add another'
        })
        return prev
      }
      return [...prev, hashtagName]
    })
  }

  const locationProof: LocationProof = evaluateLocationProof(userLocation, venue?.location)

  const handleSubmit = async () => {
    if (!venue) return

    const trimmed = caption.trim()
    const wantsReview = trimmed.length > 0
    const captionCheck = wantsReview
      ? validateLiveReviewCaption(trimmed)
      : { ok: true as const, caption: trimmed }
    if (!captionCheck.ok) {
      toast.error(captionCheck.error ?? 'Caption is required')
      return
    }

    const photos = Object.values(energyPhotos).filter((photo): photo is string => photo !== null)

    const contentIssues = screenContent(caption)
    if (contentIssues.length > 0) {
      toast.error(contentIssues[0])
      return
    }

    setIsSubmitting(true)

    // Authoritative server-side moderation check before persisting.
    if (caption && caption.trim().length > 0) {
      const verdict = await moderateServer(caption, 'pulse')
      if (!verdict.allowed) {
        setIsSubmitting(false)
        const reason = verdict.reasons[0] ?? 'Content cannot be posted'
        toast.error('Pulse blocked by moderation', {
          description: verdict.reasons.join(' · ') || reason,
        })
        return
      }
    }

    await onSubmit({
      energyRating,
      caption: captionCheck.caption,
      photos,
      video: video || undefined,
      hashtags: selectedHashtags,
      kind: wantsReview ? 'review' : 'pulse',
      locationVerified: locationProof.locationVerified,
    })
    clearPulseDraft()

    track('pulse_created', {
      pulseId: `pulse-${Date.now()}`,
      venueId: venue.id,
      hasPhoto: photos.length > 0,
      hasCaption: true,
      hashtagCount: selectedHashtags.length,
      energyRating,
      isFirstPulse: !hasSubmittedFirstPulse.current,
      kind: 'review',
      locationVerified: locationProof.locationVerified,
    })
    hasSubmittedFirstPulse.current = true

    setIsSubmitting(false)
    
    setEnergyRating('chill')
    setCaption('')
    setSelectedHashtags([])
    setEnergyPhotos({
      dead: null,
      chill: null,
      buzzing: null,
      electric: null
    })
    setVideo(null)
    setVideoDuration(0)
    setOriginalSize(0)
    setCompressedSize(0)
    setCompressionProgress(0)
    onClose()
  }

  const handlePhotoUpload = (energy: EnergyRating) => {
    const mockPhotos = [
      'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&q=80',
      'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=800&q=80',
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80'
    ]
    const randomPhoto = mockPhotos[Math.floor(Math.random() * mockPhotos.length)]
    setEnergyPhotos(prev => ({
      ...prev,
      [energy]: randomPhoto
    }))
  }

  const removePhoto = (energy: EnergyRating) => {
    setEnergyPhotos(prev => ({
      ...prev,
      [energy]: null
    }))
  }

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('video/')) {
      toast.error('Invalid file type', {
        description: 'Please select a video file'
      })
      return
    }

    setOriginalSize(file.size)

    const videoElement = document.createElement('video')
    videoElement.preload = 'metadata'
    
    videoElement.onloadedmetadata = async () => {
      window.URL.revokeObjectURL(videoElement.src)
      
      if (videoElement.duration > 30) {
        toast.error('Video too long', {
          description: 'Videos must be 30 seconds or less'
        })
        return
      }

      setVideoDuration(videoElement.duration)

      try {
        setIsCompressing(true)
        setCompressionProgress(0)

        toast.loading('Compressing video...', {
          id: 'video-compression',
          description: 'This may take a moment'
        })

        const compressedBlob = await compressVideo(
          file,
          {
            maxWidth: 1280,
            maxHeight: 720,
            quality: 0.8,
            videoBitrate: 1500000,
            audioBitrate: 128000
          },
          (progress) => {
            setCompressionProgress(progress.percent)
          }
        )

        setCompressedSize(compressedBlob.size)
        const videoUrl = URL.createObjectURL(compressedBlob)
        setVideo(videoUrl)
        setIsCompressing(false)

        const ratio = getCompressionRatio(file.size, compressedBlob.size)
        toast.success('Video compressed!', {
          id: 'video-compression',
          description: `Reduced by ${ratio}% (${formatFileSize(file.size)} → ${formatFileSize(compressedBlob.size)})`
        })
      } catch (error) {
        console.error('Compression error:', error)
        setIsCompressing(false)
        toast.error('Compression failed', {
          id: 'video-compression',
          description: 'Using original video instead'
        })
        
        const videoUrl = URL.createObjectURL(file)
        setVideo(videoUrl)
        setCompressedSize(file.size)
      }
    }

    videoElement.onerror = () => {
      toast.error('Error loading video', {
        description: 'Could not read the video file'
      })
    }

    videoElement.src = URL.createObjectURL(file)
  }

  const removeVideo = () => {
    if (video?.startsWith('blob:')) {
      URL.revokeObjectURL(video)
    }
    setVideo(null)
    setVideoDuration(0)
    setOriginalSize(0)
    setCompressedSize(0)
    setCompressionProgress(0)
    if (videoInputRef.current) {
      videoInputRef.current.value = ''
    }
  }

  const photoCount = Object.values(energyPhotos).filter(Boolean).length

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        fullscreen
        hideClose
        className="flex flex-col gap-5 overflow-y-auto bg-background pt-5"
      >
        <DialogHeader className="gap-0 text-left">
          <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 text-[15px] font-semibold text-muted-foreground touch-manipulation"
            >
              Cancel
            </button>
            <DialogTitle className="sr-only">Quick pulse</DialogTitle>
            <button
              type="button"
              onClick={() => { void handleSubmit() }}
              disabled={isSubmitting || isCompressing}
              className="min-h-11 rounded-full bg-primary px-5 text-[15px] font-bold text-primary-foreground touch-manipulation disabled:opacity-50"
            >
              {isSubmitting ? 'Posting...' : 'Post'}
            </button>
          </div>
          <DialogDescription className="pt-3 text-[13px] text-muted-foreground">
            {venue ? `${venue.name} · from map pin` : 'What’s the vibe right now?'}
          </DialogDescription>
          {venue && (
            <div className="pt-3">
              <ComposerVenueChip
                name={venue.name}
                nearVenue={locationProof.reason === 'verified'}
              />
            </div>
          )}
        </DialogHeader>

        <div className="space-y-3.5 py-1">
          <div className="relative border-b border-border pb-2">
            <label htmlFor="create-pulse-caption" className="sr-only">
              Caption
            </label>
            <Textarea
              id="create-pulse-caption"
              placeholder="What's the vibe right now?"
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, QUICK_PULSE_CAPTION_MAX))}
              maxLength={QUICK_PULSE_CAPTION_MAX}
              rows={4}
              className="min-h-[120px] resize-none border-0 bg-transparent p-0 text-[20px] leading-7 text-foreground placeholder:text-muted-foreground shadow-none focus-visible:ring-0"
              aria-required="true"
              aria-describedby="create-pulse-caption-count create-pulse-location-proof"
            />
            <p id="create-pulse-caption-count" className="mt-2 text-[13px] text-muted-foreground">
              {caption.length} / {QUICK_PULSE_CAPTION_MAX}
            </p>
          </div>

          <div>
            <EnergyPills value={energyRating} onChange={setEnergyRating} />
            <div className="hidden">
              <EnergySlider
                value={energyRating}
                onChange={setEnergyRating}
                energyPhotos={energyPhotos}
                onAddPhoto={handlePhotoUpload}
                onRemovePhoto={removePhoto}
              />
            </div>
          </div>

          {video && (
            <div className="space-y-2">
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="relative aspect-video overflow-hidden rounded-[18px] bg-secondary"
              >
                <video
                  src={video}
                  controls
                  className="h-full w-full object-cover"
                >
                  Your browser does not support the video tag.
                </video>
                <button
                  onClick={removeVideo}
                  aria-label="Remove video"
                  className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 hover:bg-black transition-colors"
                >
                  <X size={16} weight="bold" className="text-white" />
                </button>
                <div className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-1 font-mono text-xs text-white">
                  {Math.round(videoDuration)}s
                </div>
                {compressedSize > 0 && originalSize > 0 && (
                  <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/70 px-2 py-1 font-mono text-xs text-white">
                    <CheckCircle size={12} weight="fill" className="text-accent" />
                    {formatFileSize(compressedSize)}
                  </div>
                )}
              </motion.div>
              {compressedSize > 0 && originalSize > 0 && originalSize !== compressedSize && (
                <p className="text-xs text-muted-foreground">
                  Compressed from {formatFileSize(originalSize)} (saved {getCompressionRatio(originalSize, compressedSize)}%)
                </p>
              )}
            </div>
          )}

          {isCompressing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Compressing video...</span>
                <span className="font-mono text-accent">{Math.round(compressionProgress)}%</span>
              </div>
              <Progress value={compressionProgress} className="h-2" />
            </div>
          )}

          {!video && !isCompressing && (
            <div>
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                onChange={handleVideoUpload}
                className="hidden"
                id="video-upload"
              />
              <button
                type="button"
                onClick={() => {
                  if (photoCount < 3) {
                    handlePhotoUpload(energyRating)
                    return
                  }
                  videoInputRef.current?.click()
                }}
                className="flex min-h-11 w-full flex-col items-center justify-center gap-0.5 rounded-full border border-dashed border-border bg-card px-3.5 py-3 text-center transition-colors hover:border-primary/60"
              >
                {photoCount > 0 ? (
                  <>
                    <p className="text-sm font-semibold text-foreground">
                      {photoCount} photo{photoCount === 1 ? '' : 's'} added
                    </p>
                    <p className="text-xs text-muted-foreground">Tap to add another · shows in Live now</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-foreground">Add photo (optional)</p>
                    <p className="text-xs text-muted-foreground">Shows in Live now</p>
                  </>
                )}
              </button>
            </div>
          )}

          <div id="create-pulse-location-proof" className="flex items-center gap-2">
            {locationProof.reason === 'verified' ? (
              <>
                <span className="inline-flex items-center rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground">
                  Near venue ✓
                </span>
                <span className="text-xs text-muted-foreground">Auto from map</span>
              </>
            ) : (
              <>
                <span className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                  Unverified
                </span>
                <span className="text-xs text-muted-foreground">
                  {locationProof.reason === 'outside_radius'
                    ? 'Outside check-in radius — will post unverified.'
                    : 'Location off — you can still post, marked unverified.'}
                </span>
              </>
            )}
          </div>

          {suggestedGroups.length > 0 && (
            <details className="rounded-xl border border-border bg-card p-3.5">
              <summary className="cursor-pointer text-sm font-semibold text-muted-foreground">
                Hashtags (optional)
              </summary>
              <div className="mt-3 space-y-3">
                {suggestedGroups.map((group, groupIndex) => (
                  <div key={groupIndex} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Hash size={14} weight="bold" className="text-muted-foreground" />
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {group.label}
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {group.hashtags.map((hashtag) => {
                        const isSelected = selectedHashtags.includes(hashtag.name)
                        const isSeeded = hashtag.seeded

                        return (
                          <motion.button
                            key={hashtag.id}
                            type="button"
                            onClick={() => toggleHashtag(hashtag.name)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <Badge
                              variant={isSelected ? "default" : "outline"}
                              className={`cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'hover:border-primary/50'
                              } ${
                                isSeeded && !isSelected ? 'border-dashed' : ''
                              }`}
                            >
                              <span className="mr-1">{hashtag.emoji}</span>
                              #{hashtag.name}
                            </Badge>
                          </motion.button>
                        )
                      })}
                    </div>
                  </div>
                ))}
                {selectedHashtags.length > 0 && (
                  <div className="border-t border-border pt-2">
                    <p className="text-xs text-muted-foreground">
                      {selectedHashtags.length}/5 hashtags selected
                    </p>
                  </div>
                )}
              </div>
            </details>
          )}

          <Button
            className={UX_CTA}
            onClick={handleSubmit}
            disabled={isSubmitting || isCompressing}
          >
            {isSubmitting ? 'Posting...' : 'Post · 1 tap'}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Photo optional · draft never lost
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
