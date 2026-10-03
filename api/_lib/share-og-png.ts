/**
 * PNG Open Graph card. iMessage, Slack, and Twitter drop SVG og:image,
 * so the venue name and energy freshness have to be real pixels.
 */

import { deflateSync } from 'node:zlib'
import { glyphFor } from './share-og-font.js'

export const SHARE_OG_WIDTH = 1200
export const SHARE_OG_HEIGHT = 630

export const SHARE_OG_LAYOUT = {
  padX: 72,
  titleY: 168,
  titleScale: 6,
  energyY: 280,
  energyScale: 5,
  eyebrowY: 96,
  eyebrowScale: 3,
  ctaY: 430,
  ctaScale: 4,
} as const

export interface ShareOgCardPaint {
  eyebrow: string
  title: string
  energyLine: string
  cta: string
}

const BG = { r: 0x0a, g: 0x0a, b: 0x0d }
const INK = { r: 0xf5, g: 0xf5, b: 0xf7 }
const MUTED = { r: 0x8c, g: 0x8c, b: 0x94 }
const ENERGY = { r: 0xfa, g: 0x59, b: 0x8c }
const CTA_BG = { r: 0x73, g: 0xd1, b: 0xff }
const CTA_INK = { r: 0x0a, g: 0x0a, b: 0x0d }

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[n] = c >>> 0
  }
  return table
})()

function crc32(data: Buffer): number {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i += 1) {
    c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([length, typeBuf, data, crc])
}

export interface PaintedShareCard {
  width: number
  height: number
  rgb: Buffer
  pixel: (x: number, y: number) => [number, number, number]
}

function setPixel(
  rgb: Buffer,
  width: number,
  height: number,
  x: number,
  y: number,
  color: { r: number; g: number; b: number },
): void {
  if (x < 0 || y < 0 || x >= width || y >= height) return
  const offset = (y * width + x) * 3
  rgb[offset] = color.r
  rgb[offset + 1] = color.g
  rgb[offset + 2] = color.b
}

function fillRect(
  rgb: Buffer,
  width: number,
  height: number,
  x: number,
  y: number,
  w: number,
  h: number,
  color: { r: number; g: number; b: number },
): void {
  for (let row = 0; row < h; row += 1) {
    for (let col = 0; col < w; col += 1) {
      setPixel(rgb, width, height, x + col, y + row, color)
    }
  }
}

function textWidth(text: string, scale: number): number {
  const gap = scale
  let width = 0
  for (const char of text) {
    if (char === '·') {
      width += 5 * scale + gap
      continue
    }
    width += 5 * scale + gap
  }
  return Math.max(0, width - gap)
}

function fitText(text: string, scale: number, maxWidth: number): string {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  if (textWidth(trimmed, scale) <= maxWidth) return trimmed
  let next = trimmed
  while (next.length > 1 && textWidth(`${next}…`, scale) > maxWidth) {
    next = next.slice(0, -1).trimEnd()
  }
  return `${next}…`
}

function drawDot(
  rgb: Buffer,
  width: number,
  height: number,
  x: number,
  y: number,
  scale: number,
  color: { r: number; g: number; b: number },
): void {
  const size = Math.max(2, scale)
  const dx = x + 2 * scale
  const dy = y + 3 * scale
  fillRect(rgb, width, height, dx, dy, size, size, color)
}

function drawGlyph(
  rgb: Buffer,
  width: number,
  height: number,
  glyph: number[],
  x: number,
  y: number,
  scale: number,
  color: { r: number; g: number; b: number },
): void {
  for (let row = 0; row < glyph.length; row += 1) {
    const bits = glyph[row] ?? 0
    for (let col = 0; col < 5; col += 1) {
      const on = (bits & (1 << (4 - col))) !== 0
      if (!on) continue
      fillRect(rgb, width, height, x + col * scale, y + row * scale, scale, scale, color)
    }
  }
}

function drawText(
  rgb: Buffer,
  width: number,
  height: number,
  text: string,
  x: number,
  y: number,
  scale: number,
  color: { r: number; g: number; b: number },
  maxWidth: number,
): void {
  const fitted = fitText(text, scale, maxWidth)
  let cursor = x
  for (const char of fitted) {
    if (char === '·') {
      drawDot(rgb, width, height, cursor, y, scale, color)
    } else if (char !== '…') {
      const glyph = glyphFor(char)
      if (glyph) drawGlyph(rgb, width, height, glyph, cursor, y, scale, color)
    } else {
      drawDot(rgb, width, height, cursor, y + 4 * scale, scale, color)
    }
    cursor += 5 * scale + scale
  }
}

export function paintShareOgCard(input: ShareOgCardPaint): PaintedShareCard {
  const width = SHARE_OG_WIDTH
  const height = SHARE_OG_HEIGHT
  const rgb = Buffer.alloc(width * height * 3, BG.r)
  for (let i = 2; i < rgb.length; i += 3) rgb[i] = BG.b

  const maxText = width - SHARE_OG_LAYOUT.padX * 2
  drawText(rgb, width, height, input.eyebrow, SHARE_OG_LAYOUT.padX, SHARE_OG_LAYOUT.eyebrowY, SHARE_OG_LAYOUT.eyebrowScale, MUTED, maxText)
  drawText(rgb, width, height, input.title, SHARE_OG_LAYOUT.padX, SHARE_OG_LAYOUT.titleY, SHARE_OG_LAYOUT.titleScale, INK, maxText)
  drawText(rgb, width, height, input.energyLine, SHARE_OG_LAYOUT.padX, SHARE_OG_LAYOUT.energyY, SHARE_OG_LAYOUT.energyScale, ENERGY, maxText)

  const ctaW = Math.min(640, textWidth(input.cta, SHARE_OG_LAYOUT.ctaScale) + 80)
  fillRect(rgb, width, height, SHARE_OG_LAYOUT.padX, SHARE_OG_LAYOUT.ctaY, ctaW, 80, CTA_BG)
  drawText(
    rgb,
    width,
    height,
    input.cta,
    SHARE_OG_LAYOUT.padX + 28,
    SHARE_OG_LAYOUT.ctaY + 24,
    SHARE_OG_LAYOUT.ctaScale,
    CTA_INK,
    ctaW - 56,
  )

  return {
    width,
    height,
    rgb,
    pixel(x: number, y: number) {
      if (x < 0 || y < 0 || x >= width || y >= height) return [0, 0, 0]
      const offset = (y * width + x) * 3
      return [rgb[offset], rgb[offset + 1], rgb[offset + 2]]
    },
  }
}

export function encodeShareOgPng(painted: PaintedShareCard): Buffer {
  const { width, height, rgb } = painted
  const stride = width * 3
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y += 1) {
    const rawOffset = y * (stride + 1)
    raw[rawOffset] = 0
    rgb.copy(raw, rawOffset + 1, y * stride, y * stride + stride)
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

export function renderShareOgPng(input: ShareOgCardPaint): Buffer {
  return encodeShareOgPng(paintShareOgCard(input))
}
