import { useState, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CalendarBlank, CaretLeft, CaretRight, Clock, UsersThree, CheckCircle } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import type { Pulse } from '@/lib/types'
import { getStaffingRecommendation, type StaffSchedule, type StaffingLevel } from '@/lib/venue-platform'

interface StaffSchedulerProps {
  venueId: string
  pulses: Pulse[]
}

const LEVEL_CONFIG: Record<StaffingLevel, { color: string; bgColor: string; label: string }> = {
  light: { color: 'text-green-400', bgColor: 'bg-green-500/20', label: 'Light' },
  moderate: { color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', label: 'Moderate' },
  heavy: { color: 'text-red-400', bgColor: 'bg-red-500/20', label: 'Heavy' },
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DISPLAY_HOURS = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2]

function formatHour(h: number): string {
  if (h === 0) return '12a'
  if (h === 12) return '12p'
  return h > 12 ? `${h - 12}p` : `${h}a`
}

export function StaffScheduler({ venueId, pulses }: StaffSchedulerProps) {
  const [weekOffset, setWeekOffset] = useState(0)

  const baseDate = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + weekOffset * 7)
    // Go to start of week (Sunday)
    d.setDate(d.getDate() - d.getDay())
    return d
  }, [weekOffset])

  const weekSchedules = useMemo(() => {
    const schedules: StaffSchedule[] = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(baseDate)
      date.setDate(date.getDate() + i)
      schedules.push(getStaffingRecommendation(venueId, date, pulses))
    }
    return schedules
  }, [venueId, pulses, baseDate])

  const [selectedDay, setSelectedDay] = useState(new Date().getDay())
  const selectedSchedule = weekSchedules[selectedDay]

  // Calculate average confidence across the week
  const avgConfidence = useMemo(() => {
    let total = 0, count = 0
    for (const schedule of weekSchedules) {
      for (const h of schedule.hours) {
        total += h.confidence
        count++
      }
    }
    return count > 0 ? Math.round((total / count) * 100) : 0
  }, [weekSchedules])

  const weekLabel = useMemo(() => {
    const end = new Date(baseDate)
    end.setDate(end.getDate() + 6)
    const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`
    return `${fmt(baseDate)} - ${fmt(end)}`
  }, [baseDate])

  const totalStaffNeeded = selectedSchedule?.hours.reduce((s, h) => Math.max(s, h.recommendedStaff), 0) ?? 0

  return (
    <div className="space-y-4">
      {/* Week Navigation */}
      <Card className="p-4 bg-card/80 border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CalendarBlank size={16} weight="fill" className="text-accent" />
            <h3 className="text-sm font-bold text-foreground">Staff Scheduling</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekOffset(o => o - 1)}
              className="p-1 rounded hover:bg-muted/50 transition-colors"
            >
              <CaretLeft size={16} className="text-muted-foreground" />
            </button>
            <span className="text-xs text-muted-foreground min-w-[90px] text-center">{weekLabel}</span>
            <button
              onClick={() => setWeekOffset(o => o + 1)}
              className="p-1 rounded hover:bg-muted/50 transition-colors"
            >
              <CaretRight size={16} className="text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Day selector */}
        <div className="grid grid-cols-7 gap-1">
          {DAYS.map((day, i) => {
            const isToday = weekOffset === 0 && i === new Date().getDay()
            return (
              <button
                key={day}
                onClick={() => setSelectedDay(i)}
                className={`py-1.5 rounded text-xs font-medium transition-colors ${
                  selectedDay === i
                    ? 'bg-primary text-primary-foreground'
                    : isToday
                    ? 'bg-accent/20 text-accent'
                    : 'hover:bg-muted/50 text-muted-foreground'
                }`}
              >
                {day}
              </button>
            )
          })}
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3 bg-card/80 border-border text-center">
          <UsersThree size={16} className="text-accent mx-auto mb-1" />
          <p className="text-lg font-bold text-foreground">{totalStaffNeeded}</p>
          <p className="text-[10px] text-muted-foreground">Peak Staff</p>
        </Card>
        <Card className="p-3 bg-card/80 border-border text-center">
          <Clock size={16} className="text-accent mx-auto mb-1" />
          <p className="text-lg font-bold text-foreground">
            {selectedSchedule?.hours.filter(h => h.level === 'heavy').length ?? 0}h
          </p>
          <p className="text-[10px] text-muted-foreground">Heavy Hours</p>
        </Card>
        <Card className="p-3 bg-card/80 border-border text-center">
          <CheckCircle size={16} className="text-accent mx-auto mb-1" />
          <p className="text-lg font-bold text-foreground">{avgConfidence}%</p>
          <p className="text-[10px] text-muted-foreground">Accuracy</p>
        </Card>
      </div>

      {/* Calendar Grid */}
      <Card className="p-4 bg-card/80 border-border">
        <h3 className="text-sm font-bold text-foreground mb-3">
          {DAYS[selectedDay]} Hourly Breakdown
        </h3>
        <div className="space-y-1">
          {DISPLAY_HOURS.map(hour => {
            const rec = selectedSchedule?.hours.find(h => h.hour === hour)
            if (!rec) return null
            const config = LEVEL_CONFIG[rec.level]
            const barWidth = Math.min(100, (rec.predictedVisitors / 80) * 100)

            return (
              <motion.div
                key={hour}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: DISPLAY_HOURS.indexOf(hour) * 0.02 }}
                className={`flex items-center gap-2 p-2 rounded-md ${config.bgColor}`}
              >
                <span className="text-xs text-muted-foreground w-8 shrink-0 font-mono">
                  {formatHour(hour)}
                </span>
                <div className="flex-1 h-4 bg-background/30 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${barWidth}%` }}
                    transition={{ duration: 0.5, delay: DISPLAY_HOURS.indexOf(hour) * 0.03 }}
                    className={`h-full rounded-full ${
                      rec.level === 'heavy' ? 'bg-red-500/60' :
                      rec.level === 'moderate' ? 'bg-yellow-500/60' :
                      'bg-green-500/60'
                    }`}
                  />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${config.color} border-current/30`}>
                    {config.label}
                  </Badge>
                  <span className="text-xs text-foreground font-medium w-6 text-right">
                    {rec.recommendedStaff}
                  </span>
                  <UsersThree size={12} className="text-muted-foreground" />
                </div>
              </motion.div>
            )
          })}
        </div>
      </Card>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4">
        {(['light', 'moderate', 'heavy'] as StaffingLevel[]).map(level => {
          const config = LEVEL_CONFIG[level]
          return (
            <div key={level} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded-sm ${config.bgColor}`} />
              <span className={`text-[10px] ${config.color}`}>{config.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
