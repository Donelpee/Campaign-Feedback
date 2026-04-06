const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

declare const Deno: {
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
  env: {
    get: (name: string) => string | undefined;
  };
};

interface SubmitFeedbackRequest {
  code: string;
  clientSessionId?: string | null;
  payload: Record<string, unknown>;
}

interface LinkRow {
  campaign_id: string | null;
  company_id: string | null;
  tenant_id: string | null;
  campaign: { name: string } | null;
  company: { name: string } | null;
}

interface RoleRow {
  user_id: string;
  role: "admin" | "super_admin";
}

interface ProfileRow {
  user_id: string;
  email: string;
  full_name: string | null;
  tenant_id: string | null;
}

interface UserSettingsRow {
  user_id: string;
  email_notifications: boolean;
}

declare const EdgeRuntime:
  | {
      waitUntil: (promise: Promise<unknown>) => void;
    }
  | undefined;

const SUBMISSION_COOLDOWN_MINUTES = 5;
const SUBMISSION_COOLDOWN_ERROR = "Please try again after 5 minutes";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getServiceHeaders(extraHeaders?: HeadersInit): HeadersInit {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) {
    throw new Error("Missing Supabase service credentials.");
  }

  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
    ...(extraHeaders || {}),
  };
}

async function serviceFetch(path: string, options: RequestInit) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) {
    throw new Error("Missing Supabase URL.");
  }

  return fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: getServiceHeaders(options.headers),
  });
}

async function postgrest<T>(path: string, options: RequestInit): Promise<T> {
  const response = await serviceFetch(path, options);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PostgREST error (${response.status}): ${text}`);
  }

  if (response.status === 204) return [] as unknown as T;

  const text = await response.text();
  if (!text.trim()) return [] as unknown as T;

  return JSON.parse(text) as T;
}

async function postRpc<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) {
    throw new Error("Missing Supabase URL.");
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: getServiceHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`RPC error (${response.status}): ${text}`);
  }

  const text = await response.text();
  if (!text.trim()) return "" as T;
  return JSON.parse(text) as T;
}

async function sendWithResend(params: {
  to: string;
  subject: string;
  html: string;
}) {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail =
    Deno.env.get("FEEDBACK_ALERT_FROM_EMAIL") ||
    Deno.env.get("CAMPAIGN_FROM_EMAIL") ||
    "no-reply@clientpulselens.com";
  if (!resendApiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [params.to],
      subject: params.subject,
      html: params.html,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Resend error (${response.status}): ${text}`);
  }
}

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function enforceRateLimitWithClient(
  code: string,
  ipFingerprint: string,
  clientFingerprint: string | null,
) {
  const shortWindow = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const hourWindow = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const queries: Array<Promise<Array<{ id: string }>>> = [
    postgrest<Array<{ id: string }>>(
      `feedback_submission_attempts?select=id&ip_fingerprint=eq.${ipFingerprint}&link_code=eq.${encodeURIComponent(code)}&attempted_at=gte.${encodeURIComponent(shortWindow)}&limit=1001`,
      { method: "GET" },
    ),
    postgrest<Array<{ id: string }>>(
      `feedback_submission_attempts?select=id&ip_fingerprint=eq.${ipFingerprint}&attempted_at=gte.${encodeURIComponent(hourWindow)}&limit=2501`,
      { method: "GET" },
    ),
  ];

  if (clientFingerprint) {
    queries.push(
      postgrest<Array<{ id: string }>>(
        `feedback_submission_attempts?select=id&client_fingerprint=eq.${clientFingerprint}&link_code=eq.${encodeURIComponent(code)}&attempted_at=gte.${encodeURIComponent(shortWindow)}&limit=7`,
        { method: "GET" },
      ),
      postgrest<Array<{ id: string }>>(
        `feedback_submission_attempts?select=id&client_fingerprint=eq.${clientFingerprint}&attempted_at=gte.${encodeURIComponent(hourWindow)}&limit=13`,
        { method: "GET" },
      ),
    );
  }

  const [recentIpForCode, recentIpOverall, recentClientForCode, recentClientOverall] =
    await Promise.all(queries);

  if (recentIpForCode.length >= 1000 || recentIpOverall.length >= 2500) {
    return false;
  }

  if (
    clientFingerprint &&
    ((recentClientForCode?.length || 0) >= 6 || (recentClientOverall?.length || 0) >= 12)
  ) {
    return false;
  }

  return true;
}

async function hasRecentSuccessfulSubmission(
  code: string,
  ipFingerprint: string,
  clientFingerprint: string | null,
) {
  const cooldownWindow = new Date(
    Date.now() - SUBMISSION_COOLDOWN_MINUTES * 60 * 1000,
  ).toISOString();

  if (clientFingerprint) {
    const recentClientSubmission = await postgrest<Array<{ id: string }>>(
      `feedback_submission_attempts?select=id&client_fingerprint=eq.${clientFingerprint}&link_code=eq.${encodeURIComponent(code)}&attempt_status=eq.submitted&attempted_at=gte.${encodeURIComponent(cooldownWindow)}&limit=1`,
      { method: "GET" },
    );

    if (recentClientSubmission.length > 0) {
      return true;
    }
  }

  const recentIpSubmission = await postgrest<Array<{ id: string }>>(
    `feedback_submission_attempts?select=id&ip_fingerprint=eq.${ipFingerprint}&link_code=eq.${encodeURIComponent(code)}&attempt_status=eq.submitted&attempted_at=gte.${encodeURIComponent(cooldownWindow)}&limit=1`,
    { method: "GET" },
  );

  return recentIpSubmission.length > 0;
}

async function recordSubmissionAttempt(
  code: string,
  ipFingerprint: string,
  clientFingerprint: string | null,
  attemptStatus: "received" | "submitted" | "failed" | "rate_limited" = "received",
) {
  const rows = await postgrest<Array<{ id: string }>>(
    "feedback_submission_attempts",
    {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        link_code: code,
        ip_fingerprint: ipFingerprint,
        client_fingerprint: clientFingerprint,
        attempt_status: attemptStatus,
      }),
    },
  );

  return rows[0]?.id || null;
}

async function updateSubmissionAttempt(
  attemptId: string | null,
  updates: {
    attempt_status?: "submitted" | "failed" | "rate_limited";
    response_id?: string;
  },
) {
  if (!attemptId) return;

  await postgrest(
    `feedback_submission_attempts?id=eq.${attemptId}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(updates),
    },
  );
}

async function getLinkByCode(code: string) {
  const links = await postgrest<LinkRow[]>(
    `company_campaign_links?unique_code=eq.${encodeURIComponent(code)}&select=campaign_id,company_id,tenant_id,campaign:campaign_id(name),company:company_id(name)&limit=1`,
    { method: "GET" },
  );
  return links[0] || null;
}

async function tryCreateEmailEvent(responseId: string, code: string, tenantId: string | null) {
  const response = await serviceFetch("feedback_response_email_events", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      response_id: responseId,
      link_code: code,
      tenant_id: tenantId,
    }),
  });

  if (response.ok) return true;
  if (response.status === 409) return false;

  const text = await response.text();
  throw new Error(`Failed to create email event (${response.status}): ${text}`);
}

async function finalizeEmailEvent(responseId: string, sentCount: number, failedCount: number) {
  await postgrest(
    `feedback_response_email_events?response_id=eq.${responseId}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        processed_at: new Date().toISOString(),
        sent_count: sentCount,
        failed_count: failedCount,
      }),
    },
  );
}

async function sendAdminNotifications(code: string, responseId: string) {
  const link = await getLinkByCode(code);
  if (!link) return { sent: 0, failed: 0, skipped: 0 };

  const shouldSend = await tryCreateEmailEvent(responseId, code, link.tenant_id);
  if (!shouldSend) {
    return { sent: 0, failed: 0, skipped: 0 };
  }

  const roles = await postgrest<RoleRow[]>(
    "user_roles?select=user_id,role&role=in.(admin,super_admin)",
    { method: "GET" },
  );

  const adminIds = Array.from(new Set(roles.map((row) => row.user_id)));
  if (adminIds.length === 0) {
    await finalizeEmailEvent(responseId, 0, 0);
    return { sent: 0, failed: 0, skipped: 0 };
  }

  const [profiles, settingsRows] = await Promise.all([
    postgrest<ProfileRow[]>(
      `profiles?select=user_id,email,full_name,tenant_id&user_id=in.(${adminIds.join(",")})`,
      { method: "GET" },
    ),
    postgrest<UserSettingsRow[]>(
      `user_settings?select=user_id,email_notifications&user_id=in.(${adminIds.join(",")})`,
      { method: "GET" },
    ),
  ]);

  const settingsByUser = new Map(
    settingsRows.map((entry) => [entry.user_id, entry.email_notifications]),
  );
  const rolesByUser = new Map<string, Set<string>>();

  for (const role of roles) {
    const existing = rolesByUser.get(role.user_id) || new Set<string>();
    existing.add(role.role);
    rolesByUser.set(role.user_id, existing);
  }

  const campaignName = link.campaign?.name || "Campaign";
  const companyName = link.company?.name || "Company";

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const profile of profiles) {
    const roleSet = rolesByUser.get(profile.user_id) || new Set<string>();
    const isSuperAdmin = roleSet.has("super_admin");
    const isTenantAdmin = !!link.tenant_id && profile.tenant_id === link.tenant_id;

    if (!isSuperAdmin && !isTenantAdmin) {
      skipped += 1;
      continue;
    }

    if (!profile.email || settingsByUser.get(profile.user_id) === false) {
      skipped += 1;
      continue;
    }

    try {
      await sendWithResend({
        to: profile.email,
        subject: `New feedback response: ${campaignName}`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.5;">
            <h2>New feedback response received</h2>
            <p><strong>Campaign:</strong> ${campaignName}</p>
            <p><strong>Company:</strong> ${companyName}</p>
            <p>A respondent just submitted a new feedback form entry.</p>
          </div>
        `,
      });
      sent += 1;
    } catch (error) {
      failed += 1;
      console.error("submit-feedback-response email notification failed:", error);
    }
  }

  await finalizeEmailEvent(responseId, sent, failed);
  return { sent, failed, skipped };
}

function scheduleAdminNotifications(code: string, responseId: string) {
  const task = sendAdminNotifications(code, responseId).catch((error) => {
    console.error("submit-feedback-response post-submit notification error:", error);
  });

  if (typeof EdgeRuntime !== "undefined" && typeof EdgeRuntime.waitUntil === "function") {
    EdgeRuntime.waitUntil(task);
    return;
  }

  void task;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  let attemptId: string | null = null;

  try {
    const body = (await request.json()) as SubmitFeedbackRequest;
    const code = String(body?.code || "").trim();
    const clientSessionId =
      typeof body?.clientSessionId === "string" ? body.clientSessionId.trim() : "";
    const payload =
      body?.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
        ? body.payload
        : null;

    if (!code || !payload) {
      return jsonResponse(400, { error: "A feedback code and payload are required." });
    }

    const ipFingerprint = await sha256Hex(getClientIp(request));
    const sessionFingerprint = clientSessionId
      ? await sha256Hex(`session:${clientSessionId}`)
      : null;
    const isWithinCooldown = await hasRecentSuccessfulSubmission(
      code,
      ipFingerprint,
      sessionFingerprint,
    );
    if (isWithinCooldown) {
      await recordSubmissionAttempt(
        code,
        ipFingerprint,
        sessionFingerprint,
        "rate_limited",
      );
      return jsonResponse(429, { error: SUBMISSION_COOLDOWN_ERROR });
    }

    const withinLimit = await enforceRateLimitWithClient(
      code,
      ipFingerprint,
      sessionFingerprint,
    );
    if (!withinLimit) {
      await recordSubmissionAttempt(
        code,
        ipFingerprint,
        sessionFingerprint,
        "rate_limited",
      );
      return jsonResponse(429, {
        error:
          "Too many recent submission attempts from this browser or network. Please wait a few minutes and try again.",
      });
    }

    attemptId = await recordSubmissionAttempt(
      code,
      ipFingerprint,
      sessionFingerprint,
      "received",
    );

    const responseId = await postRpc<string>("submit_feedback_response", {
      p_code: code,
      p_payload: payload,
    });

    await updateSubmissionAttempt(attemptId, {
      attempt_status: "submitted",
      response_id: String(responseId),
    });

    scheduleAdminNotifications(code, String(responseId));

    return jsonResponse(200, {
      responseId,
      message: "Feedback submitted successfully.",
    });
  } catch (error) {
    await updateSubmissionAttempt(attemptId, {
      attempt_status: "failed",
    }).catch((attemptError) => {
      console.error("submit-feedback-response attempt update failed:", attemptError);
    });
    console.error("submit-feedback-response function error:", error);
    return jsonResponse(500, {
      error:
        error instanceof Error && error.message.trim()
          ? error.message
          : "Failed to submit feedback.",
    });
  }
});
