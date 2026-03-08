/**
 * Internationalization (i18n) Framework
 *
 * Lightweight i18n with locale detection, string interpolation,
 * pluralization, and RTL support.
 */

export type Locale = 'en' | 'es' | 'fr' | 'ja' | 'ar' | 'pt' | 'de' | 'ko' | 'zh'
export type Direction = 'ltr' | 'rtl'

const RTL_LOCALES: Locale[] = ['ar']

export interface TranslationMap {
  [key: string]: string | { one: string; other: string }
}

const translations: Record<Locale, TranslationMap> = {
  en: {
    // Navigation
    'nav.trending': 'Trending',
    'nav.venues': 'Venues',
    'nav.map': 'Map',
    'nav.notifications': 'Notifications',
    'nav.profile': 'Profile',

    // Energy levels
    'energy.dead': 'Dead',
    'energy.chill': 'Chill',
    'energy.buzzing': 'Buzzing',
    'energy.electric': 'Electric',

    // Actions
    'action.pulse': 'Post Pulse',
    'action.share': 'Share',
    'action.follow': 'Follow',
    'action.unfollow': 'Unfollow',
    'action.favorite': 'Favorite',
    'action.going': 'Going',
    'action.interested': 'Interested',

    // Venue
    'venue.score': 'Pulse Score',
    'venue.open_now': 'Open Now',
    'venue.closed': 'Closed',

    // Social
    'social.friends': { one: '{{count}} friend', other: '{{count}} friends' },
    'social.people_here': { one: '{{count}} person here', other: '{{count}} people here' },
    'social.mutual_friends': { one: '{{count}} mutual friend', other: '{{count}} mutual friends' },

    // Time
    'time.just_now': 'Just now',
    'time.minutes_ago': { one: '{{count}} min ago', other: '{{count}} mins ago' },
    'time.hours_ago': { one: '{{count}} hour ago', other: '{{count}} hours ago' },

    // Notifications
    'notif.friend_pulse': '{{name}} posted a pulse at {{venue}}',
    'notif.trending': '{{venue}} is {{level}} right now',
    'notif.none': 'No notifications yet',

    // Errors
    'error.offline': 'You\'re offline. Pulses will sync when connected.',
    'error.location_denied': 'Location access needed to find venues near you.',
    'error.cooldown': 'Wait {{minutes}}m before posting here again.',
  },

  es: {
    'nav.trending': 'Tendencias',
    'nav.venues': 'Lugares',
    'nav.map': 'Mapa',
    'nav.notifications': 'Notificaciones',
    'nav.profile': 'Perfil',
    'energy.dead': 'Muerto',
    'energy.chill': 'Tranquilo',
    'energy.buzzing': 'Animado',
    'energy.electric': 'Electrizante',
    'action.pulse': 'Publicar Pulso',
    'action.share': 'Compartir',
    'action.follow': 'Seguir',
    'action.unfollow': 'Dejar de seguir',
    'action.favorite': 'Favorito',
    'action.going': 'Voy',
    'action.interested': 'Interesado',
    'venue.score': 'Puntuacion Pulse',
    'social.friends': { one: '{{count}} amigo', other: '{{count}} amigos' },
    'time.just_now': 'Ahora mismo',
    'time.minutes_ago': { one: 'hace {{count}} min', other: 'hace {{count}} mins' },
    'error.offline': 'Sin conexion. Los pulsos se sincronizaran al conectar.',
  },

  fr: {
    'nav.trending': 'Tendances',
    'nav.venues': 'Lieux',
    'nav.map': 'Carte',
    'nav.notifications': 'Notifications',
    'nav.profile': 'Profil',
    'energy.dead': 'Mort',
    'energy.chill': 'Calme',
    'energy.buzzing': 'Anime',
    'energy.electric': 'Electrique',
    'action.pulse': 'Poster un Pulse',
    'action.share': 'Partager',
    'social.friends': { one: '{{count}} ami', other: '{{count}} amis' },
    'time.just_now': 'A l\'instant',
  },

  ja: {
    'nav.trending': 'トレンド',
    'nav.venues': '会場',
    'nav.map': 'マップ',
    'nav.notifications': '通知',
    'nav.profile': 'プロフィール',
    'energy.dead': 'デッド',
    'energy.chill': 'チル',
    'energy.buzzing': 'バジング',
    'energy.electric': 'エレクトリック',
    'action.pulse': 'パルスを投稿',
  },

  ar: {
    'nav.trending': 'الرائج',
    'nav.venues': 'الأماكن',
    'nav.map': 'الخريطة',
    'nav.notifications': 'الإشعارات',
    'nav.profile': 'الملف الشخصي',
    'energy.dead': 'ميت',
    'energy.chill': 'هادئ',
    'energy.buzzing': 'نشيط',
    'energy.electric': 'كهربائي',
    'action.pulse': 'نشر نبض',
    'action.share': 'مشاركة',
  },

  // Stubs for additional locales (would be fully translated in production)
  pt: { 'nav.trending': 'Tendencias', 'energy.electric': 'Eletrico' },
  de: { 'nav.trending': 'Trends', 'energy.electric': 'Elektrisch' },
  ko: { 'nav.trending': '트렌딩', 'energy.electric': '일렉트릭' },
  zh: { 'nav.trending': '热门', 'energy.electric': '电力十足' },
}

let currentLocale: Locale = 'en'

/**
 * Detect user locale from browser.
 */
export function detectLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en'
  const lang = navigator.language?.split('-')[0] as Locale
  return translations[lang] ? lang : 'en'
}

/**
 * Set the current locale.
 */
export function setLocale(locale: Locale): void {
  currentLocale = locale
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale
    document.documentElement.dir = getDirection(locale)
  }
  try {
    localStorage.setItem('pulse_locale', locale)
  } catch {}
}

/**
 * Get the current locale.
 */
export function getLocale(): Locale {
  return currentLocale
}

/**
 * Initialize locale from stored preference or browser detection.
 */
export function initLocale(): Locale {
  try {
    const stored = localStorage.getItem('pulse_locale') as Locale | null
    if (stored && translations[stored]) {
      setLocale(stored)
      return stored
    }
  } catch {}
  const detected = detectLocale()
  setLocale(detected)
  return detected
}

/**
 * Get text direction for a locale.
 */
export function getDirection(locale: Locale): Direction {
  return RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr'
}

/**
 * Check if current locale is RTL.
 */
export function isRTL(): boolean {
  return getDirection(currentLocale) === 'rtl'
}

/**
 * Translate a key with optional interpolation.
 */
export function t(
  key: string,
  params?: Record<string, string | number>
): string {
  const entry = translations[currentLocale]?.[key] ?? translations.en[key]
  if (!entry) return key

  let text: string

  if (typeof entry === 'object') {
    // Pluralization
    const count = params?.count ?? 0
    text = count === 1 ? entry.one : entry.other
  } else {
    text = entry
  }

  // Interpolation
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v))
    }
  }

  return text
}

/**
 * Get all available locales.
 */
export function getAvailableLocales(): { code: Locale; name: string }[] {
  return [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Español' },
    { code: 'fr', name: 'Français' },
    { code: 'ja', name: '日本語' },
    { code: 'ar', name: 'العربية' },
    { code: 'pt', name: 'Português' },
    { code: 'de', name: 'Deutsch' },
    { code: 'ko', name: '한국어' },
    { code: 'zh', name: '中文' },
  ]
}

/**
 * Format a number according to the current locale.
 */
export function formatNumber(n: number): string {
  try {
    return new Intl.NumberFormat(currentLocale).format(n)
  } catch {
    return n.toString()
  }
}

/**
 * Format a date according to the current locale.
 */
export function formatDate(date: Date | string, style: 'short' | 'medium' | 'long' = 'medium'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const options: Intl.DateTimeFormatOptions =
    style === 'short' ? { month: 'numeric', day: 'numeric' }
    : style === 'long' ? { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' }
  try {
    return new Intl.DateTimeFormat(currentLocale, options).format(d)
  } catch {
    return d.toLocaleDateString()
  }
}

/**
 * Format relative time (e.g., "5 minutes ago").
 */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const diffMs = Date.now() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return t('time.just_now')
  if (diffMins < 60) return t('time.minutes_ago', { count: diffMins })
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return t('time.hours_ago', { count: diffHours })
  return formatDate(d, 'short')
}
