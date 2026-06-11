import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ArrowLeft } from '@phosphor-icons/react'

export type LegalDoc = 'privacy' | 'terms'

interface LegalPageProps {
  doc: LegalDoc
  onBack: () => void
}

const LAST_UPDATED = 'June 11, 2026'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-bold">{title}</h2>
      <div className="space-y-2 text-sm text-foreground/80">{children}</div>
    </section>
  )
}

function PrivacyContent() {
  return (
    <>
      <Section title="Overview">
        <p>
          Pulse shows you where the energy is happening right now. To do that, we collect
          a minimal set of data and design it to disappear quickly. This policy explains
          what we collect, why, and the choices you have.
        </p>
      </Section>
      <Section title="What we collect">
        <p>
          <strong>Account data</strong> — username, email, and profile photo when you create
          an account.
        </p>
        <p>
          <strong>Pulses and check-ins</strong> — the venue, energy rating, optional caption
          and media you choose to post. Pulses expire from public view after 90 minutes by design.
        </p>
        <p>
          <strong>Location</strong> — your device location, only while you are using the app
          and only if you grant permission. We use it to rank nearby venues and verify
          check-ins. We do not track your location in the background, and your exact
          location is never shown to other users — only your general presence at a venue,
          which you can turn off in Settings.
        </p>
        <p>
          <strong>Usage analytics</strong> — anonymous events such as app opens and feature
          usage, used to improve the product.
        </p>
      </Section>
      <Section title="What we never do">
        <p>We do not sell your personal data.</p>
        <p>We do not track your location in the background.</p>
        <p>We do not share your exact location with other users or venues.</p>
      </Section>
      <Section title="How we share data">
        <p>
          Venue owners see aggregated, anonymized activity for their venue (for example,
          energy scores and pulse counts) — never your identity or precise location.
          Service providers that host our infrastructure process data on our behalf under
          contract.
        </p>
      </Section>
      <Section title="Your rights">
        <p>
          You can export your data from Settings at any time, and you can request deletion
          of your account and all associated data. If you are in a region covered by GDPR
          or CCPA, you have the rights to access, correct, delete, and port your data, and
          to object to processing. Contact us at privacy@pulse.app to exercise any of
          these rights.
        </p>
      </Section>
      <Section title="Age requirement">
        <p>
          Pulse is for adults. You must be at least 18 years old to use Pulse. We do not
          knowingly collect data from anyone under 18, and we delete accounts found to
          belong to minors.
        </p>
      </Section>
      <Section title="Data retention">
        <p>
          Pulses expire from public view after 90 minutes. Underlying records are retained
          in aggregate form for venue scoring and trends, with personal identifiers removed
          over time. Account data is kept until you delete your account.
        </p>
      </Section>
      <Section title="Changes">
        <p>
          We will notify you in the app before material changes to this policy take effect.
        </p>
      </Section>
    </>
  )
}

function TermsContent() {
  return (
    <>
      <Section title="Acceptance">
        <p>
          By creating an account or using Pulse you agree to these terms. If you do not
          agree, do not use Pulse.
        </p>
      </Section>
      <Section title="Eligibility">
        <p>
          You must be at least 18 years old to use Pulse. Pulse features nightlife venues,
          including venues that serve alcohol.
        </p>
      </Section>
      <Section title="Your content">
        <p>
          You own the pulses, photos, and other content you post. By posting, you grant
          Pulse a license to display that content within the app for its natural lifetime
          (pulses expire after 90 minutes) and to use aggregated, de-identified activity
          for venue scoring and trends.
        </p>
        <p>
          Don't post content that is illegal, harassing, or that violates someone else's
          rights or privacy — including photos of identifiable people without their
          consent. We may remove content and suspend accounts that violate these rules.
        </p>
      </Section>
      <Section title="Be accurate, be safe">
        <p>
          Pulse depends on honest signal. Posting fake check-ins, manipulating venue
          scores, or operating coordinated inauthentic accounts is prohibited. Never use
          Pulse while driving, and drink responsibly — Pulse does not encourage or reward
          alcohol consumption.
        </p>
      </Section>
      <Section title="Venues and third parties">
        <p>
          Venue information, scores, and forecasts are estimates based on community
          activity and may be inaccurate or out of date. Pulse is not responsible for
          your experience at any venue, or for third-party services linked from the app
          (such as ride-share or reservations).
        </p>
      </Section>
      <Section title="Disclaimer and liability">
        <p>
          Pulse is provided "as is" without warranties of any kind. To the maximum extent
          permitted by law, Pulse is not liable for indirect, incidental, or consequential
          damages arising from your use of the service.
        </p>
      </Section>
      <Section title="Termination">
        <p>
          You can delete your account at any time. We may suspend or terminate accounts
          that violate these terms.
        </p>
      </Section>
      <Section title="Changes">
        <p>
          We may update these terms and will notify you in the app before material changes
          take effect. Continued use after changes means you accept the updated terms.
        </p>
      </Section>
    </>
  )
}

export function LegalPage({ doc, onBack }: LegalPageProps) {
  const title = doc === 'privacy' ? 'Privacy Policy' : 'Terms of Service'
  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back">
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{title}</h1>
            <p className="text-xs text-muted-foreground">Last updated {LAST_UPDATED}</p>
          </div>
        </div>
        <Card className="p-5 space-y-5">
          {doc === 'privacy' ? <PrivacyContent /> : <TermsContent />}
        </Card>
      </div>
    </div>
  )
}
