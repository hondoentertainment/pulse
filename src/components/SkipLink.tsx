/**
 * SkipLink — "Skip to main content" accessibility shortcut.
 *
 * Visually hidden until focused via Tab key, then appears in the top-left
 * corner. Allows keyboard and screen reader users to bypass navigation and
 * jump directly to the primary content area.
 *
 * Usage:
 *   1. Render <SkipLink /> as the very first element inside <body> / the root.
 *   2. Add id="main-content" (or your chosen targetId) to the <main> element.
 *
 * @example
 * // App.tsx
 * <SkipLink />
 * <AppHeader />
 * <main id="main-content">...</main>
 */

interface SkipLinkProps {
  /** The id of the element to skip to. Defaults to "main-content". */
  targetId?: string
  /** Link label. Defaults to "Skip to main content". */
  label?: string
}

export function SkipLink({
  targetId = 'main-content',
  label = 'Skip to main content',
}: SkipLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      className={[
        // Visually hidden by default
        'absolute left-2 top-2 z-[9999]',
        '-translate-y-full opacity-0',
        // Revealed on focus
        'focus:translate-y-0 focus:opacity-100',
        // Styling
        'rounded-md bg-background px-4 py-2 text-sm font-medium text-foreground shadow-md ring-2 ring-accent',
        'transition-all duration-150',
        // Ensure it is never interactive when hidden (avoids accidental clicks)
        'focus-visible:outline-none',
      ].join(' ')}
    >
      {label}
    </a>
  )
}

export default SkipLink
