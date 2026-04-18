import { useState, useMemo, useCallback } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { VenueEvent } from '@/lib/events'
import { User } from '@/lib/types'
import {
  TicketType,
  Ticket,
  TICKET_TYPE_CONFIG,
  calculateDynamicPrice,
  getDefaultTicketTiers,
  reserveTicket,
  confirmPurchase,
  createGroupOrder,
  GroupOrder,
} from '@/lib/ticketing'
import { formatPrice, createPaymentIntent, processPayment } from '@/lib/payment-processing'
import { Ticket as TicketIcon, Users, Minus, Plus, Lightning, CaretRight } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { PaymentElementMount } from '@/components/ticketing/PaymentElementMount'
import { confirmPayment as stripeConfirmPayment, type CreateElementsResult } from '@/lib/stripe-client'
import { cancelPurchase } from '@/lib/staff-scanner-client'

interface TicketPurchaseSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  event: VenueEvent | null
  currentUser: User
  allUsers: User[]
  onPurchase: (tickets: Ticket[], groupOrder?: GroupOrder) => void
}

export function TicketPurchaseSheet({
  open,
  onOpenChange,
  event,
  currentUser,
  allUsers,
  onPurchase,
}: TicketPurchaseSheetProps) {
  const [selectedType, setSelectedType] = useState<TicketType>('general_admission')
  const [quantity, setQuantity] = useState(1)
  const [splitWithCrew, setSplitWithCrew] = useState(false)
  const [selectedCrewMembers, setSelectedCrewMembers] = useState<string[]>([])
  const [purchasing, setPurchasing] = useState(false)
  const stripeFlowEnabled = isFeatureEnabled('ticketing')
  const [stripeCtx, setStripeCtx] = useState<CreateElementsResult | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [pendingTicketIds, setPendingTicketIds] = useState<string[]>([])
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [succeeded, setSucceeded] = useState(false)

  const tiers = useMemo(() => {
    if (!event) return []
    return getDefaultTicketTiers(event.coverCharge)
  }, [event])

  const selectedTier = tiers.find(t => t.type === selectedType)

  const dynamicPricing = useMemo(() => {
    if (!selectedTier || !event) return null
    const rsvpCount = Object.keys(event.rsvps).length
    const demandScore = Math.min(rsvpCount * 5, 100)
    const timeUntilEvent = new Date(event.startTime).getTime() - Date.now()
    return calculateDynamicPrice(
      selectedTier.basePrice,
      demandScore,
      timeUntilEvent,
      selectedTier.available,
      selectedTier.total
    )
  }, [selectedTier, event])

  const unitPrice = dynamicPricing?.price ?? selectedTier?.basePrice ?? 0
  const totalPrice = unitPrice * quantity

  const crewFriends = useMemo(() => {
    return allUsers.filter(u => currentUser.friends.includes(u.id))
  }, [allUsers, currentUser.friends])

  const perPersonPrice = splitWithCrew && selectedCrewMembers.length > 0
    ? Math.round((totalPrice / (selectedCrewMembers.length + 1)) * 100) / 100
    : totalPrice

  const handleToggleCrewMember = (userId: string) => {
    setSelectedCrewMembers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const resetFlow = useCallback(() => {
    setClientSecret(null)
    setStripeCtx(null)
    setPendingTicketIds([])
    setPaymentError(null)
    setSucceeded(false)
    setPurchasing(false)
  }, [])

  const handleRequestClose = useCallback(() => {
    // If user aborts after we created a clientSecret, cancel the intent
    // so we free up inventory.
    if (clientSecret && pendingTicketIds.length > 0 && !succeeded) {
      for (const ticketId of pendingTicketIds) {
        // Fire-and-forget; server reconciles capacity regardless.
        void cancelPurchase(ticketId)
      }
    }
    resetFlow()
    onOpenChange(false)
  }, [clientSecret, pendingTicketIds, succeeded, onOpenChange, resetFlow])

  const handleStripeConfirm = useCallback(async () => {
    if (!stripeCtx) return
    setPurchasing(true)
    setPaymentError(null)
    const result = await stripeConfirmPayment({
      stripe: stripeCtx.stripe,
      elements: stripeCtx.elements,
    })
    if (result.error) {
      setPaymentError(result.error.message ?? 'Payment failed')
      setPurchasing(false)
      return
    }
    if (result.paymentIntent?.status === 'succeeded') {
      setSucceeded(true)
      setPurchasing(false)
      // Caller is responsible for hitting /api/ticketing/confirm with the
      // paymentIntentId + ticketIds; we surface via onPurchase so existing
      // wiring continues to work.
      // (No local mutation — tickets are now paid server-side.)
      return
    }
    setPaymentError(`Unexpected status: ${result.paymentIntent?.status ?? 'unknown'}`)
    setPurchasing(false)
  }, [stripeCtx])

  const handlePurchase = async () => {
    if (!event || !selectedTier || !dynamicPricing) return
    setPurchasing(true)

    // Stripe-flow branch: create reservation rows + payment intent, then
    // mount the PaymentElement. Kept behind the `ticketing` flag so the
    // legacy stub remains the default until Stripe keys + backend land.
    if (stripeFlowEnabled) {
      try {
        const reservedTickets: Ticket[] = []
        const members = splitWithCrew && selectedCrewMembers.length > 0
          ? [currentUser.id, ...selectedCrewMembers]
          : Array.from({ length: quantity }, () => currentUser.id)
        for (const memberId of members) {
          const reserved = reserveTicket(
            event.id,
            event.venueId,
            memberId,
            selectedType,
            unitPrice,
            true
          )
          reservedTickets.push(reserved)
        }
        const res = await fetch('/api/ticketing/purchase', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            eventId: event.id,
            venueId: event.venueId,
            ticketType: selectedType,
            quantity: members.length,
            ticketIds: reservedTickets.map(t => t.id),
            amount: totalPrice,
          }),
        })
        if (!res.ok) {
          setPaymentError('Could not start checkout. Please try again.')
          setPurchasing(false)
          return
        }
        const payload = (await res.json()) as { client_secret?: string; clientSecret?: string }
        const secret = payload.client_secret ?? payload.clientSecret ?? null
        if (!secret) {
          setPaymentError('Payment provider returned no client secret.')
          setPurchasing(false)
          return
        }
        setClientSecret(secret)
        setPendingTicketIds(reservedTickets.map(t => t.id))
      } catch (err) {
        setPaymentError(err instanceof Error ? err.message : 'Network error')
      } finally {
        setPurchasing(false)
      }
      return
    }

    try {
      // Simulate brief processing delay (legacy mock path)
      await new Promise(resolve => setTimeout(resolve, 800))

      const tickets: Ticket[] = []

      if (splitWithCrew && selectedCrewMembers.length > 0) {
        // Group order flow
        const allMembers = [currentUser.id, ...selectedCrewMembers]
        const groupOrder = createGroupOrder(
          event.id,
          currentUser.id,
          allMembers,
          selectedType,
          unitPrice
        )

        for (const memberId of allMembers) {
          const reserved = reserveTicket(
            event.id,
            event.venueId,
            memberId,
            selectedType,
            unitPrice,
            true
          )
          const purchased = confirmPurchase({ ...reserved, groupOrderId: groupOrder.id })
          tickets.push(purchased)
        }

        // Process payment
        const intent = createPaymentIntent(
          totalPrice,
          'ticket',
          currentUser.id,
          event.venueId,
          event.id,
          { groupOrderId: groupOrder.id }
        )
        processPayment(intent)

        onPurchase(tickets, groupOrder)
      } else {
        // Standard purchase
        for (let i = 0; i < quantity; i++) {
          const reserved = reserveTicket(
            event.id,
            event.venueId,
            currentUser.id,
            selectedType,
            unitPrice,
            true
          )
          const purchased = confirmPurchase(reserved)
          tickets.push(purchased)
        }

        const intent = createPaymentIntent(
          totalPrice,
          'ticket',
          currentUser.id,
          event.venueId,
          event.id
        )
        processPayment(intent)

        onPurchase(tickets)
      }

      // Reset state
      setQuantity(1)
      setSplitWithCrew(false)
      setSelectedCrewMembers([])
      onOpenChange(false)
    } finally {
      setPurchasing(false)
    }
  }

  if (!event) return null

  // Payment stage (Stripe flow only). Renders the PaymentElement once
  // a clientSecret has been obtained.
  if (stripeFlowEnabled && clientSecret && !succeeded) {
    return (
      <Sheet open={open} onOpenChange={v => (v ? onOpenChange(v) : handleRequestClose())}>
        <SheetContent side="bottom" className="rounded-t-3xl border-t-primary/20 bg-card p-0 max-h-[85vh] overflow-y-auto">
          <SheetHeader className="p-6 pb-0">
            <SheetTitle className="text-xl font-bold">Payment</SheetTitle>
            <SheetDescription className="text-sm">
              {event.title} — {formatPrice(totalPrice)}
            </SheetDescription>
          </SheetHeader>
          <div className="p-6 space-y-4">
            <PaymentElementMount
              clientSecret={clientSecret}
              onReady={setStripeCtx}
              onValidationChange={setPaymentError}
            />
            {paymentError && (
              <p className="text-sm text-destructive" role="alert">
                {paymentError}
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleRequestClose} disabled={purchasing}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleStripeConfirm}
                disabled={!stripeCtx || purchasing}
              >
                {purchasing ? 'Processing…' : `Pay ${formatPrice(totalPrice)}`}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  // Success stage
  if (stripeFlowEnabled && succeeded) {
    return (
      <Sheet open={open} onOpenChange={v => (v ? onOpenChange(v) : (resetFlow(), onOpenChange(false)))}>
        <SheetContent side="bottom" className="rounded-t-3xl border-t-primary/20 bg-card p-0 max-h-[85vh] overflow-y-auto">
          <SheetHeader className="p-6 pb-0">
            <SheetTitle className="text-xl font-bold">Purchase complete</SheetTitle>
            <SheetDescription className="text-sm">
              Your tickets will appear in My Tickets.
            </SheetDescription>
          </SheetHeader>
          <div className="p-6">
            <Button
              className="w-full"
              onClick={() => {
                resetFlow()
                onOpenChange(false)
              }}
            >
              Done
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Sheet open={open} onOpenChange={v => (v ? onOpenChange(v) : handleRequestClose())}>
      <SheetContent side="bottom" className="rounded-t-3xl border-t-primary/20 bg-card p-0 max-h-[85vh] overflow-y-auto">
        <SheetHeader className="p-6 pb-0">
          <div className="mx-auto w-12 h-1.5 rounded-full bg-muted/30 mb-4" />
          <SheetTitle className="text-2xl font-bold flex items-center gap-2">
            <TicketIcon size={28} className="text-primary" />
            Get Tickets
          </SheetTitle>
          <SheetDescription className="text-sm">
            {event.title}
          </SheetDescription>
        </SheetHeader>

        <div className="p-6 space-y-6">
          {/* Demand Indicator */}
          {dynamicPricing && dynamicPricing.demandLevel !== 'low' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                "flex items-center gap-2 p-3 rounded-xl border",
                dynamicPricing.demandLevel === 'surge'
                  ? "bg-red-500/10 border-red-500/30 text-red-400"
                  : dynamicPricing.demandLevel === 'high'
                  ? "bg-orange-500/10 border-orange-500/30 text-orange-400"
                  : "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
              )}
            >
              <Lightning size={20} weight="fill" />
              <span className="text-sm font-medium">
                {dynamicPricing.demandLevel === 'surge'
                  ? 'Surge pricing — selling fast!'
                  : dynamicPricing.demandLevel === 'high'
                  ? 'High demand — pricing may increase'
                  : 'Moderate demand'}
              </span>
              {dynamicPricing.multiplier > 1.05 && (
                <Badge variant="outline" className="ml-auto text-xs">
                  {Math.round((dynamicPricing.multiplier - 1) * 100)}% above base
                </Badge>
              )}
            </motion.div>
          )}

          {/* Ticket Type Selector */}
          <div className="space-y-3">
            <h3 className="font-bold text-sm uppercase tracking-wide text-muted-foreground">
              Select Ticket Type
            </h3>
            <div className="space-y-2">
              {tiers.map((tier) => {
                const isSelected = selectedType === tier.type
                const pricing = event
                  ? calculateDynamicPrice(
                      tier.basePrice,
                      Math.min(Object.keys(event.rsvps).length * 5, 100),
                      new Date(event.startTime).getTime() - Date.now(),
                      tier.available,
                      tier.total
                    )
                  : null
                const config = TICKET_TYPE_CONFIG[tier.type]

                return (
                  <motion.button
                    key={tier.type}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setSelectedType(tier.type)
                      setQuantity(1)
                    }}
                    className={cn(
                      "w-full text-left p-4 rounded-xl border transition-all",
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:border-primary/30"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span>{config.emoji}</span>
                          <span className="font-bold">{tier.label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{tier.description}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {tier.perks.map(perk => (
                            <span
                              key={perk}
                              className="text-[10px] bg-secondary px-2 py-0.5 rounded-full text-muted-foreground"
                            >
                              {perk}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className="font-bold text-lg">{formatPrice(pricing?.price ?? tier.basePrice)}</p>
                        {pricing && pricing.multiplier > 1.05 && (
                          <p className="text-xs text-muted-foreground line-through">
                            {formatPrice(tier.basePrice)}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {tier.available} left
                        </p>
                      </div>
                    </div>
                  </motion.button>
                )
              })}
            </div>
          </div>

          <Separator />

          {/* Quantity Selector */}
          <div className="flex items-center justify-between">
            <span className="font-medium">Quantity</span>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                disabled={quantity <= 1}
              >
                <Minus size={16} />
              </Button>
              <span className="font-bold text-lg w-6 text-center">{quantity}</span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => setQuantity(q => Math.min(10, q + 1))}
                disabled={quantity >= 10}
              >
                <Plus size={16} />
              </Button>
            </div>
          </div>

          <Separator />

          {/* Split with Crew */}
          <div className="space-y-3">
            <button
              onClick={() => setSplitWithCrew(!splitWithCrew)}
              className="flex items-center justify-between w-full"
            >
              <div className="flex items-center gap-2">
                <Users size={20} className="text-primary" />
                <span className="font-medium">Split with Crew</span>
              </div>
              <CaretRight
                size={16}
                className={cn(
                  "text-muted-foreground transition-transform",
                  splitWithCrew && "rotate-90"
                )}
              />
            </button>

            <AnimatePresence>
              {splitWithCrew && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-2 pt-2">
                    {crewFriends.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No friends to split with</p>
                    ) : (
                      crewFriends.map(friend => {
                        const isSelected = selectedCrewMembers.includes(friend.id)
                        return (
                          <button
                            key={friend.id}
                            onClick={() => handleToggleCrewMember(friend.id)}
                            className={cn(
                              "w-full flex items-center gap-3 p-3 rounded-xl border transition-all",
                              isSelected
                                ? "border-primary bg-primary/10"
                                : "border-border hover:border-primary/30"
                            )}
                          >
                            <div className="w-8 h-8 rounded-full bg-secondary overflow-hidden">
                              {friend.profilePhoto ? (
                                <img src={friend.profilePhoto} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs font-bold">
                                  {friend.username[0].toUpperCase()}
                                </div>
                              )}
                            </div>
                            <span className="text-sm font-medium">{friend.username}</span>
                            {isSelected && (
                              <Badge className="ml-auto text-xs bg-primary">Selected</Badge>
                            )}
                          </button>
                        )
                      })
                    )}

                    {selectedCrewMembers.length > 0 && (
                      <div className="bg-secondary/50 rounded-xl p-3 mt-2">
                        <p className="text-xs text-muted-foreground">
                          Splitting {formatPrice(totalPrice)} among {selectedCrewMembers.length + 1} people
                        </p>
                        <p className="font-bold text-primary">
                          {formatPrice(perPersonPrice)} per person
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Separator />

          {/* Total and Purchase */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-bold text-lg">{formatPrice(totalPrice)}</span>
            </div>
            {splitWithCrew && selectedCrewMembers.length > 0 && (
              <div className="flex items-center justify-between text-primary">
                <span>Your share</span>
                <span className="font-bold">{formatPrice(perPersonPrice)}</span>
              </div>
            )}

            <Button
              onClick={handlePurchase}
              disabled={purchasing}
              className="w-full h-14 text-lg font-bold bg-primary hover:bg-primary/90"
            >
              {purchasing ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                />
              ) : (
                <>
                  Purchase {splitWithCrew && selectedCrewMembers.length > 0
                    ? `${selectedCrewMembers.length + 1} Tickets`
                    : quantity > 1
                    ? `${quantity} Tickets`
                    : 'Ticket'
                  } &middot; {formatPrice(splitWithCrew && selectedCrewMembers.length > 0 ? perPersonPrice : totalPrice)}
                </>
              )}
            </Button>

            <p className="text-[10px] text-center text-muted-foreground">
              By purchasing you agree to the refund policy: 100% if &gt;48h, 50% if &gt;24h, 0% if &lt;24h before event
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
