import ExcelJS from 'exceljs';
import { generatePieChart, generateBarChart } from './chart-image-generator';

interface ResponseData {
  id: string;
  overall_satisfaction: number;
  service_quality: number;
  recommendation_likelihood: number;
  improvement_areas: string[];
  additional_comments: string | null;
  created_at: string;
  company_name: string;
  campaign_name: string;
}

const areaLabels: Record<string, string> = {
  communication: 'Communication',
  response_time: 'Response Time',
  product_quality: 'Product Quality',
  customer_service: 'Customer Service',
  pricing: 'Pricing',
  technical_support: 'Technical Support',
  delivery: 'Delivery',
  documentation: 'Documentation',
};

const likertLabels = ['Very Unlikely', 'Unlikely', 'Neutral', 'Likely', 'Very Likely'];

function addChartImage(workbook: ExcelJS.Workbook, sheet: ExcelJS.Worksheet, base64: string, col: number, row: number, width: number, height: number) {
  const imageId = workbook.addImage({ base64, extension: 'png' });
  sheet.addImage(imageId, {
    tl: { col, row },
    ext: { width, height },
  });
}

function styleHeader(sheet: ExcelJS.Worksheet, cell: string, text: string, size = 14) {
  const c = sheet.getCell(cell);
  c.value = text;
  c.font = { size, bold: true, color: { argb: 'FF1E3A8A' } };
}

function styleTableHeader(cell: ExcelJS.Cell) {
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
  cell.alignment = { horizontal: 'center' };
}

export async function exportToExcel(responses: ResponseData[], filename: string) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Feedback System';
  workbook.created = new Date();

  const totalResponses = responses.length;
  const avgSatisfaction = totalResponses > 0 ? responses.reduce((sum, r) => sum + r.overall_satisfaction, 0) / totalResponses : 0;
  const avgServiceQuality = totalResponses > 0 ? responses.reduce((sum, r) => sum + r.service_quality, 0) / totalResponses : 0;
  const avgRecommendation = totalResponses > 0 ? responses.reduce((sum, r) => sum + r.recommendation_likelihood, 0) / totalResponses : 0;

  // Distributions
  const satisfactionDist = Array.from({ length: 10 }, (_, i) => ({
    label: `${i + 1}`,
    value: responses.filter(r => r.overall_satisfaction === i + 1).length,
  }));

  const qualityDist = Array.from({ length: 5 }, (_, i) => ({
    label: `${i + 1} Star${i > 0 ? 's' : ''}`,
    value: responses.filter(r => r.service_quality === i + 1).length,
  }));

  const recommendationDist = likertLabels.map((label, i) => ({
    label,
    value: responses.filter(r => r.recommendation_likelihood === i + 1).length,
  }));

  // Company breakdown
  const companyMap = new Map<string, number>();
  responses.forEach(r => companyMap.set(r.company_name, (companyMap.get(r.company_name) || 0) + 1));
  const companyBreakdown = Array.from(companyMap.entries()).map(([label, value]) => ({ label, value }));

  // Improvement areas breakdown
  const areaMap = new Map<string, number>();
  responses.forEach(r => (r.improvement_areas || []).forEach(area => areaMap.set(area, (areaMap.get(area) || 0) + 1)));
  const areasBreakdown = Array.from(areaMap.entries())
    .map(([area, value]) => ({ label: areaLabels[area] || area, value }))
    .sort((a, b) => b.value - a.value);

  // ========== SUMMARY DASHBOARD SHEET ==========
  const summarySheet = workbook.addWorksheet('Summary Dashboard');
  summarySheet.columns = [{ width: 25 }, { width: 25 }, { width: 25 }, { width: 25 }, { width: 20 }, { width: 20 }];

  summarySheet.mergeCells('A1:F1');
  const titleCell = summarySheet.getCell('A1');
  titleCell.value = 'Feedback Analysis Report';
  titleCell.font = { size: 24, bold: true, color: { argb: 'FF1E3A8A' } };
  titleCell.alignment = { horizontal: 'center' };

  summarySheet.mergeCells('A2:F2');
  const subtitleCell = summarySheet.getCell('A2');
  subtitleCell.value = `Generated on ${new Date().toLocaleDateString()} | ${totalResponses} Total Responses`;
  subtitleCell.font = { size: 12, color: { argb: 'FF6B7280' } };
  subtitleCell.alignment = { horizontal: 'center' };

  // KPI Cards
  styleHeader(summarySheet, 'A4', 'KEY PERFORMANCE INDICATORS');
  const kpis = [
    { label: 'Total Responses', value: totalResponses, color: 'FF3B82F6' },
    { label: 'Avg. Satisfaction', value: `${avgSatisfaction.toFixed(1)}/10`, color: 'FF10B981' },
    { label: 'Avg. Service Quality', value: `${avgServiceQuality.toFixed(1)}/5`, color: 'FFF59E0B' },
    { label: 'Avg. Recommendation', value: `${avgRecommendation.toFixed(1)}/5`, color: 'FF8B5CF6' },
  ];
  kpis.forEach((kpi, i) => {
    const col = i + 1;
    const hc = summarySheet.getCell(5, col);
    hc.value = kpi.label;
    hc.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    hc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.color } };
    hc.alignment = { horizontal: 'center' };
    const vc = summarySheet.getCell(6, col);
    vc.value = kpi.value;
    vc.font = { size: 18, bold: true };
    vc.alignment = { horizontal: 'center' };
    vc.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
  });

  // Charts in Summary Sheet
  if (totalResponses > 0) {
    // Satisfaction bar chart
    const satBarImg = generateBarChart(satisfactionDist, 'Overall Satisfaction Distribution (1-10)');
    addChartImage(workbook, summarySheet, satBarImg, 0, 8, 500, 330);

    // Company pie chart
    const compPieImg = generatePieChart(companyBreakdown, 'Responses by Company');
    addChartImage(workbook, summarySheet, compPieImg, 3.5, 8, 500, 330);

    // Service quality pie chart
    const qualPieImg = generatePieChart(qualityDist, 'Service Quality Distribution');
    addChartImage(workbook, summarySheet, qualPieImg, 0, 26, 500, 330);

    // Recommendation bar chart
    const recBarImg = generateBarChart(recommendationDist, 'Recommendation Likelihood');
    addChartImage(workbook, summarySheet, recBarImg, 3.5, 26, 500, 330);

    // Improvement areas bar chart
    if (areasBreakdown.length > 0) {
      const areasBarImg = generateBarChart(areasBreakdown.slice(0, 8), 'Top Improvement Areas');
      addChartImage(workbook, summarySheet, areasBarImg, 0, 44, 500, 330);

      const areasPieImg = generatePieChart(areasBreakdown.slice(0, 8), 'Improvement Areas Breakdown');
      addChartImage(workbook, summarySheet, areasPieImg, 3.5, 44, 500, 330);
    }
  }

  // ========== PER-CAMPAIGN SHEETS WITH CHARTS ==========
  const campaignNames = [...new Set(responses.map(r => r.campaign_name))];

  campaignNames.forEach(campaignName => {
    const campaignResponses = responses.filter(r => r.campaign_name === campaignName);
    const sheetName = campaignName.substring(0, 28).replace(/[*?:/\\[\]]/g, '');
    const sheet = workbook.addWorksheet(sheetName);
    sheet.columns = [{ width: 25 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 20 }];

    // Campaign header
    sheet.mergeCells('A1:F1');
    const cTitle = sheet.getCell('A1');
    cTitle.value = `Campaign: ${campaignName}`;
    cTitle.font = { size: 22, bold: true, color: { argb: 'FF1E3A8A' } };
    cTitle.alignment = { horizontal: 'center' };

    sheet.mergeCells('A2:F2');
    const cSub = sheet.getCell('A2');
    cSub.value = `${campaignResponses.length} Responses | Companies: ${[...new Set(campaignResponses.map(r => r.company_name))].join(', ')}`;
    cSub.font = { size: 11, color: { argb: 'FF6B7280' } };
    cSub.alignment = { horizontal: 'center' };

    if (campaignResponses.length === 0) return;

    const cTotal = campaignResponses.length;

    // Campaign KPIs
    const cAvgSat = campaignResponses.reduce((s, r) => s + r.overall_satisfaction, 0) / cTotal;
    const cAvgQual = campaignResponses.reduce((s, r) => s + r.service_quality, 0) / cTotal;
    const cAvgRec = campaignResponses.reduce((s, r) => s + r.recommendation_likelihood, 0) / cTotal;

    styleHeader(sheet, 'A4', 'Campaign KPIs');
    const cKpis = [
      { label: 'Responses', value: cTotal, color: 'FF3B82F6' },
      { label: 'Avg Satisfaction', value: `${cAvgSat.toFixed(1)}/10`, color: 'FF10B981' },
      { label: 'Avg Quality', value: `${cAvgQual.toFixed(1)}/5`, color: 'FFF59E0B' },
      { label: 'Avg Recommendation', value: `${cAvgRec.toFixed(1)}/5`, color: 'FF8B5CF6' },
    ];
    cKpis.forEach((kpi, i) => {
      const hc = sheet.getCell(5, i + 1);
      hc.value = kpi.label;
      hc.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
      hc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.color } };
      hc.alignment = { horizontal: 'center' };
      const vc = sheet.getCell(6, i + 1);
      vc.value = kpi.value;
      vc.font = { size: 16, bold: true };
      vc.alignment = { horizontal: 'center' };
      vc.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    // Q1: Overall Satisfaction - Bar + Pie
    const cSatDist = Array.from({ length: 10 }, (_, i) => ({
      label: `${i + 1}`,
      value: campaignResponses.filter(r => r.overall_satisfaction === i + 1).length,
    }));
    const satBar = generateBarChart(cSatDist, 'Q1: Overall Satisfaction (1-10) - Bar Chart');
    const satPie = generatePieChart(cSatDist.filter(d => d.value > 0), 'Q1: Overall Satisfaction - Pie Chart');
    addChartImage(workbook, sheet, satBar, 0, 8, 500, 330);
    addChartImage(workbook, sheet, satPie, 3.5, 8, 500, 330);

    // Data table for Q1
    let tableRow = 28;
    styleHeader(sheet, `A${tableRow}`, 'Q1: Satisfaction Data', 12);
    tableRow++;
    ['Rating', 'Count', '%'].forEach((h, i) => {
      const c = sheet.getCell(tableRow, i + 1);
      c.value = h;
      styleTableHeader(c);
    });
    tableRow++;
    cSatDist.forEach(item => {
      sheet.getCell(tableRow, 1).value = item.label;
      sheet.getCell(tableRow, 2).value = item.value;
      sheet.getCell(tableRow, 3).value = cTotal > 0 ? `${((item.value / cTotal) * 100).toFixed(1)}%` : '0%';
      tableRow++;
    });

    // Q2: Service Quality - Bar + Pie
    tableRow += 2;
    const cQualDist = Array.from({ length: 5 }, (_, i) => ({
      label: `${i + 1} Star${i > 0 ? 's' : ''}`,
      value: campaignResponses.filter(r => r.service_quality === i + 1).length,
    }));
    const qualBar = generateBarChart(cQualDist, 'Q2: Service Quality (1-5 Stars) - Bar Chart');
    const qualPie = generatePieChart(cQualDist.filter(d => d.value > 0), 'Q2: Service Quality - Pie Chart');
    addChartImage(workbook, sheet, qualBar, 0, tableRow, 500, 330);
    addChartImage(workbook, sheet, qualPie, 3.5, tableRow, 500, 330);

    tableRow += 20;
    styleHeader(sheet, `A${tableRow}`, 'Q2: Service Quality Data', 12);
    tableRow++;
    ['Stars', 'Count', '%'].forEach((h, i) => {
      const c = sheet.getCell(tableRow, i + 1);
      c.value = h;
      styleTableHeader(c);
    });
    tableRow++;
    cQualDist.forEach(item => {
      sheet.getCell(tableRow, 1).value = item.label;
      sheet.getCell(tableRow, 2).value = item.value;
      sheet.getCell(tableRow, 3).value = cTotal > 0 ? `${((item.value / cTotal) * 100).toFixed(1)}%` : '0%';
      tableRow++;
    });

    // Q3: Recommendation Likelihood - Bar + Pie
    tableRow += 2;
    const cRecDist = likertLabels.map((label, i) => ({
      label,
      value: campaignResponses.filter(r => r.recommendation_likelihood === i + 1).length,
    }));
    const recBar = generateBarChart(cRecDist, 'Q3: Recommendation Likelihood - Bar Chart');
    const recPie = generatePieChart(cRecDist.filter(d => d.value > 0), 'Q3: Recommendation Likelihood - Pie Chart');
    addChartImage(workbook, sheet, recBar, 0, tableRow, 500, 330);
    addChartImage(workbook, sheet, recPie, 3.5, tableRow, 500, 330);

    tableRow += 20;
    styleHeader(sheet, `A${tableRow}`, 'Q3: Recommendation Data', 12);
    tableRow++;
    ['Response', 'Count', '%'].forEach((h, i) => {
      const c = sheet.getCell(tableRow, i + 1);
      c.value = h;
      styleTableHeader(c);
    });
    tableRow++;
    cRecDist.forEach(item => {
      sheet.getCell(tableRow, 1).value = item.label;
      sheet.getCell(tableRow, 2).value = item.value;
      sheet.getCell(tableRow, 3).value = cTotal > 0 ? `${((item.value / cTotal) * 100).toFixed(1)}%` : '0%';
      tableRow++;
    });

    // Q4: Improvement Areas - Bar + Pie
    const cAreaMap = new Map<string, number>();
    campaignResponses.forEach(r => (r.improvement_areas || []).forEach(a => cAreaMap.set(a, (cAreaMap.get(a) || 0) + 1)));
    const cAreasData = Array.from(cAreaMap.entries())
      .map(([area, value]) => ({ label: areaLabels[area] || area, value }))
      .sort((a, b) => b.value - a.value);

    if (cAreasData.length > 0) {
      tableRow += 2;
      const areaBar = generateBarChart(cAreasData.slice(0, 8), 'Q4: Improvement Areas - Bar Chart');
      const areaPie = generatePieChart(cAreasData.slice(0, 8), 'Q4: Improvement Areas - Pie Chart');
      addChartImage(workbook, sheet, areaBar, 0, tableRow, 500, 330);
      addChartImage(workbook, sheet, areaPie, 3.5, tableRow, 500, 330);

      tableRow += 20;
      styleHeader(sheet, `A${tableRow}`, 'Q4: Improvement Areas Data', 12);
      tableRow++;
      ['Area', 'Mentions', '%'].forEach((h, i) => {
        const c = sheet.getCell(tableRow, i + 1);
        c.value = h;
        styleTableHeader(c);
      });
      tableRow++;
      cAreasData.forEach(item => {
        sheet.getCell(tableRow, 1).value = item.label;
        sheet.getCell(tableRow, 2).value = item.value;
        sheet.getCell(tableRow, 3).value = cTotal > 0 ? `${((item.value / cTotal) * 100).toFixed(1)}%` : '0%';
        tableRow++;
      });
    }

    // Company breakdown within campaign
    const cCompanyMap = new Map<string, number>();
    campaignResponses.forEach(r => cCompanyMap.set(r.company_name, (cCompanyMap.get(r.company_name) || 0) + 1));
    const cCompanyData = Array.from(cCompanyMap.entries()).map(([label, value]) => ({ label, value }));

    if (cCompanyData.length > 1) {
      tableRow += 2;
      const compPie = generatePieChart(cCompanyData, 'Responses by Company - Pie Chart');
      const compBar = generateBarChart(cCompanyData, 'Responses by Company - Bar Chart');
      addChartImage(workbook, sheet, compPie, 0, tableRow, 500, 330);
      addChartImage(workbook, sheet, compBar, 3.5, tableRow, 500, 330);
    }
  });

  // ========== RAW DATA SHEET ==========
  const dataSheet = workbook.addWorksheet('All Responses');
  const headers = ['Company', 'Campaign', 'Satisfaction (1-10)', 'Service Quality (1-5)', 'Recommendation', 'Improvement Areas', 'Comments', 'Date'];
  const headerRow = dataSheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };

  responses.forEach(r => {
    dataSheet.addRow([
      r.company_name,
      r.campaign_name,
      r.overall_satisfaction,
      r.service_quality,
      likertLabels[r.recommendation_likelihood - 1] || r.recommendation_likelihood,
      (r.improvement_areas || []).map(a => areaLabels[a] || a).join(', '),
      r.additional_comments || '',
      new Date(r.created_at).toLocaleDateString(),
    ]);
  });

  dataSheet.columns.forEach(column => { column.width = 20; });

  // Conditional formatting for satisfaction
  dataSheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      const val = row.getCell(3).value as number;
      if (val >= 7) {
        row.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
      } else if (val >= 4) {
        row.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
      } else {
        row.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      }
    }
  });

  // Generate and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
