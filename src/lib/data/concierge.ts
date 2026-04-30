/**
 * Data access for AI Night Concierge sessions, messages, and plans.
 *
 * Thin wrappers around Supabase. All queries rely on RLS — callers only
 * ever see their own rows. See supabase/migrations/20260417000005_ai_concierge.sql.
 */
import { supabase } from '../supabase'

export interface ConciergeSessionRow {
  id: string
  user_id: string
  started_at: string
  ended_at: string | null
  total_input_tokens: number
  total_output_tokens: number
  total_cost_cents: number
  model: string | null
  metadata: Record<string, unknown> | null
}

export interface ConciergeMessageRow {
  id: string
  session_id: string
  role: 'user' | 'assistant' | 'tool'
  content: unknown
  tool_name: string | null
  tokens_in: number
  tokens_out: number
  created_at: string
}

export interface ConciergePlanRow {
  id: string
  session_id: string
  user_id: string
  plan_json: Record<string, unknown>
  accepted: boolean
  created_at: string
}

export async function listMySessions(limit = 30): Promise<ConciergeSessionRow[]> {
  const { data, error } = await supabase
    .from('concierge_sessions')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.warn('[concierge] listMySessions failed', error.message)
    return []
  }
  return (data ?? []) as ConciergeSessionRow[]
}

export interface ConciergeSessionDetail {
  session: ConciergeSessionRow | null
  messages: ConciergeMessageRow[]
  plans: ConciergePlanRow[]
}

export async function getSession(sessionId: string): Promise<ConciergeSessionDetail> {
  const [sessionRes, messagesRes, plansRes] = await Promise.all([
    supabase.from('concierge_sessions').select('*').eq('id', sessionId).maybeSingle(),
    supabase
      .from('concierge_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true }),
    supabase
      .from('concierge_plans')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false }),
  ])
  return {
    session: (sessionRes.data as ConciergeSessionRow | null) ?? null,
    messages: ((messagesRes.data as ConciergeMessageRow[] | null) ?? []),
    plans: ((plansRes.data as ConciergePlanRow[] | null) ?? []),
  }
}

export async function saveAcceptedPlan(args: {
  sessionId: string
  userId: string
  planJson: Record<string, unknown>
  accepted?: boolean
}): Promise<ConciergePlanRow | null> {
  const { data, error } = await supabase
    .from('concierge_plans')
    .insert({
      session_id: args.sessionId,
      user_id: args.userId,
      plan_json: args.planJson,
      accepted: args.accepted ?? true,
    })
    .select()
    .single()
  if (error) {
    console.warn('[concierge] saveAcceptedPlan failed', error.message)
    return null
  }
  return data as ConciergePlanRow
}
