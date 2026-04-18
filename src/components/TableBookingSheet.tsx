import { useState, useMemo } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Venue } from '@/lib/types'
import {
  VenueTable,
  TableReservation,
  TimeSlot,
  TABLE_LOCATION_CONFIG,
  getDefaultVenueTables,
  generateTimeSlots,
  getAvailableTables,
  calculateDeposit,
  createTableReservation,
} from '@/lib/table-booking'
import { formatPrice, createPaymentIntent, processPayment } from '@/lib/payment-processing'
import { CalendarBlank, Clock, Users, MapPin, Minus, Plus, ChatText } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { featureFlags } from '@/lib/feature-flags'
import { requestReservation } from '@/lib/reservations-client'

interface TableBookingSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  venue: Venue | null
  userId: string
  existingReservations: TableReservation[]
  onBook: (reservation: TableReservation) => void
}

export function TableBookingSheet({
  open,
  onOpenChange,
  venue,
  userId,
  existingReservations,
  onBook,
}: TableBookingSheetProps) {
  const today = new Date()
  const [selectedDate, setSelectedDate] = useState<string>(
    today.toISOString().split('T')[0]
  )
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [partySize, setPartySize] = useState(4)
  const [selectedTable, setSelectedTable] = useState<VenueTable | null>(null)
  const [specialRequests, setSpecialRequests] = useState('')
  const [booking, setBooking] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  const timeSlots = useMemo(() => generateTimeSlots(selectedDate), [selectedDate])

  const venueTables = useMemo(() => {
    if (!venue) return []
    return getDefaultVenueTables(venue.id)
  }, [venue])

  const availableTables = useMemo(() => {
    if (!venue || !selectedSlot) return []
    return getAvailableTables(
      venueTables,
      existingReservations,
      selectedDate,
      selectedSlot,
      partySize
    )
  }, [venue, venueTables, existingReservations, selectedDate, selectedSlot, partySize])

  // Generate next 7 days for date picker
  const dateOptions = useMemo(() => {
    const dates: { value: string; label: string; dayLabel: string }[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() + i)
      dates.push({
        value: d.toISOString().split('T')[0],
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        dayLabel: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short' }),
      })
    }
    return dates
  }, [])

  const deposit = selectedTable ? calculateDeposit(selectedTable.minimumSpend) : 0

  const handleBook = async () => {
    if (!venue || !selectedTable || !selectedSlot) return
    setBooking(true)
    setApiError(null)

    // ── New reservations API (feature-flagged) ───────────────
    if (featureFlags.ticketing) {
      try {
        const startsAt = `${selectedDate}T${selectedSlot.start}:00`
        const endsAt = `${selectedDate}T${selectedSlot.end}:00`
        const result = await requestReservation({
          venue_id: venue.id,
          party_size: partySize,
          starts_at: new Date(startsAt).toISOString(),
          ends_at: new Date(endsAt).toISOString(),
          notes: specialRequests || undefined,
          deposit_cents: Math.round(deposit * 100),
        })
        if (!result.ok) {
          setApiError(result.error)
          return
        }
        onOpenChange(false)
        setSelectedSlot(null)
        setSelectedTable(null)
        setSpecialRequests('')
        setPartySize(4)
        return
      } catch (err) {
        setApiError(err instanceof Error ? err.message : 'Booking failed')
        return
      } finally {
        setBooking(false)
      }
    }

    try {
      await new Promise(resolve => setTimeout(resolve, 800))

      const reservation = createTableReservation(
        venue.id,
        selectedTable.id,
        userId,
        selectedDate,
        selectedSlot,
        partySize,
        selectedTable.tableNumber,
        selectedTable.minimumSpend,
        specialRequests
      )

      // Process deposit payment
      const intent = createPaymentIntent(
        deposit,
        'table_booking',
        userId,
        venue.id,
        undefined,
        { reservationId: reservation.id, tableNumber: selectedTable.tableNumber }
      )
      processPayment(intent)

      onBook(reservation)
      onOpenChange(false)

      // Reset
      setSelectedSlot(null)
      setSelectedTable(null)
      setSpecialRequests('')
      setPartySize(4)
    } finally {
      setBooking(false)
    }
  }

  if (!venue) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl border-t-primary/20 bg-card p-0 max-h-[85vh] overflow-y-auto">
        <SheetHeader className="p-6 pb-0">
          <div className="mx-auto w-12 h-1.5 rounded-full bg-muted/30 mb-4" />
          <SheetTitle className="text-2xl font-bold flex items-center gap-2">
            <CalendarBlank size={28} className="text-primary" />
            Reserve a Table
          </SheetTitle>
          <SheetDescription className="text-sm">
            {venue.name}
          </SheetDescription>
        </SheetHeader>

        <div className="p-6 space-y-6">
          {/* Date Picker */}
          <div className="space-y-3">
            <h3 className="font-bold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <CalendarBlank size={16} />
              Select Date
            </h3>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
              {dateOptions.map(date => (
                <button
                  key={date.value}
                  onClick={() => {
                    setSelectedDate(date.value)
                    setSelectedSlot(null)
                    setSelectedTable(null)
                  }}
                  className={cn(
                    "flex-shrink-0 px-4 py-3 rounded-xl border text-center transition-all min-w-[72px]",
                    selectedDate === date.value
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/30"
                  )}
                >
                  <p className="text-xs text-muted-foreground">{date.dayLabel}</p>
                  <p className="font-bold text-sm">{date.label}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Time Slot Picker */}
          <div className="space-y-3">
            <h3 className="font-bold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <Clock size={16} />
              Select Time (2-hour blocks)
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {timeSlots.map((slot, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setSelectedSlot(slot)
                    setSelectedTable(null)
                  }}
                  className={cn(
                    "px-4 py-3 rounded-xl border text-sm font-medium transition-all",
                    selectedSlot?.start === slot.start
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/30"
                  )}
                >
                  {slot.label}
                </button>
              ))}
            </div>
          </div>

          {/* Party Size */}
          <div className="space-y-3">
            <h3 className="font-bold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <Users size={16} />
              Party Size
            </h3>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full"
                onClick={() => setPartySize(s => Math.max(2, s - 1))}
                disabled={partySize <= 2}
              >
                <Minus size={16} />
              </Button>
              <span className="font-bold text-2xl w-8 text-center">{partySize}</span>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full"
                onClick={() => setPartySize(s => Math.min(12, s + 1))}
                disabled={partySize >= 12}
              >
                <Plus size={16} />
              </Button>
              <span className="text-sm text-muted-foreground">guests</span>
            </div>
          </div>

          {/* Available Tables */}
          {selectedSlot && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="font-bold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                  <MapPin size={16} />
                  Available Tables
                </h3>
                {availableTables.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No tables available for this time and party size
                  </p>
                ) : (
                  <div className="space-y-2">
                    {availableTables.map(table => {
                      const isSelected = selectedTable?.id === table.id
                      const locationConfig = TABLE_LOCATION_CONFIG[table.location]
                      const dep = calculateDeposit(table.minimumSpend)

                      return (
                        <motion.button
                          key={table.id}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setSelectedTable(table)}
                          className={cn(
                            "w-full text-left p-4 rounded-xl border transition-all",
                            isSelected
                              ? "border-primary bg-primary/10"
                              : "border-border hover:border-primary/30"
                          )}
                        >
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span>{locationConfig.emoji}</span>
                                <span className="font-bold">Table {table.tableNumber}</span>
                                <Badge variant="outline" className="text-[10px]">
                                  {locationConfig.label}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">{table.description}</p>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-xs text-muted-foreground">
                                  Up to {table.capacity} guests
                                </span>
                              </div>
                            </div>
                            <div className="text-right shrink-0 ml-3">
                              <p className="text-xs text-muted-foreground">Min. spend</p>
                              <p className="font-bold">{formatPrice(table.minimumSpend)}</p>
                              <p className="text-xs text-primary mt-1">
                                {formatPrice(dep)} deposit
                              </p>
                            </div>
                          </div>
                        </motion.button>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Special Requests */}
          {selectedTable && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="font-bold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                  <ChatText size={16} />
                  Special Requests
                </h3>
                <textarea
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  placeholder="Birthday celebration, bottle preferences, dietary needs..."
                  className="w-full h-20 bg-secondary rounded-xl p-3 text-sm resize-none placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  maxLength={300}
                />
              </div>
            </>
          )}

          {/* Booking Summary & Button */}
          {selectedTable && (
            <>
              <Separator />
              <div className="space-y-4">
                <div className="bg-secondary/50 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Table</span>
                    <span className="font-medium">
                      {selectedTable.tableNumber} ({TABLE_LOCATION_CONFIG[selectedTable.location].label})
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Minimum Spend</span>
                    <span className="font-medium">{formatPrice(selectedTable.minimumSpend)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="font-medium">Deposit Due Now</span>
                    <span className="font-bold text-primary text-lg">{formatPrice(deposit)}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Deposit is 50% of minimum spend. Remainder due at venue.
                  </p>
                </div>

                {apiError && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400"
                  >
                    {apiError}
                  </div>
                )}

                <Button
                  onClick={handleBook}
                  disabled={booking}
                  className="w-full h-14 text-lg font-bold bg-primary hover:bg-primary/90"
                >
                  {booking ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                      className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                    />
                  ) : (
                    <>Book Table &middot; {formatPrice(deposit)} deposit</>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
