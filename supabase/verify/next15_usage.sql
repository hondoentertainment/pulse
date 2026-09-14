-- Verify next-15 additive columns + RPCs on xeldqwhztcnnvazmshzh.

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'pulses'
  AND column_name = 'door_chips';

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'follows'
  AND column_name = 'pinned_at';

SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('venue_here_now_count', 'venue_here_now_friends')
ORDER BY routine_name;
