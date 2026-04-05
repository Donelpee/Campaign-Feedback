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

interface ConsumePayload {
  token: string;
  username?: string;
  fullName?: string;
  accountType?: string;
  respondentNamePreference?: string;
  organizationName?: string;
  password: string;
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
  if (!supabaseUrl || !serviceKey) throw new Error("Missing service credentials.");

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

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function createAuthUser(params: {
  email: string;
  username: string;
  fullName: string;
  accountType: string;
  respondentNamePreference: string;
  organizationName: string | null;
  password: string;
}): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) throw new Error("Missing service credentials.");

  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: params.email,
      password: params.password,
      email_confirm: true,
      user_metadata: {
        full_name: params.fullName,
        username: params.username,
        account_type: params.accountType,
        respondent_name_preference: params.respondentNamePreference,
        organization_name: params.organizationName,
      },
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Create user failed (${response.status}): ${text}`);
  }
  const body = (await response.json()) as { user?: { id?: string } };
  const userId = body?.user?.id;
  if (!userId) throw new Error("Created user but id was not returned.");
  return userId;
}

function escapePostgrestValue(value: string): string {
  return encodeURIComponent(value.replace(/,/g, "\\,"));
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  try {
    const payload = (await request.json()) as ConsumePayload;
    const token = String(payload?.token || "").trim();
    const password = String(payload?.password || "");
    if (!token) return jsonResponse(400, { error: "Token is required." });
    if (password.length < 6) return jsonResponse(400, { error: "Password must be at least 6 characters." });

    const tokenHash = await hashToken(token);
    const invites = await postgrest<Array<{
      id: string;
      invite_email: string;
      role_key: string;
      username: string | null;
      module_keys: string[];
      company_ids: string[];
      tenant_id: string;
      expires_at: string;
      used_at: string | null;
    }>>(
      `onboarding_invites?token_hash=eq.${tokenHash}&select=id,invite_email,role_key,username,module_keys,company_ids,tenant_id,expires_at,used_at&limit=1`,
      { method: "GET" },
    );

    const invite = invites[0];
    if (!invite) return jsonResponse(404, { error: "Invalid onboarding link." });
    if (invite.used_at) return jsonResponse(410, { error: "This onboarding link has already been used." });
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      return jsonResponse(410, { error: "This onboarding link has expired." });
    }

    const username = String(payload?.username || invite.username || "")
      .trim();
    if (!username) return jsonResponse(400, { error: "Username is required." });
    const fullName = String(payload?.fullName || "").trim();
    if (fullName.length < 2) {
      return jsonResponse(400, { error: "Full name must be at least 2 characters." });
    }
    const accountType =
      String(payload?.accountType || "organization").trim().toLowerCase() === "individual"
        ? "individual"
        : "organization";
    const respondentNamePreference =
      accountType === "individual"
        ? "individual_name"
        : String(payload?.respondentNamePreference || "organization_name")
            .trim()
            .toLowerCase() === "individual_name"
          ? "individual_name"
          : "organization_name";
    const organizationName =
      accountType === "organization"
        ? String(payload?.organizationName || "").trim()
        : "";
    if (accountType === "organization" && organizationName.length < 2) {
      return jsonResponse(400, {
        error: "Organization name must be at least 2 characters.",
      });
    }

    const existingUsername = await postgrest<Array<{ user_id: string }>>(
      `profiles?username=ilike.${escapePostgrestValue(username)}&select=user_id&limit=1`,
      { method: "GET" },
    );
    if (existingUsername.length > 0) {
      return jsonResponse(409, { error: "This username is already in use." });
    }

    const userId = await createAuthUser({
      email: invite.invite_email,
      username,
      fullName,
      accountType,
      respondentNamePreference,
      organizationName: accountType === "organization" ? organizationName : null,
      password,
    });

    await postgrest(
      `profiles?user_id=eq.${userId}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          tenant_id: invite.tenant_id,
          full_name: fullName,
          username,
          account_type: accountType,
          respondent_name_preference: respondentNamePreference,
          organization_name: accountType === "organization" ? organizationName : null,
        }),
      },
    );

    await postgrest(
      "user_roles",
      {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify([{ user_id: userId, role: invite.role_key }]),
      },
    );

    if (invite.role_key !== "super_admin" && invite.module_keys.length > 0) {
      await postgrest(
        "user_module_permissions",
        {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify(
            invite.module_keys.map((module_key) => ({ user_id: userId, module_key })),
          ),
        },
      );
    }
    if (invite.role_key !== "super_admin" && invite.company_ids.length > 0) {
      await postgrest(
        "user_company_permissions",
        {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify(
            invite.company_ids.map((company_id) => ({ user_id: userId, company_id })),
          ),
        },
      );
    }

    await postgrest(
      `onboarding_invites?id=eq.${invite.id}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ used_at: new Date().toISOString() }),
      },
    );

    return jsonResponse(200, { message: "Onboarding completed." });
  } catch (error) {
    console.error("consume-onboarding-invite error:", error);
    return jsonResponse(500, {
      error: "Failed to complete onboarding.",
    });
  }
});
