/**
 * StaffScannerPage — staff-only page that uses the BarcodeDetector API
 * (where available) plus a manual entry fallback to verify tickets at
 * the door.
 *
 * Gate: feature flag `ticketing` AND `useVenueStaffStatus().isStaff`.
 * Renders `null` when either is off.
 */

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { useVenueStaffStatus } from '@/hooks/use-venue-staff-status'
import {
  verifyTicket,
  type VerifyTicketResponse,
  type ApiResult,
} from '@/lib/staff-scanner-client'

// Minimal BarcodeDetector typing — the global `BarcodeDetector` is
// not yet in lib.dom.d.ts for TS 5.7.
interface DetectedBarcode {
  rawValue: string
  format: string
}
interface BarcodeDetectorInstance {
  detect: (source: ImageBitmapSource) => Promise<DetectedBarcode[]>
}
interface BarcodeDetectorCtor {
  new (options?: { formats?: string[] }): BarcodeDetectorInstance
  getSupportedFormats?: () => Promise<string[]>
}
declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorCtor
  }
}

export interface StaffScannerPageProps {
  currentUserId: string | null
}

type ScanState =
  | { kind: 'idle' }
  | { kind: 'scanning' }
  | { kind: 'success'; result: VerifyTicketResponse }
  | { kind: 'error'; message: string }

export function StaffScannerPage({ currentUserId }: StaffScannerPageProps) {
  const ticketingOn = isFeatureEnabled('ticketing')
  const status = useVenueStaffStatus(currentUserId)
  const [state, setState] = useState<ScanState>({ kind: 'idle' })
  const [manualCode, setManualCode] = useState('')
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null)
  const lastScannedRef = useRef<string | null>(null)

  const canScanWithCamera =
    typeof window !== 'undefined' && typeof window.BarcodeDetector === 'function'

  useEffect(() => {
    return () => {
      stopCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function stopCamera() {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  async function handleSubmit(qr: string) {
    if (!qr) return
    // De-dupe the same QR within a brief window to avoid hammering the API.
    if (lastScannedRef.current === qr) return
    lastScannedRef.current = qr
    setTimeout(() => {
      if (lastScannedRef.current === qr) lastScannedRef.current = null
    }, 2_000)

    setState({ kind: 'scanning' })
    const res: ApiResult<VerifyTicketResponse> = await verifyTicket(qr)
    if (!res.ok) {
      setState({ kind: 'error', message: res.error })
      return
    }
    setState({ kind: 'success', result: res.data })
  }

  async function startCamera() {
    if (!canScanWithCamera || !window.BarcodeDetector) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] })
      const loop = async () => {
        if (!videoRef.current || !detectorRef.current) return
        try {
          const codes = await detectorRef.current.detect(videoRef.current)
          if (codes.length > 0) {
            await handleSubmit(codes[0].rawValue)
          }
        } catch {
          // transient detect errors are fine; we keep scanning
        }
        rafRef.current = requestAnimationFrame(loop)
      }
      rafRef.current = requestAnimationFrame(loop)
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Camera unavailable',
      })
    }
  }

  if (!ticketingOn) return null
  if (status.loading) return null
  if (!status.isStaff) return null

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Ticket Scanner</h1>
        <p className="text-sm text-muted-foreground">
          Verify attendee QR codes at the door. Staff role required.
        </p>
        <div className="mt-2 flex gap-2 flex-wrap">
          {status.venues.map(v => (
            <Badge key={v.venueId} variant="outline">
              {v.role} · {v.venueId.slice(0, 6)}
            </Badge>
          ))}
        </div>
      </header>

      {canScanWithCamera ? (
        <div className="space-y-3">
          <video
            ref={videoRef}
            className="w-full max-w-md aspect-square rounded-xl bg-black object-cover"
            muted
            playsInline
            data-testid="scanner-video"
          />
          <div className="flex gap-2">
            <Button onClick={startCamera} disabled={!!streamRef.current}>
              Start camera
            </Button>
            <Button variant="outline" onClick={stopCamera}>
              Stop
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Camera-based scanning is not supported on this device. Please enter the
          ticket code manually below.
        </p>
      )}

      <form
        onSubmit={e => {
          e.preventDefault()
          void handleSubmit(manualCode.trim())
        }}
        className="space-y-2"
      >
        <label className="text-sm font-medium" htmlFor="manual-code">
          Manual entry
        </label>
        <div className="flex gap-2">
          <input
            id="manual-code"
            value={manualCode}
            onChange={e => setManualCode(e.target.value)}
            className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm"
            placeholder="PULSE-TKT:…"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
          />
          <Button type="submit" disabled={!manualCode.trim()}>
            Verify
          </Button>
        </div>
      </form>

      <div role="status" aria-live="polite" className="min-h-[60px]">
        {state.kind === 'scanning' && (
          <p className="text-sm text-muted-foreground">Verifying…</p>
        )}
        {state.kind === 'success' && (
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-400">
            <p className="font-bold">
              {state.result.status === 'already_scanned'
                ? 'Already scanned'
                : state.result.status === 'ok'
                ? 'Admitted'
                : 'Invalid'}
            </p>
            {state.result.attendeeInitials && (
              <p>Attendee: {state.result.attendeeInitials}</p>
            )}
            {state.result.ticketType && <p>Type: {state.result.ticketType}</p>}
            {state.result.scannedAt && (
              <p className="text-xs text-muted-foreground">
                at {new Date(state.result.scannedAt).toLocaleTimeString()}
              </p>
            )}
          </div>
        )}
        {state.kind === 'error' && (
          <div
            className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            role="alert"
          >
            <p className="font-bold">Scan failed</p>
            <p>{state.message}</p>
          </div>
        )}
      </div>
    </div>
  )
}
