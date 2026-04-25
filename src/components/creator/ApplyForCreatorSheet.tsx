import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { applyForCreator } from '@/lib/creators-client'

interface ApplyForCreatorSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmitted?: () => void
}

/**
 * Simple application form.  Collects handle, niche, one bio, a list of
 * social links (newline separated) and up to 5 content sample URLs.
 */
export function ApplyForCreatorSheet({
  open,
  onOpenChange,
  onSubmitted,
}: ApplyForCreatorSheetProps) {
  const [handle, setHandle] = useState('')
  const [bio, setBio] = useState('')
  const [niche, setNiche] = useState('')
  const [socialLinks, setSocialLinks] = useState('')
  const [samples, setSamples] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit =
    handle.trim().length >= 3 && socialLinks.trim().length > 0 && !submitting

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const linkList = socialLinks
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean)
      const sampleList = samples
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean)
      await applyForCreator({
        handle: handle.trim(),
        bio: bio.trim() || undefined,
        niche: niche.trim() || undefined,
        social_links: linkList,
        content_samples: sampleList,
      })
      onSubmitted?.()
      onOpenChange(false)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Apply to become a verified creator</SheetTitle>
          <SheetDescription>
            Share your socials and content. Our team reviews applications
            within 3 business days.
          </SheetDescription>
        </SheetHeader>

        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="handle">Handle</Label>
            <Input
              id="handle"
              placeholder="@yourhandle"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="niche">Niche</Label>
            <Input
              id="niche"
              placeholder="e.g. nightlife, cocktails, live music"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Short bio</Label>
            <Textarea
              id="bio"
              rows={3}
              placeholder="Tell us what you cover"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="social">Social links (one per line)</Label>
            <Textarea
              id="social"
              rows={3}
              placeholder="https://instagram.com/..."
              value={socialLinks}
              onChange={(e) => setSocialLinks(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="samples">Content samples (URLs, one per line)</Label>
            <Textarea
              id="samples"
              rows={3}
              placeholder="https://..."
              value={samples}
              onChange={(e) => setSamples(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          )}

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {submitting ? 'Submitting...' : 'Submit application'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
