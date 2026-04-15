import { supabase } from "@/integrations/supabase/client";

export type SystemHealthSeverity = "info" | "warning" | "error" | "critical";

export interface SystemHealthEventInput {
  area: string;
  eventType: string;
  message: string;
  severity?: SystemHealthSeverity;
  source?: "frontend" | "edge_function";
  route?: string;
  statusCode?: number;
  companyId?: string | null;
  campaignId?: string | null;
  linkId?: string | null;
  metadata?: Record<string, unknown>;
  fingerprint?: string;
}

const RECENT_EVENT_TTL_MS = 2 * 60 * 1000;
const recentEventTimestamps = new Map<string, number>();

function trimText(value: string, maxLength: number) {
  return value.trim().slice(0, maxLength);
}

function buildFingerprint(input: SystemHealthEventInput, route: string) {
  return trimText(
    [
      input.source || "frontend",
      input.area,
      input.eventType,
      input.statusCode || "na",
      route || "unknown-route",
      input.message,
    ].join("::"),
    240,
  );
}

function sanitizeMetadata(
  value: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!value) return undefined;

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
    ) as Record<string, unknown>;
  } catch {
    return { serialization_failed: true };
  }
}

function pruneRecentEventCache(now: number) {
  recentEventTimestamps.forEach((timestamp, key) => {
    if (now - timestamp > RECENT_EVENT_TTL_MS) {
      recentEventTimestamps.delete(key);
    }
  });
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  return fallback;
}

export async function reportSystemHealthEvent(input: SystemHealthEventInput) {
  if (typeof window === "undefined") return;

  const route = trimText(input.route || window.location.pathname, 255);
  const fingerprint = input.fingerprint || buildFingerprint(input, route);
  const now = Date.now();

  pruneRecentEventCache(now);
  const previousTimestamp = recentEventTimestamps.get(fingerprint);
  if (previousTimestamp && now - previousTimestamp < RECENT_EVENT_TTL_MS) {
    return;
  }
  recentEventTimestamps.set(fingerprint, now);

  try {
    await supabase.functions.invoke("record-system-health-event", {
      body: {
        source: input.source || "frontend",
        area: trimText(input.area, 120),
        severity: input.severity || "error",
        eventType: trimText(input.eventType, 120),
        message: trimText(input.message, 500),
        fingerprint,
        route,
        statusCode: input.statusCode || null,
        companyId: input.companyId || null,
        campaignId: input.campaignId || null,
        linkId: input.linkId || null,
        metadata: sanitizeMetadata({
          ...input.metadata,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        }),
      },
    });
  } catch (error) {
    console.error("Failed to record system health event:", error);
  }
}
