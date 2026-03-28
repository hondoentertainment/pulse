// ============================================================
// Edge Function: create-pulse
// Server-validated pulse creation with geofencing and rate limiting.
// ============================================================
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";

// --------------- Constants ---------------

const MAX_CAPTION_LENGTH = 280;
const MAX_HASHTAGS = 5;
const HASHTAG_RE = /^[a-zA-Z0-9_]+$/;
const GEOFENCE_MILES = 0.5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1_000; // 1 hour
const RATE_LIMIT_MAX = 10;
// Pulse expires 90 minutes after creation.
const PULSE_TTL_MINUTES = 90;

// --------------- Types ---------------

type EnergyRating = "dead" | "chill" | "buzzing" | "electric";
const VALID_ENERGY_RATINGS: EnergyRating[] = [
  "dead",
  "chill",
  "buzzing",
  "electric",
];

interface CreatePulseBody {
  venue_id: string;
  energy_rating: EnergyRating;
  caption?: string;
  hashtags?: string[];
  photos?: string[];
  video_url?: string;
  crew_id?: string;
  user_lat: number;
  user_lng: number;
}

interface VenueRow {
  id: string;
  location_lat: number;
  location_lng: number;
}

interface PulseRow {
  created_at: string;
}

// --------------- CORS ---------------

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

// --------------- Helpers ---------------

/**
 * Haversine formula — returns distance in miles between two lat/lng points.
 */
function haversineDistanceMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 3_958.8; // Earth radius in miles
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

function isUUID(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    .test(value);
}

function getSupabaseAdmin(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

function getSupabaseUser(req: Request): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  return createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
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

  // ── Auth ──
  const userClient = getSupabaseUser(req);
  const {
    data: { user },
    error: authErr,
  } = await userClient.auth.getUser();

  if (authErr || !user) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  // ── Parse body ──
  let body: CreatePulseBody;
  try {
    body = await req.json() as CreatePulseBody;
  } catch {
    return Response.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  // ── Input validation ──
  const validationErrors: string[] = [];

  if (!isUUID(body.venue_id)) {
    validationErrors.push("venue_id must be a valid UUID");
  }

  if (!VALID_ENERGY_RATINGS.includes(body.energy_rating)) {
    validationErrors.push(
      `energy_rating must be one of: ${VALID_ENERGY_RATINGS.join(", ")}`,
    );
  }

  if (body.caption !== undefined) {
    if (typeof body.caption !== "string") {
      validationErrors.push("caption must be a string");
    } else if (body.caption.length > MAX_CAPTION_LENGTH) {
      validationErrors.push(
        `caption must be at most ${MAX_CAPTION_LENGTH} characters`,
      );
    }
  }

  if (body.hashtags !== undefined) {
    if (!Array.isArray(body.hashtags)) {
      validationErrors.push("hashtags must be an array");
    } else {
      if (body.hashtags.length > MAX_HASHTAGS) {
        validationErrors.push(`Maximum ${MAX_HASHTAGS} hashtags allowed`);
      }
      const invalidTags = body.hashtags.filter(
        (t) => typeof t !== "string" || !HASHTAG_RE.test(t),
      );
      if (invalidTags.length > 0) {
        validationErrors.push(
          `Invalid hashtags (alphanumeric + underscore only): ${invalidTags.join(", ")}`,
        );
      }
    }
  }

  const userLat = body.user_lat;
  const userLng = body.user_lng;

  if (typeof userLat !== "number" || typeof userLng !== "number") {
    validationErrors.push("user_lat and user_lng must be numbers");
  } else if (
    userLat < -90 ||
    userLat > 90 ||
    userLng < -180 ||
    userLng > 180
  ) {
    validationErrors.push("user_lat / user_lng out of valid range");
  }

  if (body.crew_id !== undefined && !isUUID(body.crew_id)) {
    validationErrors.push("crew_id must be a valid UUID");
  }

  if (validationErrors.length > 0) {
    return Response.json(
      { error: "Validation failed", details: validationErrors },
      { status: 422, headers: CORS_HEADERS },
    );
  }

  const admin = getSupabaseAdmin();

  // ── Geofence check ──
  const { data: venueData, error: venueErr } = await admin
    .from("venues")
    .select("id, location_lat, location_lng")
    .eq("id", body.venue_id)
    .single<VenueRow>();

  if (venueErr || !venueData) {
    return Response.json(
      { error: "Venue not found" },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  const distanceMiles = haversineDistanceMiles(
    userLat,
    userLng,
    venueData.location_lat,
    venueData.location_lng,
  );

  if (distanceMiles > GEOFENCE_MILES) {
    return Response.json(
      {
        error: "Too far from venue",
        detail: `You must be within ${GEOFENCE_MILES} miles of the venue to post a pulse. You are ${distanceMiles.toFixed(2)} miles away.`,
      },
      { status: 403, headers: CORS_HEADERS },
    );
  }

  // ── Rate limit check ──
  const windowStart = new Date(
    Date.now() - RATE_LIMIT_WINDOW_MS,
  ).toISOString();

  const { count, error: countErr } = await admin
    .from("pulses")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", windowStart);

  if (countErr) {
    console.error("Rate limit check failed:", countErr);
    return Response.json(
      { error: "Internal server error" },
      { status: 500, headers: CORS_HEADERS },
    );
  }

  if ((count ?? 0) >= RATE_LIMIT_MAX) {
    return Response.json(
      {
        error: "Rate limit exceeded",
        detail: `Maximum ${RATE_LIMIT_MAX} pulses per hour.`,
      },
      { status: 429, headers: CORS_HEADERS },
    );
  }

  // ── Fetch user's credibility weight ──
  const { data: profileData } = await admin
    .from("profiles")
    .select("credibility_score")
    .eq("id", user.id)
    .single<{ credibility_score: number }>();

  const credibilityWeight = profileData?.credibility_score ?? 1.0;

  // ── Determine if pioneer (first pulse at this venue in >90 min) ──
  const ninetyMinutesAgo = new Date(
    Date.now() - PULSE_TTL_MINUTES * 60 * 1_000,
  ).toISOString();

  const { data: recentPulses } = await admin
    .from("pulses")
    .select("created_at")
    .eq("venue_id", body.venue_id)
    .gte("created_at", ninetyMinutesAgo)
    .order("created_at", { ascending: false })
    .limit(1)
    .returns<PulseRow[]>();

  const isPioneer = !recentPulses || recentPulses.length === 0;

  // ── Insert pulse ──
  const expiresAt = new Date(
    Date.now() + PULSE_TTL_MINUTES * 60 * 1_000,
  ).toISOString();

  const { data: pulse, error: insertErr } = await admin
    .from("pulses")
    .insert({
      user_id: user.id,
      venue_id: body.venue_id,
      energy_rating: body.energy_rating,
      caption: body.caption ?? null,
      hashtags: body.hashtags ?? [],
      photos: body.photos ?? [],
      video_url: body.video_url ?? null,
      crew_id: body.crew_id ?? null,
      credibility_weight: credibilityWeight,
      is_pioneer: isPioneer,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (insertErr || !pulse) {
    console.error("Pulse insert failed:", insertErr);
    return Response.json(
      { error: "Failed to create pulse" },
      { status: 500, headers: CORS_HEADERS },
    );
  }

  // Score recalculation is handled by the DB trigger
  // (trg_pulse_inserted_recalculate_score), so we don't need to call it here.

  return Response.json(
    { pulse, is_pioneer: isPioneer },
    { status: 201, headers: CORS_HEADERS },
  );
});
