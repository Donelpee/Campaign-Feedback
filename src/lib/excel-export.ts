import type {
  CampaignBriefMetricInput,
  CampaignReportBrief,
} from "./campaign-report-briefs";
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

export type CampaignExportMetric = CampaignBriefMetricInput;

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

function addChartImage(
  workbook: ExcelJS.Workbook,
  sheet: ExcelJS.Worksheet,
  base64: string,
  col: number,
  row: number,
  width: number,
  height: number,
) {
  const imageId = workbook.addImage({ base64, extension: "png" });
  sheet.addImage(imageId, { tl: { col, row }, ext: { width, height } });
}

function styleHeader(cell: ExcelJS.Cell) {
  cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E3A8A" },
  };
}

function toNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function hasAnswer(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

function createUniqueSheetName(name: string, usedNames: Set<string>): string {
  const sanitized = name.replace(/[*?:/\\[\]]/g, "").trim() || "Campaign";
  const maxLength = 31;
  let candidate = sanitized.slice(0, maxLength);
  let counter = 1;

  while (usedNames.has(candidate)) {
    const suffix = ` ${counter}`;
    candidate = sanitized.slice(0, Math.max(1, maxLength - suffix.length)) + suffix;
    counter += 1;
  }

  usedNames.add(candidate);
  return candidate;
}

export async function exportToExcel(
  responses: ExportResponseData[],
  campaignMetrics: CampaignExportMetric[],
  campaignBriefs: CampaignReportBrief[],
  insights: AdvancedExportInsights,
  filename: string,
) {
  const [{ default: ExcelJS }, { generateBarChart, generatePieChart }] =
    await Promise.all([import("exceljs"), import("./chart-image-generator")]);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Nkọwa";
  workbook.created = new Date();
  const usedSheetNames = new Set<string>();
  const campaignNameCounts = new Map<string, number>();

  campaignMetrics.forEach((metric) => {
    campaignNameCounts.set(
      metric.campaign_name,
      (campaignNameCounts.get(metric.campaign_name) || 0) + 1,
    );
  });

  const getCampaignLabel = (metric: {
    campaign_name: string;
    company_name: string;
  }) =>
    (campaignNameCounts.get(metric.campaign_name) || 0) > 1
      ? `${metric.company_name} - ${metric.campaign_name}`
      : metric.campaign_name;

  const briefByCampaignId = new Map(
    campaignBriefs.map((brief) => [brief.campaignId, brief]),
  );

  const summary = workbook.addWorksheet("Summary");
  usedSheetNames.add("Summary");
  summary.columns = [{ width: 26 }, { width: 26 }, { width: 26 }, { width: 26 }];

  summary.mergeCells("A1:D1");
  summary.getCell("A1").value = "Campaign Analytics Export";
  summary.getCell("A1").font = { size: 20, bold: true, color: { argb: "FF1E3A8A" } };
  summary.getCell("A1").alignment = { horizontal: "center" };

  const totalResponses = responses.length;
  const totalViews = campaignMetrics.reduce((sum, item) => sum + item.views, 0);
  const overallRate = totalViews > 0 ? (totalResponses / totalViews) * 100 : 0;
  const avgCompletion =
    campaignMetrics.length > 0
      ? campaignMetrics.reduce((sum, item) => sum + item.completion_rate, 0) /
        campaignMetrics.length
      : 0;

  summary.getCell("A3").value = "Total Responses";
  summary.getCell("B3").value = totalResponses;
  summary.getCell("A4").value = "Total Views";
  summary.getCell("B4").value = totalViews;
  summary.getCell("A5").value = "Response Rate";
  summary.getCell("B5").value = `${overallRate.toFixed(1)}%`;
  summary.getCell("A6").value = "Avg Completion";
  summary.getCell("B6").value = `${avgCompletion.toFixed(1)}%`;
  summary.getCell("A7").value = "7D Response Delta";
  summary.getCell("B7").value = `${insights.periodDelta.deltaPercent.toFixed(1)}%`;
  summary.getCell("A8").value = "Sentiment Index";
  summary.getCell("B8").value = `${insights.sentiment.scoreIndex.toFixed(1)}`;
  summary.getCell("A9").value = "Benchmark Gap";
  summary.getCell("B9").value = insights.benchmark
    ? `${insights.benchmark.gapPercent.toFixed(1)}%`
    : "N/A";
  summary.getCell("A10").value = "Forecast (Next 7 Days)";
  summary.getCell("B10").value = `${insights.forecast.next7Responses.toFixed(0)}`;
  summary.getCell("A11").value = "Forecast Daily Avg";
  summary.getCell("B11").value = `${insights.forecast.dailyAverage.toFixed(1)}`;

  const campaignResponseChart = generateBarChart(
    campaignMetrics.map((m) => ({ label: getCampaignLabel(m), value: m.responses })),
    "Responses by Campaign",
  );
  addChartImage(workbook, summary, campaignResponseChart, 0, 11, 520, 300);

  const campaignRateChart = generateBarChart(
    campaignMetrics.map((m) => ({
      label: getCampaignLabel(m),
      value: Number(m.response_rate.toFixed(2)),
    })),
    "Response Rate by Campaign (%)",
  );
  addChartImage(workbook, summary, campaignRateChart, 2.6, 11, 520, 300);

  const sentimentTotal =
    insights.sentiment.positive + insights.sentiment.neutral + insights.sentiment.negative;
  if (sentimentTotal > 0) {
    const sentimentChart = generatePieChart(
      [
        { label: "Positive", value: insights.sentiment.positive },
        { label: "Neutral", value: insights.sentiment.neutral },
        { label: "Negative", value: insights.sentiment.negative },
      ].filter((item) => item.value > 0),
      "Sentiment Mix",
    );
    addChartImage(workbook, summary, sentimentChart, 0, 28, 520, 280);
  }

  let tableRow = 45;
  summary.getCell(`A${tableRow}`).value = "Campaign Health Scorecard";
  summary.getCell(`A${tableRow}`).font = { bold: true, size: 12, color: { argb: "FF1E3A8A" } };
  tableRow += 1;
  const healthHeaders = [
    "Campaign",
    "Response Rate %",
    "Completion %",
    "Sentiment",
    "Health",
    "Risk",
  ];
  const healthHeaderRow = summary.addRow(healthHeaders);
  healthHeaderRow.eachCell(styleHeader);
  insights.campaignHealth.forEach((row) => {
    summary.addRow([
      row.campaignName,
      row.responseRate.toFixed(1),
      row.completionRate.toFixed(1),
      row.sentimentIndex.toFixed(1),
      row.healthScore.toFixed(1),
      row.risk,
    ]);
  });

  const recommendationStart = summary.rowCount + 2;
  summary.getCell(`A${recommendationStart}`).value = "Prioritized Recommendations";
  summary.getCell(`A${recommendationStart}`).font = {
    bold: true,
    size: 12,
    color: { argb: "FF1E3A8A" },
  };
  summary.getCell(`A${recommendationStart + 1}`).value = "Recommendation";
  styleHeader(summary.getCell(`A${recommendationStart + 1}`));
  insights.recommendations.forEach((item) => {
    summary.addRow([item]);
  });

  const briefsSheet = workbook.addWorksheet("AI Briefs");
  usedSheetNames.add("AI Briefs");
  briefsSheet.columns = [
    { width: 28 },
    { width: 28 },
    { width: 16 },
    { width: 60 },
    { width: 60 },
  ];
  briefsSheet.mergeCells("A1:E1");
  briefsSheet.getCell("A1").value = "Campaign AI Summaries And Recommendations";
  briefsSheet.getCell("A1").font = {
    size: 18,
    bold: true,
    color: { argb: "FF1E3A8A" },
  };
  ["A3", "B3", "C3", "D3", "E3"].forEach((cellRef, index) => {
    briefsSheet.getCell(cellRef).value = [
      "Company",
      "Campaign",
      "Source",
      "Summary",
      "Recommendations",
    ][index];
    styleHeader(briefsSheet.getCell(cellRef));
  });

  if (campaignBriefs.length === 0) {
    const row = briefsSheet.addRow([
      "",
      "",
      "",
      "No campaign brief was generated for this export.",
      "",
    ]);
    row.eachCell((cell) => {
      cell.alignment = { wrapText: true, vertical: "top" };
    });
  } else {
    campaignBriefs.forEach((brief) => {
      const row = briefsSheet.addRow([
        brief.companyName,
        brief.campaignName,
        brief.source.toUpperCase(),
        brief.summary,
        brief.recommendations.map((item, index) => `${index + 1}. ${item}`).join("\n"),
      ]);
      row.height = 90;
      row.eachCell((cell) => {
        cell.alignment = { wrapText: true, vertical: "top" };
      });
    });
  }

  const raw = workbook.addWorksheet("Raw Responses");
  usedSheetNames.add("Raw Responses");
  const headers = [
    "Company",
    "Campaign",
    "Satisfaction",
    "Quality",
    "Recommendation",
    "Improvement Areas",
    "Comments",
    "Date",
  ];
  const headerRow = raw.addRow(headers);
  headerRow.eachCell(styleHeader);
  raw.columns = headers.map(() => ({ width: 24 }));

  responses.forEach((r) => {
    raw.addRow([
      r.company_name,
      r.campaign_name,
      r.satisfaction_value !== null
        ? `${r.satisfaction_value}/${r.satisfaction_max}`
        : "",
      r.quality_value !== null ? `${r.quality_value}/${r.quality_max}` : "",
      r.recommendation_text,
      r.improvement_areas.join(", "),
      r.additional_comments || "",
      new Date(r.created_at).toLocaleString(),
    ]);
  });

  const campaignIds = [...new Set(responses.map((r) => r.campaign_id))];
  campaignIds.forEach((campaignId) => {
    const campaignResponses = responses.filter((r) => r.campaign_id === campaignId);
    if (campaignResponses.length === 0) return;

    const campaignMeta = campaignResponses[0];
    const metric = campaignMetrics.find((item) => item.campaign_id === campaignId);
    const brief = briefByCampaignId.get(campaignId);
    const displayLabel = metric
      ? getCampaignLabel(metric)
      : `${campaignMeta.company_name} - ${campaignMeta.campaign_name}`;
    const sheet = workbook.addWorksheet(
      createUniqueSheetName(displayLabel, usedSheetNames),
    );
    sheet.columns = [{ width: 30 }, { width: 25 }, { width: 25 }, { width: 25 }];
    sheet.mergeCells("A1:D1");
    sheet.getCell("A1").value = `Campaign: ${displayLabel}`;
    sheet.getCell("A1").font = { size: 18, bold: true, color: { argb: "FF1E3A8A" } };

    sheet.getCell("A2").value = "Company";
    sheet.getCell("B2").value = campaignMeta.company_name;
    sheet.getCell("A3").value = "Responses";
    sheet.getCell("B3").value = metric?.responses || campaignResponses.length;
    sheet.getCell("A4").value = "Views";
    sheet.getCell("B4").value = metric?.views || 0;
    sheet.getCell("A5").value = "Response Rate";
    sheet.getCell("B5").value = `${(metric?.response_rate || 0).toFixed(1)}%`;
    sheet.getCell("A6").value = "Completion Rate";
    sheet.getCell("B6").value = `${(metric?.completion_rate || 0).toFixed(1)}%`;
    sheet.getCell("A7").value = "Brief Source";
    sheet.getCell("B7").value = brief ? brief.source.toUpperCase() : "N/A";

    sheet.getCell("A9").value = "AI Summary";
    sheet.getCell("A9").font = { bold: true, size: 12, color: { argb: "FF1E3A8A" } };
    sheet.mergeCells("A10:D12");
    sheet.getCell("A10").value =
      brief?.summary || "No campaign summary was available for this export.";
    sheet.getCell("A10").alignment = { wrapText: true, vertical: "top" };

    sheet.getCell("A14").value = "Recommended Actions";
    sheet.getCell("A14").font = { bold: true, size: 12, color: { argb: "FF1E3A8A" } };
    const recommendationRows =
      brief?.recommendations.length && brief.recommendations.length > 0
        ? brief.recommendations
        : ["No recommendations were generated for this campaign."];
    recommendationRows.forEach((item, index) => {
      const rowNumber = 15 + index;
      sheet.mergeCells(`A${rowNumber}:D${rowNumber}`);
      sheet.getCell(`A${rowNumber}`).value = `${index + 1}. ${item}`;
      sheet.getCell(`A${rowNumber}`).alignment = { wrapText: true, vertical: "top" };
    });

    const questionDefs = normalizeCampaignSurvey(
      campaignResponses[0].campaign_questions || [],
    ).questions;
    let rowCursor = 18 + recommendationRows.length;
    questionDefs.forEach((question) => {
      const values = campaignResponses.map((response) => response.answers[question.id]);
      const answered = values.filter((v) => hasAnswer(v));
      sheet.getCell(`A${rowCursor}`).value = question.question;
      sheet.getCell(`A${rowCursor}`).font = { bold: true };
      rowCursor += 1;

      if (question.type === "text") {
        const samples = answered
          .map((v) => String(v).trim())
          .filter((v) => v.length > 0)
          .slice(0, 5);
        samples.forEach((sample) => {
          sheet.getCell(`A${rowCursor}`).value = sample;
          rowCursor += 1;
        });
        if (samples.length === 0) {
          sheet.getCell(`A${rowCursor}`).value = "No text samples";
          rowCursor += 1;
        }
        rowCursor += 1;
        return;
      }

      const dist = new Map<string, number>();
      if (question.type === "multiple_choice") {
        answered.forEach((v) => {
          if (!Array.isArray(v)) return;
          v.forEach((item) => {
            const key = String(item);
            dist.set(key, (dist.get(key) || 0) + 1);
          });
        });
      } else if (question.type === "checkbox_matrix") {
        answered.forEach((v) => {
          if (!v || typeof v !== "object" || Array.isArray(v)) return;
          Object.values(v as Record<string, unknown>).forEach((rowValue) => {
            if (!Array.isArray(rowValue)) return;
            rowValue.forEach((item) => {
              const key = String(item);
              dist.set(key, (dist.get(key) || 0) + 1);
            });
          });
        });
      } else if (question.type === "radio_matrix") {
        answered.forEach((v) => {
          if (!v || typeof v !== "object" || Array.isArray(v)) return;
          Object.values(v as Record<string, unknown>).forEach((rowValue) => {
            const key = String(rowValue);
            if (!key.trim()) return;
            dist.set(key, (dist.get(key) || 0) + 1);
          });
        });
      } else if (question.type === "rank") {
        answered.forEach((v) => {
          if (!Array.isArray(v)) return;
          v.forEach((item) => {
            const key = String(item);
            if (!key.trim()) return;
            dist.set(key, (dist.get(key) || 0) + 1);
          });
        });
      } else {
        answered.forEach((v) => {
          const num = toNumber(v);
          const key = num !== null ? String(Math.round(num)) : String(v);
          dist.set(key, (dist.get(key) || 0) + 1);
        });
      }

      const chartData = Array.from(dist.entries()).map(([label, value]) => ({
        label,
        value,
      }));
      if (chartData.length > 0) {
        const chart =
          question.type === "single_choice" ||
          question.type === "multiple_choice" ||
          question.type === "combobox" ||
          question.type === "checkbox_matrix" ||
          question.type === "radio_matrix"
            ? generatePieChart(chartData, question.question.substring(0, 45))
            : generateBarChart(chartData, question.question.substring(0, 45));
        addChartImage(workbook, sheet, chart, 0, rowCursor / 1.4, 520, 260);
        rowCursor += 12;
      } else {
        sheet.getCell(`A${rowCursor}`).value = "No data for this question";
        rowCursor += 2;
      }
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
