/**
 * Terms of Service page component.
 *
 * Standard ToS for a social nightlife app with ephemeral content,
 * user-generated content, venue data, and a creator economy.
 */

import { useState } from 'react'

const LAST_UPDATED = 'March 28, 2026'
const EFFECTIVE_DATE = 'March 28, 2026'
const CONTACT_EMAIL = 'legal@pulse.app'
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
  { id: 'acceptance', label: 'Acceptance of Terms' },
  { id: 'eligibility', label: 'Eligibility' },
  { id: 'account', label: 'Your Account' },
  { id: 'content', label: 'User-Generated Content' },
  { id: 'prohibited', label: 'Prohibited Conduct' },
  { id: 'ip', label: 'Intellectual Property' },
  { id: 'venues', label: 'Venue Data' },
  { id: 'third-party', label: 'Third-Party Links & Services' },
  { id: 'disclaimers', label: 'Disclaimers' },
  { id: 'liability', label: 'Limitation of Liability' },
  { id: 'indemnification', label: 'Indemnification' },
  { id: 'termination', label: 'Termination' },
  { id: 'governing-law', label: 'Governing Law' },
  { id: 'changes', label: 'Changes to Terms' },
  { id: 'contact', label: 'Contact' },
]

export function TermsOfService() {
  const [tocOpen, setTocOpen] = useState(false)

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground">
          Last updated: <time dateTime="2026-03-28">{LAST_UPDATED}</time> · Effective:{' '}
          <time dateTime="2026-03-28">{EFFECTIVE_DATE}</time>
        </p>
      </header>

      {/* Table of contents toggle */}
      <div className="mb-8 border border-border rounded-lg overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 text-sm font-medium text-foreground"
          onClick={() => setTocOpen((v) => !v)}
          aria-expanded={tocOpen}
          aria-controls="tos-toc-list"
        >
          <span>Table of Contents</span>
          <span aria-hidden="true">{tocOpen ? '▲' : '▼'}</span>
        </button>
        {tocOpen && (
          <nav id="tos-toc-list" aria-label="Terms of service sections">
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
      <Section id="acceptance" title="1. Acceptance of Terms">
        <p>
          Please read these Terms of Service (&quot;Terms&quot;) carefully before using the{' '}
          {APP_NAME} application (&quot;the App&quot;, &quot;Service&quot;) operated by {APP_NAME}
          (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;).
        </p>
        <p>
          By accessing or using the App, you agree to be bound by these Terms and our{' '}
          <a href="/privacy" className="text-accent hover:underline">
            Privacy Policy
          </a>
          , which is incorporated herein by reference. If you do not agree to these Terms, you may
          not use the App.
        </p>
      </Section>

      <Section id="eligibility" title="2. Eligibility">
        <p>
          <strong>You must be at least 18 years old to use {APP_NAME}.</strong> The App features
          nightlife content including bars, clubs, and venues that serve alcohol. By creating an
          account you represent and warrant that:
        </p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>You are at least 18 years of age</li>
          <li>You have the legal capacity to enter into a binding agreement</li>
          <li>You are not prohibited from using the Service under applicable law</li>
          <li>You will use the App only for lawful purposes</li>
        </ul>
        <p>
          We reserve the right to terminate accounts of users who misrepresent their age or
          eligibility.
        </p>
      </Section>

      <Section id="account" title="3. Your Account">
        <p>
          To use most features of {APP_NAME} you must create an account. You are responsible for:
        </p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Maintaining the confidentiality of your login credentials</li>
          <li>All activity that occurs under your account</li>
          <li>Notifying us immediately of any unauthorized use of your account</li>
          <li>Providing accurate and up-to-date account information</li>
        </ul>
        <p>
          You may not create accounts using automated means or create an account for another person
          without their permission.
        </p>
        <p>
          We reserve the right to suspend or terminate accounts that violate these Terms, engage in
          fraudulent activity, or remain inactive for an extended period.
        </p>
      </Section>

      <Section id="content" title="4. User-Generated Content">
        <h3 className="font-medium text-foreground mt-3 mb-1">Your Content</h3>
        <p>
          The App allows you to post pulses, check-ins, stories, photos, videos, captions, and other
          content (&quot;User Content&quot;). You retain ownership of your User Content.
        </p>
        <p>
          By posting User Content, you grant {APP_NAME} a non-exclusive, worldwide, royalty-free,
          sublicensable license to use, reproduce, modify, adapt, publish, distribute, and display
          that content in connection with operating and improving the Service.
        </p>

        <h3 className="font-medium text-foreground mt-4 mb-1">Content Standards</h3>
        <p>User Content must not:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Be false, misleading, or fraudulent</li>
          <li>Infringe any third party&apos;s intellectual property or privacy rights</li>
          <li>Contain nudity, explicit sexual content, or pornography</li>
          <li>Depict or promote illegal activity, violence, or self-harm</li>
          <li>Harass, bully, or threaten any individual</li>
          <li>Contain hate speech targeting protected characteristics</li>
          <li>Include spam, phishing, or malware</li>
          <li>Violate any applicable law or regulation</li>
        </ul>

        <h3 className="font-medium text-foreground mt-4 mb-1">Ephemeral Content</h3>
        <p>
          Certain content types have automatic expiry built into the platform:
        </p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>
            <strong>Pulses</strong> expire after 90 minutes and are permanently deleted
          </li>
          <li>
            <strong>Stories</strong> expire after 24 hours and are permanently deleted
          </li>
        </ul>
        <p>
          You understand and agree that expired content cannot be recovered. Do not use pulses or
          stories to share content you wish to retain.
        </p>

        <h3 className="font-medium text-foreground mt-4 mb-1">Moderation</h3>
        <p>
          We reserve the right to remove any User Content that violates these Terms or that we
          determine, in our sole discretion, is harmful, objectionable, or otherwise inappropriate.
          We may also suspend or terminate accounts that repeatedly post violating content.
        </p>
      </Section>

      <Section id="prohibited" title="5. Prohibited Conduct">
        <p>You agree not to:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Use the App for any unlawful purpose or in violation of any law</li>
          <li>Impersonate any person or entity or misrepresent your affiliation</li>
          <li>Circumvent, disable, or interfere with security features of the App</li>
          <li>Scrape, crawl, or use automated means to access the App without permission</li>
          <li>Reverse engineer or attempt to extract source code from the App</li>
          <li>
            Use the App to send unsolicited communications (&quot;spam&quot;) to other users
          </li>
          <li>Attempt to gain unauthorized access to other users&apos; accounts</li>
          <li>
            Upload or transmit viruses, malware, or other harmful code
          </li>
          <li>
            Post false venue information, fabricate check-ins, or manipulate venue scores
          </li>
          <li>Create multiple accounts to circumvent suspensions or bans</li>
          <li>
            Use the location features to stalk, surveil, or harass other users
          </li>
          <li>
            Engage in any activity that could disable, overburden, or impair our infrastructure
          </li>
        </ul>
      </Section>

      <Section id="ip" title="6. Intellectual Property">
        <p>
          The {APP_NAME} name, logo, app design, user interface, and all original content created by
          us are protected by copyright, trademark, and other intellectual property laws. You may
          not reproduce, distribute, or create derivative works from our proprietary content without
          our express written permission.
        </p>
        <p>
          If you believe that content on the App infringes your copyright, please contact us at{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent hover:underline">
            {CONTACT_EMAIL}
          </a>{' '}
          with a description of the alleged infringement.
        </p>
      </Section>

      <Section id="venues" title="7. Venue Data">
        <p>
          Venue information displayed in the App (names, addresses, categories) is sourced from
          public data sets and user contributions. We make reasonable efforts to ensure accuracy but
          do not guarantee that venue information is current, complete, or error-free.
        </p>
        <p>
          If you are a venue owner and find inaccurate information about your venue, you may report
          it via the venue detail page or by emailing{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent hover:underline">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
        <p>
          Energy scores and crowd metrics are user-generated and represent the subjective opinions
          of contributors. They should not be relied upon for safety-critical decisions.
        </p>
      </Section>

      <Section id="third-party" title="8. Third-Party Links & Services">
        <p>
          The App may contain links to third-party websites or integrate third-party services (e.g.,
          rideshare apps, music services, map providers). These links and integrations are provided
          for convenience only.
        </p>
        <p>
          We have no control over third-party sites or services and are not responsible for their
          content, privacy practices, or availability. Your use of third-party services is governed
          by their respective terms and privacy policies.
        </p>
      </Section>

      <Section id="disclaimers" title="9. Disclaimers">
        <p>
          THE APP IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF
          ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY,
          FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
        </p>
        <p>We do not warrant that:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>The App will be available at all times or free from errors</li>
          <li>Venue energy scores or crowd data are accurate or reliable</li>
          <li>The App will meet your specific requirements</li>
          <li>Any defects in the App will be corrected</li>
        </ul>
        <p>
          You acknowledge that attendance at nightlife venues involves inherent risks. {APP_NAME}{' '}
          does not endorse any venue and is not responsible for any incidents that occur at venues
          listed in the App.
        </p>
      </Section>

      <Section id="liability" title="10. Limitation of Liability">
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, {APP_NAME.toUpperCase()} AND ITS
          OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT,
          INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR RELATED TO YOUR
          USE OF THE APP, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
        </p>
        <p>
          OUR TOTAL LIABILITY TO YOU FOR ANY CLAIMS ARISING OUT OF OR RELATED TO THESE TERMS OR THE
          APP SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID US IN THE 12 MONTHS PRECEDING
          THE CLAIM OR (B) $100 USD.
        </p>
        <p>
          Some jurisdictions do not allow the exclusion of certain warranties or limitation of
          liability. In such jurisdictions, our liability is limited to the greatest extent permitted
          by law.
        </p>
      </Section>

      <Section id="indemnification" title="11. Indemnification">
        <p>
          You agree to indemnify, defend, and hold harmless {APP_NAME} and its officers, directors,
          employees, and agents from any claims, liabilities, damages, losses, and expenses
          (including reasonable attorneys&apos; fees) arising out of or related to:
        </p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Your use of the App</li>
          <li>Your User Content</li>
          <li>Your violation of these Terms</li>
          <li>Your violation of any rights of a third party</li>
        </ul>
      </Section>

      <Section id="termination" title="12. Termination">
        <p>
          We may terminate or suspend your access to the App at any time, with or without cause or
          notice, including for violation of these Terms.
        </p>
        <p>
          You may terminate your account at any time via Settings → Delete Account. Upon
          termination:
        </p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Your profile and content will be scheduled for deletion (within 30 days)</li>
          <li>Your right to use the App will immediately cease</li>
          <li>
            Provisions of these Terms that by their nature should survive termination will survive
          </li>
        </ul>
      </Section>

      <Section id="governing-law" title="13. Governing Law">
        <p>
          These Terms shall be governed by and construed in accordance with the laws of the State of
          California, USA, without regard to its conflict of law provisions.
        </p>
        <p>
          Any dispute arising out of or related to these Terms or the App shall be resolved through
          binding arbitration in accordance with the American Arbitration Association&apos;s
          Consumer Arbitration Rules, except that you may bring claims in small claims court if they
          qualify.
        </p>
        <p>
          You waive any right to participate in a class action lawsuit or class-wide arbitration.
        </p>
      </Section>

      <Section id="changes" title="14. Changes to Terms">
        <p>
          We reserve the right to modify these Terms at any time. When we make material changes, we
          will update the &quot;Last updated&quot; date and notify you via an in-app notification at
          least 14 days before the changes take effect.
        </p>
        <p>
          Your continued use of the App after changes take effect constitutes acceptance of the
          revised Terms. If you do not agree to the new Terms, you must stop using the App and
          delete your account.
        </p>
      </Section>

      <Section id="contact" title="15. Contact">
        <p>
          Questions about these Terms? Contact us:
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
      </Section>
    </div>
  )
}

export default TermsOfService
