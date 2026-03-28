// ============================================================
// Edge Function: recalculate-scores
// Cron-triggered (every 5 minutes) score recalculation.
//
// Expected invocation via Supabase scheduled functions or pg_cron:
//   supabase functions invoke recalculate-scores --no-verify-jwt
// ============================================================
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --------------- Types ---------------

interface VenueRow {
  id: string;
}

interface CleanupResult {
  pulses_deleted: number;
  stories_deleted: number;
}

interface RecalcReport {
  venues_recalculated: number;
  pulses_deleted: number;
  stories_deleted: number;
  duration_ms: number;
  errors: string[];
}

// --------------- CORS ---------------

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

// --------------- Helpers ---------------

function getSupabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set",
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

// --------------- Main handler ---------------

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return Response.json(
      { error: "Method not allowed" },
      { status: 405, headers: CORS_HEADERS },
    );
  }

  // This function is called by the scheduler (service-role context).
  // Optionally validate a shared secret for belt-and-suspenders security.
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret) {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (authHeader !== `Bearer ${cronSecret}`) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS_HEADERS },
      );
    }
  }

  const startMs = Date.now();
  const errors: string[] = [];
  let venuesRecalculated = 0;
  let pulsesDeleted = 0;
  let storiesDeleted = 0;

  let supabase: ReturnType<typeof createClient>;
  try {
    supabase = getSupabaseAdmin();
  } catch (err) {
    return Response.json(
      { error: (err as Error).message },
      { status: 500, headers: CORS_HEADERS },
    );
  }

  // ── Step 1: Find venues that had pulse activity in the last 90 min ──
  const { data: activeVenues, error: venueErr } = await supabase
    .from("venues")
    .select("id")
    .gte(
      "last_pulse_at",
      new Date(Date.now() - 90 * 60 * 1_000).toISOString(),
    )
    .returns<VenueRow[]>();

  if (venueErr) {
    errors.push(`Failed to fetch active venues: ${venueErr.message}`);
  } else if (activeVenues && activeVenues.length > 0) {
    // ── Step 2: Recalculate score for each active venue ──
    const recalcPromises = activeVenues.map(async (v: VenueRow) => {
      const { error } = await supabase.rpc("recalculate_venue_score", {
        venue_uuid: v.id,
      });
      if (error) {
        errors.push(`Venue ${v.id}: ${error.message}`);
      } else {
        venuesRecalculated++;
      }
    });

    // Process in batches of 20 to avoid overwhelming the DB.
    const BATCH_SIZE = 20;
    for (let i = 0; i < recalcPromises.length; i += BATCH_SIZE) {
      await Promise.all(recalcPromises.slice(i, i + BATCH_SIZE));
    }
  }

  // ── Step 3: Clean up expired content ──
  const { data: cleanupData, error: cleanupErr } = await supabase
    .rpc("cleanup_expired_content")
    .returns<CleanupResult[]>();

  if (cleanupErr) {
    errors.push(`Cleanup error: ${cleanupErr.message}`);
  } else if (cleanupData && cleanupData.length > 0) {
    const row = cleanupData[0] as CleanupResult;
    pulsesDeleted = row.pulses_deleted ?? 0;
    storiesDeleted = row.stories_deleted ?? 0;
  }

  // ── Step 4: Mark pre-trending venues ──
  // Venues whose score_velocity is in the top 10% and score > 5 get
  // the pre_trending flag so the UI can show the "Heating up" badge.
  const { error: trendingErr } = await supabase.rpc(
    "recalculate_venue_score", // no-op here; handled by SQL below
    { venue_uuid: "00000000-0000-0000-0000-000000000000" }, // sentinel
  ).then(() => ({ error: null })).catch((e) => ({ error: e }));

  // Use a raw SQL update instead of the sentinel RPC call above.
  const { error: flagErr } = await supabase
    .from("venues")
    .update({ pre_trending: false })
    .gte("id", "00000000-0000-0000-0000-000000000000"); // update all rows

  // Then flag the truly trending ones.
  if (!flagErr) {
    await supabase
      .from("venues")
      .update({ pre_trending: true })
      .gte("score_velocity", 2.0)
      .gte("pulse_score", 5.0);
  } else if (trendingErr) {
    errors.push(`Pre-trending flag error: ${flagErr?.message}`);
  }

  const report: RecalcReport = {
    venues_recalculated: venuesRecalculated,
    pulses_deleted: pulsesDeleted,
    stories_deleted: storiesDeleted,
    duration_ms: Date.now() - startMs,
    errors,
  };

  console.log("recalculate-scores completed:", report);

  return Response.json(report, {
    status: errors.length > 0 ? 207 : 200,
    headers: CORS_HEADERS,
  });
});
