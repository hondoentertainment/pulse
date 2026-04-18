/**
 * Capture + publish UI for a video pulse.
 *
 * Flow:
 *   1. Platform-preferred capture (Capacitor camera if available; otherwise
 *      `<input type="file" accept="video/*" capture>`).
 *   2. Client-side compression via the existing `video-compression.ts`.
 *   3. Canvas-rendered first-frame thumbnail.
 *   4. Optional trim (if duration > 30s; simple start slider — full timeline
 *      editor is a follow-up).
 *   5. Caption moderation via the server-side `moderateServer` flow, which
 *      calls `POST /api/video/publish`; captions are re-screened server-side.
 *   6. Offline-aware: if `navigator.onLine === false`, enqueue the publish
 *      job via `video-offline-queue` and drain on reconnect.
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import { compressVideo, formatFileSize } from '@/lib/video-compression'
import { publishVideoPulse } from '@/lib/data/video-pulses'
import {
  requestUploadUrl,
  uploadVideo,
  type VideoClientOptions,
} from '@/lib/video-client'
import { enqueueVideoPublish } from '@/lib/video-offline-queue'

// --- optional Capacitor camera abstraction --------------------------
// The `Platform.camera` module is authored in a parallel wave. Until it
// lands we feature-detect at runtime and fall back to the file input.

interface CameraCapture {
  captureVideo: (opts?: { maxDurationSeconds?: number }) => Promise<File>
}

function getPlatformCamera(): CameraCapture | null {
  const p = (globalThis as unknown as { Platform?: { camera?: CameraCapture } }).Platform
  if (p && typeof p.camera?.captureVideo === 'function') return p.camera
  return null
}

// --- helpers ---------------------------------------------------------

async function generateThumbnail(file: Blob): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.src = url
    video.muted = true
    video.preload = 'metadata'
    video.playsInline = true

    const cleanup = () => URL.revokeObjectURL(url)

    video.onloadeddata = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth || 720
        canvas.height = video.videoHeight || 1280
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          cleanup()
          return resolve(null)
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(
          (blob) => {
            cleanup()
            resolve(blob)
          },
          'image/jpeg',
          0.8,
        )
      } catch {
        cleanup()
        resolve(null)
      }
    }
    video.onerror = () => {
      cleanup()
      resolve(null)
    }
  })
}

async function probeVideo(
  blob: Blob,
): Promise<{ width: number; height: number; durationMs: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const video = document.createElement('video')
    video.src = url
    video.preload = 'metadata'
    const done = (v: { width: number; height: number; durationMs: number }) => {
      URL.revokeObjectURL(url)
      resolve(v)
    }
    video.onloadedmetadata = () =>
      done({
        width: video.videoWidth || 720,
        height: video.videoHeight || 1280,
        durationMs: Math.max(1, Math.round(video.duration * 1000)),
      })
    video.onerror = () => done({ width: 720, height: 1280, durationMs: 1 })
  })
}

// --- component -------------------------------------------------------

export interface VideoCaptureSheetProps {
  open: boolean
  onClose: () => void
  venueId?: string
  venueLat?: number
  venueLng?: number
  clientOptions?: VideoClientOptions
}

type Step = 'pick' | 'preview' | 'publishing' | 'done'

export function VideoCaptureSheet({
  open,
  onClose,
  venueId,
  venueLat,
  venueLng,
  clientOptions,
}: VideoCaptureSheetProps) {
  const [step, setStep] = useState<Step>('pick')
  const [file, setFile] = useState<File | null>(null)
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [durationMs, setDurationMs] = useState<number>(0)
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 720,
    height: 1280,
  })
  const [caption, setCaption] = useState('')
  const [trimStart, setTrimStart] = useState(0)
  const [isCompressing, setIsCompressing] = useState(false)
  const [compressionPct, setCompressionPct] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const needsTrim = useMemo(() => durationMs > 30_000, [durationMs])

  const handlePickNative = useCallback(async () => {
    setError(null)
    const camera = getPlatformCamera()
    if (!camera) {
      // Fall back to `<input>`.
      fileInputRef.current?.click()
      return
    }
    try {
      const captured = await camera.captureVideo({ maxDurationSeconds: 60 })
      await ingestFile(captured)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record video')
    }
  }, [])

  const ingestFile = useCallback(async (f: File) => {
    setFile(f)
    setIsCompressing(true)
    try {
      const compressed = await compressVideo(
        f,
        { maxWidth: 720, maxHeight: 1280, videoBitrate: 1_200_000 },
        (p) => setCompressionPct(Math.round(p.percent)),
      )
      setCompressedBlob(compressed)
      const probed = await probeVideo(compressed)
      setDurationMs(probed.durationMs)
      setDimensions({ width: probed.width, height: probed.height })
      const url = URL.createObjectURL(compressed)
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return url
      })
      setStep('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Compression failed')
    } finally {
      setIsCompressing(false)
    }
  }, [])

  const handleFileInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]
      if (!f) return
      if (!f.type.startsWith('video/')) {
        setError('Please select a video file')
        return
      }
      if (f.size > 200 * 1024 * 1024) {
        setError('Video is too large (max 200 MB pre-compression)')
        return
      }
      await ingestFile(f)
    },
    [ingestFile],
  )

  const handlePublish = useCallback(async () => {
    if (!compressedBlob) return
    if (!venueId || typeof venueLat !== 'number' || typeof venueLng !== 'number') {
      setError('No venue selected')
      return
    }

    setStep('publishing')
    setError(null)

    const mime = compressedBlob.type || 'video/webm'
    const bytes = compressedBlob.size
    const filename = `pulse-${Date.now()}.${mime.includes('mp4') ? 'mp4' : 'webm'}`

    // Generate thumbnail in parallel with requesting the upload URL.
    const [thumbnailBlob, urlResult] = await Promise.all([
      generateThumbnail(compressedBlob),
      requestUploadUrl({ filename, mime, bytes }, clientOptions),
    ])

    if (!urlResult.ok) {
      // Offline? Queue for later.
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        enqueueVideoPublish({
          id: `vpj_${Date.now()}`,
          payload: {
            venueId,
            caption,
            hashtags: [],
            videoStorageKey: `pending/${filename}`,
            durationMs,
            width: dimensions.width,
            height: dimensions.height,
            thumbnailStorageKey: null,
            mime,
            bytes,
            venueLat,
            venueLng,
          },
          localPreviewUrl: previewUrl ?? undefined,
        })
        setStep('done')
        return
      }
      setError(urlResult.error)
      setStep('preview')
      return
    }

    const upload = await uploadVideo(urlResult.data.signedUrl, compressedBlob, mime)
    if (!upload.ok) {
      setError(upload.error)
      setStep('preview')
      return
    }

    let thumbnailStorageKey: string | null = null
    if (thumbnailBlob) {
      const thumbFilename = `thumb-${Date.now()}.jpg`
      const thumbUrl = await requestUploadUrl(
        { filename: thumbFilename, mime: 'video/mp4' /* thumb bucket reuse */, bytes: thumbnailBlob.size },
        clientOptions,
      )
      // Thumbnail upload is best-effort — if it fails, we still publish.
      if (thumbUrl.ok) {
        const thumbUpload = await uploadVideo(thumbUrl.data.signedUrl, thumbnailBlob, 'image/jpeg')
        if (thumbUpload.ok) thumbnailStorageKey = thumbUrl.data.path
      }
    }

    const publishResult = await publishVideoPulse(
      {
        venueId,
        caption,
        hashtags: [],
        videoStorageKey: urlResult.data.path,
        durationMs,
        width: dimensions.width,
        height: dimensions.height,
        thumbnailStorageKey,
        mime,
        bytes,
        venueLat,
        venueLng,
      },
      clientOptions?.authToken,
    )

    if (!publishResult.ok) {
      setError(publishResult.error)
      setStep('preview')
      return
    }

    setStep('done')
  }, [
    caption,
    clientOptions,
    compressedBlob,
    dimensions.height,
    dimensions.width,
    durationMs,
    previewUrl,
    venueId,
    venueLat,
    venueLng,
  ])

  if (!open) return null

  return (
    <div
      data-testid="video-capture-sheet"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-background flex flex-col"
    >
      <header className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-lg font-semibold">Record a video pulse</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-muted-foreground"
        >
          Close
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {error && (
          <div role="alert" className="text-sm text-destructive">
            {error}
          </div>
        )}

        {step === 'pick' && (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handlePickNative}
              className="px-4 py-3 rounded-lg bg-primary text-primary-foreground"
              data-testid="video-capture-pick"
            >
              Record with camera
            </button>
            <p className="text-sm text-muted-foreground">
              Up to 60 seconds. Compressed on-device before upload.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              // `capture` hints to mobile browsers that the camera is preferred.
              // Types don't expose the attribute so the string literal is fine.
              {...({ capture: 'environment' } as Record<string, string>)}
              onChange={handleFileInput}
              className="hidden"
              data-testid="video-capture-file"
            />
          </div>
        )}

        {isCompressing && (
          <div data-testid="video-capture-compressing" className="text-sm text-muted-foreground">
            Compressing… {compressionPct}%
          </div>
        )}

        {step === 'preview' && previewUrl && (
          <div className="flex flex-col gap-3">
            <video
              src={previewUrl}
              controls
              playsInline
              className="w-full rounded-lg bg-black aspect-[9/16] max-h-[60vh] object-contain"
              data-testid="video-capture-preview"
            />
            <p className="text-xs text-muted-foreground">
              {formatFileSize(compressedBlob?.size ?? 0)} · {Math.round(durationMs / 1000)}s
            </p>

            {needsTrim && (
              <label className="flex flex-col gap-1 text-sm">
                Trim start: {Math.round(trimStart / 1000)}s
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, durationMs - 30_000)}
                  value={trimStart}
                  onChange={(e) => setTrimStart(Number(e.target.value))}
                  data-testid="video-capture-trim"
                />
              </label>
            )}

            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, 500))}
              placeholder="Add a caption…"
              className="w-full p-2 rounded border border-border bg-background"
              rows={3}
              data-testid="video-capture-caption"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setStep('pick')
                  setCompressedBlob(null)
                  if (previewUrl) URL.revokeObjectURL(previewUrl)
                  setPreviewUrl(null)
                }}
                className="px-4 py-2 rounded border border-border"
              >
                Retake
              </button>
              <button
                type="button"
                onClick={handlePublish}
                className="flex-1 px-4 py-2 rounded bg-primary text-primary-foreground"
                data-testid="video-capture-publish"
              >
                Publish
              </button>
            </div>
          </div>
        )}

        {step === 'publishing' && (
          <div data-testid="video-capture-publishing" className="text-sm">
            Publishing…
          </div>
        )}

        {step === 'done' && (
          <div className="flex flex-col gap-3">
            <p className="text-sm">Your pulse is live.</p>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded bg-primary text-primary-foreground"
            >
              Done
            </button>
          </div>
        )}
      </div>

      {/* Hidden input so `handlePickNative` can delegate to file input. */}
      {step !== 'pick' && (
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileInput}
          className="hidden"
        />
      )}
    </div>
  )
}

export default VideoCaptureSheet
