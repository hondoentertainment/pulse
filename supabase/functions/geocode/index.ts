import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { lat, lng } = await req.json()

    if (!lat || !lng) {
      return new Response(JSON.stringify({ error: 'Missing lat or lng' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Call Nominatim (or Google Maps / Mapbox in the future natively securely without exposing keys)
    // Nominatim asks for a unique user agent. Use a pulse specific UA.
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
    const nominatimRes = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'PulseProduction/1.0 (contact@pulse.local)'
      }
    })
    
    if (!nominatimRes.ok) throw new Error('Failed to reverse geocode')
    const data = await nominatimRes.json()

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
