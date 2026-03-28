import { User } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useUnitPreference } from '@/hooks/use-unit-preference'
import { useNotificationSettings } from '@/hooks/use-notification-settings'
import {
  ArrowLeft, Bell, Eye, EyeSlash, Ruler, Shield, Palette,
  Export, Trash, UsersFour, TrendUp, Sparkle, EnvelopeSimple, Info, WifiSlash,
  Translate, DownloadSimple, Eyeglasses, MapPin,
} from '@phosphor-icons/react'
import { US_CITY_LOCATIONS } from '@/lib/us-venues'
import { toast } from 'sonner'
import { getPendingCountSync as getPendingCount, clearQueue, getLastQueueSyncStatusSync as getLastQueueSyncStatus, getQueueRetryInfoSync as getQueueRetryInfo } from '@/lib/offline-queue'
import { getAvailableLocales, getLocale, setLocale, type Locale } from '@/lib/i18n'
import { getHighContrastMode, setHighContrastMode, type HighContrastMode, prefersReducedMotion } from '@/lib/accessibility'
import { getInstallState, showInstallPrompt, listenForInstallPrompt } from '@/lib/pwa'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

interface SettingsPageProps {
  currentUser: User
  onBack: () => void
  onUpdateUser: (user: User) => void
  onCityChange?: (location: { lat: number; lng: number }) => void
}

export function SettingsPage({ currentUser, onBack, onUpdateUser, onCityChange }: SettingsPageProps) {
  const { setUnitSystem, isImperial } = useUnitPreference()
  const { settings, updateSetting } = useNotificationSettings()
  const [offlineCount, setOfflineCount] = useState(getPendingCount())
  const [queueSyncStatus, setQueueSyncStatus] = useState(getLastQueueSyncStatus())
  const [queueRetryInfo, setQueueRetryInfo] = useState(getQueueRetryInfo())
  const [currentLocale, setCurrentLocale] = useState<Locale>(getLocale())
  const [contrastMode, setContrastMode] = useState<HighContrastMode>(getHighContrastMode())
  const [canInstallPwa, setCanInstallPwa] = useState(false)
  const installState = getInstallState()

  useEffect(() => {
    return listenForInstallPrompt(() => setCanInstallPwa(true))
  }, [])

  useEffect(() => {
    const intervalId = setInterval(() => {
      setOfflineCount(getPendingCount())
      setQueueSyncStatus(getLastQueueSyncStatus())
      setQueueRetryInfo(getQueueRetryInfo())
    }, 2000)
    return () => clearInterval(intervalId)
  }, [])

  const presenceSettings = currentUser.presenceSettings ?? {
    enabled: true,
    visibility: 'everyone' as const,
    hideAtSensitiveVenues: true,
  }

  const handlePresenceToggle = (enabled: boolean) => {
    onUpdateUser({
      ...currentUser,
      presenceSettings: { ...presenceSettings, enabled },
    })
  }

  const handleVisibilityChange = (visibility: 'everyone' | 'friends' | 'off') => {
    onUpdateUser({
      ...currentUser,
      presenceSettings: { ...presenceSettings, visibility },
    })
  }

  const handleSensitiveVenueToggle = (hide: boolean) => {
    onUpdateUser({
      ...currentUser,
      presenceSettings: { ...presenceSettings, hideAtSensitiveVenues: hide },
    })
  }

  const handleExportData = () => {
    const data = {
      user: currentUser,
      exportedAt: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pulse-data-${currentUser.username}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Data exported!')
  }

  const handleClearOfflineQueue = () => {
    clearQueue().catch(() => {})
    setOfflineCount(0)
    setQueueRetryInfo(getQueueRetryInfo())
    toast.success('Offline queue cleared')
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-secondary">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-bold flex-1">Settings</h1>
          <Badge variant="outline" className="text-xs">v1.0.0</Badge>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Notifications */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Bell size={18} weight="fill" className="text-accent" />
              <Label className="font-bold">Notifications</Label>
            </div>

            <SettingRow
              icon={<UsersFour size={16} weight="fill" className="text-primary" />}
              label="Friend Pulses"
              description="When friends post new pulses"
            >
              <Switch
                checked={settings?.friendPulses ?? true}
                onCheckedChange={(checked) => updateSetting('friendPulses', checked)}
                className="data-[state=checked]:bg-primary"
              />
            </SettingRow>

            <SettingRow
              icon={<UsersFour size={16} weight="fill" className="text-accent" />}
              label="Friends Nearby"
              description="When friends are at nearby venues"
            >
              <Switch
                checked={settings?.friendNearbyVenues ?? true}
                onCheckedChange={(checked) => updateSetting('friendNearbyVenues', checked)}
                className="data-[state=checked]:bg-primary"
              />
            </SettingRow>

            <SettingRow
              icon={<TrendUp size={16} weight="fill" className="text-primary" />}
              label="Trending Venues"
              description="Venues surging near you"
            >
              <Switch
                checked={settings?.trendingVenues ?? true}
                onCheckedChange={(checked) => updateSetting('trendingVenues', checked)}
                className="data-[state=checked]:bg-primary"
              />
            </SettingRow>

            <SettingRow
              icon={<Sparkle size={16} weight="fill" className="text-accent" />}
              label="Pulse Reactions"
              description="When someone reacts to your pulses"
            >
              <Switch
                checked={settings?.pulseReactions ?? true}
                onCheckedChange={(checked) => updateSetting('pulseReactions', checked)}
                className="data-[state=checked]:bg-primary"
              />
            </SettingRow>

            <SettingRow
              icon={<EnvelopeSimple size={16} weight="fill" className="text-muted-foreground" />}
              label="Weekly Digest"
              description="Summary of top spots each week"
            >
              <Switch
                checked={settings?.weeklyDigest ?? false}
                onCheckedChange={(checked) => updateSetting('weeklyDigest', checked)}
                className="data-[state=checked]:bg-primary"
              />
            </SettingRow>
          </Card>
        </motion.div>

        {/* Privacy & Presence */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Shield size={18} weight="fill" className="text-primary" />
              <Label className="font-bold">Privacy & Presence</Label>
            </div>

            <SettingRow
              icon={presenceSettings.enabled ? <Eye size={16} weight="fill" className="text-green-500" /> : <EyeSlash size={16} weight="fill" className="text-muted-foreground" />}
              label="Show Presence"
              description="Let others see you're at a venue"
            >
              <Switch
                checked={presenceSettings.enabled}
                onCheckedChange={handlePresenceToggle}
                className="data-[state=checked]:bg-primary"
              />
            </SettingRow>

            {presenceSettings.enabled && (
              <>
                <div className="pl-2 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Who can see you</p>
                  <div className="flex gap-2">
                    {(['everyone', 'friends', 'off'] as const).map(v => (
                      <button
                        key={v}
                        onClick={() => handleVisibilityChange(v)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          presenceSettings.visibility === v
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-muted-foreground'
                        }`}
                      >
                        {v.charAt(0).toUpperCase() + v.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <SettingRow
                  icon={<Shield size={16} weight="fill" className="text-yellow-500" />}
                  label="Hide at Sensitive Venues"
                  description="Auto-hide presence at certain venue types"
                >
                  <Switch
                    checked={presenceSettings.hideAtSensitiveVenues}
                    onCheckedChange={handleSensitiveVenueToggle}
                    className="data-[state=checked]:bg-primary"
                  />
                </SettingRow>
              </>
            )}

            <div className="flex items-start gap-2 p-3 bg-accent/10 rounded-lg">
              <Info size={14} weight="fill" className="text-accent mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                Your exact location is never shared. Only general presence at venues is shown.
              </p>
            </div>
          </Card>
        </motion.div>

        {/* Display */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Palette size={18} weight="fill" className="text-primary" />
              <Label className="font-bold">Display</Label>
            </div>

            <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Ruler size={16} weight="fill" className="text-primary" />
                <div>
                  <p className="text-sm font-medium">Distance Units</p>
                  <p className="text-xs text-muted-foreground">
                    {isImperial ? 'Miles & feet' : 'Kilometers & meters'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${isImperial ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>mi</span>
                <Switch
                  checked={!isImperial}
                  onCheckedChange={(checked) => setUnitSystem(checked ? 'metric' : 'imperial')}
                  className="data-[state=checked]:bg-primary"
                />
                <span className={`text-xs ${!isImperial ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>km</span>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* City */}
        {onCityChange && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.11 }}>
            <Card className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <MapPin size={18} weight="fill" className="text-accent" />
                <Label className="font-bold">City</Label>
              </div>
              <p className="text-xs text-muted-foreground">Simulate being in a different city to explore venues nationwide.</p>
              <div className="flex flex-wrap gap-2">
                {(['nyc', 'la', 'miami', 'chicago', 'austin', 'nashville', 'sf', 'vegas'] as const).map(key => {
                  const city = US_CITY_LOCATIONS[key]
                  if (!city) return null
                  const label = city.name.split(',')[0]
                  return (
                    <button
                      key={key}
                      onClick={() => onCityChange({ lat: city.lat, lng: city.lng })}
                      className="px-3 py-1.5 rounded-full text-xs font-medium bg-secondary text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-all"
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </Card>
          </motion.div>
        )}

        {/* Language */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Translate size={18} weight="fill" className="text-primary" />
              <Label className="font-bold">Language</Label>
              <Badge variant="outline" className="text-xs">
                {getAvailableLocales().find(l => l.code === currentLocale)?.name || 'English'}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {getAvailableLocales().map(locale => (
                <button
                  key={locale.code}
                  onClick={() => {
                    setLocale(locale.code)
                    setCurrentLocale(locale.code)
                    toast.success(`Language set to ${locale.name}`)
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    currentLocale === locale.code
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {locale.name}
                </button>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Accessibility */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.13 }}>
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Eyeglasses size={18} weight="fill" className="text-primary" />
              <Label className="font-bold">Accessibility</Label>
              {contrastMode !== 'off' && (
                <Badge variant="outline" className="text-xs">
                  {contrastMode === 'high' ? 'High contrast' : 'Increased contrast'}
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Contrast mode</p>
              <div className="flex gap-2">
                {([
                  { value: 'off' as HighContrastMode, label: 'Off' },
                  { value: 'increased' as HighContrastMode, label: 'Increased' },
                  { value: 'high' as HighContrastMode, label: 'High' },
                ]).map(option => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setHighContrastMode(option.value)
                      setContrastMode(option.value)
                      toast.success(`Contrast set to ${option.label}`)
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      contrastMode === option.value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Eye size={16} weight="fill" className="text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Reduced Motion</p>
                  <p className="text-xs text-muted-foreground">
                    {prefersReducedMotion() ? 'Enabled (system setting)' : 'Disabled (system setting)'}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs">
                System
              </Badge>
            </div>
          </Card>
        </motion.div>

        {/* Install App */}
        {(canInstallPwa || !installState.isInstalled) && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
            <Card className="p-4 space-y-3 border-primary/20">
              <div className="flex items-center gap-2">
                <DownloadSimple size={18} weight="fill" className="text-primary" />
                <Label className="font-bold">Install App</Label>
              </div>
              {canInstallPwa ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    Install Pulse for a faster, native-like experience with offline support.
                  </p>
                  <Button
                    size="sm"
                    onClick={async () => {
                      const accepted = await showInstallPrompt()
                      if (accepted) {
                        toast.success('App installed!')
                        setCanInstallPwa(false)
                      }
                    }}
                  >
                    <DownloadSimple size={14} className="mr-1" />
                    Install Pulse
                  </Button>
                </>
              ) : installState.isInstalled ? (
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <Badge variant="outline" className="text-xs text-green-500 border-green-500/30">Installed</Badge>
                  Running as installed app
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {installState.platform === 'ios'
                    ? 'Tap the share button, then "Add to Home Screen" to install.'
                    : 'Use your browser menu to install this app.'}
                </p>
              )}
            </Card>
          </motion.div>
        )}

        {/* Offline Queue */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="p-4 space-y-3 border-yellow-500/30">
            <div className="flex items-center gap-2">
              <WifiSlash size={18} weight="fill" className="text-yellow-500" />
              <Label className="font-bold">Offline Queue</Label>
              <Badge variant="outline" className="text-xs text-yellow-500 border-yellow-500/30">
                {offlineCount} pending
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Pulses queued while offline will sync when you're back online.
            </p>
            {queueRetryInfo.failedCount > 0 && queueRetryInfo.nextRetryInMs !== null && (
              <p className="text-xs text-muted-foreground">
                Next retry ETA: {Math.ceil(queueRetryInfo.nextRetryInMs / 1000)}s ({queueRetryInfo.failedCount} failed item{queueRetryInfo.failedCount > 1 ? 's' : ''})
              </p>
            )}
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Last sync attempt: {queueSyncStatus.lastAttemptAt ? new Date(queueSyncStatus.lastAttemptAt).toLocaleTimeString() : 'Never'}</p>
              <p>Last result: {queueSyncStatus.lastSyncedCount} synced, {queueSyncStatus.lastFailedCount} failed</p>
              {queueSyncStatus.lastBatchDurationMs !== undefined && (
                <p>Batch duration: {queueSyncStatus.lastBatchDurationMs}ms</p>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={handleClearOfflineQueue}>
              <Trash size={14} className="mr-1" />
              Clear Queue
            </Button>
          </Card>
        </motion.div>

        {/* Data & Account */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Export size={18} weight="fill" className="text-primary" />
              <Label className="font-bold">Data & Account</Label>
            </div>

            <Button variant="outline" className="w-full justify-start" onClick={handleExportData}>
              <Export size={16} className="mr-2" />
              Export My Data
            </Button>

            <Separator />

            <div className="text-xs text-muted-foreground space-y-1">
              <p className="flex justify-between">
                <span>Account created</span>
                <span className="font-mono">{new Date(currentUser.createdAt).toLocaleDateString()}</span>
              </p>
              <p className="flex justify-between">
                <span>Friends</span>
                <span className="font-mono">{currentUser.friends.length}</span>
              </p>
              <p className="flex justify-between">
                <span>Favorites</span>
                <span className="font-mono">{currentUser.favoriteVenues?.length ?? 0}</span>
              </p>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}

function SettingRow({
  icon,
  label,
  description,
  children,
}: {
  icon: React.ReactNode
  label: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </div>
  )
}
