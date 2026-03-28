-- ============================================================
-- Migration: Additional Tables
-- Created: 2026-03-28
-- ============================================================

-- ----------------------------------------------------------------
-- CREWS
-- A crew is a group of friends coordinating their night out together.
-- ----------------------------------------------------------------
CREATE TABLE crews (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT        NOT NULL,
    creator_id   UUID        REFERENCES profiles(id) ON DELETE CASCADE,
    members      UUID[]      DEFAULT '{}',
    active_venue_id UUID     REFERENCES venues(id),
    status       TEXT        DEFAULT 'idle'
                             CHECK (status IN ('idle', 'planning', 'active', 'ended')),
    meet_point   JSONB,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_crews_creator_id       ON crews(creator_id);
CREATE INDEX idx_crews_active_venue_id  ON crews(active_venue_id);
CREATE INDEX idx_crews_status           ON crews(status);
CREATE INDEX idx_crews_created_at       ON crews(created_at DESC);

-- ----------------------------------------------------------------
-- STORIES
-- Ephemeral media (image/video) attached to a venue, expires in 24 h.
-- ----------------------------------------------------------------
CREATE TABLE stories (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    venue_id    UUID        NOT NULL REFERENCES venues(id)   ON DELETE CASCADE,
    media_url   TEXT        NOT NULL,
    media_type  TEXT        NOT NULL CHECK (media_type IN ('image', 'video')),
    caption     TEXT,
    reactions   JSONB       DEFAULT '{}'::jsonb,
    view_count  INTEGER     DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX idx_stories_user_id    ON stories(user_id);
CREATE INDEX idx_stories_venue_id   ON stories(venue_id);
CREATE INDEX idx_stories_expires_at ON stories(expires_at);
CREATE INDEX idx_stories_created_at ON stories(created_at DESC);

-- ----------------------------------------------------------------
-- REACTIONS (normalized; the JSONB blob on pulses stays for quick reads)
-- ----------------------------------------------------------------
CREATE TABLE reactions (
    id            UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID  NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    pulse_id      UUID  NOT NULL REFERENCES pulses(id)   ON DELETE CASCADE,
    reaction_type TEXT  NOT NULL
                        CHECK (reaction_type IN ('fire', 'eyes', 'skull', 'lightning', 'heart')),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, pulse_id, reaction_type)
);

CREATE INDEX idx_reactions_pulse_id      ON reactions(pulse_id);
CREATE INDEX idx_reactions_user_id       ON reactions(user_id);
CREATE INDEX idx_reactions_reaction_type ON reactions(reaction_type);
CREATE INDEX idx_reactions_created_at    ON reactions(created_at DESC);

-- ----------------------------------------------------------------
-- EVENTS
-- Venue-specific events (DJ sets, theme nights, etc.)
-- ----------------------------------------------------------------
CREATE TABLE events (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id         UUID        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    name             TEXT        NOT NULL,
    description      TEXT,
    start_time       TIMESTAMPTZ NOT NULL,
    end_time         TIMESTAMPTZ,
    cover_image_url  TEXT,
    ticket_url       TEXT,
    capacity         INTEGER,
    rsvp_count       INTEGER     DEFAULT 0,
    tags             TEXT[]      DEFAULT '{}',
    created_by       UUID        REFERENCES profiles(id),
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT events_end_after_start CHECK (end_time IS NULL OR end_time > start_time),
    CONSTRAINT events_capacity_positive CHECK (capacity IS NULL OR capacity > 0)
);

CREATE INDEX idx_events_venue_id    ON events(venue_id);
CREATE INDEX idx_events_start_time  ON events(start_time);
CREATE INDEX idx_events_created_by  ON events(created_by);
CREATE INDEX idx_events_tags        ON events USING GIN (tags);

-- ----------------------------------------------------------------
-- VENUE_OWNERS
-- Maps users to venues they own/manage with role + verification status.
-- ----------------------------------------------------------------
CREATE TABLE venue_owners (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    venue_id    UUID        NOT NULL REFERENCES venues(id)   ON DELETE CASCADE,
    role        TEXT        DEFAULT 'owner'
                            CHECK (role IN ('owner', 'manager', 'staff')),
    verified    BOOLEAN     DEFAULT false,
    verified_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, venue_id)
);

CREATE INDEX idx_venue_owners_user_id  ON venue_owners(user_id);
CREATE INDEX idx_venue_owners_venue_id ON venue_owners(venue_id);
CREATE INDEX idx_venue_owners_verified ON venue_owners(verified);

-- ----------------------------------------------------------------
-- CONTENT_REPORTS
-- User-submitted reports of content / accounts / venues.
-- ----------------------------------------------------------------
CREATE TABLE content_reports (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    target_type  TEXT        NOT NULL
                             CHECK (target_type IN ('pulse', 'story', 'user', 'venue')),
    target_id    UUID        NOT NULL,
    reason       TEXT        NOT NULL
                             CHECK (reason IN (
                                 'spam', 'inappropriate', 'harassment',
                                 'misinformation', 'fake_location', 'other'
                             )),
    details      TEXT,
    status       TEXT        DEFAULT 'pending'
                             CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed')),
    reviewed_by  UUID        REFERENCES profiles(id),
    reviewed_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_content_reports_reporter_id  ON content_reports(reporter_id);
CREATE INDEX idx_content_reports_target       ON content_reports(target_type, target_id);
CREATE INDEX idx_content_reports_status       ON content_reports(status);
CREATE INDEX idx_content_reports_created_at   ON content_reports(created_at DESC);

-- ----------------------------------------------------------------
-- FOLLOWS
-- Polymorphic follow: a user can follow another user or a venue.
-- ----------------------------------------------------------------
CREATE TABLE follows (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    target_type TEXT        NOT NULL CHECK (target_type IN ('user', 'venue')),
    target_id   UUID        NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (follower_id, target_type, target_id)
);

CREATE INDEX idx_follows_follower_id ON follows(follower_id);
CREATE INDEX idx_follows_target      ON follows(target_type, target_id);
CREATE INDEX idx_follows_created_at  ON follows(created_at DESC);

-- ----------------------------------------------------------------
-- CHECK_INS
-- Records a user physically checking in at a venue (GPS verified).
-- ----------------------------------------------------------------
CREATE TABLE check_ins (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    venue_id     UUID        NOT NULL REFERENCES venues(id)   ON DELETE CASCADE,
    crew_id      UUID        REFERENCES crews(id),
    location_lat FLOAT       NOT NULL,
    location_lng FLOAT       NOT NULL,
    verified     BOOLEAN     DEFAULT false,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_check_ins_user_id    ON check_ins(user_id);
CREATE INDEX idx_check_ins_venue_id   ON check_ins(venue_id);
CREATE INDEX idx_check_ins_crew_id    ON check_ins(crew_id);
CREATE INDEX idx_check_ins_verified   ON check_ins(verified);
CREATE INDEX idx_check_ins_created_at ON check_ins(created_at DESC);
