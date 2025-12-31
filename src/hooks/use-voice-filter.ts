import { useEffect, useCallback } from 'react'
import { useVoiceSearch } from './use-voice-search'
import { MapFiltersState, EnergyFilter } from '@/components/MapFilters'
import { toast } from 'sonner'

interface VoiceFilterResult {
  energyLevels?: EnergyFilter[]
  categories?: string[]
  action?: 'clear' | 'show'
}

export function useVoiceFilter(
  availableCategories: string[],
  onFiltersChange: (filters: Partial<MapFiltersState>) => void
) {
  const { isListening, transcript, startListening, stopListening, resetTranscript, isSupported, error } = useVoiceSearch()

  const parseVoiceCommand = useCallback((text: string): VoiceFilterResult | null => {
    const lowerText = text.toLowerCase().trim()
    
    if (lowerText.includes('clear') || lowerText.includes('reset') || lowerText.includes('remove all')) {
      return { action: 'clear' }
    }

    const result: VoiceFilterResult = {}

    const energyKeywords = {
      dead: ['dead', 'empty', 'quiet'],
      chill: ['chill', 'calm', 'relaxed', 'mellow'],
      buzzing: ['buzzing', 'busy', 'active', 'lively', 'crowded'],
      electric: ['electric', 'pumping', 'crazy', 'wild', 'packed', 'lit', 'energetic']
    }

    const detectedEnergy: EnergyFilter[] = []
    Object.entries(energyKeywords).forEach(([energy, keywords]) => {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        detectedEnergy.push(energy as EnergyFilter)
      }
    })

    if (detectedEnergy.length > 0) {
      result.energyLevels = detectedEnergy
    }

    const detectedCategories: string[] = []
    availableCategories.forEach(category => {
      const categoryLower = category.toLowerCase()
      if (lowerText.includes(categoryLower)) {
        detectedCategories.push(category)
      }
      
      const categoryWords = categoryLower.split(' ')
      if (categoryWords.some(word => lowerText.includes(word))) {
        if (!detectedCategories.includes(category)) {
          detectedCategories.push(category)
        }
      }
    })

    if (detectedCategories.length > 0) {
      result.categories = detectedCategories
    }

    const hasShowCommand = lowerText.includes('show') || 
                          lowerText.includes('filter') || 
                          lowerText.includes('find') ||
                          lowerText.includes('display')

    if (hasShowCommand && (result.energyLevels || result.categories)) {
      result.action = 'show'
    }

    if (Object.keys(result).length === 0) {
      return null
    }

    return result
  }, [availableCategories])

  const applyVoiceFilters = useCallback((result: VoiceFilterResult, currentFilters: MapFiltersState) => {
    if (result.action === 'clear') {
      onFiltersChange({
        energyLevels: [],
        categories: [],
        maxDistance: Infinity
      })
      toast.success('Filters cleared', {
        description: 'All filters have been removed'
      })
      return
    }

    const updates: Partial<MapFiltersState> = {}

    if (result.energyLevels) {
      updates.energyLevels = result.energyLevels
    }

    if (result.categories) {
      updates.categories = result.categories
    }

    if (Object.keys(updates).length > 0) {
      onFiltersChange(updates)
      
      const parts: string[] = []
      if (updates.energyLevels && updates.energyLevels.length > 0) {
        parts.push(updates.energyLevels.join(', '))
      }
      if (updates.categories && updates.categories.length > 0) {
        parts.push(updates.categories.join(', '))
      }
      
      toast.success('Filters applied', {
        description: parts.join(' • ')
      })
    }
  }, [onFiltersChange])

  useEffect(() => {
    if (error) {
      toast.error('Voice error', {
        description: error
      })
    }
  }, [error])

  return {
    isListening,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
    isSupported,
    parseVoiceCommand,
    applyVoiceFilters
  }
}
