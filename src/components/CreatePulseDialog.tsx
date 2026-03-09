import { useState, useRef, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { EnergySlider } from './EnergySlider'
import { EnergyRating, Venue, Hashtag, HashtagSuggestionContext } from '@/lib/types'
import { X, VideoCamera, CheckCircle, Hash } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { compressVideo, formatFileSize, getCompressionRatio } from '@/lib/video-compression'
import { suggestHashtags, getTimeOfDay, getDayOfWeek } from '@/lib/seeded-hashtags'
import { useKV } from '@github/spark/hooks'

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
  const [allHashtags] = useKV<Hashtag[]>('hashtags', [])
  const [suggestedGroups, setSuggestedGroups] = useState<{ hashtags: Hashtag[]; label: string }[]>([])

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

  const handleSubmit = async () => {
    if (!venue) return
    
    const photos = Object.values(energyPhotos).filter((photo): photo is string => photo !== null)
    
    setIsSubmitting(true)
    await onSubmit({ 
      energyRating, 
      caption, 
      photos, 
      video: video || undefined,
      hashtags: selectedHashtags
    })
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            Create Pulse at {venue?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div>
            <label className="text-sm font-medium mb-3 block">How's the energy?</label>
            <EnergySlider 
              value={energyRating} 
              onChange={setEnergyRating}
              energyPhotos={energyPhotos}
              onAddPhoto={handlePhotoUpload}
              onRemovePhoto={removePhoto}
            />
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
            <label className="text-sm font-medium">
              Caption <span className="text-muted-foreground">(optional)</span>
            </label>
            <Textarea
              placeholder="What's the vibe?"
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, 140))}
              maxLength={140}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">
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
              disabled={isSubmitting || isCompressing}
            >
              {isSubmitting ? 'Posting...' : 'Post Pulse'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
