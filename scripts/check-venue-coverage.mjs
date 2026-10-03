import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for the target environment')
const client = createClient(url, key, { auth: { persistSession: false } })
const markets = new Map()
let total = 0
for (let offset = 0; ; offset += 1000) {
  const { data, error } = await client.from('venues').select('id,city,state')
    .order('id').range(offset, offset + 999)
  if (error) throw new Error(error.message)
  for (const venue of data) {
    const market = `${venue.city ?? 'Unknown'}, ${venue.state ?? 'Unknown'}`
    markets.set(market, (markets.get(market) ?? 0) + 1)
    total++
  }
  if (data.length < 1000) break
}
const { error } = await client.rpc('get_live_venue_intelligence', { max_pulses: 1 })
console.log(JSON.stringify({ total, markets: Object.fromEntries(markets), liveIntelligenceAvailable: !error }, null, 2))
if (error) throw new Error(error.message)
