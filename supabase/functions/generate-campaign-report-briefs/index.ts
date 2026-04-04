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

interface CampaignBriefRequest {
  campaignId: string;
  companyId: string;
  companyName: string;
  campaignName: string;
  responses: number;
  views: number;
  responseRate: number;
  completionRate: number;
  avgSatisfaction: number | null;
  avgQuality: number | null;
  avgRecommendation: number | null;
  sentimentIndex: number | null;
  healthScore: number | null;
  risk: string | null;
  topThemes: string[];
  sampleComments: string[];
}

interface CampaignReportBrief {
  campaignId: string;
  companyId: string;
  companyName: string;
  campaignName: string;
  summary: string;
  recommendations: string[];
  source: "ai" | "fallback";
}

function jsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function asNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sanitizeRequest(input: unknown): CampaignBriefRequest | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const payload = input as Record<string, unknown>;
  const campaignId = String(payload.campaignId || "").trim();
  const companyId = String(payload.companyId || "").trim();
  const companyName = String(payload.companyName || "").trim();
  const campaignName = String(payload.campaignName || "").trim();

  if (!campaignId || !companyId || !companyName || !campaignName) return null;

  return {
    campaignId,
    companyId,
    companyName,
    campaignName,
    responses: Number(payload.responses) || 0,
    views: Number(payload.views) || 0,
    responseRate: Number(payload.responseRate) || 0,
    completionRate: Number(payload.completionRate) || 0,
    avgSatisfaction: asNumberOrNull(payload.avgSatisfaction),
    avgQuality: asNumberOrNull(payload.avgQuality),
    avgRecommendation: asNumberOrNull(payload.avgRecommendation),
    sentimentIndex: asNumberOrNull(payload.sentimentIndex),
    healthScore: asNumberOrNull(payload.healthScore),
    risk:
      typeof payload.risk === "string" && payload.risk.trim().length > 0
        ? payload.risk.trim()
        : null,
    topThemes: Array.isArray(payload.topThemes)
      ? payload.topThemes.map((item) => String(item).trim()).filter(Boolean).slice(0, 5)
      : [],
    sampleComments: Array.isArray(payload.sampleComments)
      ? payload.sampleComments
          .map((item) => String(item).replace(/\s+/g, " ").trim())
          .filter(Boolean)
          .slice(0, 5)
      : [],
  };
}

function formatAverage(value: number | null, max: number): string {
  if (value === null) return "n/a";
  return `${value.toFixed(1)}/${max}`;
}

function buildFallbackRecommendations(request: CampaignBriefRequest): string[] {
  const recommendations: string[] = [];

  if (request.responseRate < 25) {
    recommendations.push(
      "Run a reminder sequence and simplify the opening section to improve conversions.",
    );
  }

  if (request.completionRate < 70) {
    recommendations.push(
      "Reduce form friction by reviewing required questions and moving longer prompts later.",
    );
  }

  if (request.avgSatisfaction !== null && request.avgSatisfaction < 6.5) {
    recommendations.push(
      "Prioritize a service recovery review for the lowest-scoring experience gaps this week.",
    );
  }

  if (request.avgRecommendation !== null && request.avgRecommendation < 7) {
    recommendations.push(
      "Address value and trust concerns before the next campaign cycle to improve advocacy.",
    );
  }

  if (request.topThemes.length > 0) {
    recommendations.push(
      `Focus the next action plan on ${request.topThemes.slice(0, 2).join(" and ")}.`,
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "Performance is stable; maintain cadence and track any movement in weekly response quality.",
    );
  }

  return recommendations.slice(0, 3);
}

function buildFallbackBriefs(
  campaigns: CampaignBriefRequest[],
): CampaignReportBrief[] {
  return campaigns.map((campaign) => {
    const summaryParts = [
      `${campaign.campaignName} for ${campaign.companyName} recorded ${campaign.responses} responses from ${campaign.views} views (${campaign.responseRate.toFixed(1)}% response rate).`,
      `Completion averaged ${campaign.completionRate.toFixed(1)}%, with satisfaction at ${formatAverage(campaign.avgSatisfaction, 10)}, quality at ${formatAverage(campaign.avgQuality, 5)}, and recommendation at ${formatAverage(campaign.avgRecommendation, 10)}.`,
    ];

    if (campaign.topThemes.length > 0) {
      summaryParts.push(
        `The strongest recurring themes were ${campaign.topThemes.slice(0, 3).join(", ")}.`,
      );
    }

    if (campaign.risk) {
      const healthText =
        campaign.healthScore === null
          ? `${campaign.risk} risk`
          : `${campaign.risk} risk (${campaign.healthScore.toFixed(0)} health score)`;
      summaryParts.push(`Overall health currently sits at ${healthText}.`);
    }

    if (campaign.sampleComments.length > 0) {
      summaryParts.push(
        `Representative written feedback highlights ${campaign.sampleComments[0]}.`,
      );
    }

    return {
      campaignId: campaign.campaignId,
      companyId: campaign.companyId,
      companyName: campaign.companyName,
      campaignName: campaign.campaignName,
      summary: summaryParts.join(" "),
      recommendations: buildFallbackRecommendations(campaign),
      source: "fallback",
    };
  });
}

function sanitizeAiBriefs(
  raw: unknown,
  campaigns: CampaignBriefRequest[],
): CampaignReportBrief[] {
  if (!Array.isArray(raw)) return [];

  const lookup = new Map(campaigns.map((campaign) => [campaign.campaignId, campaign]));

  return raw
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const payload = item as Record<string, unknown>;
      const campaignId = String(payload.campaignId || "").trim();
      const summary = String(payload.summary || "").replace(/\s+/g, " ").trim();
      const recommendations = Array.isArray(payload.recommendations)
        ? payload.recommendations
            .map((entry) => String(entry).replace(/\s+/g, " ").trim())
            .filter(Boolean)
            .slice(0, 3)
        : [];

      const campaign = lookup.get(campaignId);
      if (!campaign || !summary || recommendations.length === 0) return null;

      return {
        campaignId: campaign.campaignId,
        companyId: campaign.companyId,
        companyName: campaign.companyName,
        campaignName: campaign.campaignName,
        summary,
        recommendations,
        source: "ai" as const,
      };
    })
    .filter((item): item is CampaignReportBrief => Boolean(item));
}

async function generateWithOpenAI(
  campaigns: CampaignBriefRequest[],
  apiKey: string,
  model: string,
  baseUrl: string,
): Promise<CampaignReportBrief[]> {
  const prompt = [
    "You are preparing executive-ready campaign report briefs for an admin analytics export.",
    "Return strict JSON only with this schema:",
    '{"briefs":[{"campaignId":string,"summary":string,"recommendations":string[]}]}',
    "Rules:",
    "- Write one brief per campaign in the input.",
    "- Summary must be 2-4 sentences, concise, professional, and evidence-based.",
    "- Recommendations must contain exactly 3 practical actions.",
    "- Do not mention AI, models, confidence, or missing data unless essential.",
    "- Use only the supplied data.",
    `Campaign data:\n${JSON.stringify(campaigns)}`,
  ].join("\n");

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: "Return valid JSON only." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI provider error: ${response.status} ${text}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(content);
    return sanitizeAiBriefs(parsed?.briefs, campaigns);
  } catch {
    return [];
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await request.json();
    const campaigns = Array.isArray(body?.campaigns)
      ? body.campaigns.map((item: unknown) => sanitizeRequest(item)).filter((item): item is CampaignBriefRequest => Boolean(item))
      : [];

    if (campaigns.length === 0) {
      return jsonResponse(400, { error: "At least one campaign is required." });
    }

    const fallbackBriefs = buildFallbackBriefs(campaigns);
    const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
    const openAiModel = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";
    const openAiBaseUrl =
      Deno.env.get("OPENAI_BASE_URL") || "https://api.openai.com/v1";

    if (!openAiApiKey) {
      return jsonResponse(200, {
        briefs: fallbackBriefs,
        source: "fallback",
      });
    }

    try {
      const aiBriefs = await generateWithOpenAI(
        campaigns,
        openAiApiKey,
        openAiModel,
        openAiBaseUrl,
      );

      if (aiBriefs.length === campaigns.length) {
        return jsonResponse(200, { briefs: aiBriefs, source: "ai" });
      }

      const aiByCampaignId = new Map(
        aiBriefs.map((brief) => [brief.campaignId, brief]),
      );
      const mergedBriefs = fallbackBriefs.map(
        (brief) => aiByCampaignId.get(brief.campaignId) || brief,
      );

      return jsonResponse(200, {
        briefs: mergedBriefs,
        source: aiBriefs.length > 0 ? "ai_partial" : "fallback",
      });
    } catch (error) {
      console.error("generate-campaign-report-briefs AI error:", error);
      return jsonResponse(200, {
        briefs: fallbackBriefs,
        source: "fallback",
      });
    }
  } catch (error) {
    console.error("generate-campaign-report-briefs function error:", error);
    return jsonResponse(500, {
      error: "Unable to generate campaign report briefs.",
    });
  }
});
