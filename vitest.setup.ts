/**
 * Global vitest setup — polyfills for jsdom environment.
 *
 * jsdom lacks ResizeObserver and window.matchMedia; many UI components
 * (radix-ui, framer-motion, map components) rely on them at import time.
 */

// ── ResizeObserver polyfill ────────────────────────────────────────
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  // @ts-expect-error — minimal stub for test environment
  globalThis.ResizeObserver = ResizeObserverStub
}

// ── window.matchMedia polyfill ─────────────────────────────────────
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}
