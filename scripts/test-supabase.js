import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xeldqwhztcnnvazmshzh.supabase.co'
const supabaseKey = 'sb_publishable_Yug1sr1fQpYNL9c7jp0-aw_AjwjItgG'

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkRemote() {
  const { data, error } = await supabase.from('venues').select('id').limit(1)
  if (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }
  console.log('Success! Venues table exists and is readable.', data)
}

checkRemote()
