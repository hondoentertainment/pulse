-- Migration: Row Level Security policies for presence and events tables
-- (profiles, venues, pulses, and notifications already have RLS policies
--  from 20260322000000_initial_schema.sql)

-- ============================================================
-- Venues: allow authenticated users to update
-- ============================================================
CREATE POLICY "Authenticated users can update venues."
    ON venues FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Authenticated users can insert venues."
    ON venues FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- ============================================================
-- Presence: authenticated users can read/insert/update their own
-- ============================================================
CREATE POLICY "Authenticated users can view all presence."
    ON presence FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can insert their own presence."
    ON presence FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own presence."
    ON presence FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own presence."
    ON presence FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- ============================================================
-- Events: anyone can read
-- ============================================================
CREATE POLICY "Events are viewable by everyone."
    ON events FOR SELECT
    USING (true);

CREATE POLICY "Authenticated users can insert events."
    ON events FOR INSERT
    TO authenticated
    WITH CHECK (true);
