-- Verify pulse_reports.resolution_note on xeldqwhztcnnvazmshzh
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'pulse_reports'
  AND column_name = 'resolution_note';
