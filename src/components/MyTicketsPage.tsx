import { useState, useMemo } from 'react'
import { Venue } from '@/lib/types'
import { VenueEvent } from '@/lib/events'
import {
  Ticket,
  TICKET_TYPE_CONFIG,
  getUpcomingTickets,
  getPastTickets,
  getRefundEligibility,
  requestRefund,
  applyRefund,
  initiateTransfer,
} from '@/lib/ticketing'
import {
  TableReservation,
  getUpcomingReservations,
  getPastReservations,
  cancelReservation,
} from '@/lib/table-booking'
import { formatPrice } from '@/lib/payment-processing'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Ticket as TicketIcon,
  CaretLeft,
  QrCode,
  ArrowsLeftRight,
  ArrowCounterClockwise,
  CalendarBlank,
  MapPin,
  Clock,
  X,
} from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface MyTicketsPageProps {
  currentUserId: string
  tickets: Ticket[]
  reservations: TableReservation[]
  events: VenueEvent[]
  venues: Venue[]
  onBack: () => void
  onTicketsUpdate: (tickets: Ticket[]) => void
  onReservationsUpdate: (reservations: TableReservation[]) => void
}

type TabFilter = 'upcoming' | 'past'

export function MyTicketsPage({
  currentUserId,
  tickets,
  reservations,
  events,
  venues,
  onBack,
  onTicketsUpdate,
  onReservationsUpdate,
}: MyTicketsPageProps) {
  const [tab, setTab] = useState<TabFilter>('upcoming')
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null)
  const [showTransferDialog, setShowTransferDialog] = useState<string | null>(null)
  const [transferToUser, setTransferToUser] = useState('')

  const eventMap = useMemo(() => {
    const map = new Map<string, VenueEvent>()
    for (const e of events) map.set(e.id, e)
    return map
  }, [events])

  const venueMap = useMemo(() => {
    const map = new Map<string, Venue>()
    for (const v of venues) map.set(v.id, v)
    return map
  }, [venues])

  const eventsForTickets = useMemo(
    () => events.map(e => ({ id: e.id, startTime: e.startTime })),
    [events]
  )

  const upcomingTickets = useMemo(
    () => getUpcomingTickets(tickets, currentUserId, eventsForTickets),
    [tickets, currentUserId, eventsForTickets]
  )

  const pastTickets = useMemo(
    () => getPastTickets(tickets, currentUserId, eventsForTickets),
    [tickets, currentUserId, eventsForTickets]
  )

  const upcomingReservations = useMemo(
    () => getUpcomingReservations(reservations, currentUserId),
    [reservations, currentUserId]
  )

  const pastReservations = useMemo(
    () => getPastReservations(reservations, currentUserId),
    [reservations, currentUserId]
  )

  const currentTickets = tab === 'upcoming' ? upcomingTickets : pastTickets
  const currentReservations = tab === 'upcoming' ? upcomingReservations : pastReservations

  const handleRefund = (ticket: Ticket) => {
    const event = eventMap.get(ticket.eventId)
    if (!event) return

    const refundReq = requestRefund(ticket, event.startTime, 'User requested refund')
    if (refundReq.status === 'approved') {
      const updatedTickets = tickets.map(t =>
        t.id === ticket.id ? applyRefund(t) : t
      )
      onTicketsUpdate(updatedTickets)
    }
  }

  const handleTransfer = (ticket: Ticket) => {
    if (!transferToUser.trim()) return

    const result = initiateTransfer(ticket, transferToUser.trim(), ticket.price)
    if (result.success && result.ticket) {
      const updatedTickets = tickets.map(t =>
        t.id === ticket.id ? result.ticket! : t
      )
      onTicketsUpdate(updatedTickets)
      setShowTransferDialog(null)
      setTransferToUser('')
    }
  }

  const handleCancelReservation = (reservation: TableReservation) => {
    const updated = reservations.map(r =>
      r.id === reservation.id ? cancelReservation(r) : r
    )
    onReservationsUpdate(updated)
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3 max-w-2xl mx-auto">
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-muted rounded-lg">
            <CaretLeft size={24} />
          </button>
          <div className="flex items-center gap-2">
            <TicketIcon size={24} weight="fill" className="text-primary" />
            <h1 className="text-xl font-bold">My Tickets</h1>
          </div>
        </div>

        {/* Tab Filter */}
        <div className="flex gap-2 px-4 pb-3 max-w-2xl mx-auto">
          {(['upcoming', 'past'] as const).map(f => (
            <button
              key={f}
              onClick={() => setTab(f)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-all",
                tab === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground border border-border"
              )}
            >
              {f === 'upcoming' ? 'Upcoming' : 'Past'}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-6">
        {/* Tickets Section */}
        {currentTickets.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-bold text-sm uppercase tracking-wide text-muted-foreground">
              Tickets ({currentTickets.length})
            </h2>
            {currentTickets.map((ticket, i) => {
              const event = eventMap.get(ticket.eventId)
              const venue = venueMap.get(ticket.venueId)
              const config = TICKET_TYPE_CONFIG[ticket.type]
              const isExpanded = expandedTicketId === ticket.id
              const refundInfo = event ? getRefundEligibility(event.startTime) : null

              return (
                <motion.div
                  key={ticket.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card
                    className={cn(
                      "overflow-hidden border transition-all",
                      isExpanded ? "border-primary" : "border-border"
                    )}
                  >
                    <button
                      onClick={() => setExpandedTicketId(isExpanded ? null : ticket.id)}
                      className="w-full text-left p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{config.emoji}</span>
                            <span className="font-bold">{event?.title || 'Event'}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {venue?.name || 'Venue'}
                          </p>
                          {event && (
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <CalendarBlank size={12} />
                                {new Date(event.startTime).toLocaleDateString('en-US', {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock size={12} />
                                {new Date(event.startTime).toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              ticket.status === 'purchased' && "border-green-500/30 text-green-400",
                              ticket.status === 'used' && "border-muted-foreground/30 text-muted-foreground",
                              ticket.status === 'refunded' && "border-red-500/30 text-red-400"
                            )}
                          >
                            {config.label}
                          </Badge>
                          <p className="font-bold mt-1">{formatPrice(ticket.price)}</p>
                        </div>
                      </div>
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: 'auto' }}
                          exit={{ height: 0 }}
                          className="overflow-hidden"
                        >
                          <Separator />
                          <div className="p-4 space-y-4">
                            {/* QR Code placeholder */}
                            <div className="flex flex-col items-center py-4">
                              <div className="w-40 h-40 bg-white rounded-xl flex items-center justify-center">
                                <QrCode size={120} className="text-black" />
                              </div>
                              <p className="text-xs text-muted-foreground mt-2 font-mono">
                                {ticket.qrCode.slice(0, 20)}...
                              </p>
                            </div>

                            {/* Actions */}
                            {tab === 'upcoming' && ticket.status === 'purchased' && (
                              <div className="flex gap-2">
                                {ticket.transferable && ticket.transferHistory.length === 0 && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setShowTransferDialog(ticket.id)
                                    }}
                                  >
                                    <ArrowsLeftRight size={16} className="mr-2" />
                                    Transfer
                                  </Button>
                                )}
                                {refundInfo && refundInfo.eligible && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleRefund(ticket)
                                    }}
                                  >
                                    <ArrowCounterClockwise size={16} className="mr-2" />
                                    Refund ({refundInfo.percentage}%)
                                  </Button>
                                )}
                              </div>
                            )}

                            {ticket.transferHistory.length > 0 && (
                              <p className="text-xs text-muted-foreground">
                                Transferred from {ticket.transferHistory[0].fromUserId}
                              </p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>

                  {/* Transfer Dialog Inline */}
                  <AnimatePresence>
                    {showTransferDialog === ticket.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <Card className="mt-2 p-4 border-primary/30 space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-sm">Transfer Ticket</h4>
                            <button
                              onClick={() => {
                                setShowTransferDialog(null)
                                setTransferToUser('')
                              }}
                              className="p-1 hover:bg-secondary rounded"
                            >
                              <X size={16} />
                            </button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Max transfer price: {formatPrice(ticket.originalPrice * 1.1)} (110% of original)
                          </p>
                          <input
                            type="text"
                            placeholder="Enter recipient user ID"
                            value={transferToUser}
                            onChange={(e) => setTransferToUser(e.target.value)}
                            className="w-full bg-secondary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                          <Button
                            size="sm"
                            onClick={() => handleTransfer(ticket)}
                            disabled={!transferToUser.trim()}
                          >
                            Confirm Transfer
                          </Button>
                        </Card>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </div>
        )}

        {/* Table Reservations Section */}
        {currentReservations.length > 0 && (
          <>
            {currentTickets.length > 0 && <Separator />}
            <div className="space-y-3">
              <h2 className="font-bold text-sm uppercase tracking-wide text-muted-foreground">
                Table Reservations ({currentReservations.length})
              </h2>
              {currentReservations.map((reservation, i) => {
                const venue = venueMap.get(reservation.venueId)

                return (
                  <motion.div
                    key={reservation.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card className="p-4 border-border space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{venue?.name || 'Venue'}</span>
                            <Badge variant="outline" className="text-[10px]">
                              Table {reservation.tableNumber}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <CalendarBlank size={12} />
                              {new Date(reservation.date).toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock size={12} />
                              {reservation.timeSlot.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <MapPin size={12} />
                              {reservation.partySize} guests
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              reservation.status === 'confirmed' && "border-green-500/30 text-green-400",
                              reservation.status === 'completed' && "border-muted-foreground/30 text-muted-foreground",
                              reservation.status === 'cancelled' && "border-red-500/30 text-red-400"
                            )}
                          >
                            {reservation.status}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">Min spend</p>
                          <p className="font-bold">{formatPrice(reservation.minimumSpend)}</p>
                        </div>
                      </div>

                      {/* QR Code for upcoming */}
                      {tab === 'upcoming' && reservation.status === 'confirmed' && (
                        <div className="flex items-center justify-between pt-2 border-t border-border">
                          <div className="flex items-center gap-2">
                            <QrCode size={20} className="text-primary" />
                            <span className="text-xs text-muted-foreground font-mono">
                              {reservation.qrCode.slice(0, 16)}...
                            </span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCancelReservation(reservation)}
                          >
                            Cancel
                          </Button>
                        </div>
                      )}

                      {reservation.specialRequests && (
                        <p className="text-xs text-muted-foreground italic">
                          Note: {reservation.specialRequests}
                        </p>
                      )}
                    </Card>
                  </motion.div>
                )
              })}
            </div>
          </>
        )}

        {/* Empty State */}
        {currentTickets.length === 0 && currentReservations.length === 0 && (
          <div className="text-center py-12 space-y-3">
            <TicketIcon size={48} className="mx-auto text-muted-foreground/50" />
            <p className="text-muted-foreground">
              {tab === 'upcoming' ? 'No upcoming tickets or reservations' : 'No past tickets or reservations'}
            </p>
            <p className="text-sm text-muted-foreground/70">
              {tab === 'upcoming'
                ? 'Get tickets for events or reserve tables at your favorite venues'
                : 'Your ticket and reservation history will appear here'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
