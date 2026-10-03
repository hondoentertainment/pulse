-- Verify pulse rate-limit trigger + RPC on xeldqwhztcnnvazmshzh
SELECT
  to_regprocedure('public.pulse_rate_limit_violation(uuid,uuid)') IS NOT NULL AS violation_fn,
  to_regprocedure('public.assert_pulse_rate_limit(uuid,uuid)') IS NOT NULL AS assert_rpc,
  to_regprocedure('public.enforce_pulse_rate_limit()') IS NOT NULL AS trigger_fn,
  EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'pulses_enforce_rate_limit'
  ) AS rate_limit_trigger;
