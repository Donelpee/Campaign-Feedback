import {
  buildCampaignReportData,
  buildMasterCsvColumns,
  buildMasterCsvRows,
  type AdvancedExportInsights,
  type CampaignExportMetric,
  type CampaignReportBrief,
  type ExportResponseData,
} from "./reporting-exports";

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
    fgColor: { argb: "FF1D4ED8" },
  };
  cell.alignment = { vertical: "middle", horizontal: "center" };
}

function styleSection(cell: ExcelJS.Cell) {
  cell.font = { bold: true, size: 13, color: { argb: "FF0F172A" } };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFDCEAFE" },
  };
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatNumber(value: number | null, decimals = 1) {
  return value === null ? "n/a" : value.toFixed(decimals);
}

export async function exportToExcel(
  responses: ExportResponseData[],
  campaignMetrics: CampaignExportMetric[],
  campaignBriefs: CampaignReportBrief[],
  insights: AdvancedExportInsights,
  filename: string,
) {
  const [
    { default: ExcelJS },
    { generateBarChart, generatePieChart },
  ] = await Promise.all([import("exceljs"), import("./chart-image-generator")]);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Nkowa";
  workbook.created = new Date();

  const campaignReports = buildCampaignReportData(
    responses,
    campaignMetrics,
    campaignBriefs,
  );
  const totalResponses = responses.length;
  const totalViews = campaignMetrics.reduce((sum, item) => sum + item.views, 0);
  const overallRate = totalViews > 0 ? (totalResponses / totalViews) * 100 : 0;
  const avgCompletion =
    campaignReports.length > 0
      ? campaignReports.reduce((sum, campaign) => sum + campaign.completionRate, 0) /
        campaignReports.length
      : 0;

  const summary = workbook.addWorksheet("Summary");
  summary.columns = new Array(6).fill(null).map(() => ({ width: 20 }));
  summary.mergeCells("A1:F1");
  summary.getCell("A1").value = "Feedback Intelligence Report";
  summary.getCell("A1").font = { size: 22, bold: true, color: { argb: "FF0F172A" } };
  summary.getCell("A2").value = `Generated ${new Date().toLocaleString()}`;
  summary.getCell("A2").font = { size: 10, color: { argb: "FF64748B" } };

  [
    ["Responses", totalResponses],
    ["Views", totalViews],
    ["Response Rate", formatPercent(overallRate)],
    ["Completion", formatPercent(avgCompletion)],
    ["Sentiment", formatNumber(insights.sentiment.scoreIndex)],
    ["Forecast 7D", Math.round(insights.forecast.next7Responses)],
  ].forEach(([label, value], index) => {
    const col = String.fromCharCode("A".charCodeAt(0) + index);
    summary.getCell(`${col}4`).value = label;
    summary.getCell(`${col}4`).font = { bold: true, size: 10, color: { argb: "FF475569" } };
    summary.getCell(`${col}5`).value = value;
    summary.getCell(`${col}5`).font = { bold: true, size: 17, color: { argb: "FF0F172A" } };
  });

  summary.getCell("A8").value = "Signals";
  styleSection(summary.getCell("A8"));
  summary.getCell("A9").value = "Benchmark Gap";
  summary.getCell("B9").value = insights.benchmark
    ? formatPercent(insights.benchmark.gapPercent)
    : "n/a";
  summary.getCell("C9").value = "7D Delta";
  summary.getCell("D9").value = formatPercent(insights.periodDelta.deltaPercent);
  summary.getCell("E9").value = "Daily Average";
  summary.getCell("F9").value = insights.forecast.dailyAverage.toFixed(1);

  const responseChart = generateBarChart(
    campaignReports.map((campaign) => ({
      label: campaign.campaignName,
      value: campaign.responses,
    })),
    "Responses by Campaign",
    760,
    340,
  );
  addChartImage(workbook, summary, responseChart, 0, 10, 540, 250);

  const rateChart = generateBarChart(
    campaignReports.map((campaign) => ({
      label: campaign.campaignName,
      value: Number(campaign.responseRate.toFixed(1)),
    })),
    "Response Rate by Campaign",
    760,
    340,
  );
  addChartImage(workbook, summary, rateChart, 3.1, 10, 540, 250);

  const sentimentParts = [
    { label: "Positive", value: insights.sentiment.positive },
    { label: "Neutral", value: insights.sentiment.neutral },
    { label: "Negative", value: insights.sentiment.negative },
  ].filter((item) => item.value > 0);
  if (sentimentParts.length > 0) {
    const sentimentChart = generatePieChart(sentimentParts, "Sentiment Mix", 760, 340);
    addChartImage(workbook, summary, sentimentChart, 0, 24, 540, 250);
  }

  const overview = workbook.addWorksheet("Campaign Overview");
  overview.columns = [
    { header: "Company", key: "company", width: 24 },
    { header: "Campaign", key: "campaign", width: 28 },
    { header: "Responses", key: "responses", width: 12 },
    { header: "Views", key: "views", width: 12 },
    { header: "Response Rate", key: "responseRate", width: 14 },
    { header: "Completion", key: "completion", width: 14 },
    { header: "Sentiment", key: "sentiment", width: 12 },
    { header: "Health", key: "health", width: 12 },
    { header: "Risk", key: "risk", width: 12 },
  ];
  overview.getRow(1).eachCell(styleHeader);
  campaignReports.forEach((campaign) => {
    overview.addRow({
      company: campaign.companyName,
      campaign: campaign.campaignName,
      responses: campaign.responses,
      views: campaign.views,
      responseRate: formatPercent(campaign.responseRate),
      completion: formatPercent(campaign.completionRate),
      sentiment: formatNumber(campaign.sentimentIndex),
      health: formatNumber(campaign.healthScore),
      risk: campaign.risk || "n/a",
    });
  });

  const questionSummary = workbook.addWorksheet("Question Summary");
  questionSummary.columns = [
    { header: "Company", key: "company", width: 22 },
    { header: "Campaign", key: "campaign", width: 24 },
    { header: "Question", key: "question", width: 42 },
    { header: "Type", key: "type", width: 16 },
    { header: "Answered", key: "answered", width: 12 },
    { header: "Skipped", key: "skipped", width: 12 },
    { header: "Answer Rate", key: "answerRate", width: 14 },
    { header: "Average", key: "average", width: 12 },
    { header: "Minimum", key: "minimum", width: 12 },
    { header: "Maximum", key: "maximum", width: 12 },
    { header: "Top Response", key: "topResponse", width: 28 },
    { header: "Insight", key: "insight", width: 54 },
  ];
  questionSummary.getRow(1).eachCell(styleHeader);
  campaignReports.forEach((campaign) => {
    campaign.questionSummaries.forEach((question) => {
      questionSummary.addRow({
        company: campaign.companyName,
        campaign: campaign.campaignName,
        question: question.question,
        type: question.type.replace(/_/g, " "),
        answered: question.answeredCount,
        skipped: question.skippedCount,
        answerRate: formatPercent(question.answerRate),
        average: formatNumber(question.averageValue),
        minimum: formatNumber(question.minValue),
        maximum: formatNumber(question.maxValue),
        topResponse: question.topResponse || "",
        insight: question.responseSummary,
      });
    });
  });
  questionSummary.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.eachCell((cell) => {
      cell.alignment = { wrapText: true, vertical: "top" };
    });
  });

  const questionResults = workbook.addWorksheet("Question Results");
  questionResults.columns = [
    { header: "Company", key: "company", width: 22 },
    { header: "Campaign", key: "campaign", width: 24 },
    { header: "Question", key: "question", width: 42 },
    { header: "Type", key: "type", width: 16 },
    { header: "Result Group", key: "group", width: 18 },
    { header: "Result Label", key: "label", width: 30 },
    { header: "Count", key: "count", width: 10 },
    { header: "Percent", key: "percent", width: 12 },
    { header: "Detail", key: "detail", width: 54 },
  ];
  questionResults.getRow(1).eachCell(styleHeader);

  campaignReports.forEach((campaign) => {
    campaign.questionSummaries.forEach((question) => {
      if (question.optionStats.length === 0 && question.rowSummaries.length === 0 && question.textInsights.length === 0) {
        questionResults.addRow({
          company: campaign.companyName,
          campaign: campaign.campaignName,
          question: question.question,
          type: question.type.replace(/_/g, " "),
          group: "Summary",
          label: "No detailed result values recorded",
          count: "",
          percent: "",
          detail: question.responseSummary,
        });
      }

      question.optionStats.forEach((option) => {
        questionResults.addRow({
          company: campaign.companyName,
          campaign: campaign.campaignName,
          question: question.question,
          type: question.type.replace(/_/g, " "),
          group: "Option",
          label: option.label,
          count: option.value,
          percent: formatPercent(option.percentage),
          detail: "",
        });
      });

      question.rowSummaries.forEach((rowSummary) => {
        rowSummary.options.forEach((option) => {
          questionResults.addRow({
            company: campaign.companyName,
            campaign: campaign.campaignName,
            question: question.question,
            type: question.type.replace(/_/g, " "),
            group: rowSummary.rowLabel,
            label: option.label,
            count: option.value,
            percent: formatPercent(option.percentage),
            detail: "",
          });
        });
      });

      question.textInsights.forEach((insight) => {
        questionResults.addRow({
          company: campaign.companyName,
          campaign: campaign.campaignName,
          question: question.question,
          type: question.type.replace(/_/g, " "),
          group: insight.type.replace(/_/g, " "),
          label: "",
          count: "",
          percent: "",
          detail: insight.value,
        });
      });
    });
  });
  questionResults.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.eachCell((cell) => {
      cell.alignment = { wrapText: true, vertical: "top" };
    });
  });

  const rawSheet = workbook.addWorksheet("Master Responses");
  const csvColumns = buildMasterCsvColumns(responses);
  const masterRows = buildMasterCsvRows(responses, csvColumns);
  rawSheet.columns = [
    { header: "Company", key: "company", width: 24 },
    { header: "Campaign", key: "campaign", width: 28 },
    { header: "Response ID", key: "response_id", width: 20 },
    { header: "Submitted At", key: "submitted_at", width: 22 },
    { header: "Satisfaction", key: "satisfaction", width: 14 },
    { header: "Service Quality", key: "service_quality", width: 16 },
    { header: "Recommendation", key: "recommendation", width: 16 },
    { header: "Improvement Areas", key: "improvement_areas", width: 28 },
    { header: "Additional Comments", key: "additional_comments", width: 34 },
    ...csvColumns.map((column) => ({
      header: column.label,
      key: column.key,
      width: 28,
    })),
  ];
  rawSheet.getRow(1).eachCell(styleHeader);
  masterRows.forEach((rowData) => {
    const row = rawSheet.addRow(rowData);
    row.eachCell((cell) => {
      cell.alignment = { wrapText: true, vertical: "top" };
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
