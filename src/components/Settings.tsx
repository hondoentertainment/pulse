import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AnalyticsDashboard } from './AnalyticsDashboard'
import { useUnitPreference } from '@/hooks/use-unit-preference'
import { useNotificationSettings } from '@/hooks/use-notification-settings'
import { Ruler, Info, Bell, UsersFour, TrendUp, Sparkle, EnvelopeSimple, Flask, Stack, ChartLine } from '@phosphor-icons/react'

interface SettingsProps {
  onGenerateDemoNotifications?: () => void
  onOpenSocialPulseDashboard?: () => void
}

export function Settings({ onGenerateDemoNotifications, onOpenSocialPulseDashboard }: SettingsProps) {
  const { unitSystem, setUnitSystem, isImperial } = useUnitPreference()
  const { settings, updateSetting } = useNotificationSettings()

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
          <div className="p-2 rounded-lg bg-accent/10">
            <Bell size={20} weight="bold" className="text-accent" />
          </div>
          <div className="flex-1 space-y-3">
            <div className="space-y-1">
              <Label className="text-base font-semibold">
                Notifications
              </Label>
              <p className="text-sm text-muted-foreground">
                Control what updates you receive
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <UsersFour size={18} weight="fill" className="text-primary" />
                  <div>
                    <p className="text-sm font-medium">Friend Pulses</p>
                    <p className="text-xs text-muted-foreground">When friends post new pulses</p>
                  </div>
                </div>
                <Switch
                  id="friend-pulses"
                  checked={settings?.friendPulses ?? true}
                  onCheckedChange={(checked) => updateSetting('friendPulses', checked)}
                  className="data-[state=checked]:bg-primary"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <UsersFour size={18} weight="fill" className="text-accent" />
                  <div>
                    <p className="text-sm font-medium">Friends Nearby</p>
                    <p className="text-xs text-muted-foreground">When friends are at nearby venues</p>
                  </div>
                </div>
                <Switch
                  id="friend-nearby"
                  checked={settings?.friendNearbyVenues ?? true}
                  onCheckedChange={(checked) => updateSetting('friendNearbyVenues', checked)}
                  className="data-[state=checked]:bg-primary"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <TrendUp size={18} weight="fill" className="text-primary" />
                  <div>
                    <p className="text-sm font-medium">Trending Venues</p>
                    <p className="text-xs text-muted-foreground">Hot spots popping off near you</p>
                  </div>
                </div>
                <Switch
                  id="trending-venues"
                  checked={settings?.trendingVenues ?? true}
                  onCheckedChange={(checked) => updateSetting('trendingVenues', checked)}
                  className="data-[state=checked]:bg-primary"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Sparkle size={18} weight="fill" className="text-accent" />
                  <div>
                    <p className="text-sm font-medium">Pulse Reactions</p>
                    <p className="text-xs text-muted-foreground">When someone reacts to your pulses</p>
                  </div>
                </div>
                <Switch
                  id="pulse-reactions"
                  checked={settings?.pulseReactions ?? true}
                  onCheckedChange={(checked) => updateSetting('pulseReactions', checked)}
                  className="data-[state=checked]:bg-primary"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <EnvelopeSimple size={18} weight="fill" className="text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Weekly Digest</p>
                    <p className="text-xs text-muted-foreground">Summary of top spots each week</p>
                  </div>
                </div>
                <Switch
                  id="weekly-digest"
                  checked={settings?.weeklyDigest ?? false}
                  onCheckedChange={(checked) => updateSetting('weeklyDigest', checked)}
                  className="data-[state=checked]:bg-primary"
                />
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 bg-accent/10 rounded-lg">
              <Info size={16} weight="fill" className="text-accent mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Notification preferences are saved automatically. You can change them anytime.
              </p>
            </div>
          </div>
        </div>
      </Card>

      <Separator />

      <Card className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Stack size={20} weight="bold" className="text-primary" />
          </div>
          <div className="flex-1 space-y-3">
            <div className="space-y-1">
              <Label className="text-base font-semibold">
                Grouping Preferences
              </Label>
              <p className="text-sm text-muted-foreground">
                Control how similar notifications are grouped together
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Sparkle size={18} weight="fill" className="text-accent" />
                  <div>
                    <p className="text-sm font-medium">Group Reactions</p>
                    <p className="text-xs text-muted-foreground">Combine multiple reactions on same pulse</p>
                  </div>
                </div>
                <Switch
                  id="group-reactions"
                  checked={settings?.groupReactions ?? true}
                  onCheckedChange={(checked) => updateSetting('groupReactions', checked)}
                  className="data-[state=checked]:bg-primary"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <UsersFour size={18} weight="fill" className="text-primary" />
                  <div>
                    <p className="text-sm font-medium">Group Friend Pulses</p>
                    <p className="text-xs text-muted-foreground">Combine friend pulses from same venue</p>
                  </div>
                </div>
                <Switch
                  id="group-friend-pulses"
                  checked={settings?.groupFriendPulses ?? false}
                  onCheckedChange={(checked) => updateSetting('groupFriendPulses', checked)}
                  className="data-[state=checked]:bg-primary"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <TrendUp size={18} weight="fill" className="text-primary" />
                  <div>
                    <p className="text-sm font-medium">Group Trending Venues</p>
                    <p className="text-xs text-muted-foreground">Combine trending alerts for same venue</p>
                  </div>
                </div>
                <Switch
                  id="group-trending-venues"
                  checked={settings?.groupTrendingVenues ?? false}
                  onCheckedChange={(checked) => updateSetting('groupTrendingVenues', checked)}
                  className="data-[state=checked]:bg-primary"
                />
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 bg-accent/10 rounded-lg">
              <Info size={16} weight="fill" className="text-accent mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Grouping helps reduce clutter by combining similar notifications. You'll see a count when multiple are grouped.
              </p>
            </div>
          </div>
        </div>
      </Card>

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

      {onGenerateDemoNotifications && (
        <>
          <Separator />
          <Card className="p-5 space-y-4 border-accent/50">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-accent/10">
                <Flask size={20} weight="bold" className="text-accent" />
              </div>
              <div className="flex-1 space-y-3">
                <div className="space-y-1">
                  <Label className="text-base font-semibold">
                    Demo Mode
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Generate sample pulses and notifications from popular Seattle venues
                  </p>
                </div>
                <Button
                  onClick={onGenerateDemoNotifications}
                  variant="outline"
                  className="w-full border-accent text-accent hover:bg-accent hover:text-accent-foreground"
                >
                  <Flask size={18} weight="bold" className="mr-2" />
                  Generate Seattle Demo Data
                </Button>
                <div className="flex items-start gap-2 p-3 bg-accent/10 rounded-lg">
                  <Info size={16} weight="fill" className="text-accent mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Creates sample pulses with realistic captions, photos, and reactions from venues across Seattle neighborhoods including Capitol Hill, Fremont, Georgetown, and South Lake Union.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </>
      )}

      {onOpenSocialPulseDashboard && (
        <>
          <Separator />
          <Card className="p-5 space-y-4 border-primary/50">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <ChartLine size={20} weight="bold" className="text-primary" />
              </div>
              <div className="flex-1 space-y-3">
                <div className="space-y-1">
                  <Label className="text-base font-semibold">
                    Social Pulse Dashboard
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Track and correlate social media activity with venue energy
                  </p>
                </div>
                <Button
                  onClick={onOpenSocialPulseDashboard}
                  variant="outline"
                  className="w-full border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                >
                  <ChartLine size={18} weight="bold" className="mr-2" />
                  Open Admin Dashboard
                </Button>
                <div className="flex items-start gap-2 p-3 bg-primary/10 rounded-lg">
                  <Info size={16} weight="fill" className="text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Monitor real-time social media activity, track hashtags, and analyze correlation between social buzz and venue check-ins.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </>
      )}

      {onGenerateDemoNotifications && (
        <>
          <Separator />
          <Card className="p-5">
            <AnalyticsDashboard />
          </Card>
        </>
      )}
    </div>
  )
}
