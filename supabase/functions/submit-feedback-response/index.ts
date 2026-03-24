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
  return (await response.json()) as T;
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

  return (await response.json()) as T;
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

async function enforceRateLimit(code: string, ipFingerprint: string) {
  const perCodeWindow = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const perIpWindow = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const [recentForCode, recentForIp] = await Promise.all([
    postgrest<Array<{ id: string }>>(
      `feedback_submission_attempts?select=id&ip_fingerprint=eq.${ipFingerprint}&link_code=eq.${encodeURIComponent(code)}&attempted_at=gte.${encodeURIComponent(perCodeWindow)}&limit=6`,
      { method: "GET" },
    ),
    postgrest<Array<{ id: string }>>(
      `feedback_submission_attempts?select=id&ip_fingerprint=eq.${ipFingerprint}&attempted_at=gte.${encodeURIComponent(perIpWindow)}&limit=21`,
      { method: "GET" },
    ),
  ]);

  if (recentForCode.length >= 5 || recentForIp.length >= 20) {
    return false;
  }

  return true;
}

async function recordSubmissionAttempt(code: string, ipFingerprint: string) {
  await postgrest(
    "feedback_submission_attempts",
    {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        link_code: code,
        ip_fingerprint: ipFingerprint,
      }),
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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const body = (await request.json()) as SubmitFeedbackRequest;
    const code = String(body?.code || "").trim();
    const payload =
      body?.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
        ? body.payload
        : null;

    if (!code || !payload) {
      return jsonResponse(400, { error: "A feedback code and payload are required." });
    }

    const clientFingerprint = await sha256Hex(getClientIp(request));
    const withinLimit = await enforceRateLimit(code, clientFingerprint);
    if (!withinLimit) {
      return jsonResponse(429, {
        error: "Too many submissions from this connection. Please wait before trying again.",
      });
    }

    await recordSubmissionAttempt(code, clientFingerprint);

    const responseId = await postRpc<string>("submit_feedback_response", {
      p_code: code,
      p_payload: payload,
    });

    await sendAdminNotifications(code, String(responseId));

    return jsonResponse(200, {
      responseId,
      message: "Feedback submitted successfully.",
    });
  } catch (error) {
    console.error("submit-feedback-response function error:", error);
    return jsonResponse(500, {
      error: "Failed to submit feedback.",
    });
  }
});
