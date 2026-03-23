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

interface InvitePayload {
  email: string;
  role: string;
  permissions?: string[];
  companyIds?: string[];
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

async function fetchCallerId(request: Request): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    throw new Error("Missing Supabase anon credentials.");
  }

  const authHeader = request.headers.get("Authorization");
  if (!authHeader) throw new Error("Missing auth token.");

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: "GET",
    headers: {
      Authorization: authHeader,
      apikey: anonKey,
    },
  });
  if (!response.ok) throw new Error("Invalid caller token.");

  const user = (await response.json()) as { id?: string };
  if (!user?.id) throw new Error("Unable to resolve caller.");
  return user.id;
}

async function getCallerPrivileges(callerId: string) {
  const roles = await postgrest<Array<{ role: string }>>(
    `user_roles?user_id=eq.${callerId}&select=role`,
    { method: "GET" },
  );
  const isAdmin = roles.some(
    (row) => row.role === "admin" || row.role === "super_admin",
  );
  const isSuperAdmin = roles.some((row) => row.role === "super_admin");
  const permissions = await postgrest<Array<{ module_key: string }>>(
    `user_module_permissions?user_id=eq.${callerId}&select=module_key&module_key=eq.users`,
    { method: "GET" },
  );
  const canManageUsers = isSuperAdmin || (isAdmin && permissions.length > 0);
  if (!canManageUsers) {
    throw new Error("Only admins can create or manage users.");
  }
  return { isSuperAdmin };
}

async function getCallerTenantId(callerId: string): Promise<string> {
  const rows = await postgrest<Array<{ tenant_id: string | null }>>(
    `profiles?user_id=eq.${callerId}&select=tenant_id&limit=1`,
    { method: "GET" },
  );
  const tenantId = rows[0]?.tenant_id;
  if (!tenantId) {
    throw new Error("Caller does not have a tenant assigned.");
  }
  return tenantId;
}

async function validateCompanyIdsForTenant(
  companyIds: string[],
  tenantId: string,
): Promise<void> {
  if (companyIds.length === 0) return;
  const encoded = companyIds.join(",");
  const rows = await postgrest<Array<{ id: string }>>(
    `companies?id=in.(${encoded})&tenant_id=eq.${tenantId}&select=id`,
    { method: "GET" },
  );
  if (rows.length !== companyIds.length) {
    throw new Error("One or more selected companies are outside your tenant.");
  }
}

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sendOnboardingEmail(params: { to: string; link: string }) {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail =
    Deno.env.get("ONBOARDING_FROM_EMAIL") ||
    Deno.env.get("CAMPAIGN_FROM_EMAIL") ||
    "no-reply@clientpulselens.com";
  if (!resendApiKey) throw new Error("RESEND_API_KEY is not configured.");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [params.to],
      subject: "Your onboarding link",
      html: `
        <div style="font-family: Arial, sans-serif; line-height:1.5;">
          <h2>Complete your onboarding</h2>
          <p>Your onboarding link can be used once and expires in 3 days.</p>
          <p><a href="${params.link}" target="_blank">Complete onboarding</a></p>
        </div>
      `,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Resend error (${response.status}): ${text}`);
  }
}

function escapePostgrestValue(value: string): string {
  return encodeURIComponent(value.replace(/,/g, "\\,"));
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  try {
    const callerId = await fetchCallerId(request);
    const privileges = await getCallerPrivileges(callerId);
    const callerTenantId = await getCallerTenantId(callerId);
    const payload = (await request.json()) as InvitePayload;

    const email = String(payload?.email || "").trim().toLowerCase();
    const role = String(payload?.role || "").trim().toLowerCase() || "admin";
    const moduleKeys = Array.isArray(payload?.permissions)
      ? payload.permissions.filter((key) => typeof key === "string" && key.length > 0)
      : [];
    const companyIds = Array.isArray(payload?.companyIds)
      ? payload.companyIds.filter((id) => typeof id === "string" && id.length > 0)
      : [];
    await validateCompanyIdsForTenant(companyIds, callerTenantId);
    if (!email) return jsonResponse(400, { error: "Email is required." });
    if (role === "super_admin" && !privileges.isSuperAdmin) {
      return jsonResponse(403, { error: "Only Super Admin can assign Super Admin role." });
    }

    const existingProfiles = await postgrest<Array<{ user_id: string }>>(
      `profiles?email=eq.${escapePostgrestValue(email)}&select=user_id&limit=1`,
      { method: "GET" },
    );

    if (existingProfiles.length > 0) {
      const userId = existingProfiles[0].user_id;
      await postgrest(
        `profiles?user_id=eq.${userId}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ tenant_id: callerTenantId }),
        },
      );
      await postgrest(
        `user_roles?user_id=eq.${userId}`,
        { method: "DELETE", headers: { Prefer: "return=minimal" } },
      );
      await postgrest(
        "user_roles",
        {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify([{ user_id: userId, role }]),
        },
      );
      await postgrest(
        `user_module_permissions?user_id=eq.${userId}`,
        { method: "DELETE", headers: { Prefer: "return=minimal" } },
      );
      await postgrest(
        `user_company_permissions?user_id=eq.${userId}`,
        { method: "DELETE", headers: { Prefer: "return=minimal" } },
      );
      if (role !== "super_admin" && moduleKeys.length > 0) {
        await postgrest(
          "user_module_permissions",
          {
            method: "POST",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify(
              moduleKeys.map((moduleKey) => ({ user_id: userId, module_key: moduleKey })),
            ),
          },
        );
      }
      if (role !== "super_admin" && companyIds.length > 0) {
        await postgrest(
          "user_company_permissions",
          {
            method: "POST",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify(
              companyIds.map((company_id) => ({ user_id: userId, company_id })),
            ),
          },
        );
      }
      return jsonResponse(200, { message: "Existing user access updated.", user_id: userId });
    }

    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const tokenHash = await hashToken(token);
    const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

    await postgrest(
      "onboarding_invites",
      {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify([
          {
            invite_email: email,
            token_hash: tokenHash,
            role_key: role,
            module_keys: moduleKeys,
            company_ids: companyIds,
            tenant_id: callerTenantId,
            expires_at: expiresAt,
            created_by: callerId,
          },
        ]),
      },
    );

    const appBaseUrl = Deno.env.get("APP_BASE_URL") || Deno.env.get("SITE_URL") || "http://localhost:8080";
    const onboardingLink = `${appBaseUrl.replace(/\/$/, "")}/auth?onboarding_token=${encodeURIComponent(token)}`;
    await sendOnboardingEmail({ to: email, link: onboardingLink });

    return jsonResponse(200, {
      message: "Onboarding email sent.",
      expires_at: expiresAt,
    });
  } catch (error) {
    console.error("invite-admin-user error:", error);
    return jsonResponse(500, {
      error: "Failed to send onboarding invite.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});
