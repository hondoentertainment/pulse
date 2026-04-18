import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Trash, CheckCircle, Warning, PaperPlaneTilt } from '@phosphor-icons/react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  createEmergencyContact,
  deleteEmergencyContact,
  listEmergencyContacts,
  type EmergencyContact,
} from '@/lib/data/safety'
import {
  confirmContactVerificationCode,
  sendContactVerificationCode,
} from '@/lib/safety-client'

export interface EmergencyContactsPageProps {
  userId: string
  onBack: () => void
}

const E164_HINT = 'Use international format, e.g. +15551234567'

export function EmergencyContactsPage(props: EmergencyContactsPageProps) {
  const [contacts, setContacts] = useState<EmergencyContact[]>([])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('+1')
  const [relationship, setRelationship] = useState('')
  const [pendingVerifyId, setPendingVerifyId] = useState<string | null>(null)
  const [otpCode, setOtpCode] = useState('')
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    const result = await listEmergencyContacts(props.userId)
    if (result.ok) setContacts(result.data)
    else toast.error(result.error ?? 'Could not load contacts')
    setLoading(false)
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.userId])

  const handleAdd = async () => {
    if (!name.trim()) return toast.error('Add a name')
    if (!/^\+[1-9][0-9]{6,14}$/.test(phone)) return toast.error(E164_HINT)
    const result = await createEmergencyContact({
      userId: props.userId,
      name,
      phone_e164: phone,
      relationship: relationship || undefined,
    })
    if (!result.ok) return toast.error(result.error)
    setName('')
    setPhone('+1')
    setRelationship('')
    setContacts(prev => [...prev, result.data])
    toast.success('Contact added. Verify to enable alerts.')
  }

  const handleDelete = async (contactId: string) => {
    const result = await deleteEmergencyContact(contactId)
    if (!result.ok) return toast.error(result.error)
    setContacts(prev => prev.filter(c => c.id !== contactId))
  }

  const handleSendCode = async (contactId: string) => {
    const result = await sendContactVerificationCode({ contactId })
    if (!result.ok) return toast.error(result.error)
    setPendingVerifyId(contactId)
    toast.success('Code sent. Ask them to read it back.')
  }

  const handleConfirm = async () => {
    if (!pendingVerifyId) return
    if (!/^[0-9]{6}$/.test(otpCode)) return toast.error('Enter the 6-digit code')
    const result = await confirmContactVerificationCode({
      contactId: pendingVerifyId,
      code: otpCode,
    })
    if (!result.ok) return toast.error(result.error)
    toast.success('Contact verified.')
    setPendingVerifyId(null)
    setOtpCode('')
    await refresh()
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={props.onBack}
            aria-label="Go back"
            className="p-2 -ml-2 rounded-full hover:bg-secondary"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-bold flex-1">Emergency Contacts</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        <Card className="p-4 space-y-3">
          <Label className="font-bold text-sm">Add a contact</Label>
          <div className="space-y-2">
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Name"
              className="h-11"
              autoComplete="name"
            />
            <Input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="Phone (+1…)"
              className="h-11"
              inputMode="tel"
              autoComplete="tel"
            />
            <Input
              value={relationship}
              onChange={e => setRelationship(e.target.value)}
              placeholder="Relationship (optional)"
              className="h-11"
            />
            <p className="text-[10px] text-muted-foreground">{E164_HINT}</p>
          </div>
          <Button onClick={handleAdd} className="w-full h-12">
            <Plus size={14} /> Add contact
          </Button>
        </Card>

        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="font-bold text-sm">Your contacts</Label>
            <Badge variant="outline" className="text-xs">{contacts.length}</Badge>
          </div>
          {loading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : contacts.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No contacts yet. Add someone you trust to reach you quickly.
            </p>
          ) : (
            <div className="space-y-2">
              {contacts.map(contact => {
                const verified = Boolean(contact.verified_at)
                const isVerifying = pendingVerifyId === contact.id
                return (
                  <div
                    key={contact.id}
                    className="p-3 rounded-md bg-secondary/50 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium flex items-center gap-2">
                          {contact.name}
                          {verified ? (
                            <Badge variant="outline" className="text-[10px] text-green-500 border-green-500/30">
                              <CheckCircle size={10} weight="fill" /> Verified
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-yellow-500 border-yellow-500/30">
                              <Warning size={10} weight="fill" /> Unverified
                            </Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {contact.phone_e164}
                          {contact.relationship ? ` · ${contact.relationship}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {!verified && (
                          <Button size="sm" variant="outline" onClick={() => handleSendCode(contact.id)}>
                            <PaperPlaneTilt size={12} /> Verify
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(contact.id)} aria-label="Delete contact">
                          <Trash size={14} />
                        </Button>
                      </div>
                    </div>
                    {isVerifying && (
                      <>
                        <Separator />
                        <div className="flex gap-2">
                          <Input
                            value={otpCode}
                            onChange={e => setOtpCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                            placeholder="6-digit code"
                            inputMode="numeric"
                            className="h-11"
                          />
                          <Button onClick={handleConfirm} className="h-11">
                            Confirm
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
