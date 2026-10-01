-- WC-7: admin resolve/dismiss reason on existing pulse_reports.
-- Additive only. Does not drop signal_* tables.
-- Apply on xeldqwhztcnnvazmshzh. Verify with supabase/verify/pulse_report_resolution_note.sql.

ALTER TABLE public.pulse_reports
  ADD COLUMN IF NOT EXISTS resolution_note TEXT;

COMMENT ON COLUMN public.pulse_reports.resolution_note IS
  'Why an admin resolved or dismissed this report from /ops. Reporter details stay in details.';
