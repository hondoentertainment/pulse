-- ============================================================
-- Migration: Triggers
-- Created: 2026-03-28
-- ============================================================
-- All trigger functions are defined in 20260328000003_functions.sql.
-- ============================================================

-- ----------------------------------------------------------------
-- 1. After INSERT on pulses → recalculate venue score
-- ----------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_pulse_inserted_recalculate_score ON pulses;

CREATE TRIGGER trg_pulse_inserted_recalculate_score
    AFTER INSERT ON pulses
    FOR EACH ROW
    EXECUTE FUNCTION increment_venue_score_on_pulse();

-- ----------------------------------------------------------------
-- 2. After INSERT / DELETE on reactions → sync pulse reaction counts
-- ----------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_reaction_inserted_update_counts ON reactions;

CREATE TRIGGER trg_reaction_inserted_update_counts
    AFTER INSERT ON reactions
    FOR EACH ROW
    EXECUTE FUNCTION update_pulse_reaction_counts();

DROP TRIGGER IF EXISTS trg_reaction_deleted_update_counts ON reactions;

CREATE TRIGGER trg_reaction_deleted_update_counts
    AFTER DELETE ON reactions
    FOR EACH ROW
    EXECUTE FUNCTION update_pulse_reaction_counts();

-- ----------------------------------------------------------------
-- 3. After INSERT on check_ins → increment venue verified count
-- ----------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_check_in_inserted_increment_count ON check_ins;

CREATE TRIGGER trg_check_in_inserted_increment_count
    AFTER INSERT ON check_ins
    FOR EACH ROW
    EXECUTE FUNCTION increment_venue_check_in_count();

-- ----------------------------------------------------------------
-- 4. Before UPDATE on crews → keep updated_at current
-- ----------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_crews_set_updated_at ON crews;

CREATE TRIGGER trg_crews_set_updated_at
    BEFORE UPDATE ON crews
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
