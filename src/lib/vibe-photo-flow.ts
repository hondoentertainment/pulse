/**
 * Shared Create-Pulse photo + vibe-vision orchestration (pure async helpers).
 */

import { assessVibeFromPhoto, type VibeAssessment, type VibeAssessClientResult } from './vibe-assess-client'
import { uploadPulsePhoto } from './photo-client'

export interface PreparedPulsePhoto {
  previewUrl: string
  /** Storage object key when upload succeeded; otherwise null (local-only). */
  storageKey: string | null
  publicUrl: string | null
}

export async function preparePulsePhoto(args: {
  dataUrl: string
  format?: string
  blob?: Blob
}): Promise<PreparedPulsePhoto> {
  const uploaded = await uploadPulsePhoto({
    dataUrl: args.dataUrl,
    blob: args.blob,
    format: args.format,
  })

  if (uploaded.ok) {
    return {
      previewUrl: args.dataUrl,
      storageKey: uploaded.data.storageKey,
      publicUrl: uploaded.data.publicUrl,
    }
  }

  // Dev / offline: keep the local preview; submit may still use data URL.
  return {
    previewUrl: args.dataUrl,
    storageKey: null,
    publicUrl: null,
  }
}

export async function assessPreparedPhoto(args: {
  photo: PreparedPulsePhoto
  dataUrl: string
  venueName?: string
  venueCategory?: string
}): Promise<VibeAssessClientResult> {
  const { photo, dataUrl, venueName, venueCategory } = args

  if (photo.storageKey) {
    const byKey = await assessVibeFromPhoto({
      storageKey: photo.storageKey,
      venueName,
      venueCategory,
    })
    if (byKey.ok) return byKey
  }

  if (photo.publicUrl?.startsWith('http')) {
    const byUrl = await assessVibeFromPhoto({
      imageUrl: photo.publicUrl,
      venueName,
      venueCategory,
    })
    if (byUrl.ok) return byUrl
  }

  return assessVibeFromPhoto({
    imageBase64: dataUrl,
    venueName,
    venueCategory,
  })
}

export function photosForPulseSubmit(photo: PreparedPulsePhoto | null): string[] {
  if (!photo) return []
  if (photo.storageKey) return [photo.storageKey]
  if (photo.publicUrl) return [photo.publicUrl]
  // Last resort: persist data URL only in mock/dev (API caps item length at 2048,
  // so large data URLs are dropped server-side — upload is preferred).
  if (photo.previewUrl.startsWith('data:') && photo.previewUrl.length <= 2048) {
    return [photo.previewUrl]
  }
  return []
}

export type { VibeAssessment }
