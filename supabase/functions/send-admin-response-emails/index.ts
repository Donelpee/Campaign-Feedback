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

interface SendEmailRequest {
  code: string;
}

interface LinkRow {
  campaign_id: string | null;
  company_id: string | null;
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

async function postgrest<T>(path: string, options: RequestInit): Promise<T> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing Supabase service credentials.");
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PostgREST error (${response.status}): ${text}`);
  }

  if (response.status === 204) return [] as unknown as T;
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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const body = (await request.json()) as SendEmailRequest;
    const code = String(body?.code || "").trim();
    if (!code) {
      return jsonResponse(400, { error: "Feedback link code is required." });
    }

    const links = await postgrest<LinkRow[]>(
      `company_campaign_links?unique_code=eq.${encodeURIComponent(code)}&select=campaign_id,company_id,campaign:campaign_id(name),company:company_id(name)&limit=1`,
      { method: "GET" },
    );
    const link = links[0];
    if (!link) {
      return jsonResponse(404, { error: "Feedback link not found." });
    }

    const roles = await postgrest<RoleRow[]>(
      "user_roles?select=user_id,role&role=in.(admin,super_admin)",
      { method: "GET" },
    );
    const adminIds = Array.from(new Set(roles.map((row) => row.user_id)));
    if (adminIds.length === 0) {
      return jsonResponse(200, { sent: 0, skipped: 0, failed: 0 });
    }

    const [profiles, settingsRows] = await Promise.all([
      postgrest<ProfileRow[]>(
        `profiles?select=user_id,email,full_name&user_id=in.(${adminIds.join(",")})`,
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

    const campaignName = link.campaign?.name || "Campaign";
    const companyName = link.company?.name || "Company";

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const profile of profiles) {
      const wantsEmail = settingsByUser.get(profile.user_id);
      if (wantsEmail === false) {
        skipped += 1;
        continue;
      }

      try {
        const subject = `New feedback response: ${campaignName}`;
        const html = `
          <div style="font-family: Arial, sans-serif; line-height: 1.5;">
            <h2>New feedback response received</h2>
            <p><strong>Campaign:</strong> ${campaignName}</p>
            <p><strong>Company:</strong> ${companyName}</p>
            <p>A respondent just submitted a new feedback form entry.</p>
          </div>
        `;
        await sendWithResend({
          to: profile.email,
          subject,
          html,
        });
        sent += 1;
      } catch (error) {
        failed += 1;
        console.error(
          "send-admin-response-emails recipient failed:",
          profile.email,
          error,
        );
      }
    }

    return jsonResponse(200, {
      sent,
      failed,
      skipped,
      campaign_name: campaignName,
      company_name: companyName,
    });
  } catch (error) {
    console.error("send-admin-response-emails function error:", error);
    return jsonResponse(500, {
      error: "Failed to send admin response notification emails.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});
