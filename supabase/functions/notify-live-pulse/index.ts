import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Optional Database Webhook / HTTP target for live-pulse fan-out.
 * Prefer POST /api/push/notify-live from the Vercel API when a pulse is created.
 * Missing VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY is an honest no-op.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  if (!publicKey || !privateKey) {
    return new Response(JSON.stringify({
      attempted: false,
      sent: 0,
      reason: 'missing_vapid',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }

  const apiBase = Deno.env.get('PULSE_API_BASE_URL') || Deno.env.get('SITE_URL')
  if (!apiBase) {
    return new Response(JSON.stringify({
      attempted: false,
      sent: 0,
      reason: 'missing_api_base',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }

  const body = await req.json().catch(() => ({}))
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE')
  const res = await fetch(`${apiBase.replace(/\/$/, '')}/api/push/notify-live`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(serviceKey ? { Authorization: `Bearer ${serviceKey}` } : {}),
    },
    body: JSON.stringify(body),
  })

  const json = await res.json().catch(() => ({}))
  return new Response(JSON.stringify(json), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: res.ok ? 200 : res.status,
  })
})
