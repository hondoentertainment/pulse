/**
 * Mute quiet-night prompts for a launched city.
 * The push sender reads launch_quiet_mutes. Local storage covers this device
 * when the account write has not landed yet.
 */

import { coastCityByKey, DEFAULT_COAST_CITY_KEY } from './coast-cities'
import { weekdayName } from './launch-city-quiet'

const STORAGE_KEY = 'pulse_launch_quiet_mute_v1'

export function rememberLaunchQuietMute(cityKey: string): void {
  if (typeof localStorage === 'undefined') return
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) as Record<string, string> : {}
    parsed[cityKey] = new Date().toISOString()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
  } catch {
    /* private mode */
  }
}

export async function muteLaunchQuiet(cityKey: string): Promise<{ ok: boolean; message: string }> {
  const city = coastCityByKey(cityKey)
  if (!city || city.key === DEFAULT_COAST_CITY_KEY) {
    return { ok: false, message: '' }
  }
  rememberLaunchQuietMute(city.key)
  const weekday = weekdayName(new Date())
  try {
    const mod = await import('./supabase')
    if (!mod.hasSupabaseConfig) {
      return { ok: true, message: `Muted ${weekday} prompts` }
    }
    const { data } = await mod.supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) {
      return { ok: false, message: 'Sign in to mute these prompts on your account' }
    }
    const response = await fetch('/api/push/mute-launch-quiet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ cityKey: city.key }),
    })
    if (!response.ok) {
      return { ok: false, message: 'Could not mute these prompts yet' }
    }
  } catch {
    return { ok: true, message: `Muted ${weekday} prompts on this device` }
  }
  return { ok: true, message: `Muted ${weekday} prompts` }
}
