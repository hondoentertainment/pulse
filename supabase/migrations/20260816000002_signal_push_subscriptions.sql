-- Web Push subscriptions for Signal daily reminders (closed-app delivery).

CREATE TABLE IF NOT EXISTS signal_push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (endpoint)
);

CREATE INDEX IF NOT EXISTS idx_signal_push_subscriptions_user
    ON signal_push_subscriptions(user_id);

ALTER TABLE signal_push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own push subscriptions."
    ON signal_push_subscriptions FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own push subscriptions."
    ON signal_push_subscriptions FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own push subscriptions."
    ON signal_push_subscriptions FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own push subscriptions."
    ON signal_push_subscriptions FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

REVOKE ALL ON signal_push_subscriptions FROM anon;
