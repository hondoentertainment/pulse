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
import { EnergyRating, Venue, Hashtag, HashtagSuggestionContext, ENERGY_CONFIG } from '@/lib/types'
import { X, VideoCamera, CheckCircle, Hash, Camera, Sparkle } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { compressVideo, formatFileSize, getCompressionRatio } from '@/lib/video-compression'
import { screenContent } from '@/lib/content-moderation'
import { moderateServer } from '@/lib/moderation-client'
import { track } from '@/lib/observability/analytics'
import { suggestHashtags, getTimeOfDay, getDayOfWeek } from '@/lib/seeded-hashtags'
import { useKV } from '@github/spark/hooks'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { Platform } from '@/lib/platform/platform'
import {
  vibeTagsToHashtagNames,
  VIBE_CONFIDENCE_APPLY_THRESHOLD,
} from '@/lib/vibe-assess-client'
import {
  assessPreparedPhoto,
  photosForPulseSubmit,
  preparePulsePhoto,
  type PreparedPulsePhoto,
  type VibeAssessment,
} from '@/lib/vibe-photo-flow'

interface CreatePulseDialogProps {
  open: boolean
  onClose: () => void
  venue: Venue | null
  onSubmit: (data: {
    energyRating: EnergyRating
    caption: string
    photos: string[]
    video?: string
    hashtags?: string[]
  }) => void
}

export function CreatePulseDialog({
  open,
  onClose,
  venue,
  onSubmit
}: CreatePulseDialogProps) {
  const [energyRating, setEnergyRating] = useState<EnergyRating>('chill')
  const [caption, setCaption] = useState('')
  const [selectedHashtags, setSelectedHashtags] = useState<string[]>([])
  const [pulsePhoto, setPulsePhoto] = useState<PreparedPulsePhoto | null>(null)
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
  const [isWorkingPhoto, setIsWorkingPhoto] = useState(false)
  const [vibeAssessment, setVibeAssessment] = useState<VibeAssessment | null>(null)
  /** When true, user explicitly kept/overrode the AI energy suggestion. */
  const [energyOverridden, setEnergyOverridden] = useState(false)
  const [userEnergyBeforeAssess, setUserEnergyBeforeAssess] = useState<EnergyRating | null>(null)
  const vibeVisionEnabled = isFeatureEnabled('vibeVision')

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

  const applyVibeTagHashtags = (assessment: VibeAssessment) => {
    const names = vibeTagsToHashtagNames(assessment.tags)
    if (names.length === 0) return
    setSelectedHashtags((prev) => {
      const next = [...prev]
      for (const name of names) {
        if (next.length >= 5) break
        if (!next.includes(name)) next.push(name)
      }
      return next
    })
  }

  const handleSubmit = async () => {
    if (!venue) return

    const photos = photosForPulseSubmit(pulsePhoto)

    const contentIssues = screenContent(caption)
    if (contentIssues.length > 0) {
      toast.error(contentIssues[0])
      return
    }

    setIsSubmitting(true)

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
      caption,
      photos,
      video: video || undefined,
      hashtags: selectedHashtags
    })

    track('pulse_created', {
      pulseId: `pulse-${Date.now()}`,
      venueId: venue.id,
      hasPhoto: photos.length > 0,
      hashtagCount: selectedHashtags.length,
      energyRating,
      vibeAssessed: Boolean(vibeAssessment),
      isFirstPulse: !hasSubmittedFirstPulse.current,
    })
    hasSubmittedFirstPulse.current = true

    setIsSubmitting(false)

    setEnergyRating('chill')
    setCaption('')
    setSelectedHashtags([])
    setPulsePhoto(null)
    setVibeAssessment(null)
    setEnergyOverridden(false)
    setUserEnergyBeforeAssess(null)
    setVideo(null)
    setVideoDuration(0)
    setOriginalSize(0)
    setCompressedSize(0)
    setCompressionProgress(0)
    onClose()
  }

  const clearPhoto = () => {
    setPulsePhoto(null)
    setVibeAssessment(null)
    setEnergyOverridden(false)
    setUserEnergyBeforeAssess(null)
  }

  const applyAssessment = (
    assessment: VibeAssessment,
    prepared: PreparedPulsePhoto,
    opts?: { forceEnergy?: boolean },
  ) => {
    if (!venue) return
    setVibeAssessment(assessment)
    setEnergyOverridden(false)

    const shouldApply =
      Boolean(opts?.forceEnergy) ||
      (assessment.applyEnergy !== false &&
        assessment.confidence >=
          (assessment.confidenceThreshold ?? VIBE_CONFIDENCE_APPLY_THRESHOLD))

    if (shouldApply) {
      setUserEnergyBeforeAssess(energyRating)
      setEnergyRating(assessment.energyRating)
    }

    if (!caption.trim() && assessment.suggestedCaption && shouldApply) {
      setCaption(assessment.suggestedCaption.slice(0, 140))
    }
    applyVibeTagHashtags(assessment)

    track('vibe_assessed_from_photo', {
      venueId: venue.id,
      energyRating: assessment.energyRating,
      confidence: assessment.confidence,
      tagCount: assessment.tags.length,
      uploaded: Boolean(prepared.storageKey),
      applied: shouldApply,
      lowConfidence: !shouldApply,
    })

    if (shouldApply) {
      toast.success(`Looks ${ENERGY_CONFIG[assessment.energyRating].label}`, {
        id: 'pulse-photo',
        description: assessment.summary,
      })
    } else {
      toast.message('Unsure about the vibe — pick manually', {
        id: 'pulse-photo',
        description: assessment.summary,
      })
    }
  }

  const runAssessOnCurrentPhoto = async (prepared: PreparedPulsePhoto, dataUrl: string) => {
    if (!venue) return
    const result = await assessPreparedPhoto({
      photo: prepared,
      dataUrl,
      venueName: venue.name,
      venueCategory: venue.category,
      venueId: venue.id,
      source: 'create_pulse',
    })

    if (!result.ok) {
      if (result.code === 'content_blocked') {
        toast.error('Photo blocked by safety screening', {
          id: 'pulse-photo',
          description: result.message,
        })
        track('vibe_assess_blocked', {
          venueId: venue.id,
          reason: result.blockedReason ?? 'unknown',
        })
        clearPhoto()
        return
      }
      if (result.code === 'cap_reached') {
        toast.error('Daily vibe vision limit reached', {
          id: 'pulse-photo',
          description: result.message,
        })
        track('vibe_assess_cap_hit', { venueId: venue.id, surface: 'create_pulse' })
        return
      }
      toast.error('Photo saved, but vibe assess failed', {
        id: 'pulse-photo',
        description: result.message,
      })
      return
    }

    applyAssessment(result.assessment, prepared)
  }

  const handleAddPhoto = async (opts: { assess: boolean }) => {
    if (!venue || isWorkingPhoto) return

    const picked = await Platform.camera.pick({ source: 'prompt', quality: 70 })
    if (!picked?.dataUrl) {
      toast.error('No photo selected')
      return
    }

    setIsWorkingPhoto(true)
    toast.loading(opts.assess ? 'Uploading & reading vibe…' : 'Uploading photo…', {
      id: 'pulse-photo',
    })

    const prepared = await preparePulsePhoto({
      dataUrl: picked.dataUrl,
      format: picked.format,
      blob: picked.blob,
    })
    setPulsePhoto(prepared)

    if (!opts.assess || !vibeVisionEnabled) {
      setIsWorkingPhoto(false)
      toast.success(prepared.storageKey ? 'Photo added' : 'Photo added (local preview)', {
        id: 'pulse-photo',
      })
      return
    }

    await runAssessOnCurrentPhoto(prepared, prepared.previewUrl)
    setIsWorkingPhoto(false)
  }

  const handleReassess = async () => {
    if (!venue || !pulsePhoto || isWorkingPhoto) return
    setIsWorkingPhoto(true)
    toast.loading('Re-reading vibe…', { id: 'pulse-photo' })
    await runAssessOnCurrentPhoto(pulsePhoto, pulsePhoto.previewUrl)
    setIsWorkingPhoto(false)
  }

  const handleKeepMyRating = () => {
    if (userEnergyBeforeAssess) {
      setEnergyRating(userEnergyBeforeAssess)
    }
    setEnergyOverridden(true)
    track('vibe_assess_overridden', {
      venueId: venue?.id ?? 'unknown',
      aiEnergy: vibeAssessment?.energyRating,
      keptEnergy: userEnergyBeforeAssess ?? energyRating,
    })
    toast.message('Keeping your energy rating')
  }

  const handleApplyAiEnergy = () => {
    if (!vibeAssessment) return
    setUserEnergyBeforeAssess(energyRating)
    setEnergyRating(vibeAssessment.energyRating)
    setEnergyOverridden(false)
    if (!caption.trim() && vibeAssessment.suggestedCaption) {
      setCaption(vibeAssessment.suggestedCaption.slice(0, 140))
    }
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            Photo review at {venue?.name}
          </DialogTitle>
          <DialogDescription>
            Share what it&apos;s like right now. Live reviews fade after 90 minutes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div>
            <label className="text-sm font-medium mb-3 block">What&apos;s the vibe right now?</label>
            <EnergySlider
              value={energyRating}
              onChange={setEnergyRating}
            />
          </div>

          <div className="space-y-3">
            {pulsePhoto ? (
              <div className="relative overflow-hidden rounded-xl bg-secondary aspect-[4/3]">
                <img
                  src={pulsePhoto.previewUrl}
                  alt="Venue photo"
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={clearPhoto}
                  aria-label="Remove photo"
                  className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black"
                >
                  <X size={16} weight="bold" />
                </button>
                {vibeAssessment && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-3 pt-8 text-white">
                    <p className="text-sm font-medium">
                      {ENERGY_CONFIG[vibeAssessment.energyRating].emoji}{' '}
                      {ENERGY_CONFIG[vibeAssessment.energyRating].label}
                      <span className="ml-2 text-xs font-normal opacity-80">
                        {Math.round(vibeAssessment.confidence * 100)}% match
                        {vibeAssessment.confidence < VIBE_CONFIDENCE_APPLY_THRESHOLD
                          ? ' · low confidence'
                          : ''}
                        {energyOverridden ? ' · using yours' : ''}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs opacity-90">{vibeAssessment.summary}</p>
                    {vibeAssessment.tags.length > 0 && (
                      <p className="mt-1 text-[11px] opacity-70">
                        {vibeAssessment.tags.map((t) => `#${t}`).join(' · ')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  disabled={isWorkingPhoto || isSubmitting}
                  onClick={() => void handleAddPhoto({ assess: false })}
                >
                  <Camera size={20} weight="fill" className="mr-2" />
                  {isWorkingPhoto ? 'Working…' : 'Add photo'}
                </Button>
                {vibeVisionEnabled && (
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    disabled={isWorkingPhoto || isSubmitting}
                    onClick={() => void handleAddPhoto({ assess: true })}
                  >
                    {isWorkingPhoto ? (
                      <>
                        <Sparkle size={20} weight="fill" className="mr-2 animate-pulse" />
                        Reading vibe…
                      </>
                    ) : (
                      <>
                        <Sparkle size={20} weight="fill" className="mr-2" />
                        Assess vibe from photo
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
            {pulsePhoto && vibeVisionEnabled && (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isWorkingPhoto || isSubmitting}
                  onClick={() => void handleReassess()}
                >
                  <Sparkle size={16} weight="fill" className="mr-1.5" />
                  Re-scan vibe
                </Button>
                {vibeAssessment &&
                  energyRating === vibeAssessment.energyRating &&
                  !energyOverridden && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isWorkingPhoto}
                      onClick={handleKeepMyRating}
                    >
                      Keep my rating
                    </Button>
                  )}
                {vibeAssessment &&
                  (energyOverridden || energyRating !== vibeAssessment.energyRating) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isWorkingPhoto}
                      onClick={handleApplyAiEnergy}
                    >
                      Use AI rating
                    </Button>
                  )}
              </div>
            )}
          </div>

          {video && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Video</label>
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="relative rounded-lg overflow-hidden bg-secondary aspect-video"
              >
                <video
                  src={video}
                  controls
                  className="w-full h-full object-cover"
                >
                  Your browser does not support the video tag.
                </video>
                <button
                  onClick={removeVideo}
                  aria-label="Remove video"
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/70 flex items-center justify-center hover:bg-black transition-colors"
                >
                  <X size={16} weight="bold" className="text-white" />
                </button>
                <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-black/70 text-white text-xs font-mono">
                  {Math.round(videoDuration)}s
                </div>
                {compressedSize > 0 && originalSize > 0 && (
                  <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/70 text-white text-xs font-mono flex items-center gap-1">
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
            <div className="flex gap-2">
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                onChange={handleVideoUpload}
                className="hidden"
                id="video-upload"
              />
              <label htmlFor="video-upload" className="flex-1">
                <Button
                  variant="outline"
                  className="w-full"
                  type="button"
                  asChild
                >
                  <span>
                    <VideoCamera size={20} weight="fill" className="mr-2" />
                    Add Video (max 30s)
                  </span>
                </Button>
              </label>
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="create-pulse-caption" className="text-sm font-medium">
              Caption <span className="text-muted-foreground">(optional)</span>
            </label>
            <Textarea
              id="create-pulse-caption"
              placeholder="Tip for others — line, music, crowd…"
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, 140))}
              maxLength={140}
              rows={3}
              className="resize-none"
              aria-describedby="create-pulse-caption-count"
            />
            <p id="create-pulse-caption-count" className="text-xs text-muted-foreground text-right">
              {caption.length}/140
            </p>
          </div>

          {suggestedGroups.length > 0 && (
            <div className="space-y-3">
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
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    {selectedHashtags.length}/5 hashtags selected
                  </p>
                </div>
              )}
            </div>
          )}

          {vibeAssessment && selectedHashtags.length > 0 && suggestedGroups.length === 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedHashtags.map((name) => (
                <Badge
                  key={name}
                  variant="default"
                  className="cursor-pointer"
                  onClick={() => toggleHashtag(name)}
                >
                  #{name}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-primary hover:bg-primary/90"
              onClick={handleSubmit}
              disabled={isSubmitting || isCompressing || isWorkingPhoto}
            >
              {isSubmitting ? 'Posting...' : 'Post live review'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
