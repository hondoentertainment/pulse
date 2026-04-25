-- ============================================================
-- AI Night Concierge tables
-- ============================================================

-- Sessions: one per concierge conversation
CREATE TABLE IF NOT EXISTS concierge_sessions (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    ended_at TIMESTAMP WITH TIME ZONE,
    total_input_tokens BIGINT DEFAULT 0 NOT NULL,
    total_output_tokens BIGINT DEFAULT 0 NOT NULL,
    total_cost_cents NUMERIC(10, 4) DEFAULT 0 NOT NULL,
    model TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_concierge_sessions_user_started
    ON concierge_sessions (user_id, started_at DESC);

ALTER TABLE concierge_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can read their concierge sessions."
    ON concierge_sessions FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Owners can insert their concierge sessions."
    ON concierge_sessions FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can update their concierge sessions."
    ON concierge_sessions FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can delete their concierge sessions."
    ON concierge_sessions FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);


-- Messages: every turn (user / assistant / tool) in a session
CREATE TABLE IF NOT EXISTS concierge_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL REFERENCES concierge_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
    content JSONB NOT NULL,
    tool_name TEXT,
    tokens_in INTEGER DEFAULT 0 NOT NULL,
    tokens_out INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_concierge_messages_session_created
    ON concierge_messages (session_id, created_at);

ALTER TABLE concierge_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can read their concierge messages."
    ON concierge_messages FOR SELECT
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM concierge_sessions s
        WHERE s.id = concierge_messages.session_id AND s.user_id = auth.uid()
    ));

CREATE POLICY "Owners can insert their concierge messages."
    ON concierge_messages FOR INSERT
    TO authenticated
    WITH CHECK (EXISTS (
        SELECT 1 FROM concierge_sessions s
        WHERE s.id = concierge_messages.session_id AND s.user_id = auth.uid()
    ));


-- Plans: materialized plan artifacts the user has chosen to save
CREATE TABLE IF NOT EXISTS concierge_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL REFERENCES concierge_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
    plan_json JSONB NOT NULL,
    accepted BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_concierge_plans_session
    ON concierge_plans (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_concierge_plans_user
    ON concierge_plans (user_id, created_at DESC);

ALTER TABLE concierge_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can read their concierge plans."
    ON concierge_plans FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Owners can insert their concierge plans."
    ON concierge_plans FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can update their concierge plans."
    ON concierge_plans FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can delete their concierge plans."
    ON concierge_plans FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);
