 import ExcelJS from 'exceljs';
 
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
 
 export async function exportToExcel(responses: ResponseData[], filename: string) {
   const workbook = new ExcelJS.Workbook();
   workbook.creator = 'Feedback System';
   workbook.created = new Date();
 
   // Calculate metrics
   const totalResponses = responses.length;
   const avgSatisfaction = totalResponses > 0
     ? responses.reduce((sum, r) => sum + r.overall_satisfaction, 0) / totalResponses
     : 0;
   const avgServiceQuality = totalResponses > 0
     ? responses.reduce((sum, r) => sum + r.service_quality, 0) / totalResponses
     : 0;
   const avgRecommendation = totalResponses > 0
     ? responses.reduce((sum, r) => sum + r.recommendation_likelihood, 0) / totalResponses
     : 0;
 
   // Calculate distributions
   const satisfactionDist = Array.from({ length: 10 }, (_, i) => ({
     rating: i + 1,
     count: responses.filter(r => r.overall_satisfaction === i + 1).length,
   }));
 
   const qualityDist = Array.from({ length: 5 }, (_, i) => ({
     rating: i + 1,
     count: responses.filter(r => r.service_quality === i + 1).length,
   }));
 
   const recommendationDist = Array.from({ length: 5 }, (_, i) => ({
     label: likertLabels[i],
     count: responses.filter(r => r.recommendation_likelihood === i + 1).length,
   }));
 
   // Company breakdown
   const companyMap = new Map<string, number>();
   responses.forEach(r => {
     companyMap.set(r.company_name, (companyMap.get(r.company_name) || 0) + 1);
   });
   const companyBreakdown = Array.from(companyMap.entries()).map(([name, count]) => ({ name, count }));
 
   // Improvement areas breakdown
   const areaMap = new Map<string, number>();
   responses.forEach(r => {
     (r.improvement_areas || []).forEach(area => {
       areaMap.set(area, (areaMap.get(area) || 0) + 1);
     });
   });
   const areasBreakdown = Array.from(areaMap.entries())
     .map(([area, count]) => ({ area: areaLabels[area] || area, count }))
     .sort((a, b) => b.count - a.count);
 
   // ========== SUMMARY SHEET ==========
   const summarySheet = workbook.addWorksheet('Summary Dashboard');
   
   // Title
   summarySheet.mergeCells('A1:F1');
   const titleCell = summarySheet.getCell('A1');
   titleCell.value = 'Feedback Analysis Report';
   titleCell.font = { size: 24, bold: true, color: { argb: 'FF1E3A8A' } };
   titleCell.alignment = { horizontal: 'center' };
   
   // Subtitle with date
   summarySheet.mergeCells('A2:F2');
   const subtitleCell = summarySheet.getCell('A2');
   subtitleCell.value = `Generated on ${new Date().toLocaleDateString()} | ${totalResponses} Total Responses`;
   subtitleCell.font = { size: 12, color: { argb: 'FF6B7280' } };
   subtitleCell.alignment = { horizontal: 'center' };
 
   // KPI Cards section
   summarySheet.getCell('A4').value = 'KEY PERFORMANCE INDICATORS';
   summarySheet.getCell('A4').font = { size: 14, bold: true };
   
   // KPI Headers
   const kpiRow = 5;
   const kpis = [
     { label: 'Total Responses', value: totalResponses, color: 'FF3B82F6' },
     { label: 'Avg. Satisfaction', value: `${avgSatisfaction.toFixed(1)}/10`, color: 'FF10B981' },
     { label: 'Avg. Service Quality', value: `${avgServiceQuality.toFixed(1)}/5`, color: 'FFF59E0B' },
     { label: 'Avg. Recommendation', value: `${avgRecommendation.toFixed(1)}/5`, color: 'FF8B5CF6' },
   ];
 
   kpis.forEach((kpi, index) => {
     const col = index + 1;
     const headerCell = summarySheet.getCell(kpiRow, col);
     headerCell.value = kpi.label;
     headerCell.font = { bold: true, size: 11 };
     headerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.color } };
     headerCell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
     headerCell.alignment = { horizontal: 'center' };
     
     const valueCell = summarySheet.getCell(kpiRow + 1, col);
     valueCell.value = kpi.value;
     valueCell.font = { size: 18, bold: true };
     valueCell.alignment = { horizontal: 'center' };
     valueCell.border = {
       top: { style: 'thin' },
       left: { style: 'thin' },
       bottom: { style: 'thin' },
       right: { style: 'thin' },
     };
   });
 
   // Set column widths
   summarySheet.columns = [
     { width: 25 }, { width: 25 }, { width: 25 }, { width: 25 }, { width: 20 }, { width: 20 },
   ];
 
   // Satisfaction Distribution Section
   summarySheet.getCell('A9').value = 'SATISFACTION DISTRIBUTION (1-10)';
   summarySheet.getCell('A9').font = { size: 14, bold: true };
   
   summarySheet.getCell('A10').value = 'Rating';
   summarySheet.getCell('B10').value = 'Count';
   summarySheet.getCell('C10').value = 'Percentage';
   ['A10', 'B10', 'C10'].forEach(cell => {
     summarySheet.getCell(cell).font = { bold: true };
     summarySheet.getCell(cell).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
   });
 
   satisfactionDist.forEach((item, index) => {
     const row = 11 + index;
     summarySheet.getCell(`A${row}`).value = item.rating;
     summarySheet.getCell(`B${row}`).value = item.count;
     summarySheet.getCell(`C${row}`).value = totalResponses > 0 ? `${((item.count / totalResponses) * 100).toFixed(1)}%` : '0%';
     
     // Visual bar using conditional formatting
     const pct = totalResponses > 0 ? (item.count / totalResponses) : 0;
     if (pct > 0) {
       summarySheet.getCell(`C${row}`).fill = {
         type: 'pattern',
         pattern: 'solid',
         fgColor: { argb: pct > 0.2 ? 'FF10B981' : pct > 0.1 ? 'FFFBBF24' : 'FFEF4444' },
       };
     }
   });
 
   // Company Breakdown Section
   summarySheet.getCell('E9').value = 'RESPONSES BY COMPANY';
   summarySheet.getCell('E9').font = { size: 14, bold: true };
   
   summarySheet.getCell('E10').value = 'Company';
   summarySheet.getCell('F10').value = 'Responses';
   ['E10', 'F10'].forEach(cell => {
     summarySheet.getCell(cell).font = { bold: true };
     summarySheet.getCell(cell).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
   });
 
   companyBreakdown.forEach((item, index) => {
     const row = 11 + index;
     summarySheet.getCell(`E${row}`).value = item.name;
     summarySheet.getCell(`F${row}`).value = item.count;
   });
 
   // Service Quality Section
   const qualityStartRow = 23;
   summarySheet.getCell(`A${qualityStartRow}`).value = 'SERVICE QUALITY DISTRIBUTION (1-5 Stars)';
   summarySheet.getCell(`A${qualityStartRow}`).font = { size: 14, bold: true };
   
   summarySheet.getCell(`A${qualityStartRow + 1}`).value = 'Stars';
   summarySheet.getCell(`B${qualityStartRow + 1}`).value = 'Count';
   summarySheet.getCell(`C${qualityStartRow + 1}`).value = 'Visual';
   ['A', 'B', 'C'].forEach(col => {
     summarySheet.getCell(`${col}${qualityStartRow + 1}`).font = { bold: true };
     summarySheet.getCell(`${col}${qualityStartRow + 1}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
   });
 
   qualityDist.forEach((item, index) => {
     const row = qualityStartRow + 2 + index;
     summarySheet.getCell(`A${row}`).value = '⭐'.repeat(item.rating);
     summarySheet.getCell(`B${row}`).value = item.count;
     summarySheet.getCell(`C${row}`).value = '█'.repeat(Math.min(item.count, 20));
     summarySheet.getCell(`C${row}`).font = { color: { argb: 'FFF59E0B' } };
   });
 
   // Recommendation Section
   summarySheet.getCell(`E${qualityStartRow}`).value = 'RECOMMENDATION LIKELIHOOD';
   summarySheet.getCell(`E${qualityStartRow}`).font = { size: 14, bold: true };
   
   summarySheet.getCell(`E${qualityStartRow + 1}`).value = 'Response';
   summarySheet.getCell(`F${qualityStartRow + 1}`).value = 'Count';
   ['E', 'F'].forEach(col => {
     summarySheet.getCell(`${col}${qualityStartRow + 1}`).font = { bold: true };
     summarySheet.getCell(`${col}${qualityStartRow + 1}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
   });
 
   recommendationDist.forEach((item, index) => {
     const row = qualityStartRow + 2 + index;
     summarySheet.getCell(`E${row}`).value = item.label;
     summarySheet.getCell(`F${row}`).value = item.count;
   });
 
   // Improvement Areas Section
   const areasStartRow = 31;
   summarySheet.getCell(`A${areasStartRow}`).value = 'TOP IMPROVEMENT AREAS';
   summarySheet.getCell(`A${areasStartRow}`).font = { size: 14, bold: true };
   
   summarySheet.getCell(`A${areasStartRow + 1}`).value = 'Area';
   summarySheet.getCell(`B${areasStartRow + 1}`).value = 'Mentions';
   summarySheet.getCell(`C${areasStartRow + 1}`).value = 'Percentage';
   ['A', 'B', 'C'].forEach(col => {
     summarySheet.getCell(`${col}${areasStartRow + 1}`).font = { bold: true };
     summarySheet.getCell(`${col}${areasStartRow + 1}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
   });
 
   areasBreakdown.slice(0, 8).forEach((item, index) => {
     const row = areasStartRow + 2 + index;
     summarySheet.getCell(`A${row}`).value = item.area;
     summarySheet.getCell(`B${row}`).value = item.count;
     summarySheet.getCell(`C${row}`).value = totalResponses > 0 ? `${((item.count / totalResponses) * 100).toFixed(1)}%` : '0%';
   });
 
   // ========== CHART DATA SHEET (for charts) ==========
   const chartDataSheet = workbook.addWorksheet('Chart Data');
   
   // Satisfaction chart data
   chartDataSheet.getCell('A1').value = 'Rating';
   chartDataSheet.getCell('B1').value = 'Count';
   satisfactionDist.forEach((item, index) => {
     chartDataSheet.getCell(`A${index + 2}`).value = item.rating;
     chartDataSheet.getCell(`B${index + 2}`).value = item.count;
   });
 
   // Company chart data
   chartDataSheet.getCell('D1').value = 'Company';
   chartDataSheet.getCell('E1').value = 'Responses';
   companyBreakdown.forEach((item, index) => {
     chartDataSheet.getCell(`D${index + 2}`).value = item.name;
     chartDataSheet.getCell(`E${index + 2}`).value = item.count;
   });
 
   // ========== RAW DATA SHEET ==========
   const dataSheet = workbook.addWorksheet('All Responses');
   
   // Headers
   const headers = ['Company', 'Campaign', 'Satisfaction (1-10)', 'Service Quality (1-5)', 'Recommendation', 'Improvement Areas', 'Comments', 'Date'];
   const headerRow = dataSheet.addRow(headers);
   headerRow.font = { bold: true };
   headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
   headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
   
   // Data rows
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
 
   // Auto-fit columns
   dataSheet.columns.forEach(column => {
     column.width = 20;
   });
 
   // Add conditional formatting for satisfaction
   dataSheet.eachRow((row, rowNumber) => {
     if (rowNumber > 1) {
       const satisfactionCell = row.getCell(3);
       const value = satisfactionCell.value as number;
       if (value >= 7) {
         satisfactionCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
       } else if (value >= 4) {
         satisfactionCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
       } else {
         satisfactionCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
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