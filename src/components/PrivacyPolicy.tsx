/**
 * Privacy Policy page component.
 *
 * Covers GDPR, CCPA, and standard privacy requirements for a social
 * location-sharing app with ephemeral content (pulses, stories).
 */

import { useState } from 'react'

const LAST_UPDATED = 'March 28, 2026'
const CONTACT_EMAIL = 'privacy@pulse.app'
const APP_NAME = 'Pulse'

interface SectionProps {
  id: string
  title: string
  children: React.ReactNode
}

function Section({ id, title, children }: SectionProps) {
  return (
    <section id={id} className="mb-10 scroll-mt-20">
      <h2 className="text-xl font-semibold text-foreground mb-3">{title}</h2>
      <div className="text-muted-foreground leading-relaxed space-y-3">{children}</div>
    </section>
  )
}

const TOC_ITEMS = [
  { id: 'overview', label: 'Overview' },
  { id: 'data-collected', label: 'Data We Collect' },
  { id: 'location', label: 'Location Data' },
  { id: 'data-retention', label: 'Data Retention' },
  { id: 'third-parties', label: 'Third-Party Services' },
  { id: 'user-rights', label: 'Your Rights' },
  { id: 'gdpr-ccpa', label: 'GDPR & CCPA' },
  { id: 'cookies', label: 'Cookies & Storage' },
  { id: 'age', label: 'Age Requirement' },
  { id: 'changes', label: 'Changes to This Policy' },
  { id: 'contact', label: 'Contact Us' },
]

export function PrivacyPolicy() {
  const [tocOpen, setTocOpen] = useState(false)

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">
          Last updated: <time dateTime="2026-03-28">{LAST_UPDATED}</time>
        </p>
      </header>

      {/* Mobile table of contents toggle */}
      <div className="mb-8 border border-border rounded-lg overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 text-sm font-medium text-foreground"
          onClick={() => setTocOpen((v) => !v)}
          aria-expanded={tocOpen}
          aria-controls="toc-list"
        >
          <span>Table of Contents</span>
          <span aria-hidden="true">{tocOpen ? '▲' : '▼'}</span>
        </button>
        {tocOpen && (
          <nav id="toc-list" aria-label="Privacy policy sections">
            <ol className="px-4 py-3 space-y-1 text-sm">
              {TOC_ITEMS.map((item, i) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
                    onClick={() => setTocOpen(false)}
                  >
                    {i + 1}. {item.label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}
      </div>

      {/* Sections */}
      <Section id="overview" title="1. Overview">
        <p>
          {APP_NAME} (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) operates the Pulse mobile
          web application (&quot;the App&quot;), a social nightlife discovery platform. This Privacy
          Policy explains how we collect, use, disclose, and protect your information when you use
          the App.
        </p>
        <p>
          By using {APP_NAME} you agree to the collection and use of information in accordance with
          this policy. If you do not agree, please do not use the App.
        </p>
        <p>
          <strong>Age requirement:</strong> The App is intended for users who are 18 years of age or
          older. See <a href="#age" className="text-accent hover:underline">Section 9</a> for
          details.
        </p>
      </Section>

      <Section id="data-collected" title="2. Data We Collect">
        <p>We collect the following categories of information:</p>

        <h3 className="font-medium text-foreground mt-4 mb-1">Account &amp; Profile Information</h3>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Display name and username (chosen by you)</li>
          <li>Profile photo (optional, uploaded by you)</li>
          <li>Email address (used for authentication only, never shown publicly)</li>
          <li>Account creation date</li>
        </ul>

        <h3 className="font-medium text-foreground mt-4 mb-1">Content You Create</h3>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Pulses: energy ratings, captions, hashtags, and attached photos or videos</li>
          <li>Stories: short-form venue content (expire after 24 hours)</li>
          <li>Check-ins: venue associations tied to your account</li>
          <li>Reactions to other users&apos; pulses</li>
        </ul>

        <h3 className="font-medium text-foreground mt-4 mb-1">Location Data</h3>
        <p>
          See <a href="#location" className="text-accent hover:underline">Section 3</a> for full
          details on how we handle location.
        </p>

        <h3 className="font-medium text-foreground mt-4 mb-1">Usage &amp; Analytics Data</h3>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Pages and features you visit within the App</li>
          <li>Interaction events (taps, searches, feature usage) — anonymized</li>
          <li>Performance metrics (page load times, error rates)</li>
          <li>Device type and operating system (not hardware identifiers)</li>
          <li>Browser type and approximate timezone</li>
        </ul>

        <h3 className="font-medium text-foreground mt-4 mb-1">Communications</h3>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>In-app notifications you receive and read receipts</li>
          <li>Support requests or feedback you submit</li>
        </ul>
      </Section>

      <Section id="location" title="3. Location Data">
        <p>
          Location is central to {APP_NAME}&apos;s core function: discovering and rating nearby
          venues. Here is exactly how we handle it:
        </p>

        <h3 className="font-medium text-foreground mt-4 mb-1">What We Collect</h3>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>
            <strong>Approximate location</strong> — used to show nearby venues on the map. Collected
            only while the App is in the foreground.
          </li>
          <li>
            <strong>Venue check-in coordinates</strong> — stored when you explicitly check in to a
            venue. Precise coordinates are stored only during the active session; afterwards only
            the venue association is retained.
          </li>
        </ul>

        <h3 className="font-medium text-foreground mt-4 mb-1">What We Do Not Collect</h3>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Background or passive location tracking</li>
          <li>Location history beyond the current session</li>
          <li>Continuous GPS logs</li>
        </ul>

        <h3 className="font-medium text-foreground mt-4 mb-1">How Location Is Used</h3>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Sorting and filtering nearby venues on the map</li>
          <li>Associating a pulse or check-in with the correct venue</li>
          <li>Generating neighborhood-level energy scores (aggregated, not individual)</li>
        </ul>

        <h3 className="font-medium text-foreground mt-4 mb-1">Storage &amp; Sharing</h3>
        <p>
          Raw coordinates are not stored long-term and are never sold or shared with third-party
          advertisers. Reverse geocoding (converting coordinates to an address) is performed via our
          backend and the result (neighborhood name) is what persists.
        </p>

        <h3 className="font-medium text-foreground mt-4 mb-1">Your Control</h3>
        <p>
          You can deny location permission at any time in your browser or device settings. Without
          location permission the App will still function but map and nearby-venue features will be
          unavailable.
        </p>
      </Section>

      <Section id="data-retention" title="4. Data Retention">
        <p>We apply content-specific retention policies to minimize stored data:</p>

        <div className="overflow-x-auto mt-2">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 font-medium text-foreground">Content Type</th>
                <th className="text-left py-2 font-medium text-foreground">Retention</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                ['Pulses (public energy ratings)', 'Automatically expire after 90 minutes'],
                ['Stories', 'Automatically expire after 24 hours'],
                ['Check-ins', 'Retained until you delete your account'],
                ['Profile data', 'Retained until you delete your account'],
                ['Analytics events', 'Anonymized and aggregated; raw events purged after 90 days'],
                ['Error logs (Sentry)', 'Retained for 90 days per Sentry default policy'],
                ['Deleted account data', 'Permanently purged within 30 days of deletion request'],
              ].map(([type, retention]) => (
                <tr key={type}>
                  <td className="py-2 pr-4">{type}</td>
                  <td className="py-2">{retention}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3">
          Media files (photos, videos) attached to expired pulses or stories are deleted from
          storage at expiry time. Supabase Storage lifecycle rules enforce this automatically.
        </p>
      </Section>

      <Section id="third-parties" title="5. Third-Party Services">
        <p>
          We use the following third-party services that may process your data. We do not sell your
          data to any of these providers.
        </p>

        <div className="space-y-4 mt-2">
          {[
            {
              name: 'Supabase',
              role: 'Backend database, authentication, realtime, and file storage',
              privacy: 'https://supabase.com/privacy',
              location: 'USA (AWS us-east-1)',
            },
            {
              name: 'Sentry',
              role: 'Error monitoring and crash reporting',
              privacy: 'https://sentry.io/privacy/',
              location: 'USA',
            },
            {
              name: 'Vercel Analytics',
              role: 'Aggregated page view and performance analytics (no personal tracking)',
              privacy: 'https://vercel.com/docs/analytics/privacy-policy',
              location: 'USA / Global CDN',
            },
            {
              name: 'Vercel (hosting)',
              role: 'App hosting and edge CDN',
              privacy: 'https://vercel.com/legal/privacy-policy',
              location: 'USA / Global CDN',
            },
          ].map((svc) => (
            <div key={svc.name} className="border border-border rounded-md p-4">
              <p className="font-medium text-foreground">{svc.name}</p>
              <p className="text-sm mt-1">{svc.role}</p>
              <p className="text-sm mt-1">
                <span className="text-muted-foreground">Data location: </span>
                {svc.location}
              </p>
              <p className="text-sm mt-1">
                <span className="text-muted-foreground">Privacy policy: </span>
                <a
                  href={svc.privacy}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  {svc.privacy}
                </a>
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="user-rights" title="6. Your Rights">
        <p>You have the following rights regarding your personal data:</p>

        <ul className="space-y-3 mt-2">
          {[
            {
              right: 'Access',
              desc: 'Request a copy of all personal data we hold about you.',
            },
            {
              right: 'Portability',
              desc: 'Download your data in a machine-readable JSON format via the App\'s Settings → Data Export.',
            },
            {
              right: 'Correction',
              desc: 'Update or correct your profile information at any time in Settings.',
            },
            {
              right: 'Deletion',
              desc: 'Request deletion of your account and all associated data via Settings → Delete Account. Data is purged within 30 days.',
            },
            {
              right: 'Restriction',
              desc: 'Request that we restrict processing of your data while a dispute is resolved.',
            },
            {
              right: 'Objection',
              desc: 'Object to processing based on legitimate interests.',
            },
            {
              right: 'Withdraw Consent',
              desc: 'Where processing is based on consent (e.g., marketing emails), you may withdraw at any time without affecting prior processing.',
            },
          ].map(({ right, desc }) => (
            <li key={right} className="flex gap-3">
              <span className="font-medium text-foreground min-w-[100px]">{right}</span>
              <span>{desc}</span>
            </li>
          ))}
        </ul>

        <p className="mt-4">
          To exercise any right, use the in-app tools in Settings or email{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent hover:underline">
            {CONTACT_EMAIL}
          </a>
          . We will respond within 30 days.
        </p>
      </Section>

      <Section id="gdpr-ccpa" title="7. GDPR & CCPA Compliance">
        <h3 className="font-medium text-foreground mb-1">GDPR (EU/EEA Users)</h3>
        <p>
          For users in the European Economic Area, the legal basis for processing your data is:
        </p>
        <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
          <li>
            <strong>Contract performance</strong> — to provide the App&apos;s core features
          </li>
          <li>
            <strong>Legitimate interests</strong> — analytics, fraud prevention, and App improvement
          </li>
          <li>
            <strong>Consent</strong> — for optional features such as push notifications
          </li>
        </ul>
        <p className="mt-2">
          You may lodge a complaint with your local data protection authority if you believe we have
          violated your rights.
        </p>

        <h3 className="font-medium text-foreground mt-6 mb-1">CCPA (California Residents)</h3>
        <p>California residents have the right to:</p>
        <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
          <li>Know what personal information is collected</li>
          <li>Know whether personal information is sold or disclosed, and to whom</li>
          <li>Opt out of the sale of personal information</li>
          <li>Access their personal information</li>
          <li>Request deletion of their personal information</li>
          <li>Not be discriminated against for exercising CCPA rights</li>
        </ul>
        <p className="mt-2">
          <strong>We do not sell personal information.</strong> To submit a CCPA request, email{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent hover:underline">
            {CONTACT_EMAIL}
          </a>{' '}
          with the subject line &quot;CCPA Request&quot;.
        </p>
      </Section>

      <Section id="cookies" title="8. Cookies & Local Storage">
        <p>
          The App uses browser storage (localStorage, sessionStorage, and cookies) for the following
          purposes:
        </p>

        <div className="overflow-x-auto mt-2">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 font-medium text-foreground">Storage Key</th>
                <th className="text-left py-2 pr-4 font-medium text-foreground">Purpose</th>
                <th className="text-left py-2 font-medium text-foreground">Expires</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                ['supabase.auth.token', 'Authentication session token', 'Session / 1 week'],
                ['pulse_high_contrast', 'Accessibility contrast preference', 'Never (persistent)'],
                ['pulse_a11y_settings', 'Accessibility settings (motion, font size)', 'Never (persistent)'],
                ['pulse_retention_pings', 'DAU/WAU/MAU retention deduplication', '1 year'],
                ['pulse_offline_queue', 'Unsynced actions for offline mode', 'Until synced'],
                ['react-query cache', 'Cached venue/pulse data for offline use', 'Configurable TTL'],
              ].map(([key, purpose, expires]) => (
                <tr key={key}>
                  <td className="py-2 pr-4 font-mono text-xs">{key}</td>
                  <td className="py-2 pr-4">{purpose}</td>
                  <td className="py-2">{expires}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3">
          We do not use third-party advertising cookies. Vercel Analytics uses a privacy-preserving
          approach that does not set cookies for analytics purposes.
        </p>
        <p className="mt-2">
          You can clear all App storage via your browser settings. Doing so will log you out and
          reset your preferences.
        </p>
      </Section>

      <Section id="age" title="9. Age Requirement">
        <p>
          <strong>
            {APP_NAME} is intended for users who are 18 years of age or older.
          </strong>{' '}
          The App features nightlife venue content (bars, clubs, lounges) that is only appropriate
          for adults.
        </p>
        <p>
          We do not knowingly collect personal information from anyone under the age of 18. If you
          are a parent or guardian and believe your child has provided us with personal information,
          please contact us at{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent hover:underline">
            {CONTACT_EMAIL}
          </a>{' '}
          and we will delete that information promptly.
        </p>
      </Section>

      <Section id="changes" title="10. Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. When we do, we will update the
          &quot;Last updated&quot; date at the top of this page and notify users of material changes
          via an in-app notification.
        </p>
        <p>
          Continued use of the App after changes take effect constitutes your acceptance of the
          revised policy.
        </p>
      </Section>

      <Section id="contact" title="11. Contact Us">
        <p>
          If you have questions, concerns, or requests regarding this Privacy Policy or our data
          practices, please contact us:
        </p>
        <address className="not-italic mt-3 space-y-1">
          <p className="font-medium text-foreground">{APP_NAME}</p>
          <p>
            Email:{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent hover:underline">
              {CONTACT_EMAIL}
            </a>
          </p>
        </address>
        <p className="mt-4">
          We aim to respond to all privacy-related inquiries within 30 days.
        </p>
      </Section>
    </div>
  )
}

export default PrivacyPolicy
