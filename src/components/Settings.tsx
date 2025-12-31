import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { useUnitPreference } from '@/hooks/use-unit-preference'
import { Ruler, Info } from '@phosphor-icons/react'

export function Settings() {
  const { unitSystem, setUnitSystem, isImperial } = useUnitPreference()

  const handleToggleUnits = (checked: boolean) => {
    setUnitSystem(checked ? 'metric' : 'imperial')
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Customize your Pulse experience
        </p>
      </div>

      <Separator />

      <Card className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Ruler size={20} weight="bold" className="text-primary" />
          </div>
          <div className="flex-1 space-y-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label htmlFor="unit-system" className="text-base font-semibold">
                  Distance Units
                </Label>
                <Badge variant="outline" className="text-xs">
                  {isImperial ? 'Imperial' : 'Metric'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Choose how distances are displayed throughout the app
              </p>
            </div>

            <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
              <div className="flex items-center gap-3">
                <span className={`text-sm font-medium transition-colors ${!isImperial ? 'text-muted-foreground' : 'text-foreground'}`}>
                  Imperial (mi, ft)
                </span>
                <Switch
                  id="unit-system"
                  checked={!isImperial}
                  onCheckedChange={handleToggleUnits}
                  className="data-[state=checked]:bg-primary"
                />
                <span className={`text-sm font-medium transition-colors ${isImperial ? 'text-muted-foreground' : 'text-foreground'}`}>
                  Metric (km, m)
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 bg-accent/10 rounded-lg">
              <Info size={16} weight="fill" className="text-accent mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                This setting affects distance displays on venue cards, maps, and filters. 
                Your preference is saved automatically.
              </p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="font-semibold">About</h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p className="flex items-center justify-between">
            <span>Version</span>
            <span className="font-mono">1.0.0</span>
          </p>
          <Separator />
          <p className="flex items-center justify-between">
            <span>Location Required</span>
            <Badge variant="outline" className="text-xs">Active</Badge>
          </p>
        </div>
      </Card>
    </div>
  )
}
