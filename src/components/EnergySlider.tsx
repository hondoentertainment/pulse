import { useState } from 'react'
import { EnergyRating, ENERGY_CONFIG } from '@/lib/types'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Camera } from '@phosphor-icons/react'

interface EnergySliderProps {
  value: EnergyRating
  onChange: (value: EnergyRating) => void
  energyPhotos: Record<EnergyRating, string | null>
  onAddPhoto: (energy: EnergyRating) => void
  onRemovePhoto: (energy: EnergyRating) => void
}

const energyLevels: EnergyRating[] = ['dead', 'chill', 'buzzing', 'electric']

export function EnergySlider({ value, onChange, energyPhotos, onAddPhoto, onRemovePhoto }: EnergySliderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const currentIndex = energyLevels.indexOf(value)
  const currentConfig = ENERGY_CONFIG[value]
  const currentPhoto = energyPhotos[value]

  return (
    <div className="w-full space-y-6">
      <div className="text-center space-y-3">
        <div className="relative mx-auto w-32 h-32">
          <AnimatePresence mode="wait">
            {currentPhoto ? (
              <motion.div
                key={`${value}-${currentPhoto}`}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="w-32 h-32 rounded-2xl overflow-hidden border-4 shadow-lg"
                style={{ 
                  borderColor: currentConfig.color,
                  boxShadow: `0 8px 24px ${currentConfig.color}40`
                }}
              >
                <img
                  src={currentPhoto}
                  alt={`${currentConfig.label} energy`}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => onRemovePhoto(value)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/80 hover:bg-black flex items-center justify-center transition-colors shadow-lg z-10"
                  type="button"
                >
                  <X size={14} weight="bold" className="text-white" />
                </button>
              </motion.div>
            ) : (
              <motion.button
                key={`${value}-empty`}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.3 }}
                onClick={() => onAddPhoto(value)}
                className="w-32 h-32 rounded-2xl border-4 border-dashed shadow-lg flex flex-col items-center justify-center gap-2 hover:bg-secondary/50 transition-colors"
                style={{ 
                  borderColor: currentConfig.color,
                  boxShadow: `0 8px 24px ${currentConfig.color}20`
                }}
                type="button"
              >
                <Camera size={32} weight="fill" style={{ color: currentConfig.color, opacity: 0.6 }} />
                <span className="text-xs font-medium" style={{ color: currentConfig.color }}>
                  Add Photo
                </span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
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
                className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs relative"
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
                {energyPhotos[level] && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full border border-background" style={{ backgroundColor: ENERGY_CONFIG[level].color }} />
                )}
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
