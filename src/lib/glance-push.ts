/**
 * Glasses-glance Web Push shape.
 *
 * Meta Ray-Ban / Ray-Ban Display do not talk to this PWA. The phone shows
 * the notification; the Meta AI app mirrors it when the user allows that.
 * Titles stay short. `kind` and `tag` let the service worker collapse updates.
 */

export interface GlancePushAction {
  action: string
  title: string
}

export interface GlancePushPayload {
  title: string
  body: string
  url: string
  kind: string
  tag: string
  renotify: boolean
  /** Optional notification buttons. Omitted for surge glances. */
  actions?: GlancePushAction[]
  postUrl?: string
  openUrl?: string
  muteUrl?: string
}

export function glanceText(value: string, max: number): string {
  const trimmed = value.replace(/\s+/g, ' ').trim()
  if (max < 1) return ''
  if (trimmed.length <= max) return trimmed
  if (max === 1) return '…'
  return `${trimmed.slice(0, max - 1).trimEnd()}…`
}

/** JSON body stored on the push message. The service worker reads `data.*`. */
export function encodeGlancePush(payload: GlancePushPayload): string {
  const data: Record<string, string | boolean> = {
    url: payload.url,
    kind: payload.kind,
    tag: payload.tag,
    renotify: payload.renotify,
  }
  if (payload.postUrl) data.postUrl = payload.postUrl
  if (payload.openUrl) data.openUrl = payload.openUrl
  if (payload.muteUrl) data.muteUrl = payload.muteUrl
  const body: Record<string, unknown> = {
    title: payload.title,
    body: payload.body,
    data,
  }
  if (payload.actions && payload.actions.length > 0) body.actions = payload.actions
  return JSON.stringify(body)
}
