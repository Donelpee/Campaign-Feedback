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

interface CreatePayload {
  email: string;
  username: string;
  password: string;
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
  if (!response.ok) {
    throw new Error("Invalid caller token.");
  }

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

async function createAuthUser(params: {
  email: string;
  username: string;
  password: string;
}): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing Supabase service credentials.");
  }

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
        full_name: params.username,
        username: params.username,
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
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const callerId = await fetchCallerId(request);
    const privileges = await getCallerPrivileges(callerId);
    const callerTenantId = await getCallerTenantId(callerId);
    const payload = (await request.json()) as CreatePayload;

    const email = String(payload?.email || "").trim().toLowerCase();
    const username = String(payload?.username || "").trim();
    const password = String(payload?.password || "");
    const role = String(payload?.role || "").trim().toLowerCase() || "admin";
    const permissions = Array.isArray(payload?.permissions)
      ? payload.permissions
      : [];
    const companyIds = Array.isArray(payload?.companyIds)
      ? payload.companyIds.filter((id) => typeof id === "string" && id.length > 0)
      : [];
    await validateCompanyIdsForTenant(companyIds, callerTenantId);

    if (!email) return jsonResponse(400, { error: "Email is required." });
    if (!username) return jsonResponse(400, { error: "Username is required." });
    if (password.length < 6) {
      return jsonResponse(400, { error: "Password must be at least 6 characters." });
    }
    if (role === "super_admin" && !privileges.isSuperAdmin) {
      return jsonResponse(403, {
        error: "Only Super Admin can assign Super Admin role.",
      });
    }

    const existingProfiles = await postgrest<Array<{ user_id: string }>>(
      `profiles?email=eq.${escapePostgrestValue(email)}&select=user_id&limit=1`,
      { method: "GET" },
    );
    if (existingProfiles.length > 0) {
      return jsonResponse(409, { error: "A user with this email already exists." });
    }

    const existingUsername = await postgrest<Array<{ user_id: string }>>(
      `profiles?username=ilike.${escapePostgrestValue(username)}&select=user_id&limit=1`,
      { method: "GET" },
    );
    if (existingUsername.length > 0) {
      return jsonResponse(409, { error: "This username is already in use." });
    }

    const userId = await createAuthUser({ email, username, password });

    await postgrest(
      `profiles?user_id=eq.${userId}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ tenant_id: callerTenantId }),
      },
    );

    await postgrest(
      "user_roles",
      {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify([{ user_id: userId, role }]),
      },
    );

    if (role !== "super_admin" && permissions.length > 0) {
      await postgrest(
        "user_module_permissions",
        {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify(
            permissions.map((permission) => ({
              user_id: userId,
              module_key: permission,
            })),
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
            companyIds.map((companyId) => ({
              user_id: userId,
              company_id: companyId,
            })),
          ),
        },
      );
    }

    return jsonResponse(200, {
      message: "User created and access assigned successfully.",
      user_id: userId,
    });
  } catch (error) {
    console.error("create-admin-user function error:", error);
    return jsonResponse(500, {
      error: "Failed to create user.",
    });
  }
});
