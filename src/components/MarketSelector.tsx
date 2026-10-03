import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ALL_US_MARKETS_KEY, type UsMarket } from '@/lib/us-markets'

export function MarketSelector({ value, markets, onChange }: {
  value: string
  markets: UsMarket[]
  onChange: (key: string) => void
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-11 w-full max-w-xs bg-background" aria-label="Select U.S. market">
        <SelectValue placeholder="Choose city" />
      </SelectTrigger>
      <SelectContent className="max-h-80">
        <SelectItem value={ALL_US_MARKETS_KEY}>United States</SelectItem>
        {markets.map((market) => (
          <SelectItem key={market.key} value={market.key}>
            {market.name} ({market.venueCount})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
