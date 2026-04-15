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

interface SystemHealthEventRequest {
  source?: "frontend" | "edge_function";
  area?: string;
  severity?: "info" | "warning" | "error" | "critical";
  eventType?: string;
  message?: string;
  fingerprint?: string;
  route?: string | null;
  statusCode?: number | null;
  companyId?: string | null;
  campaignId?: string | null;
  linkId?: string | null;
  metadata?: Record<string, unknown> | null;
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function trimText(value: string, maxLength: number) {
  return value.trim().slice(0, maxLength);
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

function sanitizeMetadata(value: Record<string, unknown> | null | undefined) {
  if (!value) return {};

  try {
    return JSON.parse(
      JSON.stringify(value, (_key, entry) => {
        if (entry instanceof Error) {
          return {
            name: entry.name,
            message: trimText(entry.message, 500),
          };
        }
        if (typeof entry === "string") return trimText(entry, 500);
        if (typeof entry === "function" || typeof entry === "undefined") return null;
        return entry;
      }),
    );
  } catch {
    return { serialization_failed: true };
  }
}

async function insertSystemHealthEvent(
  request: Request,
  payload: Required<
    Pick<
      SystemHealthEventRequest,
      "source" | "area" | "severity" | "eventType" | "message" | "fingerprint"
    >
  > &
    Pick<
      SystemHealthEventRequest,
      "route" | "statusCode" | "companyId" | "campaignId" | "linkId" | "metadata"
    >,
) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) {
    throw new Error("Missing Supabase URL.");
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/system_health_events`, {
    method: "POST",
    headers: getServiceHeaders({
      Prefer: "return=minimal",
    }),
    body: JSON.stringify([
      {
        source: payload.source,
        area: payload.area,
        severity: payload.severity,
        event_type: payload.eventType,
        message: payload.message,
        fingerprint: payload.fingerprint,
        route: payload.route || null,
        status_code: payload.statusCode || null,
        company_id: payload.companyId || null,
        campaign_id: payload.campaignId || null,
        link_id: payload.linkId || null,
        request_path: new URL(request.url).pathname,
        request_method: request.method,
        metadata: {
          ...sanitizeMetadata(payload.metadata),
          requestUserAgent: request.headers.get("user-agent"),
        },
      },
    ]),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to insert system health event (${response.status}): ${text}`);
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
    const body = (await request.json()) as SystemHealthEventRequest;
    const area = trimText(String(body.area || ""), 120);
    const eventType = trimText(String(body.eventType || ""), 120);
    const message = trimText(String(body.message || ""), 500);

    if (!area || !eventType || !message) {
      return jsonResponse(400, {
        error: "area, eventType, and message are required.",
      });
    }

    const source = body.source === "edge_function" ? "edge_function" : "frontend";
    const severity =
      body.severity === "info" ||
      body.severity === "warning" ||
      body.severity === "critical"
        ? body.severity
        : "error";
    const route = body.route ? trimText(String(body.route), 255) : null;
    const fingerprint = trimText(
      String(body.fingerprint || `${source}:${area}:${eventType}:${route || "unknown"}`),
      240,
    );

    await insertSystemHealthEvent(request, {
      source,
      area,
      severity,
      eventType,
      message,
      fingerprint,
      route,
      statusCode:
        typeof body.statusCode === "number" && Number.isFinite(body.statusCode)
          ? body.statusCode
          : null,
      companyId: body.companyId || null,
      campaignId: body.campaignId || null,
      linkId: body.linkId || null,
      metadata: body.metadata || null,
    });

    return jsonResponse(200, { success: true });
  } catch (error) {
    console.error("record-system-health-event function error:", error);
    return jsonResponse(500, { error: "Failed to record system health event." });
  }
});
