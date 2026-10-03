-- Verify next-15 feature tables + optional image_url on xeldqwhztcnnvazmshzh.

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'venues'
  AND column_name = 'image_url';

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'pulse_replies',
    'pulse_agrees',
    'user_blocks',
    'crew_tonight',
    'venue_door_pins'
  )
ORDER BY table_name;

SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'assert_pulse_reply_rate_limit',
    'pulse_agree_count'
  )
ORDER BY routine_name;

SELECT relrowsecurity
FROM pg_class
WHERE relname IN (
  'pulse_replies',
  'pulse_agrees',
  'user_blocks',
  'crew_tonight',
  'venue_door_pins'
)
ORDER BY relname;
