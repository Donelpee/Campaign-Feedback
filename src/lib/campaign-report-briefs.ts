import { getOtherAnswerText } from "./campaign-answer-utils";
import type { CampaignQuestion } from "./supabase-types";

export interface CampaignBriefResponseInput {
  campaign_id: string;
  company_id: string;
  company_name: string;
  campaign_name: string;
  created_at: string;
  satisfaction_value: number | null;
  quality_value: number | null;
  recommendation_score: number | null;
  improvement_areas: string[];
  additional_comments: string | null;
  answers: Record<string, unknown>;
  campaign_questions: CampaignQuestion[];
}

export interface CampaignBriefMetricInput {
  campaign_id: string;
  company_id: string;
  company_name: string;
  campaign_name: string;
  responses: number;
  views: number;
  response_rate: number;
  completion_rate: number;
  sentiment_index?: number;
  health_score?: number;
  risk?: string;
}

export interface CampaignBriefRequest {
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

export interface CampaignReportBrief {
  campaignId: string;
  companyId: string;
  companyName: string;
  campaignName: string;
  summary: string;
  recommendations: string[];
  source: "ai" | "fallback";
}

function average(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => Number.isFinite(value));
  if (valid.length === 0) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function collectNarrativeText(response: CampaignBriefResponseInput): string[] {
  const texts: string[] = [];

  if (response.additional_comments) {
    const comment = normalizeText(response.additional_comments);
    if (comment) texts.push(comment);
  }

  response.campaign_questions.forEach((question) => {
    if (
      question.type !== "text" &&
      question.type !== "textbox" &&
      question.type !== "textarea"
    ) {
      return;
    }

    const value = response.answers[question.id];
    if (typeof value !== "string") return;
    const text = normalizeText(value);
    if (text) texts.push(text);
  });

  response.campaign_questions.forEach((question) => {
    const otherText = normalizeText(getOtherAnswerText(response.answers, question.id));
    if (otherText) texts.push(otherText);
  });

  return texts;
}

function formatAverage(value: number | null, max: number): string {
  if (value === null) return "n/a";
  return `${value.toFixed(1)}/${max}`;
}

function buildFallbackRecommendations(request: CampaignBriefRequest): string[] {
  const recommendations: string[] = [];

  if (request.responseRate < 25) {
    recommendations.push(
      "Send a reminder wave and shorten the first section to improve response conversion.",
    );
  }

  if (request.completionRate < 70) {
    recommendations.push(
      "Review required questions and move high-effort prompts later in the form.",
    );
  }

  if (request.avgSatisfaction !== null && request.avgSatisfaction < 6.5) {
    recommendations.push(
      "Run a service recovery review on low-scoring touchpoints and assign owners this week.",
    );
  }

  if (request.avgRecommendation !== null && request.avgRecommendation < 7) {
    recommendations.push(
      "Address trust and value concerns before the next outreach cycle to lift advocacy.",
    );
  }

  if (request.topThemes.length > 0) {
    recommendations.push(
      `Prioritize action plans around ${request.topThemes.slice(0, 2).join(" and ")} in the next report-out.`,
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "Performance is stable; keep the current cadence and monitor weekly trend shifts.",
    );
  }

  return recommendations.slice(0, 3);
}

export function buildCampaignBriefRequests(
  responses: CampaignBriefResponseInput[],
  metrics: CampaignBriefMetricInput[],
): CampaignBriefRequest[] {
  const grouped = new Map<string, CampaignBriefResponseInput[]>();

  responses.forEach((response) => {
    const existing = grouped.get(response.campaign_id) || [];
    existing.push(response);
    grouped.set(response.campaign_id, existing);
  });

  return metrics.map((metric) => {
    const campaignResponses = grouped.get(metric.campaign_id) || [];
    const themeCounts = new Map<string, number>();
    const comments: string[] = [];
    const seenComments = new Set<string>();

    campaignResponses.forEach((response) => {
      response.improvement_areas.forEach((theme) => {
        const key = normalizeText(theme);
        if (!key) return;
        themeCounts.set(key, (themeCounts.get(key) || 0) + 1);
      });

      collectNarrativeText(response).forEach((text) => {
        const normalized = normalizeText(text);
        if (!normalized || seenComments.has(normalized)) return;
        seenComments.add(normalized);
        comments.push(normalized);
      });
    });

    const topThemes = [...themeCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([theme]) => theme)
      .slice(0, 4);

    return {
      campaignId: metric.campaign_id,
      companyId: metric.company_id,
      companyName: metric.company_name,
      campaignName: metric.campaign_name,
      responses: metric.responses,
      views: metric.views,
      responseRate: metric.response_rate,
      completionRate: metric.completion_rate,
      avgSatisfaction: average(campaignResponses.map((item) => item.satisfaction_value)),
      avgQuality: average(campaignResponses.map((item) => item.quality_value)),
      avgRecommendation: average(campaignResponses.map((item) => item.recommendation_score)),
      sentimentIndex:
        typeof metric.sentiment_index === "number" ? metric.sentiment_index : null,
      healthScore: typeof metric.health_score === "number" ? metric.health_score : null,
      risk: metric.risk || null,
      topThemes,
      sampleComments: comments.slice(0, 5),
    };
  });
}

export function buildFallbackCampaignReportBriefs(
  requests: CampaignBriefRequest[],
): CampaignReportBrief[] {
  return requests.map((request) => {
    const summaryParts = [
      `${request.campaignName} for ${request.companyName} generated ${request.responses} responses from ${request.views} views (${request.responseRate.toFixed(1)}% response rate).`,
      `Completion averaged ${request.completionRate.toFixed(1)}%, with satisfaction at ${formatAverage(request.avgSatisfaction, 10)}, quality at ${formatAverage(request.avgQuality, 5)}, and recommendation at ${formatAverage(request.avgRecommendation, 10)}.`,
    ];

    if (request.topThemes.length > 0) {
      summaryParts.push(
        `The most repeated themes were ${request.topThemes.slice(0, 3).join(", ")}.`,
      );
    }

    if (request.risk) {
      const healthText =
        request.healthScore === null ? request.risk : `${request.risk} risk (${request.healthScore.toFixed(0)} health score)`;
      summaryParts.push(`Overall campaign health is ${healthText}.`);
    }

    if (request.sampleComments.length > 0) {
      summaryParts.push(
        `Written feedback highlights ${request.sampleComments[0]}.`,
      );
    }

    return {
      campaignId: request.campaignId,
      companyId: request.companyId,
      companyName: request.companyName,
      campaignName: request.campaignName,
      summary: summaryParts.join(" "),
      recommendations: buildFallbackRecommendations(request),
      source: "fallback",
    };
  });
}
