import { User } from '@/lib/types'
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
  Translate, DownloadSimple, Eyeglasses, MapPin, CaretDown, CaretUp,
} from '@phosphor-icons/react'
import { US_CITY_LOCATIONS } from '@/lib/us-venues'
import { toast } from 'sonner'
import { getPendingCount, clearQueue, getLastQueueSyncStatus, getQueueRetryInfo } from '@/lib/offline-queue'
import { getAvailableLocales, getLocale, setLocale, type Locale } from '@/lib/i18n'
import { getHighContrastMode, setHighContrastMode, type HighContrastMode, prefersReducedMotion } from '@/lib/accessibility'
import { getInstallState, showInstallPrompt, listenForInstallPrompt } from '@/lib/pwa'
import { useState, useEffect, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

interface SettingsPageProps {
  currentUser: User
  onBack: () => void
  onUpdateUser: (user: User) => void
  onCityChange?: (location: { lat: number; lng: number }) => void
}

function CollapsibleSection({
  id,
  icon,
  title,
  subtitle,
  isExpanded,
  onToggle,
  children,
}: {
  id: string
  icon: ReactNode
  title: string
  subtitle: string
  isExpanded: boolean
  onToggle: (id: string) => void
  children: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-card/95 backdrop-blur-xl overflow-hidden">
      <button
        onClick={() => onToggle(id)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-secondary/30 transition-colors"
      >
        <div className="flex-shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold">{title}</p>
          <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
        </div>
        <div className="flex-shrink-0 text-muted-foreground">
          {isExpanded ? <CaretUp size={16} weight="bold" /> : <CaretDown size={16} weight="bold" />}
        </div>
      </button>
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key={`content-${id}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
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

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['notifications']))

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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
    clearQueue()
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

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {/* Notifications */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <CollapsibleSection
            id="notifications"
            icon={<Bell size={18} weight="fill" className="text-accent" />}
            title="Notifications"
            subtitle="Push notifications, friend activity"
            isExpanded={expandedSections.has('notifications')}
            onToggle={toggleSection}
          >
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
          </CollapsibleSection>
        </motion.div>

        {/* Privacy & Presence */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <CollapsibleSection
            id="privacy"
            icon={<Shield size={18} weight="fill" className="text-primary" />}
            title="Privacy & Presence"
            subtitle="Location sharing, visibility controls"
            isExpanded={expandedSections.has('privacy')}
            onToggle={toggleSection}
          >
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
          </CollapsibleSection>
        </motion.div>

        {/* Display */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <CollapsibleSection
            id="display"
            icon={<Palette size={18} weight="fill" className="text-primary" />}
            title="Display"
            subtitle="Distance units, appearance"
            isExpanded={expandedSections.has('display')}
            onToggle={toggleSection}
          >
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
          </CollapsibleSection>
        </motion.div>

        {/* City */}
        {onCityChange && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.11 }}>
            <CollapsibleSection
              id="city"
              icon={<MapPin size={18} weight="fill" className="text-accent" />}
              title="City"
              subtitle="Simulate being in a different city"
              isExpanded={expandedSections.has('city')}
              onToggle={toggleSection}
            >
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
            </CollapsibleSection>
          </motion.div>
        )}

        {/* Language */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          <CollapsibleSection
            id="language"
            icon={<Translate size={18} weight="fill" className="text-primary" />}
            title="Language"
            subtitle={getAvailableLocales().find(l => l.code === currentLocale)?.name || 'English'}
            isExpanded={expandedSections.has('language')}
            onToggle={toggleSection}
          >
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
          </CollapsibleSection>
        </motion.div>

        {/* Accessibility */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.13 }}>
          <CollapsibleSection
            id="accessibility"
            icon={<Eyeglasses size={18} weight="fill" className="text-primary" />}
            title="Accessibility"
            subtitle={contrastMode !== 'off' ? (contrastMode === 'high' ? 'High contrast' : 'Increased contrast') : 'Contrast, reduced motion'}
            isExpanded={expandedSections.has('accessibility')}
            onToggle={toggleSection}
          >
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
          </CollapsibleSection>
        </motion.div>

        {/* Install App */}
        {(canInstallPwa || !installState.isInstalled) && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
            <CollapsibleSection
              id="install"
              icon={<DownloadSimple size={18} weight="fill" className="text-primary" />}
              title="Install App"
              subtitle="Install for offline support"
              isExpanded={expandedSections.has('install')}
              onToggle={toggleSection}
            >
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
            </CollapsibleSection>
          </motion.div>
        )}

        {/* Offline Queue */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <CollapsibleSection
            id="offline"
            icon={<WifiSlash size={18} weight="fill" className="text-yellow-500" />}
            title="Offline Queue"
            subtitle={`${offlineCount} pending items`}
            isExpanded={expandedSections.has('offline')}
            onToggle={toggleSection}
          >
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
          </CollapsibleSection>
        </motion.div>

        {/* Data & Account */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <CollapsibleSection
            id="data"
            icon={<Export size={18} weight="fill" className="text-primary" />}
            title="Data & Account"
            subtitle="Export data, account info"
            isExpanded={expandedSections.has('data')}
            onToggle={toggleSection}
          >
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
          </CollapsibleSection>
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
