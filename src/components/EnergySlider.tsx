import { useState } from 'react'
import { EnergyRating, ENERGY_CONFIG } from '@/lib/types'
import { motion, AnimatePresence } from 'framer-motion'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'

interface EnergySliderProps {
  value: EnergyRating
  onChange: (value: EnergyRating) => void
  photos?: string[]
}

const energyLevels: EnergyRating[] = ['dead', 'chill', 'buzzing', 'electric']

export function EnergySlider({ value, onChange, photos = [] }: EnergySliderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)
  const currentIndex = energyLevels.indexOf(value)
  const currentConfig = ENERGY_CONFIG[value]

  const hasPhotos = photos.length > 0
  const hasMultiplePhotos = photos.length > 1

  const nextPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev + 1) % photos.length)
  }

  const prevPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length)
  }

  return (
    <div className="w-full space-y-6">
      <div className="text-center space-y-3">
        {hasPhotos ? (
          <div className="relative mx-auto w-32 h-32">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${photos[currentPhotoIndex]}-${currentPhotoIndex}`}
                initial={{ scale: 0.9, opacity: 0, rotateY: -20 }}
                animate={{ scale: 1, opacity: 1, rotateY: 0 }}
                exit={{ scale: 0.9, opacity: 0, rotateY: 20 }}
                transition={{ duration: 0.3 }}
                className="w-32 h-32 rounded-2xl overflow-hidden border-4 shadow-lg"
                style={{ 
                  borderColor: currentConfig.color,
                  boxShadow: `0 8px 24px ${currentConfig.color}40`
                }}
              >
                <img
                  src={photos[currentPhotoIndex]}
                  alt={`Preview ${currentPhotoIndex + 1}`}
                  className="w-full h-full object-cover"
                />
              </motion.div>
            </AnimatePresence>

            {hasMultiplePhotos && (
              <>
                <button
                  onClick={prevPhoto}
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 w-8 h-8 rounded-full bg-black/70 hover:bg-black flex items-center justify-center transition-colors shadow-lg"
                  type="button"
                >
                  <CaretLeft size={16} weight="bold" className="text-white" />
                </button>
                <button
                  onClick={nextPhoto}
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 w-8 h-8 rounded-full bg-black/70 hover:bg-black flex items-center justify-center transition-colors shadow-lg"
                  type="button"
                >
                  <CaretRight size={16} weight="bold" className="text-white" />
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {photos.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentPhotoIndex(idx)}
                      className="w-1.5 h-1.5 rounded-full transition-all"
                      style={{
                        backgroundColor: idx === currentPhotoIndex ? currentConfig.color : 'rgba(255,255,255,0.5)',
                        boxShadow: idx === currentPhotoIndex ? `0 0 8px ${currentConfig.color}` : 'none'
                      }}
                      type="button"
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <motion.div
            key={value}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-6xl"
          >
            {currentConfig.emoji}
          </motion.div>
        )}
        <motion.div
          key={value}
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-2xl font-bold"
          style={{ color: currentConfig.color }}
        >
          {currentConfig.label}
        </motion.div>
      </div>

      <div className="relative px-4">
        <div className="h-2 rounded-full bg-secondary overflow-hidden">
          <motion.div
            className="h-full"
            style={{
              background: `linear-gradient(to right, ${ENERGY_CONFIG.dead.color}, ${ENERGY_CONFIG.chill.color}, ${ENERGY_CONFIG.buzzing.color}, ${ENERGY_CONFIG.electric.color})`
            }}
            initial={{ opacity: 0.3 }}
            animate={{ opacity: isDragging ? 0.8 : 0.6 }}
          />
        </div>

        <div className="relative mt-1">
          <input
            type="range"
            min="0"
            max="3"
            step="1"
            value={currentIndex}
            onChange={(e) => onChange(energyLevels[Number(e.target.value)])}
            onMouseDown={() => setIsDragging(true)}
            onMouseUp={() => setIsDragging(false)}
            onTouchStart={() => setIsDragging(true)}
            onTouchEnd={() => setIsDragging(false)}
            className="absolute inset-0 w-full h-8 -mt-5 opacity-0 cursor-pointer z-10"
          />
          
          <div className="flex justify-between px-2 pointer-events-none">
            {energyLevels.map((level, idx) => (
              <motion.div
                key={level}
                className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs"
                style={{
                  borderColor: currentConfig.color,
                  backgroundColor: idx <= currentIndex ? currentConfig.color : 'transparent'
                }}
                animate={{
                  scale: idx === currentIndex ? (isDragging ? 1.4 : 1.2) : 1,
                  boxShadow: idx === currentIndex ? `0 0 20px ${currentConfig.color}` : 'none'
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                {idx <= currentIndex && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-xs"
                  >
                    {ENERGY_CONFIG[level].emoji}
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
