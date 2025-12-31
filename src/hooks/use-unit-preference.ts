import { useKV } from '@github/spark/hooks'

export type UnitSystem = 'imperial' | 'metric'

export function useUnitPreference() {
  const [unitSystem, setUnitSystem] = useKV<UnitSystem>('unitSystem', 'imperial')
  
  return {
    unitSystem: unitSystem || 'imperial',
    setUnitSystem,
    isImperial: unitSystem === 'imperial',
    isMetric: unitSystem === 'metric'
  }
}
