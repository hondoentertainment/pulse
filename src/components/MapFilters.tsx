import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Faders, X, Lightning, Fire, MapPin, Microphone, MicrophoneSlash } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useUnitPreference } from '@/hooks/use-unit-preference'
import { useVoiceFilter } from '@/hooks/use-voice-filter'

export type EnergyFilter = 'all' | 'dead' | 'chill' | 'buzzing' | 'electric'
export type DistanceFilter = 0.3 | 0.6 | 1.2 | 3.1 | typeof Infinity

export interface MapFiltersState {
  energyLevels: EnergyFilter[]
  categories: string[]
  maxDistance: DistanceFilter
}

interface MapFiltersProps {
  filters: MapFiltersState
  onChange: (filters: MapFiltersState) => void
  availableCategories: string[]
}

const ENERGY_LEVELS = [
  { value: 'dead' as const, label: 'Dead', color: 'oklch(0.35 0.05 240)', emoji: '💀' },
  { value: 'chill' as const, label: 'Chill', color: 'oklch(0.60 0.15 150)', emoji: '😌' },
  { value: 'buzzing' as const, label: 'Buzzing', color: 'oklch(0.70 0.22 60)', emoji: '🔥' },
  { value: 'electric' as const, label: 'Electric', color: 'oklch(0.65 0.28 340)', emoji: '⚡' }
]

const DISTANCE_OPTIONS_MILES = [
  { value: 0.3, labelMi: '0.3mi', labelKm: '0.5km' },
  { value: 0.6, labelMi: '0.6mi', labelKm: '1km' },
  { value: 1.2, labelMi: '1.2mi', labelKm: '2km' },
  { value: 3.1, labelMi: '3mi', labelKm: '5km' },
  { value: Infinity, labelMi: 'All', labelKm: 'All' }
]

export function MapFilters({ filters, onChange, availableCategories }: MapFiltersProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { unitSystem } = useUnitPreference()
  const {
    isListening,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
    isSupported,
    parseVoiceCommand,
    applyVoiceFilters
  } = useVoiceFilter(availableCategories, onChange)

  const toggleEnergyLevel = (level: EnergyFilter) => {
    if (level === 'all') {
      onChange({
        ...filters,
        energyLevels: []
      })
    } else {
      const newLevels = filters.energyLevels.includes(level)
        ? filters.energyLevels.filter((l) => l !== level)
        : [...filters.energyLevels, level]
      onChange({
        ...filters,
        energyLevels: newLevels
      })
    }
  }

  const toggleCategory = (category: string) => {
    const newCategories = filters.categories.includes(category)
      ? filters.categories.filter((c) => c !== category)
      : [...filters.categories, category]
    onChange({
      ...filters,
      categories: newCategories
    })
  }

  const setDistance = (distance: DistanceFilter) => {
    onChange({
      ...filters,
      maxDistance: distance
    })
  }

  const clearAllFilters = () => {
    onChange({
      energyLevels: [],
      categories: [],
      maxDistance: Infinity
    })
  }

  const activeFilterCount =
    filters.energyLevels.length +
    filters.categories.length +
    (filters.maxDistance !== Infinity ? 1 : 0)

  const handleVoiceToggle = () => {
    if (isListening) {
      stopListening()
    } else {
      resetTranscript()
      startListening()
    }
  }

  useEffect(() => {
    if (!isListening && transcript) {
      const result = parseVoiceCommand(transcript)
      if (result) {
        applyVoiceFilters(result, filters)
      }
      resetTranscript()
    }
  }, [isListening, transcript, parseVoiceCommand, applyVoiceFilters, filters, resetTranscript])

  return (
    <>
      <Button
        size="icon"
        variant="secondary"
        className={cn(
          'bg-card/95 backdrop-blur-sm hover:bg-card shadow-lg relative',
          activeFilterCount > 0 && 'ring-2 ring-[#E1306C]'
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Faders size={20} weight="bold" />
        {activeFilterCount > 0 && (
          <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-gradient-to-r from-[#E1306C] to-[#F77737] text-white text-xs border-0">
            {activeFilterCount}
          </Badge>
        )}
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="absolute top-0 right-16 w-80 max-w-[calc(100vw-5rem)] z-50"
          >
            <Card className="bg-card/95 backdrop-blur-xl border-white/10 shadow-2xl rounded-2xl">
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Faders size={20} weight="bold" />
                    <h3 className="font-semibold text-lg">Filters</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {activeFilterCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearAllFilters}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Clear all
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setIsOpen(false)}
                      className="h-8 w-8"
                    >
                      <X size={18} />
                    </Button>
                  </div>
                </div>

                {isSupported && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Microphone size={16} weight="fill" className="text-[#E1306C]" />
                        <h4 className="font-semibold text-sm">Voice Filter</h4>
                      </div>
                      <Button
                        variant={isListening ? 'default' : 'outline'}
                        size="sm"
                        onClick={handleVoiceToggle}
                        className={cn(
                          'w-full gap-2',
                          isListening && 'bg-[#E1306C] text-white animate-pulse-glow'
                        )}
                      >
                        {isListening ? (
                          <>
                            <MicrophoneSlash size={16} weight="fill" />
                            <span>Listening...</span>
                          </>
                        ) : (
                          <>
                            <Microphone size={16} weight="fill" />
                            <span>Tap to speak</span>
                          </>
                        )}
                      </Button>
                      {transcript && (
                        <div className="text-xs text-muted-foreground bg-muted rounded-lg p-2">
                          "{transcript}"
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p className="font-semibold">Try saying:</p>
                        <ul className="list-disc list-inside space-y-0.5 ml-2">
                          <li>"Show electric venues"</li>
                          <li>"Filter buzzing or chill"</li>
                          <li>"Find bars"</li>
                          <li>"Clear filters"</li>
                        </ul>
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                <ScrollArea className="max-h-[60vh]">
                  <div className="space-y-6 pr-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Lightning size={16} weight="fill" className="text-[#FCAF45]" />
                        <h4 className="font-semibold text-sm">Energy Level</h4>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant={filters.energyLevels.length === 0 ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleEnergyLevel('all')}
                          className={cn(
                            "h-9 rounded-full",
                            filters.energyLevels.length === 0 && "bg-gradient-to-r from-[#833AB4] via-[#E1306C] to-[#F77737] border-0 text-white hover:opacity-90"
                          )}
                        >
                          All
                        </Button>
                        {ENERGY_LEVELS.map((level) => (
                          <Button
                            key={level.value}
                            variant={
                              filters.energyLevels.includes(level.value) ? 'default' : 'outline'
                            }
                            size="sm"
                            onClick={() => toggleEnergyLevel(level.value)}
                            className={cn(
                              "h-9 gap-2 rounded-full",
                              filters.energyLevels.includes(level.value) && "bg-gradient-to-r from-[#833AB4] via-[#E1306C] to-[#F77737] border-0 text-white hover:opacity-90"
                            )}
                          >
                            <span>{level.emoji}</span>
                            <span>{level.label}</span>
                          </Button>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Fire size={16} weight="fill" className="text-[#F77737]" />
                        <h4 className="font-semibold text-sm">Category</h4>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {availableCategories.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No categories available</p>
                        ) : (
                          <>
                            <Button
                              variant={filters.categories.length === 0 ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => onChange({ ...filters, categories: [] })}
                              className={cn(
                                "h-9 rounded-full",
                                filters.categories.length === 0 && "bg-gradient-to-r from-[#833AB4] via-[#E1306C] to-[#F77737] border-0 text-white hover:opacity-90"
                              )}
                            >
                              All
                            </Button>
                            {availableCategories.map((category) => (
                              <Button
                                key={category}
                                variant={
                                  filters.categories.includes(category) ? 'default' : 'outline'
                                }
                                size="sm"
                                onClick={() => toggleCategory(category)}
                                className={cn(
                                  "h-9 rounded-full",
                                  filters.categories.includes(category) && "bg-gradient-to-r from-[#833AB4] via-[#E1306C] to-[#F77737] border-0 text-white hover:opacity-90"
                                )}
                              >
                                {category}
                              </Button>
                            ))}
                          </>
                        )}
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <MapPin size={16} weight="fill" className="text-[#405DE6]" />
                        <h4 className="font-semibold text-sm">Distance</h4>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {DISTANCE_OPTIONS_MILES.map((option) => (
                          <Button
                            key={option.value}
                            variant={filters.maxDistance === option.value ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setDistance(option.value)}
                            className={cn(
                              "h-9 rounded-full",
                              filters.maxDistance === option.value && "bg-gradient-to-r from-[#833AB4] via-[#E1306C] to-[#F77737] border-0 text-white hover:opacity-90"
                            )}
                          >
                            {unitSystem === 'imperial' ? option.labelMi : option.labelKm}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
