import { useState } from 'react'
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
import { Camera, X } from '@phosphor-icons/react'
import { motion } from 'framer-motion'

interface CreatePulseDialogProps {
  open: boolean
  onClose: () => void
  venue: Venue | null
  onSubmit: (data: {
    energyRating: EnergyRating
    caption: string
    photos: string[]
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
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!venue) return
    
    setIsSubmitting(true)
    await onSubmit({ energyRating, caption, photos })
    setIsSubmitting(false)
    
    setEnergyRating('chill')
    setCaption('')
    setPhotos([])
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

          {photos.length < 3 && (
            <Button
              variant="outline"
              className="w-full"
              onClick={handlePhotoUpload}
              type="button"
            >
              <Camera size={20} weight="fill" className="mr-2" />
              Add Photo ({photos.length}/3)
            </Button>
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
