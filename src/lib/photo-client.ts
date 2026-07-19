/**
 * Client helpers for pulse/venue photo upload via POST /api/photos/upload-url.
 */

import { supabase } from './supabase'
import { resolvePulseMediaUrl } from './pulse-media'

export interface PhotoUploadUrlResponse {
  bucket: string
  path: string
  signedUrl: string
  publicUrl: string
  mime: string
  maxBytes: number
  expiresAt: string
}

export type PhotoClientResultOk<T> = { ok: true; data: T }
export type PhotoClientResultErr = { ok: false; error: string; status?: number }
export type PhotoClientResult<T> = PhotoClientResultOk<T> | PhotoClientResultErr

export type PhotoMime = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

const ENDPOINT = '/api/photos/upload-url'

async function getAccessToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  } catch {
    return null
  }
}

function err(message: string, status?: number): PhotoClientResultErr {
  return { ok: false, error: message, status }
}

export function mimeFromFormat(format: string | undefined): PhotoMime {
  switch ((format ?? '').toLowerCase()) {
    case 'png':
      return 'image/png'
    case 'webp':
      return 'image/webp'
    case 'gif':
      return 'image/gif'
    default:
      return 'image/jpeg'
  }
}

/** Convert a data URL to a Blob (browser). */
export function dataUrlToBlob(dataUrl: string): Blob | null {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl)
  if (!match) return null
  const mime = match[1]
  const b64 = match[2]
  try {
    const binary = atob(b64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new Blob([bytes], { type: mime })
  } catch {
    return null
  }
}

export async function requestPhotoUploadUrl(
  args: { filename: string; mime: PhotoMime; bytes: number },
  opts: { fetchImpl?: typeof fetch; authToken?: string | null } = {},
): Promise<PhotoClientResult<PhotoUploadUrlResponse>> {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  if (typeof fetchImpl !== 'function') return err('fetch is not available')

  const token = opts.authToken !== undefined ? opts.authToken : await getAccessToken()

  let res: Response
  try {
    res = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(args),
    })
  } catch (e) {
    return err(e instanceof Error ? e.message : 'network error', 0)
  }

  let payload: unknown
  try {
    payload = await res.json()
  } catch {
    return err(`Photo upload-url returned non-JSON (status ${res.status})`, res.status)
  }

  if (!res.ok) {
    const envelope = payload as { error?: string | { message?: string } }
    const message =
      typeof envelope.error === 'string'
        ? envelope.error
        : envelope.error?.message ?? `Upload URL failed (${res.status})`
    return err(message, res.status)
  }

  const data = (payload as { data?: PhotoUploadUrlResponse })?.data
  if (!data?.signedUrl || !data.path) {
    return err('Malformed upload-url response', res.status)
  }
  return { ok: true, data }
}

export async function uploadPhotoBlob(
  signedUrl: string,
  blob: Blob,
  mime: string,
  opts: { fetchImpl?: typeof fetch } = {},
): Promise<PhotoClientResult<{ uploaded: true }>> {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  try {
    const res = await fetchImpl(signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': mime },
      body: blob,
    })
    if (!res.ok) {
      return err(`Photo upload failed (${res.status})`, res.status)
    }
    return { ok: true, data: { uploaded: true } }
  } catch (e) {
    return err(e instanceof Error ? e.message : 'upload network error', 0)
  }
}

/**
 * Pick → signed URL → PUT. Returns storage path (preferred for pulse.photos)
 * plus a public URL for immediate display / vision assess.
 *
 * When upload fails (e.g. synthetic local URL), returns `{ ok: false }` so
 * callers can fall back to base64 assess while still showing a local preview.
 */
export async function uploadPulsePhoto(args: {
  dataUrl?: string
  blob?: Blob
  format?: string
  filename?: string
  fetchImpl?: typeof fetch
}): Promise<
  PhotoClientResult<{
    storageKey: string
    publicUrl: string
    mime: PhotoMime
  }>
> {
  const mime = mimeFromFormat(args.format)
  const blob =
    args.blob ??
    (args.dataUrl ? dataUrlToBlob(args.dataUrl) : null) ??
    null
  if (!blob) return err('No photo blob available to upload')

  const filename = args.filename ?? `pulse-${Date.now()}.${mime.split('/')[1] || 'jpg'}`
  const urlResult = await requestPhotoUploadUrl(
    { filename, mime, bytes: blob.size },
    { fetchImpl: args.fetchImpl },
  )
  if (!urlResult.ok) return urlResult

  const uploaded = await uploadPhotoBlob(urlResult.data.signedUrl, blob, mime, {
    fetchImpl: args.fetchImpl,
  })
  if (!uploaded.ok) return uploaded

  const publicUrl =
    urlResult.data.publicUrl ||
    resolvePulseMediaUrl(urlResult.data.path) ||
    urlResult.data.path

  return {
    ok: true,
    data: {
      storageKey: urlResult.data.path,
      publicUrl,
      mime,
    },
  }
}
