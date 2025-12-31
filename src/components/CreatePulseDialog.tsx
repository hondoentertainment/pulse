import { useState, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { EnergySlider } from './EnergySlider'
import { EnergyRating, Venue } from '@/lib/types'
import { Camera, X, VideoCamera, Play } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

interface CreatePulseDialogProps {
  open: boolean
  onClose: () => void
  venue: Venue | null
  onSubmit: (data: {
    energyRating: EnergyRating
    caption: string
    photos: string[]
    video?: string
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
  const [photos, setPhotos] = useState<string[]>([])
  const [video, setVideo] = useState<string | null>(null)
  const [videoDuration, setVideoDuration] = useState<number>(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const videoInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async () => {
    if (!venue) return
    
    setIsSubmitting(true)
    await onSubmit({ energyRating, caption, photos, video: video || undefined })
    setIsSubmitting(false)
    
    setEnergyRating('chill')
    setCaption('')
    setPhotos([])
    setVideo(null)
    setVideoDuration(0)
    onClose()
  }

  const handlePhotoUpload = () => {
    const mockPhotos = [
      'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&q=80',
      'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=800&q=80',
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80'
    ]
    const randomPhoto = mockPhotos[Math.floor(Math.random() * mockPhotos.length)]
    if (photos.length < 3) {
      setPhotos([...photos, randomPhoto])
    }
  }

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index))
  }

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('video/')) {
      toast.error('Invalid file type', {
        description: 'Please select a video file'
      })
      return
    }

    const videoElement = document.createElement('video')
    videoElement.preload = 'metadata'
    
    videoElement.onloadedmetadata = () => {
      window.URL.revokeObjectURL(videoElement.src)
      
      if (videoElement.duration > 30) {
        toast.error('Video too long', {
          description: 'Videos must be 30 seconds or less'
        })
        return
      }

      const videoUrl = URL.createObjectURL(file)
      setVideo(videoUrl)
      setVideoDuration(videoElement.duration)
      toast.success('Video added!', {
        description: `${Math.round(videoElement.duration)}s video ready to post`
      })
    }

    videoElement.onerror = () => {
      toast.error('Error loading video', {
        description: 'Could not read the video file'
      })
    }

    videoElement.src = URL.createObjectURL(file)
  }

  const handleMockVideoUpload = () => {
    const mockVideos = [
      'https://videos.pexels.com/video-files/3015486/3015486-uhd_2560_1440_24fps.mp4',
      'https://videos.pexels.com/video-files/3141206/3141206-uhd_2560_1440_25fps.mp4',
      'https://videos.pexels.com/video-files/2611250/2611250-uhd_2560_1440_30fps.mp4'
    ]
    const randomVideo = mockVideos[Math.floor(Math.random() * mockVideos.length)]
    setVideo(randomVideo)
    setVideoDuration(15)
    toast.success('Demo video added!', {
      description: '15s video ready to post'
    })
  }

  const removeVideo = () => {
    if (video?.startsWith('blob:')) {
      URL.revokeObjectURL(video)
    }
    setVideo(null)
    setVideoDuration(0)
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
            <EnergySlider value={energyRating} onChange={setEnergyRating} />
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
              </motion.div>
            </div>
          )}

          {photos.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Photos</label>
              <div className="grid grid-cols-3 gap-2">
                {photos.map((photo, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="relative aspect-square rounded-lg overflow-hidden bg-secondary"
                  >
                    <img
                      src={photo}
                      alt={`Upload ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => removePhoto(idx)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center hover:bg-black transition-colors"
                    >
                      <X size={14} weight="bold" className="text-white" />
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {!video && (
              <>
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleVideoUpload}
                  className="hidden"
                  id="video-upload"
                />
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleMockVideoUpload}
                  type="button"
                >
                  <VideoCamera size={20} weight="fill" className="mr-2" />
                  Add Video (max 30s)
                </Button>
              </>
            )}
            {photos.length < 3 && !video && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={handlePhotoUpload}
                type="button"
              >
                <Camera size={20} weight="fill" className="mr-2" />
                Add Photo ({photos.length}/3)
              </Button>
            )}
          </div>

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
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Posting...' : 'Post Pulse'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
