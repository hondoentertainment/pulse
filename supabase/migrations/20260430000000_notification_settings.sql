-- Persist notification preferences on profiles so server-side push can respect opt-outs.

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS notification_settings JSONB
    NOT NULL DEFAULT '{
        "friendPulses": true,
        "friendNearbyVenues": true,
        "trendingVenues": true,
        "pulseReactions": true,
        "weeklyDigest": false,
        "groupReactions": true,
        "groupFriendPulses": false,
        "groupTrendingVenues": false
    }'::jsonb;

COMMENT ON COLUMN profiles.notification_settings IS
    'User notification preferences; mirrored to client KV for offline reads.';
