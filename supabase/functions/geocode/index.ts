// ============================================================
// Edge Function: geocode
// Reverse-geocodes lat/lng via Nominatim with rate limiting
// and in-memory caching.
// ============================================================
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// --------------- Types ---------------

interface NominatimResult {
  display_name: string;
  address: {
    road?: string;
    house_number?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
    country_code?: string;
  };
}

interface GeocodeResponse {
  display_name: string;
  street: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
  country: string | null;
  country_code: string | null;
}

// --------------- CORS ---------------

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

// --------------- In-memory cache ---------------
// Key: "lat,lng" rounded to 4 decimal places (~11 m precision).
// Value: { data, expiresAt }

interface CacheEntry {
  data: GeocodeResponse;
  expiresAt: number; // Date.now() ms
}

const CACHE_TTL_MS = 60 * 60 * 1_000; // 1 hour
const cache = new Map<string, CacheEntry>();

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

function getFromCache(key: string): GeocodeResponse | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setInCache(key: string, data: GeocodeResponse): void {
  // Evict oldest entry if cache is too large (simple LRU approximation).
  if (cache.size >= 1_000) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// --------------- Nominatim rate limiter ---------------
// Nominatim's usage policy: max 1 req/s per IP (we enforce it globally
// since this function is the single proxy).

let lastNominatimCallMs = 0;
const NOMINATIM_MIN_INTERVAL_MS = 1_000; // 1 req/s

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const waitMs = NOMINATIM_MIN_INTERVAL_MS - (now - lastNominatimCallMs);
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  lastNominatimCallMs = Date.now();
  return fetch(url, {
    headers: {
      // Nominatim requires a descriptive User-Agent.
      "User-Agent": "Pulse-Nightlife-App/1.0 (contact@pulse.app)",
      Accept: "application/json",
    },
  });
}

// --------------- Main handler ---------------

serve(async (req: Request): Promise<Response> => {
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "GET") {
    return Response.json(
      { error: "Method not allowed" },
      { status: 405, headers: CORS_HEADERS },
    );
  }

  // Parse query params
  const url = new URL(req.url);
  const latStr = url.searchParams.get("lat");
  const lngStr = url.searchParams.get("lng");

  if (!latStr || !lngStr) {
    return Response.json(
      { error: "Missing required query parameters: lat, lng" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  if (isNaN(lat) || isNaN(lng)) {
    return Response.json(
      { error: "lat and lng must be valid numbers" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return Response.json(
      { error: "lat must be in [-90, 90] and lng in [-180, 180]" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  // Cache lookup
  const key = cacheKey(lat, lng);
  const cached = getFromCache(key);
  if (cached) {
    return Response.json(cached, {
      status: 200,
      headers: { ...CORS_HEADERS, "X-Cache": "HIT" },
    });
  }

  // Fetch from Nominatim
  const nominatimUrl =
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;

  let nominatimResp: Response;
  try {
    nominatimResp = await rateLimitedFetch(nominatimUrl);
  } catch (err) {
    console.error("Nominatim fetch error:", err);
    return Response.json(
      { error: "Geocoding service unavailable" },
      { status: 503, headers: CORS_HEADERS },
    );
  }

  if (!nominatimResp.ok) {
    return Response.json(
      { error: `Nominatim returned HTTP ${nominatimResp.status}` },
      { status: 502, headers: CORS_HEADERS },
    );
  }

  let raw: NominatimResult;
  try {
    raw = await nominatimResp.json() as NominatimResult;
  } catch {
    return Response.json(
      { error: "Failed to parse geocoding response" },
      { status: 502, headers: CORS_HEADERS },
    );
  }

  const addr = raw.address ?? {};
  const street = [addr.house_number, addr.road].filter(Boolean).join(" ") ||
    null;
  const city = addr.city ?? addr.town ?? addr.village ?? null;

  const result: GeocodeResponse = {
    display_name: raw.display_name,
    street,
    neighborhood: addr.suburb ?? null,
    city,
    state: addr.state ?? null,
    postcode: addr.postcode ?? null,
    country: addr.country ?? null,
    country_code: addr.country_code?.toUpperCase() ?? null,
  };

  setInCache(key, result);

  return Response.json(result, {
    status: 200,
    headers: { ...CORS_HEADERS, "X-Cache": "MISS" },
  });
});
