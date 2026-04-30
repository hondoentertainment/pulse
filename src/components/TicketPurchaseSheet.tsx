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
  GroupOrder,
} from '@/lib/ticketing'
import { formatPrice } from '@/lib/payment-processing'
import { purchaseTicket } from '@/lib/ticketing-client'
import { Ticket as TicketIcon, Users, Minus, Plus, Lightning, CaretRight } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface TicketPurchaseSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  event: VenueEvent | null
  currentUser: User
  allUsers: User[]
  /**
   * Legacy callback — retained for parents that wanted to append tickets to
   * client-side KV state. With Stripe Checkout we redirect away before
   * tickets exist in `paid` state, so this fires with an empty list on
   * successful redirect. Server-issued ticket rows appear via
   * `ticketing-client.listTickets()` on return.
   */
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
  const [error, setError] = useState<string | null>(null)

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

  const handlePurchase = useCallback(async () => {
    if (!event) return
    setPurchasing(true)
    setError(null)

    const buyQuantity = splitWithCrew && selectedCrewMembers.length > 0
      ? selectedCrewMembers.length + 1
      : quantity

    const origin = typeof window !== 'undefined' ? window.location.origin : ''

    const result = await purchaseTicket({
      eventId: event.id,
      quantity: buyQuantity,
      ticketType: selectedType,
      successUrl: origin ? `${origin}/my-tickets?session_id={CHECKOUT_SESSION_ID}` : undefined,
      cancelUrl: origin ? `${origin}/venues/${event.venueId}?ticket_cancelled=1` : undefined,
    })

    if (!result.ok) {
      setError(result.error)
      setPurchasing(false)
      return
    }

    // Server created pending tickets + Stripe session. Tell the parent that
    // a purchase was initiated so it can clear UI state, then redirect to
    // Stripe Checkout. The ticket rows materialize as `paid` via webhook.
    onPurchase([])

    if (typeof window !== 'undefined' && result.data.checkoutUrl) {
      window.location.assign(result.data.checkoutUrl)
    }
  }, [event, splitWithCrew, selectedCrewMembers, quantity, selectedType, onPurchase])

  if (!event) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
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

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <Button
              onClick={handlePurchase}
              disabled={purchasing}
              aria-busy={purchasing}
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
