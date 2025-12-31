import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Faders, X, Lightning, Fire, Coffee, MapPin } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

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

const DISTANCE_OPTIONS = [
  { value: 0.3, label: '0.3mi' },
  { value: 0.6, label: '0.6mi' },
  { value: 1.2, label: '1.2mi' },
  { value: 3.1, label: '3mi' },
  { value: Infinity, label: 'All' }
]

export function MapFilters({ filters, onChange, availableCategories }: MapFiltersProps) {
  const [isOpen, setIsOpen] = useState(false)

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

  return (
    <>
      <Button
        size="icon"
        variant="secondary"
        className={cn(
          'bg-card/95 backdrop-blur-sm hover:bg-card shadow-lg relative',
          activeFilterCount > 0 && 'ring-2 ring-primary'
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Faders size={20} weight="bold" />
        {activeFilterCount > 0 && (
          <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-primary text-primary-foreground text-xs">
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
            <Card className="bg-card/98 backdrop-blur-md border-border shadow-xl">
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Faders size={20} weight="bold" />
                    <h3 className="font-bold text-lg">Filters</h3>
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

                <Separator />

                <ScrollArea className="max-h-[60vh]">
                  <div className="space-y-6 pr-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Lightning size={16} weight="fill" className="text-primary" />
                        <h4 className="font-semibold text-sm">Energy Level</h4>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant={filters.energyLevels.length === 0 ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleEnergyLevel('all')}
                          className="h-9"
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
                            className="h-9 gap-2"
                            style={
                              filters.energyLevels.includes(level.value)
                                ? {
                                    background: level.color,
                                    borderColor: level.color,
                                    color: 'oklch(0.98 0 0)'
                                  }
                                : {}
                            }
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
                        <Fire size={16} weight="fill" className="text-accent" />
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
                              className="h-9"
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
                                className="h-9"
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
                        <MapPin size={16} weight="fill" className="text-foreground" />
                        <h4 className="font-semibold text-sm">Distance</h4>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {DISTANCE_OPTIONS.map((option) => (
                          <Button
                            key={option.value}
                            variant={filters.maxDistance === option.value ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setDistance(option.value)}
                            className="h-9"
                          >
                            {option.label}
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
