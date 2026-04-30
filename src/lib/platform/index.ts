/**
 * Platform abstraction — feature-gate native capabilities.
 *
 * IMPORTANT: This module must NOT statically import any `@capacitor/*` package.
 * All Capacitor imports are behind dynamic `import()` calls inside functions,
 * so the web bundle never pulls in native code at runtime.
 *
 * Web callers receive graceful fallbacks (e.g. navigator.geolocation, file input,
 * Web Share API) or no-ops where native-only.
 */

export * from './types'
export { isNative, getPlatformName } from './detect'
export { Platform } from './platform'
export { loadNativeModule } from './dynamic-import'
