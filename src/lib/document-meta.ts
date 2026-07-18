/**
 * Client-side document title + Open Graph / Twitter meta updates
 * for shareable venue and shortlist surfaces.
 */

export interface DocumentMetaInput {
  title: string
  description: string
  url?: string
  image?: string
  type?: 'website' | 'article'
}

const DEFAULT_IMAGE = '/screenshots/tonight.png'
const SITE_NAME = 'Pulse'

function upsertMeta(attr: 'name' | 'property', key: string, content: string): void {
  if (typeof document === 'undefined') return
  let el = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertLink(rel: string, href: string): void {
  if (typeof document === 'undefined') return
  let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null
  if (!el) {
    el = document.createElement('link')
    el.rel = rel
    document.head.appendChild(el)
  }
  el.href = href
}

export function setDocumentMeta(input: DocumentMetaInput): void {
  if (typeof document === 'undefined') return

  const title = input.title.includes(SITE_NAME) ? input.title : `${input.title} · ${SITE_NAME}`
  const description = input.description.slice(0, 200)
  const url =
    input.url ??
    (typeof window !== 'undefined' ? window.location.href : 'https://pulse.app/')
  const image = absoluteUrl(input.image ?? DEFAULT_IMAGE)
  const type = input.type ?? 'website'

  document.title = title
  upsertMeta('name', 'description', description)
  upsertMeta('property', 'og:site_name', SITE_NAME)
  upsertMeta('property', 'og:type', type)
  upsertMeta('property', 'og:title', title)
  upsertMeta('property', 'og:description', description)
  upsertMeta('property', 'og:url', url)
  upsertMeta('property', 'og:image', image)
  upsertMeta('name', 'twitter:card', 'summary_large_image')
  upsertMeta('name', 'twitter:title', title)
  upsertMeta('name', 'twitter:description', description)
  upsertMeta('name', 'twitter:image', image)
  upsertLink('canonical', url)
}

export function resetDocumentMeta(): void {
  setDocumentMeta({
    title: 'Pulse — Know where to go right now',
    description:
      'Live Seattle nightlife energy, confidence, and Tonight picks—before you waste the night.',
    url: typeof window !== 'undefined' ? `${window.location.origin}/` : 'https://pulse.app/',
    image: DEFAULT_IMAGE,
  })
}

export function absoluteUrl(pathOrUrl: string, base?: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  const origin =
    base ??
    (typeof window !== 'undefined' ? window.location.origin : 'https://pulse.app')
  if (pathOrUrl.startsWith('/')) return `${origin}${pathOrUrl}`
  return `${origin}/${pathOrUrl}`
}

export function venueDocumentMeta(input: {
  name: string
  city?: string
  category?: string
  energyLabel?: string
  confidence?: string
  venueId: string
}): DocumentMetaInput {
  const place = [input.category, input.city].filter(Boolean).join(' · ')
  const energy = input.energyLabel ? `${input.energyLabel} right now` : 'Live energy'
  const confidence = input.confidence ? ` · ${input.confidence} confidence` : ''
  return {
    title: input.name,
    description: `${place ? `${place}. ` : ''}${energy}${confidence}. Know where to go on Pulse.`,
    url: absoluteUrl(`/venue/${encodeURIComponent(input.venueId)}`),
  }
}

export function shortlistDocumentMeta(venueNames: string[]): DocumentMetaInput {
  const preview = venueNames.slice(0, 3).join(', ')
  const more = venueNames.length > 3 ? ` +${venueNames.length - 3} more` : ''
  return {
    title: 'Tonight shortlist',
    description: venueNames.length
      ? `Group picks: ${preview}${more}. Open on Pulse to decide together.`
      : 'A shared Tonight shortlist on Pulse.',
    url: typeof window !== 'undefined' ? window.location.href : absoluteUrl('/shortlist'),
  }
}
