-- Verify owner report policies on xeldqwhztcnnvazmshzh
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'pulse_reports'
  AND policyname IN (
    'pulse_reports_owner_select',
    'pulse_reports_owner_update',
    'pulse_reports_admin_all'
  )
ORDER BY policyname;
