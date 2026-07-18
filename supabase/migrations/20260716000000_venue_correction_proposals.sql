-- Structured venue correction proposals from signed-in Pulse users.
-- Extends venue_data_reports so reporters can suggest concrete field values
-- (hours, address, phone, website, name) alongside the existing reason/note.

ALTER TABLE venue_data_reports
  ADD COLUMN IF NOT EXISTS proposed_fields JSONB;

COMMENT ON COLUMN venue_data_reports.proposed_fields IS
  'Optional structured correction suggestions from the reporter, e.g. {"hours":"Mon-Thu 5pm-12am","phone":"+1..."}.';
