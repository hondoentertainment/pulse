/**
 * Glasses-glance Web Push shape.
 *
 * Meta Ray-Ban / Ray-Ban Display do not talk to this PWA. The phone shows
 * the notification; the Meta AI app mirrors it when the user allows that.
 * Titles stay short. `kind` and `tag` let the service worker collapse updates.
 */

export interface GlancePushPayload {
  title: string
  body: string
  url: string
  kind: string
  tag: string
  renotify: boolean
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
  return JSON.stringify({
    title: payload.title,
    body: payload.body,
    data: {
      url: payload.url,
      kind: payload.kind,
      tag: payload.tag,
      renotify: payload.renotify,
    },
  })
}
