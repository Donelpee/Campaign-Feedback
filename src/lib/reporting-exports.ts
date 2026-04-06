import {
  findOtherOptionLabel,
  getOtherAnswerText,
} from "./campaign-answer-utils";
import { normalizeCampaignSurvey } from "./campaign-survey";
import type { CampaignQuestion } from "./supabase-types";

export interface ExportResponseData {
  id: string;
  company_id: string;
  campaign_id: string;
  company_name: string;
  campaign_name: string;
  created_at: string;
  satisfaction_value: number | null;
  satisfaction_max: number;
  quality_value: number | null;
  quality_max: number;
  recommendation_score: number | null;
  recommendation_text: string;
  improvement_areas: string[];
  additional_comments: string | null;
  answers: Record<string, unknown>;
  campaign_questions: CampaignQuestion[];
}

export interface CampaignExportMetric {
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

export interface CampaignReportBrief {
  campaignId: string;
  companyId: string;
  companyName: string;
  campaignName: string;
  summary: string;
  recommendations: string[];
  source: "ai" | "fallback";
}

export interface AdvancedExportInsights {
  periodDelta: {
    currentResponses: number;
    previousResponses: number;
    deltaPercent: number;
  };
  benchmark: {
    selectedRate: number;
    benchmarkRate: number;
    gapPercent: number;
  } | null;
  sentiment: {
    scoreIndex: number;
    positive: number;
    neutral: number;
    negative: number;
  };
  forecast: {
    next7Responses: number;
    dailyAverage: number;
  };
  campaignHealth: Array<{
    campaignName: string;
    responseRate: number;
    completionRate: number;
    sentimentIndex: number;
    healthScore: number;
    risk: string;
  }>;
  recommendations: string[];
}

export interface ReportChartDatum {
  label: string;
  value: number;
}

export interface ReportOptionStat extends ReportChartDatum {
  percentage: number;
}

export interface QuestionTextInsight {
  type: "open_text" | "other_detail" | "file_upload";
  value: string;
  responseId: string;
  createdAt: string;
}

export interface QuestionRowSummary {
  rowLabel: string;
  options: ReportOptionStat[];
}

export interface ReportQuestionSummary {
  id: string;
  question: string;
  type: CampaignQuestion["type"];
  required: boolean;
  totalResponses: number;
  answeredCount: number;
  skippedCount: number;
  answerRate: number;
  chartType: "pie" | "bar" | "none";
  chartData: ReportChartDatum[];
  topResponse: string | null;
  averageValue: number | null;
  minValue: number | null;
  maxValue: number | null;
  optionStats: ReportOptionStat[];
  rowSummaries: QuestionRowSummary[];
  textInsights: QuestionTextInsight[];
  responseSummary: string;
}

export interface CampaignReportData {
  campaignId: string;
  companyId: string;
  companyName: string;
  campaignName: string;
  responses: number;
  views: number;
  responseRate: number;
  completionRate: number;
  sentimentIndex: number | null;
  healthScore: number | null;
  risk: string | null;
  brief: CampaignReportBrief | null;
  questionSummaries: ReportQuestionSummary[];
  rawResponses: ExportResponseData[];
}

export interface MasterCsvColumn {
  key: string;
  label: string;
}

function safePercent(value: number, total: number) {
  if (total <= 0) return 0;
  return (value / total) * 100;
}

function toNumberOrNull(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function hasAnswerValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) {
    return value.some((item) => hasAnswerValue(item));
  }
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((item) =>
      hasAnswerValue(item),
    );
  }
  return true;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function formatOptionWithOtherDetail(
  option: string,
  otherOption: string | null,
  otherText: string,
) {
  if (otherOption && option === otherOption && otherText) {
    return `${option}: ${otherText}`;
  }
  return option;
}

function sortOptionStats(options: Map<string, number>, answeredCount: number) {
  return [...options.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label, value]) => ({
      label,
      value,
      percentage: safePercent(value, answeredCount),
    }));
}

function formatQuestionAnswer(
  question: CampaignQuestion,
  answers: Record<string, unknown>,
): string {
  const value = answers[question.id];
  const otherOption = findOtherOptionLabel(question.options);
  const otherText = cleanText(getOtherAnswerText(answers, question.id));

  if (!hasAnswerValue(value)) {
    return "";
  }

  if (question.type === "multiple_choice") {
    return ((Array.isArray(value) ? value : []) as unknown[])
      .map((item) =>
        formatOptionWithOtherDetail(String(item), otherOption, otherText),
      )
      .join(" | ");
  }

  if (question.type === "rank") {
    return ((Array.isArray(value) ? value : []) as unknown[])
      .map((item, index) => `${index + 1}. ${String(item)}`)
      .join(" | ");
  }

  if (question.type === "checkbox_matrix") {
    if (!value || typeof value !== "object" || Array.isArray(value)) return "";
    return Object.entries(value as Record<string, unknown>)
      .map(([rowLabel, rowValue]) => {
        const selected = Array.isArray(rowValue)
          ? rowValue.map((item) => String(item)).join(" | ")
          : "";
        return selected ? `${rowLabel}: ${selected}` : "";
      })
      .filter(Boolean)
      .join("; ");
  }

  if (question.type === "radio_matrix") {
    if (!value || typeof value !== "object" || Array.isArray(value)) return "";
    return Object.entries(value as Record<string, unknown>)
      .map(([rowLabel, rowValue]) =>
        cleanText(String(rowValue)) ? `${rowLabel}: ${String(rowValue)}` : "",
      )
      .filter(Boolean)
      .join("; ");
  }

  if (question.type === "file_upload") {
    return ((Array.isArray(value) ? value : []) as Array<Record<string, unknown>>)
      .map((file) => String(file.originalName || file.path || "Uploaded file"))
      .join(" | ");
  }

  if (question.type === "single_choice" || question.type === "combobox") {
    return formatOptionWithOtherDetail(String(value), otherOption, otherText);
  }

  return String(value);
}

function buildQuestionSummary(
  question: CampaignQuestion,
  campaignResponses: ExportResponseData[],
): ReportQuestionSummary {
  const answerEntries = campaignResponses.map((response) => ({
    responseId: response.id,
    createdAt: response.created_at,
    answers: response.answers || {},
    value: (response.answers || {})[question.id],
  }));

  const answeredEntries = answerEntries.filter((entry) => hasAnswerValue(entry.value));
  const answeredCount = answeredEntries.length;
  const totalResponses = campaignResponses.length;
  const skippedCount = Math.max(totalResponses - answeredCount, 0);
  const answerRate = safePercent(answeredCount, totalResponses);
  const optionCounts = new Map<string, number>();
  const textInsights: QuestionTextInsight[] = [];
  const rowSummaries: QuestionRowSummary[] = [];
  const numericValues: number[] = [];
  let chartType: ReportQuestionSummary["chartType"] = "none";
  let responseSummary = `${answeredCount} of ${totalResponses} responses answered this question.`;

  const otherOption = findOtherOptionLabel(question.options);

  if (question.type === "single_choice" || question.type === "combobox") {
    chartType = "pie";
    answeredEntries.forEach((entry) => {
      const label = cleanText(String(entry.value));
      if (!label) return;
      optionCounts.set(label, (optionCounts.get(label) || 0) + 1);

      const otherText = cleanText(getOtherAnswerText(entry.answers, question.id));
      if (otherOption && label === otherOption && otherText) {
        textInsights.push({
          type: "other_detail",
          value: otherText,
          responseId: entry.responseId,
          createdAt: entry.createdAt,
        });
      }
    });
  } else if (question.type === "multiple_choice") {
    chartType = "pie";
    answeredEntries.forEach((entry) => {
      const items = Array.isArray(entry.value) ? entry.value : [];
      items.forEach((item) => {
        const label = cleanText(String(item));
        if (!label) return;
        optionCounts.set(label, (optionCounts.get(label) || 0) + 1);
      });

      const otherText = cleanText(getOtherAnswerText(entry.answers, question.id));
      if (otherText) {
        textInsights.push({
          type: "other_detail",
          value: otherText,
          responseId: entry.responseId,
          createdAt: entry.createdAt,
        });
      }
    });
    responseSummary = `${answeredCount} responses selected ${[...optionCounts.values()].reduce((sum, item) => sum + item, 0)} total options.`;
  } else if (
    question.type === "rating" ||
    question.type === "scale" ||
    question.type === "nps"
  ) {
    chartType = "bar";
    answeredEntries.forEach((entry) => {
      const numeric = toNumberOrNull(entry.value);
      if (numeric === null) return;
      numericValues.push(numeric);
      const label = String(Math.round(numeric));
      optionCounts.set(label, (optionCounts.get(label) || 0) + 1);
    });
  } else if (question.type === "checkbox_matrix") {
    chartType = "bar";
    const perRow = new Map<string, Map<string, number>>();
    answeredEntries.forEach((entry) => {
      if (!entry.value || typeof entry.value !== "object" || Array.isArray(entry.value)) return;
      Object.entries(entry.value as Record<string, unknown>).forEach(([rowLabel, rowValue]) => {
        const items = Array.isArray(rowValue) ? rowValue : [];
        const rowMap = perRow.get(rowLabel) || new Map<string, number>();
        items.forEach((item) => {
          const label = cleanText(String(item));
          if (!label) return;
          rowMap.set(label, (rowMap.get(label) || 0) + 1);
          optionCounts.set(`${rowLabel}: ${label}`, (optionCounts.get(`${rowLabel}: ${label}`) || 0) + 1);
        });
        perRow.set(rowLabel, rowMap);
      });
    });
    perRow.forEach((rowOptions, rowLabel) => {
      rowSummaries.push({
        rowLabel,
        options: sortOptionStats(rowOptions, answeredCount),
      });
    });
  } else if (question.type === "radio_matrix") {
    chartType = "bar";
    const perRow = new Map<string, Map<string, number>>();
    answeredEntries.forEach((entry) => {
      if (!entry.value || typeof entry.value !== "object" || Array.isArray(entry.value)) return;
      Object.entries(entry.value as Record<string, unknown>).forEach(([rowLabel, rowValue]) => {
        const label = cleanText(String(rowValue));
        if (!label) return;
        const rowMap = perRow.get(rowLabel) || new Map<string, number>();
        rowMap.set(label, (rowMap.get(label) || 0) + 1);
        perRow.set(rowLabel, rowMap);
        optionCounts.set(`${rowLabel}: ${label}`, (optionCounts.get(`${rowLabel}: ${label}`) || 0) + 1);
      });
    });
    perRow.forEach((rowOptions, rowLabel) => {
      rowSummaries.push({
        rowLabel,
        options: sortOptionStats(rowOptions, answeredCount),
      });
    });
  } else if (question.type === "rank") {
    chartType = "bar";
    const weightedScores = new Map<string, number>();
    answeredEntries.forEach((entry) => {
      const items = Array.isArray(entry.value) ? entry.value : [];
      items.forEach((item, index) => {
        const label = cleanText(String(item));
        if (!label) return;
        const score = items.length - index;
        weightedScores.set(label, (weightedScores.get(label) || 0) + score);
      });
    });
    weightedScores.forEach((value, label) => {
      optionCounts.set(label, value);
    });
    responseSummary = `${answeredCount} responses ranked the available options. Higher bars indicate stronger overall preference.`;
  } else if (
    question.type === "text" ||
    question.type === "textbox" ||
    question.type === "textarea"
  ) {
    answeredEntries.forEach((entry) => {
      const text = cleanText(String(entry.value));
      if (!text) return;
      textInsights.push({
        type: "open_text",
        value: text,
        responseId: entry.responseId,
        createdAt: entry.createdAt,
      });
    });
    responseSummary = `${answeredCount} written responses captured for this question.`;
  } else if (question.type === "date") {
    chartType = "bar";
    answeredEntries.forEach((entry) => {
      const label = cleanText(String(entry.value));
      if (!label) return;
      optionCounts.set(label, (optionCounts.get(label) || 0) + 1);
    });
  } else if (question.type === "file_upload") {
    answeredEntries.forEach((entry) => {
      const files = Array.isArray(entry.value) ? entry.value : [];
      files.forEach((file) => {
        const label = cleanText(
          String(
            (file as Record<string, unknown>).originalName ||
              (file as Record<string, unknown>).path ||
              "Uploaded file",
          ),
        );
        if (!label) return;
        textInsights.push({
          type: "file_upload",
          value: label,
          responseId: entry.responseId,
          createdAt: entry.createdAt,
        });
      });
    });
    responseSummary = `${answeredCount} responses uploaded files for this question.`;
  } else if (question.type === "label") {
    responseSummary = "Informational label block. This item does not collect a response.";
  }

  const optionStats = sortOptionStats(optionCounts, answeredCount);
  const chartData = optionStats.map(({ label, value }) => ({ label, value }));
  const topResponse = optionStats[0]?.label || null;
  const averageValue =
    numericValues.length > 0
      ? numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length
      : null;
  const minValue =
    numericValues.length > 0 ? Math.min(...numericValues) : null;
  const maxValue =
    numericValues.length > 0 ? Math.max(...numericValues) : null;

  return {
    id: question.id,
    question: question.question,
    type: question.type,
    required: question.required,
    totalResponses,
    answeredCount,
    skippedCount,
    answerRate,
    chartType,
    chartData,
    topResponse,
    averageValue,
    minValue,
    maxValue,
    optionStats,
    rowSummaries,
    textInsights,
    responseSummary,
  };
}

export function buildCampaignReportData(
  responses: ExportResponseData[],
  campaignMetrics: CampaignExportMetric[],
  campaignBriefs: CampaignReportBrief[],
): CampaignReportData[] {
  const groupedResponses = new Map<string, ExportResponseData[]>();

  responses.forEach((response) => {
    const existing = groupedResponses.get(response.campaign_id) || [];
    existing.push(response);
    groupedResponses.set(response.campaign_id, existing);
  });

  const briefByCampaignId = new Map(
    campaignBriefs.map((brief) => [brief.campaignId, brief]),
  );
  return campaignMetrics.map((metric) => {
    const campaignResponses = groupedResponses.get(metric.campaign_id) || [];
    const orderedQuestions = normalizeCampaignSurvey(
      campaignResponses[0]?.campaign_questions || [],
    ).questions.filter((question) => question.type !== "label");

    return {
      campaignId: metric.campaign_id,
      companyId: metric.company_id,
      companyName: metric.company_name,
      campaignName: metric.campaign_name,
      responses: metric.responses,
      views: metric.views,
      responseRate: metric.response_rate,
      completionRate: metric.completion_rate,
      sentimentIndex:
        typeof metric.sentiment_index === "number" ? metric.sentiment_index : null,
      healthScore:
        typeof metric.health_score === "number" ? metric.health_score : null,
      risk: metric.risk || null,
      brief: briefByCampaignId.get(metric.campaign_id) || null,
      questionSummaries: orderedQuestions.map((question) =>
        buildQuestionSummary(question, campaignResponses),
      ),
      rawResponses: campaignResponses,
    };
  }).sort((a, b) => b.responses - a.responses || a.campaignName.localeCompare(b.campaignName));
}

export function buildMasterCsvColumns(responses: ExportResponseData[]): MasterCsvColumn[] {
  const columns = new Map<string, MasterCsvColumn>();

  responses.forEach((response) => {
    normalizeCampaignSurvey(response.campaign_questions || []).questions
      .filter((question) => question.type !== "label")
      .forEach((question) => {
        const baseKey = `${response.campaign_id}::${question.id}`;
        const baseLabel = `${response.campaign_name} | ${question.question}`;
        if (!columns.has(baseKey)) {
          columns.set(baseKey, {
            key: baseKey,
            label: baseLabel,
          });
        }

        if (findOtherOptionLabel(question.options)) {
          const otherKey = `${baseKey}::__other`;
          if (!columns.has(otherKey)) {
            columns.set(otherKey, {
              key: otherKey,
              label: `${baseLabel} | Other Details`,
            });
          }
        }
      });
  });

  return [...columns.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function buildMasterCsvRows(
  responses: ExportResponseData[],
  columns: MasterCsvColumn[],
) {
  return responses.map((response) => {
    const row: Record<string, string> = {
      company: response.company_name,
      campaign: response.campaign_name,
      response_id: response.id,
      submitted_at: formatDateTime(response.created_at),
      satisfaction:
        response.satisfaction_value !== null
          ? `${response.satisfaction_value}/${response.satisfaction_max}`
          : "",
      service_quality:
        response.quality_value !== null
          ? `${response.quality_value}/${response.quality_max}`
          : "",
      recommendation: response.recommendation_text,
      improvement_areas: response.improvement_areas.join(" | "),
      additional_comments: response.additional_comments || "",
    };

    const questionById = new Map(
      normalizeCampaignSurvey(response.campaign_questions || []).questions.map((question) => [
        question.id,
        question,
      ]),
    );

    columns.forEach((column) => {
      if (!column.key.startsWith(`${response.campaign_id}::`)) {
        row[column.key] = "";
        return;
      }

      const questionKey = column.key.replace(`${response.campaign_id}::`, "");
      if (questionKey.endsWith("::__other")) {
        const rawQuestionId = questionKey.replace(/::__other$/, "");
        row[column.key] = cleanText(getOtherAnswerText(response.answers, rawQuestionId));
        return;
      }

      const question = questionById.get(questionKey);
      row[column.key] = question
        ? formatQuestionAnswer(question, response.answers)
        : "";
    });

    return row;
  });
}

export function buildMasterCsvContent(responses: ExportResponseData[]) {
  const columns = buildMasterCsvColumns(responses);
  const baseHeaders = [
    { key: "company", label: "Company" },
    { key: "campaign", label: "Campaign" },
    { key: "response_id", label: "Response ID" },
    { key: "submitted_at", label: "Submitted At" },
    { key: "satisfaction", label: "Satisfaction" },
    { key: "service_quality", label: "Service Quality" },
    { key: "recommendation", label: "Recommendation" },
    { key: "improvement_areas", label: "Improvement Areas" },
    { key: "additional_comments", label: "Additional Comments" },
  ];
  const allHeaders = [...baseHeaders, ...columns];
  const rows = buildMasterCsvRows(responses, columns);

  const csv = [
    allHeaders.map((header) => header.label),
    ...rows.map((row) => allHeaders.map((header) => row[header.key] || "")),
  ]
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell ?? "");
          if (/[",\n]/.test(value)) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        })
        .join(","),
    )
    .join("\n");

  return { csv, columns: allHeaders };
}

export function buildQuestionInfographicSummaries(
  responses: ExportResponseData[],
): ReportQuestionSummary[] {
  if (responses.length === 0) return [];

  const orderedQuestions = normalizeCampaignSurvey(
    responses[0].campaign_questions || [],
  ).questions.filter((question) => question.type !== "label");

  return orderedQuestions.map((question) => buildQuestionSummary(question, responses));
}

export function formatQuestionInsightLine(question: ReportQuestionSummary) {
  const segments = [
    `${question.answeredCount}/${question.totalResponses} answered (${question.answerRate.toFixed(1)}%)`,
  ];

  if (question.averageValue !== null) {
    segments.push(`Average ${question.averageValue.toFixed(1)}`);
  }

  if (question.topResponse) {
    segments.push(`Top response: ${question.topResponse}`);
  }

  return segments.join(" | ");
}
