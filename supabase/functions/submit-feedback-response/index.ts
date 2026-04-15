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
  code?: string | null;
  clientSessionId?: string | null;
  submissionToken?: string | null;
  payload?: Record<string, unknown> | null;
  statusOnly?: boolean;
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

interface ExistingSubmissionRow {
  id: string;
  submission_payload_hash: string | null;
}

interface SubmissionAttemptRow {
  attempt_status: "received" | "submitted" | "failed" | "rate_limited";
  response_id: string | null;
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

function getSafeErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim().slice(0, 500);
  }
  if (typeof error === "string" && error.trim()) {
    return error.trim().slice(0, 500);
  }
  return fallback;
}

function normalizeForStableJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeForStableJson(entry));
  }

  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort((left, right) => left.localeCompare(right))
      .reduce<Record<string, unknown>>((accumulator, key) => {
        const normalizedValue = normalizeForStableJson(
          (value as Record<string, unknown>)[key],
        );

        if (normalizedValue !== undefined) {
          accumulator[key] = normalizedValue;
        }

        return accumulator;
      }, {});
  }

  return value;
}

function stableStringify(value: unknown) {
  return JSON.stringify(normalizeForStableJson(value));
}

function classifySubmissionError(error: unknown) {
  const rawMessage = getSafeErrorMessage(error, "Failed to submit feedback.");

  if (rawMessage.includes("Submission token payload mismatch")) {
    return {
      statusCode: 409,
      message:
        "Your responses changed during a previous submission attempt. Please submit the form again.",
    };
  }

  if (rawMessage.includes("Invalid feedback link")) {
    return {
      statusCode: 404,
      message: "This feedback link is not valid.",
    };
  }

  if (rawMessage.includes("Feedback link is inactive")) {
    return {
      statusCode: 410,
      message: "This feedback form is no longer accepting responses.",
    };
  }

  if (rawMessage.includes("Campaign has not started")) {
    return {
      statusCode: 409,
      message: "This feedback campaign has not started yet.",
    };
  }

  if (rawMessage.includes("Campaign has ended")) {
    return {
      statusCode: 410,
      message: "This feedback campaign has ended.",
    };
  }

  return {
    statusCode: 500,
    message: "Failed to submit feedback.",
  };
}

async function recordSystemHealthEvent(params: {
  area: string;
  eventType: string;
  severity?: "info" | "warning" | "error" | "critical";
  message: string;
  fingerprint: string;
  statusCode?: number | null;
  companyId?: string | null;
  campaignId?: string | null;
  linkId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await postgrest("system_health_events", {
    method: "POST",
    headers: {
      Prefer: "return=minimal",
    },
    body: JSON.stringify([
      {
        source: "edge_function",
        area: params.area,
        severity: params.severity || "error",
        event_type: params.eventType,
        message: params.message.slice(0, 500),
        fingerprint: params.fingerprint.slice(0, 240),
        status_code: params.statusCode || null,
        company_id: params.companyId || null,
        campaign_id: params.campaignId || null,
        link_id: params.linkId || null,
        metadata: params.metadata || {},
      },
    ]),
  });
}

function scheduleSystemHealthEvent(params: Parameters<typeof recordSystemHealthEvent>[0]) {
  const task = recordSystemHealthEvent(params).catch((error) => {
    console.error("submit-feedback-response system health logging failed:", error);
  });

  if (typeof EdgeRuntime !== "undefined" && typeof EdgeRuntime.waitUntil === "function") {
    EdgeRuntime.waitUntil(task);
    return;
  }

  void task;
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

    // When we have a browser fingerprint, avoid using shared office IPs as a
    // duplicate-submission cooldown key. This keeps separate respondents on the
    // same network from blocking one another.
    return false;
  }

  const recentIpSubmission = await postgrest<Array<{ id: string }>>(
    `feedback_submission_attempts?select=id&ip_fingerprint=eq.${ipFingerprint}&link_code=eq.${encodeURIComponent(code)}&attempt_status=eq.submitted&attempted_at=gte.${encodeURIComponent(cooldownWindow)}&limit=1`,
    { method: "GET" },
  );

  return recentIpSubmission.length > 0;
}

async function findExistingSubmissionByToken(submissionToken: string) {
  const rows = await postgrest<ExistingSubmissionRow[]>(
    `feedback_responses?select=id,submission_payload_hash&submission_token=eq.${encodeURIComponent(submissionToken)}&limit=1`,
    { method: "GET" },
  );

  return rows[0] || null;
}

async function getSubmissionStatus(submissionToken: string) {
  const existingSubmission = await findExistingSubmissionByToken(submissionToken);
  if (existingSubmission) {
    return {
      status: "submitted" as const,
      responseId: existingSubmission.id,
      deduplicated: true,
    };
  }

  const attempts = await postgrest<SubmissionAttemptRow[]>(
    `feedback_submission_attempts?select=attempt_status,response_id&submission_token=eq.${encodeURIComponent(submissionToken)}&order=attempted_at.desc&limit=1`,
    { method: "GET" },
  );

  const latestAttempt = attempts[0];
  if (!latestAttempt) {
    return {
      status: "not_found" as const,
      responseId: null,
      deduplicated: false,
    };
  }

  if (latestAttempt.attempt_status === "submitted" && latestAttempt.response_id) {
    return {
      status: "submitted" as const,
      responseId: latestAttempt.response_id,
      deduplicated: true,
    };
  }

  if (latestAttempt.attempt_status === "received") {
    return {
      status: "processing" as const,
      responseId: null,
      deduplicated: false,
    };
  }

  return {
    status: latestAttempt.attempt_status,
    responseId: latestAttempt.response_id,
    deduplicated: false,
  };
}

async function recordSubmissionAttempt(
  code: string,
  ipFingerprint: string,
  clientFingerprint: string | null,
  submissionToken: string | null,
  payloadHash: string | null,
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
        submission_token: submissionToken,
        payload_hash: payloadHash,
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
      scheduleSystemHealthEvent({
        area: "admin_notification",
        eventType: "admin_notification_email_failed",
        severity: "error",
        message: getSafeErrorMessage(error, "Admin notification email failed"),
        fingerprint: `admin_notification_email_failed:${profile.user_id}:${responseId}`,
        companyId: link.company_id,
        campaignId: link.campaign_id,
        metadata: {
          responseId,
          recipientUserId: profile.user_id,
        },
      });
    }
  }

  await finalizeEmailEvent(responseId, sent, failed);
  return { sent, failed, skipped };
}

function scheduleAdminNotifications(code: string, responseId: string) {
  const task = sendAdminNotifications(code, responseId).catch((error) => {
    console.error("submit-feedback-response post-submit notification error:", error);
    scheduleSystemHealthEvent({
      area: "admin_notification",
      eventType: "admin_notification_dispatch_failed",
      severity: "error",
      message: getSafeErrorMessage(error, "Admin notification dispatch failed"),
      fingerprint: `admin_notification_dispatch_failed:${code}:${responseId}`,
      metadata: {
        code,
        responseId,
      },
    });
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
  let submissionToken: string | null = null;

  try {
    const body = (await request.json()) as SubmitFeedbackRequest;
    const code = String(body?.code || "").trim();
    const clientSessionId =
      typeof body?.clientSessionId === "string" ? body.clientSessionId.trim() : "";
    const requestedSubmissionToken =
      typeof body?.submissionToken === "string" ? body.submissionToken.trim() : "";
    const statusOnly = body?.statusOnly === true;
    const payload =
      body?.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
        ? body.payload
        : null;

    if (statusOnly) {
      if (!requestedSubmissionToken) {
        return jsonResponse(400, { error: "A submission token is required." });
      }

      return jsonResponse(200, await getSubmissionStatus(requestedSubmissionToken));
    }

    if (!code || !payload) {
      return jsonResponse(400, { error: "A feedback code and payload are required." });
    }

    const ipFingerprint = await sha256Hex(getClientIp(request));
    const sessionFingerprint = clientSessionId
      ? await sha256Hex(`session:${clientSessionId}`)
      : null;
    const payloadHash = await sha256Hex(stableStringify(payload));
    submissionToken =
      requestedSubmissionToken ||
      (clientSessionId
        ? await sha256Hex(`legacy:${code}:${clientSessionId}:${payloadHash}`)
        : crypto.randomUUID());

    const existingSubmission = await findExistingSubmissionByToken(submissionToken);
    if (existingSubmission) {
      if (
        existingSubmission.submission_payload_hash &&
        existingSubmission.submission_payload_hash !== payloadHash
      ) {
        return jsonResponse(409, {
          error:
            "Your responses changed during a previous submission attempt. Please submit the form again.",
        });
      }

      return jsonResponse(200, {
        responseId: existingSubmission.id,
        deduplicated: true,
        message: "Feedback submitted successfully.",
      });
    }

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
        submissionToken,
        payloadHash,
        "rate_limited",
      );
      scheduleSystemHealthEvent({
        area: "feedback_submission",
        eventType: "feedback_submission_cooldown_blocked",
        severity: "warning",
        message: SUBMISSION_COOLDOWN_ERROR,
        fingerprint: `feedback_submission_cooldown_blocked:${code}:${ipFingerprint}:${sessionFingerprint || "none"}`,
        metadata: {
          code,
          hasClientSession: !!sessionFingerprint,
        },
      });
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
        submissionToken,
        payloadHash,
        "rate_limited",
      );
      scheduleSystemHealthEvent({
        area: "feedback_submission",
        eventType: "feedback_submission_rate_limit_blocked",
        severity: "warning",
        message:
          "Too many recent submission attempts from this browser or network.",
        fingerprint: `feedback_submission_rate_limit_blocked:${code}:${ipFingerprint}:${sessionFingerprint || "none"}`,
        metadata: {
          code,
          hasClientSession: !!sessionFingerprint,
        },
      });
      return jsonResponse(429, {
        error:
          "Too many recent submission attempts from this browser or network. Please wait a few minutes and try again.",
      });
    }

    attemptId = await recordSubmissionAttempt(
      code,
      ipFingerprint,
      sessionFingerprint,
      submissionToken,
      payloadHash,
      "received",
    );

    const responseId = await postRpc<string>("submit_feedback_response", {
      p_code: code,
      p_payload: payload,
      p_submission_token: submissionToken,
      p_submission_payload_hash: payloadHash,
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
    const classifiedError = classifySubmissionError(error);
    await updateSubmissionAttempt(attemptId, {
      attempt_status: "failed",
    }).catch((attemptError) => {
      console.error("submit-feedback-response attempt update failed:", attemptError);
    });
    console.error("submit-feedback-response function error:", error);
    scheduleSystemHealthEvent({
      area: "feedback_submission",
      eventType: "submit_feedback_response_failed",
      severity: "error",
      message: getSafeErrorMessage(error, "Failed to submit feedback"),
      fingerprint: `submit_feedback_response_failed:${attemptId || "no_attempt"}`,
      statusCode: classifiedError.statusCode,
      metadata: {
        attemptId,
        submissionToken,
      },
    });
    return jsonResponse(classifiedError.statusCode, {
      error: classifiedError.message,
    });
  }
});
