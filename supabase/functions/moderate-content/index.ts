// ============================================================
// Edge Function: moderate-content
//
// Endpoints (selected by POST body `action` field):
//
//   action: "report"   — authenticated user submits a content report
//   action: "action"   — admin/moderator actions a pending report
//   action: "list"     — admin/moderator lists reports (filterable)
//
// Spam pattern matching provides an initial auto-flag; the record
// is then queued for manual moderator review.
// ============================================================
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";

// --------------- Types ---------------

type TargetType = "pulse" | "story" | "user" | "venue";
type ReportReason =
  | "spam"
  | "inappropriate"
  | "harassment"
  | "misinformation"
  | "fake_location"
  | "other";
type ReportStatus = "pending" | "reviewed" | "actioned" | "dismissed";

interface ReportAction {
  action: "report";
  target_type: TargetType;
  target_id: string;
  reason: ReportReason;
  details?: string;
}

interface ActionReport {
  action: "action";
  report_id: string;
  status: ReportStatus;
  notes?: string;
}

interface ListReports {
  action: "list";
  status?: ReportStatus;
  target_type?: TargetType;
  limit?: number;
  offset?: number;
}

type RequestBody = ReportAction | ActionReport | ListReports;

interface ProfileRow {
  role: string;
}

// --------------- Constants ---------------

const VALID_TARGET_TYPES: TargetType[] = ["pulse", "story", "user", "venue"];
const VALID_REASONS: ReportReason[] = [
  "spam",
  "inappropriate",
  "harassment",
  "misinformation",
  "fake_location",
  "other",
];
const VALID_STATUSES: ReportStatus[] = [
  "pending",
  "reviewed",
  "actioned",
  "dismissed",
];

// Simple spam pattern list.  In production this would be loaded from
// a database table or remote config so it can be updated without a deploy.
const SPAM_PATTERNS: RegExp[] = [
  /\b(buy|sell|cheap|discount|deal|offer|promo)\b/i,
  /\b(click here|follow me|dm me|link in bio)\b/i,
  /https?:\/\/\S+/i, // any URL in a caption is worth flagging
  /(.)\1{6,}/, // six or more repeated chars (aaaaaaaaa)
];

function matchesSpamPattern(text: string): boolean {
  return SPAM_PATTERNS.some((re) => re.test(text));
}

// --------------- CORS ---------------

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

// --------------- Helpers ---------------

function getSupabaseUser(req: Request): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  return createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });
}

function getSupabaseAdmin(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

function isUUID(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    .test(value);
}

async function requireModerator(
  admin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single<ProfileRow>();
  return data?.role === "admin" || data?.role === "moderator";
}

// --------------- Handlers ---------------

async function handleReport(
  body: ReportAction,
  userId: string,
  admin: SupabaseClient,
): Promise<Response> {
  // Validate target_type
  if (!VALID_TARGET_TYPES.includes(body.target_type)) {
    return Response.json(
      {
        error: `target_type must be one of: ${VALID_TARGET_TYPES.join(", ")}`,
      },
      { status: 422, headers: CORS_HEADERS },
    );
  }

  // Validate reason
  if (!VALID_REASONS.includes(body.reason)) {
    return Response.json(
      { error: `reason must be one of: ${VALID_REASONS.join(", ")}` },
      { status: 422, headers: CORS_HEADERS },
    );
  }

  // Validate target_id
  if (!isUUID(body.target_id)) {
    return Response.json(
      { error: "target_id must be a valid UUID" },
      { status: 422, headers: CORS_HEADERS },
    );
  }

  // Validate details length
  if (body.details !== undefined && body.details.length > 1_000) {
    return Response.json(
      { error: "details must be at most 1000 characters" },
      { status: 422, headers: CORS_HEADERS },
    );
  }

  // Deduplicate: prevent the same user from filing the same report twice.
  const { count: existingCount } = await admin
    .from("content_reports")
    .select("id", { count: "exact", head: true })
    .eq("reporter_id", userId)
    .eq("target_type", body.target_type)
    .eq("target_id", body.target_id)
    .eq("reason", body.reason)
    .in("status", ["pending", "reviewed"]);

  if ((existingCount ?? 0) > 0) {
    return Response.json(
      { error: "You have already filed this report" },
      { status: 409, headers: CORS_HEADERS },
    );
  }

  // Auto-detect spam from the details field.
  const isAutoFlagged =
    body.details !== undefined && matchesSpamPattern(body.details);

  // If this is a spam report, also check the target content directly.
  let targetContent: string | null = null;
  if (body.target_type === "pulse") {
    const { data: pulseData } = await admin
      .from("pulses")
      .select("caption")
      .eq("id", body.target_id)
      .single<{ caption: string | null }>();
    targetContent = pulseData?.caption ?? null;
  } else if (body.target_type === "story") {
    const { data: storyData } = await admin
      .from("stories")
      .select("caption")
      .eq("id", body.target_id)
      .single<{ caption: string | null }>();
    targetContent = storyData?.caption ?? null;
  }

  const contentAutoFlagged =
    targetContent !== null && matchesSpamPattern(targetContent);
  const autoFlagged = isAutoFlagged || contentAutoFlagged;

  // Insert the report.
  const { data: report, error: insertErr } = await admin
    .from("content_reports")
    .insert({
      reporter_id: userId,
      target_type: body.target_type,
      target_id: body.target_id,
      reason: body.reason,
      details: body.details ?? null,
      // Auto-flagged reports start as 'reviewed' to surface them sooner.
      status: autoFlagged ? "reviewed" : "pending",
    })
    .select()
    .single();

  if (insertErr || !report) {
    console.error("Report insert error:", insertErr);
    return Response.json(
      { error: "Failed to submit report" },
      { status: 500, headers: CORS_HEADERS },
    );
  }

  return Response.json(
    {
      report,
      auto_flagged: autoFlagged,
      message: autoFlagged
        ? "Your report has been automatically flagged for priority review."
        : "Your report has been submitted and queued for review.",
    },
    { status: 201, headers: CORS_HEADERS },
  );
}

async function handleAction(
  body: ActionReport,
  userId: string,
  admin: SupabaseClient,
): Promise<Response> {
  // Only admins / moderators can action reports.
  const isMod = await requireModerator(admin, userId);
  if (!isMod) {
    return Response.json(
      { error: "Forbidden: requires admin or moderator role" },
      { status: 403, headers: CORS_HEADERS },
    );
  }

  if (!isUUID(body.report_id)) {
    return Response.json(
      { error: "report_id must be a valid UUID" },
      { status: 422, headers: CORS_HEADERS },
    );
  }

  if (!VALID_STATUSES.includes(body.status)) {
    return Response.json(
      { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 422, headers: CORS_HEADERS },
    );
  }

  // Fetch the report to ensure it exists.
  const { data: existingReport, error: fetchErr } = await admin
    .from("content_reports")
    .select("*")
    .eq("id", body.report_id)
    .single<{
      id: string;
      status: ReportStatus;
      target_type: TargetType;
      target_id: string;
    }>();

  if (fetchErr || !existingReport) {
    return Response.json(
      { error: "Report not found" },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  // Update the report.
  const { data: updated, error: updateErr } = await admin
    .from("content_reports")
    .update({
      status: body.status,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", body.report_id)
    .select()
    .single();

  if (updateErr || !updated) {
    console.error("Report update error:", updateErr);
    return Response.json(
      { error: "Failed to update report" },
      { status: 500, headers: CORS_HEADERS },
    );
  }

  // If actioned against a pulse or story, optionally cascade a soft-hide.
  // In production you might set a `hidden` flag on the target; here we log
  // the intent and leave the business logic to the calling application.
  if (body.status === "actioned") {
    console.log(
      `Report ${body.report_id} actioned by ${userId}. ` +
        `Target: ${existingReport.target_type}/${existingReport.target_id}`,
    );
    // TODO: send push notification to reporter that action was taken.
  }

  return Response.json(
    { report: updated },
    { status: 200, headers: CORS_HEADERS },
  );
}

async function handleList(
  body: ListReports,
  userId: string,
  admin: SupabaseClient,
): Promise<Response> {
  // Only admins / moderators can list reports.
  const isMod = await requireModerator(admin, userId);
  if (!isMod) {
    return Response.json(
      { error: "Forbidden: requires admin or moderator role" },
      { status: 403, headers: CORS_HEADERS },
    );
  }

  const limit = Math.min(body.limit ?? 50, 100);
  const offset = body.offset ?? 0;

  let query = admin
    .from("content_reports")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (body.status) {
    if (!VALID_STATUSES.includes(body.status)) {
      return Response.json(
        { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 422, headers: CORS_HEADERS },
      );
    }
    query = query.eq("status", body.status);
  }

  if (body.target_type) {
    if (!VALID_TARGET_TYPES.includes(body.target_type)) {
      return Response.json(
        {
          error: `target_type must be one of: ${VALID_TARGET_TYPES.join(", ")}`,
        },
        { status: 422, headers: CORS_HEADERS },
      );
    }
    query = query.eq("target_type", body.target_type);
  }

  const { data: reports, error: listErr, count } = await query;

  if (listErr) {
    console.error("List reports error:", listErr);
    return Response.json(
      { error: "Failed to retrieve reports" },
      { status: 500, headers: CORS_HEADERS },
    );
  }

  return Response.json(
    { reports, total: count, limit, offset },
    { status: 200, headers: CORS_HEADERS },
  );
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
  let body: RequestBody;
  try {
    body = await req.json() as RequestBody;
  } catch {
    return Response.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  if (!body.action) {
    return Response.json(
      { error: "body.action is required (report | action | list)" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const admin = getSupabaseAdmin();

  switch (body.action) {
    case "report":
      return handleReport(body as ReportAction, user.id, admin);
    case "action":
      return handleAction(body as ActionReport, user.id, admin);
    case "list":
      return handleList(body as ListReports, user.id, admin);
    default:
      return Response.json(
        { error: "Unknown action. Must be: report | action | list" },
        { status: 400, headers: CORS_HEADERS },
      );
  }
});
