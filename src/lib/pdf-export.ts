import {
  buildCampaignReportData,
  type AdvancedExportInsights,
  type CampaignExportMetric,
  type CampaignReportBrief,
  type ExportResponseData,
  type ReportQuestionSummary,
} from "./reporting-exports";

let chartHelpers: typeof import("./chart-image-generator");

function getQuestionAccent(
  question: ReportQuestionSummary,
): {
  header: [number, number, number];
  panel: [number, number, number];
} {
  if (question.chartType === "pie") {
    return { header: [124, 58, 237], panel: [245, 243, 255] };
  }

  if (question.chartType === "bar") {
    return { header: [14, 116, 144], panel: [236, 254, 255] };
  }

  if (question.textInsights.length > 0) {
    return { header: [217, 119, 6], panel: [255, 251, 235] };
  }

  return { header: [29, 78, 216], panel: [239, 246, 255] };
}

function addWrappedText(
  doc: import("jspdf").jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight = 14,
) {
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y, { baseline: "top" });
  return y + lines.length * lineHeight;
}

function addPageBackground(
  doc: import("jspdf").jsPDF,
  fill: [number, number, number],
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFillColor(...fill);
  doc.rect(0, 0, pageWidth, pageHeight, "F");
}

function renderQuestionChart(
  question: ReportQuestionSummary,
) {
  if (question.chartData.length === 0 || question.chartType === "none") {
    return null;
  }

  if (question.chartType === "pie") {
    return chartHelpers.generatePieChart(
      question.chartData,
      question.question.slice(0, 55),
      760,
      320,
    );
  }

  return chartHelpers.generateBarChart(
    question.chartData,
    question.question.slice(0, 55),
    760,
    320,
  );
}

function addQuestionSection(
  doc: import("jspdf").jsPDF,
  autoTable: typeof import("jspdf-autotable").default,
  question: ReportQuestionSummary,
  campaignName: string,
  companyName: string,
) {
  const margin = 42;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - margin * 2;
  const accent = getQuestionAccent(question);

  doc.addPage();
  addPageBackground(doc, [248, 250, 252]);
  doc.setFillColor(...accent.panel);
  doc.roundedRect(margin, 28, contentWidth, 110, 18, 18, "F");
  doc.setFillColor(...accent.header);
  doc.roundedRect(margin, 28, contentWidth, 34, 18, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(campaignName, margin + 18, 49);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(companyName, margin + 18, 79);

  doc.setTextColor(...accent.header);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(
    `${question.type.replace(/_/g, " ")} | ${question.answeredCount}/${question.totalResponses} answered`,
    margin + 18,
    100,
  );

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  let currentY = addWrappedText(doc, question.question, margin + 18, 112, contentWidth - 36, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  currentY = addWrappedText(
    doc,
    `${question.responseSummary}${question.topResponse ? ` Top response: ${question.topResponse}.` : ""}${question.averageValue !== null ? ` Average: ${question.averageValue.toFixed(1)}.` : ""}`,
    margin + 18,
    currentY + 8,
    contentWidth - 36,
    14,
  );

  const chartImage = renderQuestionChart(question);
  if (chartImage) {
    doc.addImage(`data:image/png;base64,${chartImage}`, "PNG", margin, currentY + 12, contentWidth, 190);
    currentY += 214;
  } else {
    currentY += 10;
  }

  if (question.optionStats.length > 0) {
    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [["Option", "Count", "Percent"]],
      body: question.optionStats.map((option) => [
        option.label,
        option.value,
        `${option.percentage.toFixed(1)}%`,
      ]),
      styles: {
        fontSize: 9,
        cellPadding: 5,
        lineColor: [226, 232, 240],
        lineWidth: 0.4,
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });
  }

  let finalY =
    ((doc as import("jspdf").jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable
      ?.finalY || currentY) + 14;

  question.rowSummaries.forEach((rowSummary) => {
    autoTable(doc, {
      startY: finalY,
      margin: { left: margin, right: margin },
      head: [[`${rowSummary.rowLabel} Option`, "Count", "Percent"]],
      body: rowSummary.options.map((option) => [
        option.label,
        option.value,
        `${option.percentage.toFixed(1)}%`,
      ]),
      styles: {
        fontSize: 9,
        cellPadding: 5,
        lineColor: [226, 232, 240],
        lineWidth: 0.4,
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: [14, 116, 144],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });

    finalY =
      ((doc as import("jspdf").jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable
        ?.finalY || finalY) + 14;
  });

  if (question.textInsights.length > 0) {
    autoTable(doc, {
      startY: finalY,
      margin: { left: margin, right: margin },
      head: [["Detail Type", "Response Detail", "Submitted"]],
      body: question.textInsights.map((insight) => [
        insight.type.replace(/_/g, " "),
        insight.value,
        new Date(insight.createdAt).toLocaleDateString(),
      ]),
      styles: {
        fontSize: 8.5,
        cellPadding: 5,
        lineColor: [226, 232, 240],
        lineWidth: 0.4,
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: [71, 85, 105],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });
  }
}

export async function exportToPdf(
  responses: ExportResponseData[],
  campaignMetrics: CampaignExportMetric[],
  campaignBriefs: CampaignReportBrief[],
  insights: AdvancedExportInsights,
  filename: string,
) {
  const [{ jsPDF }, { default: autoTable }, chartModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    import("./chart-image-generator"),
  ]);
  chartHelpers = chartModule;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 42;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - margin * 2;
  const campaignReports = buildCampaignReportData(
    responses,
    campaignMetrics,
    campaignBriefs,
  );
  const totalResponses = responses.length;
  const totalViews = campaignMetrics.reduce((sum, metric) => sum + metric.views, 0);
  const overallRate = totalViews > 0 ? (totalResponses / totalViews) * 100 : 0;
  const avgCompletion =
    campaignReports.length > 0
      ? campaignReports.reduce((sum, campaign) => sum + campaign.completionRate, 0) /
        campaignReports.length
      : 0;

  addPageBackground(doc, [226, 238, 255]);
  doc.setFillColor(29, 78, 216);
  doc.roundedRect(margin, 34, contentWidth, 120, 18, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text("Feedback Intelligence Report", margin + 24, 78);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text("Objective response summary for stakeholders and analysts", margin + 24, 104);
  doc.text(`Generated ${new Date().toLocaleString()}`, margin + 24, 124);

  const cardWidth = (contentWidth - 24) / 3;
  [
    { title: "Responses", value: String(totalResponses) },
    { title: "Response Rate", value: `${overallRate.toFixed(1)}%` },
    { title: "Completion", value: `${avgCompletion.toFixed(1)}%` },
  ].forEach((card, index) => {
    const x = margin + index * (cardWidth + 12);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(191, 219, 254);
    doc.roundedRect(x, 186, cardWidth, 82, 14, 14, "FD");
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(10);
    doc.text(card.title, x + 16, 210);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(card.value, x + 16, 240);
  });

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Executive Summary", margin, 304);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  addWrappedText(
    doc,
    `This report covers ${campaignReports.length} campaign(s), ${totalResponses} completed submissions, ${totalViews} tracked views, a ${overallRate.toFixed(1)}% response rate, and an overall completion rate of ${avgCompletion.toFixed(1)}%. Sentiment index is ${insights.sentiment.scoreIndex.toFixed(1)}, while the 7-day response trend moved ${insights.periodDelta.deltaPercent.toFixed(1)}%.`,
    margin,
    320,
    contentWidth,
    16,
  );

  doc.addPage();
  addPageBackground(doc, [248, 250, 252]);
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Campaign Overview", margin, 52);
  autoTable(doc, {
    startY: 72,
    margin: { left: margin, right: margin },
    head: [[
      "Company",
      "Campaign",
      "Responses",
      "Views",
      "Resp. Rate",
      "Completion",
      "Sentiment",
      "Health",
      "Risk",
    ]],
    body: campaignReports.map((campaign) => [
      campaign.companyName,
      campaign.campaignName,
      campaign.responses,
      campaign.views,
      `${campaign.responseRate.toFixed(1)}%`,
      `${campaign.completionRate.toFixed(1)}%`,
      campaign.sentimentIndex === null ? "n/a" : campaign.sentimentIndex.toFixed(1),
      campaign.healthScore === null ? "n/a" : campaign.healthScore.toFixed(1),
      campaign.risk || "n/a",
    ]),
    styles: {
      fontSize: 8.5,
      cellPadding: 5,
      lineColor: [226, 232, 240],
      lineWidth: 0.4,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  campaignReports.forEach((campaign) => {
    doc.addPage();
    addPageBackground(doc, [239, 246, 255]);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin, 34, contentWidth, 180, 20, 20, "F");
    doc.setTextColor(29, 78, 216);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text(campaign.campaignName, margin + 24, 70);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(71, 85, 105);
    doc.text(campaign.companyName, margin + 24, 92);

    const metricCardWidth = (contentWidth - 36) / 4;
    [
      { title: "Responses", value: String(campaign.responses) },
      { title: "Views", value: String(campaign.views) },
      { title: "Resp. Rate", value: `${campaign.responseRate.toFixed(1)}%` },
      { title: "Completion", value: `${campaign.completionRate.toFixed(1)}%` },
    ].forEach((card, index) => {
      const x = margin + 24 + index * (metricCardWidth + 12);
      doc.setFillColor(239, 246, 255);
      doc.setDrawColor(191, 219, 254);
      doc.roundedRect(x, 116, metricCardWidth, 70, 12, 12, "FD");
      doc.setTextColor(71, 85, 105);
      doc.setFontSize(9);
      doc.text(card.title, x + 12, 136);
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(card.value, x + 12, 162);
    });
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Campaign Snapshot", margin + 24, 236);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    addWrappedText(
      doc,
      `${campaign.questionSummaries.length} survey question(s) were analyzed for this campaign. The pages that follow show each question's full distribution, row-level matrix breakdowns, open-text details, and supporting chart where applicable.`,
      margin + 24,
      250,
      contentWidth - 48,
      15,
    );

    campaign.questionSummaries.forEach((question) => {
      addQuestionSection(doc, autoTable, question, campaign.campaignName, campaign.companyName);
    });
  });

  doc.save(filename);
}
