-- Migration: Enable Supabase Realtime on key tables
-- Allows clients to subscribe to INSERT/UPDATE/DELETE changes in real time.

ALTER PUBLICATION supabase_realtime ADD TABLE pulses, presence, venues;
