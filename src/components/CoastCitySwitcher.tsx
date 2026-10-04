import { cn } from '@/lib/utils'
import type { CoastCity } from '@/lib/coast-cities'

export function CoastCitySwitcher({ value, cities, onChange }: {
  value: string
  cities: Array<Pick<CoastCity, 'key' | 'city'>>
  onChange: (key: string) => void
}) {
  if (cities.length === 0) return null
  return (
    <div
      role="group"
      aria-label="West Coast cities"
      data-testid="coast-city-switcher"
      className="flex flex-wrap gap-2"
    >
      {cities.map((city) => {
        const pressed = city.key === value
        return (
          <button
            key={city.key}
            type="button"
            aria-pressed={pressed}
            onClick={() => onChange(city.key)}
            className={cn(
              'h-11 rounded-full border px-3 text-sm font-semibold touch-manipulation',
              pressed
                ? 'border-accent bg-accent/15 text-foreground'
                : 'border-border bg-card/70 text-muted-foreground',
            )}
          >
            {city.city}
          </button>
        )
      })}
    </div>
  )
}
