import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Export, Trash, FileText, Scales } from '@phosphor-icons/react'
import { toast } from 'sonner'
import {
  buildLocalExportFallback,
  downloadJsonBlob,
  fetchAccountExport,
  requestAccountDeletion,
} from '@/lib/account-privacy'

interface AccountPrivacyPanelProps {
  username: string
  accessToken?: string | null
  /** Local user object for demo/offline export fallback. */
  localUser?: Record<string, unknown>
  onDeleted?: () => void | Promise<void>
  compact?: boolean
}

export function AccountPrivacyPanel({
  username,
  accessToken,
  localUser,
  onDeleted,
  compact = false,
}: AccountPrivacyPanelProps) {
  const [exporting, setExporting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      if (accessToken) {
        const result = await fetchAccountExport({ accessToken })
        if (result.ok) {
          downloadJsonBlob(`pulse-export-${username}.json`, result.data)
          if (result.data.warnings?.length) {
            toast.warning('Export complete with warnings', {
              description: `${result.data.warnings.length} table(s) could not be read.`,
            })
          } else {
            toast.success('Full account export downloaded')
          }
          return
        }
        toast.error('Export failed', { description: result.error })
        return
      }

      const fallback = buildLocalExportFallback(localUser ?? { username })
      downloadJsonBlob(`pulse-export-${username}.json`, fallback)
      toast.success('Local data exported', {
        description: 'Sign in to download your full server-side data.',
      })
    } finally {
      setExporting(false)
    }
  }

  const handleDelete = async () => {
    if (!accessToken) {
      toast.error('Sign in required', {
        description: 'Account deletion is only available for signed-in users.',
      })
      return
    }

    setDeleting(true)
    try {
      const result = await requestAccountDeletion({ accessToken })
      if (!result.ok) {
        toast.error('Could not delete account', { description: result.error })
        return
      }
      toast.success('Account deleted')
      await onDeleted?.()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'} data-testid="account-privacy-panel">
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Legal</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="flex-1 justify-start" asChild>
            <a href="/privacy.html" target="_blank" rel="noopener noreferrer">
              <FileText size={16} className="mr-2" aria-hidden />
              Privacy Policy
            </a>
          </Button>
          <Button variant="outline" className="flex-1 justify-start" asChild>
            <a href="/terms.html" target="_blank" rel="noopener noreferrer">
              <Scales size={16} className="mr-2" aria-hidden />
              Terms of Service
            </a>
          </Button>
        </div>
      </div>

      <Separator />

      <Button
        variant="outline"
        className="w-full justify-start"
        onClick={() => void handleExport()}
        disabled={exporting}
        data-testid="export-account-data"
      >
        <Export size={16} className="mr-2" aria-hidden />
        {exporting ? 'Exporting…' : 'Export My Data'}
      </Button>

      <p className="text-xs text-muted-foreground">
        Download a JSON copy of your profile, pulses, and related activity. Required for GDPR/CCPA requests.
      </p>

      <Separator />

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="destructive"
            className="w-full justify-start"
            data-testid="delete-account-trigger"
          >
            <Trash size={16} className="mr-2" aria-hidden />
            Delete Account
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes your profile, pulses, and personal data from Pulse. This action cannot be undone.
              Type DELETE in the confirmation step on the server.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault()
                void handleDelete()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting…' : 'Delete permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
