// Browser API polyfills for jsdom test environment
/* eslint-disable @typescript-eslint/no-explicit-any */
import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// IntersectionObserver
if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = class IntersectionObserver {
    readonly root: Element | null = null
    readonly rootMargin: string = '0px'
    readonly thresholds: ReadonlyArray<number> = [0]
    constructor(
      private callback: IntersectionObserverCallback,
      _options?: IntersectionObserverInit
    ) {}
    observe(_target: Element) {
      // Immediately trigger with isIntersecting: true
      this.callback(
        [{ isIntersecting: true, intersectionRatio: 1, target: _target, boundingClientRect: {} as DOMRectReadOnly, intersectionRect: {} as DOMRectReadOnly, rootBounds: null, time: Date.now() }] as IntersectionObserverEntry[],
        this as any
      )
    }
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] { return [] }
  } as any
}

// ResizeObserver
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    constructor(_callback: ResizeObserverCallback) {}
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any
}

// matchMedia
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

// navigator.vibrate
if (typeof navigator !== 'undefined' && !navigator.vibrate) {
  Object.defineProperty(navigator, 'vibrate', {
    value: vi.fn().mockReturnValue(true),
    writable: true,
    configurable: true,
  })
}

// navigator.geolocation
if (typeof navigator !== 'undefined' && !navigator.geolocation) {
  Object.defineProperty(navigator, 'geolocation', {
    value: {
      getCurrentPosition: vi.fn(),
      watchPosition: vi.fn().mockReturnValue(1),
      clearWatch: vi.fn(),
    },
    writable: true,
    configurable: true,
  })
}

// SpeechRecognition
if (typeof globalThis.SpeechRecognition === 'undefined') {
  ;(globalThis as any).SpeechRecognition = class SpeechRecognition {
    continuous = false
    interimResults = false
    lang = 'en-US'
    onresult: any = null
    onerror: any = null
    onend: any = null
    onstart: any = null
    start() {}
    stop() {}
    abort() {}
  }
  ;(globalThis as any).webkitSpeechRecognition = (globalThis as any).SpeechRecognition
}

// canvas getContext
if (typeof HTMLCanvasElement !== 'undefined') {
  const originalGetContext = HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = function (contextId: string, ...args: any[]) {
    if (contextId === '2d') {
      return {
        fillRect: vi.fn(),
        clearRect: vi.fn(),
        getImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray(0) }),
        putImageData: vi.fn(),
        createImageData: vi.fn().mockReturnValue({}),
        setTransform: vi.fn(),
        drawImage: vi.fn(),
        save: vi.fn(),
        fillText: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        stroke: vi.fn(),
        translate: vi.fn(),
        scale: vi.fn(),
        rotate: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        measureText: vi.fn().mockReturnValue({ width: 0 }),
        transform: vi.fn(),
        rect: vi.fn(),
        clip: vi.fn(),
        createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
        createRadialGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
        canvas: this,
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        font: '10px sans-serif',
        textAlign: 'start',
        textBaseline: 'alphabetic',
        globalAlpha: 1,
        globalCompositeOperation: 'source-over',
      } as any
    }
    return originalGetContext?.call(this, contextId, ...args) ?? null
  } as any
}

// window.scrollTo
if (typeof window !== 'undefined') {
  window.scrollTo = vi.fn() as any
}

// Element.scrollIntoView
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn()
}

// HTMLDialogElement.showModal / close
if (typeof HTMLDialogElement !== 'undefined') {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = vi.fn()
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = vi.fn()
  }
}
