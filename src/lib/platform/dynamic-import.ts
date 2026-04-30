/**
 * Hides a module specifier from Vite's static import-analysis so the web
 * bundle never tries to resolve native-only packages.
 *
 * Usage:
 *   const mod = await loadNativeModule<typeof import('@capacitor/app')>('@capacitor/app')
 *
 * The Function-based loader means Vite / Rollup never sees the specifier as
 * a literal argument to `import()`. On native, the specifier resolves via
 * the underlying runtime loader; on web, callers MUST guard with `isNative()`
 * first — otherwise the call will throw at runtime.
 */
export async function loadNativeModule<T = unknown>(specifier: string): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const loader = new Function('s', 'return import(s)') as (s: string) => Promise<T>
  return loader(specifier)
}
