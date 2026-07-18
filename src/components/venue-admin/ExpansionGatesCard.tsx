import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  EXPANSION_GATE_STREAK_WEEKS,
  EXPANSION_GATE_TARGETS,
  isoWeekStart,
  summarizeExpansionGates,
  type WeekGateSnapshot,
} from '@/lib/expansion-gates'
import { DecisionConversionStrip } from '@/components/DecisionConversionStrip'
import { getEvents } from '@/lib/analytics'
import { analyzeDecisionConversion } from '@/lib/decision-analytics'

const STORAGE_KEY = 'pulse-expansion-gate-weeks'

function loadWeeks(): WeekGateSnapshot[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as WeekGateSnapshot[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveWeeks(weeks: WeekGateSnapshot[]): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(weeks.slice(0, 16)))
}

interface ExpansionGatesCardProps {
  /** Live fresh-coverage % from admin API when available */
  liveFreshCoveragePct?: number | null
}

/**
 * Weekly expansion-gate scoreboard (PRD §15.1).
 * Records Thu–Sat operating weeks; geo expand only after 8 clear weeks.
 */
export function ExpansionGatesCard({ liveFreshCoveragePct }: ExpansionGatesCardProps) {
  const [weeks, setWeeks] = useState<WeekGateSnapshot[]>([])
  const [draft, setDraft] = useState({
    decisionConversionPct: 35,
    freshCoveragePct: liveFreshCoveragePct ?? 70,
    week4RetentionPct: 25,
    misleadingSignalPct: 8,
    scoutParticipationPct: 50,
  })

  useEffect(() => {
    setWeeks(loadWeeks())
  }, [])

  useEffect(() => {
    if (liveFreshCoveragePct != null && Number.isFinite(liveFreshCoveragePct)) {
      setDraft((d) => ({ ...d, freshCoveragePct: liveFreshCoveragePct }))
    }
  }, [liveFreshCoveragePct])

  const summary = useMemo(() => summarizeExpansionGates(weeks), [weeks])

  const recordWeek = () => {
    const live = analyzeDecisionConversion(getEvents())
    const weekStart = isoWeekStart()
    const entry: WeekGateSnapshot = {
      weekStart,
      ...draft,
      decisionConversionPct:
        live.qualifiedSessions > 0
          ? Math.round(live.rate * 100)
          : draft.decisionConversionPct,
    }
    const next = [entry, ...weeks.filter((w) => w.weekStart !== weekStart)]
    setWeeks(next)
    saveWeeks(next)
  }

  return (
    <Card className="p-4 space-y-3" data-testid="expansion-gates-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Expansion gate scoreboard</h2>
          <p className="text-xs text-muted-foreground">
            Need {EXPANSION_GATE_STREAK_WEEKS} consecutive clear weeks before geo expand.
          </p>
        </div>
        <Badge variant={summary.readyToExpand ? 'default' : 'secondary'}>
          {summary.consecutiveClearWeeks}/{EXPANSION_GATE_STREAK_WEEKS} clear
        </Badge>
      </div>

      <DecisionConversionStrip />

      <ul className="space-y-1.5 text-sm">
        {summary.checks.map((check) => (
          <li key={check.id} className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">{check.label}</span>
            <span className={check.passed ? 'text-emerald-400' : 'text-amber-400'}>
              {check.value}
              {check.higherIsBetter ? `≥` : `≤`}
              {check.target}
              {check.passed ? ' ✓' : ''}
            </span>
          </li>
        ))}
      </ul>

      {!summary.allPassed && weeks.length > 0 && (
        <p className="text-xs text-amber-400">Latest week missed one or more gates — streak reset.</p>
      )}
      {summary.readyToExpand && (
        <p className="text-xs text-emerald-400">
          Gates clear for {EXPANSION_GATE_STREAK_WEEKS} weeks — expansion prep is unlocked (not auto-launch).
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 pt-1">
        {(
          [
            ['decisionConversionPct', 'Conversion %'],
            ['freshCoveragePct', 'Fresh coverage %'],
            ['week4RetentionPct', 'W4 retention %'],
            ['misleadingSignalPct', 'Misleading %'],
            ['scoutParticipationPct', 'Scout participation %'],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="space-y-1">
            <Label htmlFor={`gate-${key}`} className="text-xs">
              {label}
            </Label>
            <Input
              id={`gate-${key}`}
              type="number"
              min={0}
              max={100}
              value={draft[key]}
              onChange={(e) =>
                setDraft((d) => ({ ...d, [key]: Number(e.target.value) || 0 }))
              }
              className="h-9"
            />
          </div>
        ))}
      </div>

      <Button type="button" size="sm" onClick={recordWeek}>
        Record week {isoWeekStart()}
      </Button>
      <p className="text-[11px] text-muted-foreground">
        Targets: conversion ≥{EXPANSION_GATE_TARGETS.decisionConversionPct}%, fresh ≥
        {EXPANSION_GATE_TARGETS.freshCoveragePct}%, W4 ≥{EXPANSION_GATE_TARGETS.week4RetentionPct}%,
        misleading ≤{EXPANSION_GATE_TARGETS.misleadingSignalPctMax}%, scout ≥
        {EXPANSION_GATE_TARGETS.scoutParticipationPct}%.
      </p>
    </Card>
  )
}
