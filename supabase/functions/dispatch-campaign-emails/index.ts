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

interface DispatchRequest {
  campaignId: string;
  action: "send_invites" | "send_reminders";
}

interface RecipientRow {
  id: string;
  email: string;
  status: string;
  reminder_count: number;
  last_sent_at: string | null;
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function postgrest<T>(
  path: string,
  options: RequestInit,
): Promise<T> {
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
  const fromEmail = Deno.env.get("CAMPAIGN_FROM_EMAIL") || "no-reply@clientpulselens.com";
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

function shouldSendReminder(
  recipient: RecipientRow,
  intervalDays: number,
  maxReminders: number,
) {
  if (recipient.status !== "sent") return false;
  if (recipient.reminder_count >= maxReminders) return false;
  if (!recipient.last_sent_at) return true;
  const last = new Date(recipient.last_sent_at);
  const dueAt = new Date(last);
  dueAt.setDate(last.getDate() + intervalDays);
  return new Date() >= dueAt;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const body = (await request.json()) as DispatchRequest;
    const campaignId = String(body?.campaignId || "").trim();
    const action = body?.action;
    if (!campaignId || (action !== "send_invites" && action !== "send_reminders")) {
      return jsonResponse(400, { error: "campaignId and action are required." });
    }

    const links = await postgrest<
      Array<{ unique_code: string; company_id: string; campaign: { name: string } | null }>
    >(
      `company_campaign_links?campaign_id=eq.${campaignId}&select=unique_code,company_id,campaign:campaign_id(name)&limit=1`,
      { method: "GET" },
    );
    const link = links[0];
    if (!link) {
      return jsonResponse(404, { error: "No link found for campaign." });
    }

    const settingsRows = await postgrest<
      Array<{
        reminder_enabled: boolean;
        reminder_interval_days: number;
        max_reminders: number;
      }>
    >(
      `campaign_distribution_settings?campaign_id=eq.${campaignId}&select=reminder_enabled,reminder_interval_days,max_reminders&limit=1`,
      { method: "GET" },
    );
    const settings = settingsRows[0] || {
      reminder_enabled: false,
      reminder_interval_days: 3,
      max_reminders: 2,
    };

    const recipients = await postgrest<RecipientRow[]>(
      `campaign_email_recipients?campaign_id=eq.${campaignId}&select=id,email,status,reminder_count,last_sent_at`,
      { method: "GET" },
    );

    const appBaseUrl =
      Deno.env.get("APP_BASE_URL") || Deno.env.get("SITE_URL") || "http://localhost:8080";
    const formUrl = `${appBaseUrl.replace(/\/$/, "")}/feedback/${link.unique_code}`;
    const campaignName = link.campaign?.name || "Feedback Campaign";

    const targetRecipients =
      action === "send_invites"
        ? recipients.filter((recipient) => recipient.status === "pending" || recipient.status === "failed")
        : settings.reminder_enabled
          ? recipients.filter((recipient) =>
              shouldSendReminder(
                recipient,
                settings.reminder_interval_days,
                settings.max_reminders,
              ),
            )
          : [];

    let sent = 0;
    let failed = 0;

    for (const recipient of targetRecipients) {
      try {
        const subject =
          action === "send_invites"
            ? `Invitation: ${campaignName}`
            : `Reminder: ${campaignName}`;
        const html = `
          <div style="font-family: Arial, sans-serif; line-height: 1.5;">
            <h2>${campaignName}</h2>
            <p>${action === "send_invites" ? "You are invited to complete this feedback form." : "Friendly reminder to complete this feedback form."}</p>
            <p><a href="${formUrl}" target="_blank">Open feedback form</a></p>
          </div>
        `;
        await sendWithResend({
          to: recipient.email,
          subject,
          html,
        });

        const nextReminderCount =
          action === "send_reminders" ? recipient.reminder_count + 1 : recipient.reminder_count;
        const patchBody =
          action === "send_reminders"
            ? {
                status: "sent",
                last_sent_at: new Date().toISOString(),
                last_reminder_at: new Date().toISOString(),
                reminder_count: nextReminderCount,
              }
            : {
                status: "sent",
                last_sent_at: new Date().toISOString(),
              };

        await postgrest(
          `campaign_email_recipients?id=eq.${recipient.id}`,
          {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify(patchBody),
          },
        );
        sent += 1;
      } catch (error) {
        await postgrest(
          `campaign_email_recipients?id=eq.${recipient.id}`,
          {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({ status: "failed" }),
          },
        );
        failed += 1;
        console.error("Dispatch failed for recipient:", recipient.email, error);
      }
    }

    return jsonResponse(200, {
      campaignId,
      action,
      processed: targetRecipients.length,
      sent,
      failed,
      message:
        targetRecipients.length === 0
          ? "No recipients are due for this action."
          : "Dispatch completed.",
    });
  } catch (error) {
    console.error("dispatch-campaign-emails function error:", error);
    return jsonResponse(500, {
      error: "Failed to dispatch campaign emails.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});
