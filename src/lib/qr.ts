/**
 * QR code rendering helper.
 *
 * Wraps the `qrcode` dep (~30 KB gz) with a lazy-loaded dynamic import so
 * it doesn't land in the main bundle. Returns a data URL the caller can
 * use directly in <img src>.
 */

export async function renderQrDataUrl(payload: string): Promise<string> {
  const mod = await import('qrcode')
  return mod.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 256,
  })
}
