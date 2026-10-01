-- Verify crew members can select their crew. Guests have no policy.
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'crew_tonight'
  AND policyname = 'crew_tonight_select_member';
