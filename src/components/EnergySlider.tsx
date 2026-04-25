import { useState, useRef } from 'react'
import { EnergyRating, ENERGY_CONFIG } from '@/lib/types'
import { motion, AnimatePresence } from 'framer-motion'
import { triggerEnergyChangeHaptic } from '@/lib/haptics'

interface EnergySliderProps {
  value: EnergyRating
  onChange: (value: EnergyRating) => void
  energyPhotos: Record<EnergyRating, string | null>
  onAddPhoto: (energy: EnergyRating) => void
  onRemovePhoto: (energy: EnergyRating) => void
}

const energyLevels: EnergyRating[] = ['dead', 'chill', 'buzzing', 'electric']

export function EnergySlider({ value, onChange }: EnergySliderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const previousIndexRef = useRef(energyLevels.indexOf(value))
  const currentIndex = energyLevels.indexOf(value)
  const currentConfig = ENERGY_CONFIG[value]

  const handleEnergyChange = (newIndex: number) => {
    const clamped = Math.max(0, Math.min(energyLevels.length - 1, newIndex))
    const newValue = energyLevels[clamped]

    if (clamped !== previousIndexRef.current) {
      triggerEnergyChangeHaptic(previousIndexRef.current, clamped)
      previousIndexRef.current = clamped
    }

    onChange(newValue)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Native range input handles arrow keys, but we also support Home/End
    // for better keyboard parity.
    if (e.key === 'Home') {
      e.preventDefault()
      handleEnergyChange(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      handleEnergyChange(energyLevels.length - 1)
    }
  }

  return (
    <div className="w-full space-y-6">
      <div className="text-center space-y-3">
        <div className="relative mx-auto w-32 h-32">
          <AnimatePresence mode="wait">
            <motion.div
              key={value}
              initial={{ scale: 0.9, opacity: 0, rotate: -10 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.9, opacity: 0, rotate: 10 }}
              transition={{ 
                type: 'spring',
                stiffness: 300,
                damping: 20
              }}
              className="w-32 h-32 rounded-2xl border-4 shadow-lg flex items-center justify-center"
              style={{ 
                borderColor: currentConfig.color,
                boxShadow: `0 8px 24px ${currentConfig.color}40`,
                backgroundColor: `${currentConfig.color}15`
              }}
            >
              <span className="text-7xl">{currentConfig.emoji}</span>
            </motion.div>
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
            onChange={(e) => handleEnergyChange(Number(e.target.value))}
            onKeyDown={handleKeyDown}
            onMouseDown={() => setIsDragging(true)}
            onMouseUp={() => setIsDragging(false)}
            onTouchStart={() => setIsDragging(true)}
            onTouchEnd={() => setIsDragging(false)}
            role="slider"
            aria-label="Energy level"
            aria-valuemin={0}
            aria-valuemax={energyLevels.length - 1}
            aria-valuenow={currentIndex}
            aria-valuetext={currentConfig.label}
            aria-orientation="horizontal"
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
