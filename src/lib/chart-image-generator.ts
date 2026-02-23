/**
 * Canvas-based chart image generator for Excel export.
 * Renders pie charts and bar graphs as base64 PNG images.
 */

const CHART_COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#F97316",
  "#6366F1",
  "#84CC16",
];

interface ChartDataItem {
  label: string;
  value: number;
}

function createCanvas(
  width: number,
  height: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  // White background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, height);
  return { canvas, ctx };
}

export function generatePieChart(
  data: ChartDataItem[],
  title: string,
  width = 600,
  height = 400,
): string {
  const { canvas, ctx } = createCanvas(width, height);
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) {
    ctx.fillStyle = "#6B7280";
    ctx.font = "16px Arial";
    ctx.textAlign = "center";
    ctx.fillText("No data available", width / 2, height / 2);
    return canvas.toDataURL("image/png").split(",")[1];
  }

  // Title
  ctx.fillStyle = "#1E3A5F";
  ctx.font = "bold 18px Arial";
  ctx.textAlign = "center";
  ctx.fillText(title, width / 2, 30);

  const centerX = width * 0.35;
  const centerY = height / 2 + 10;
  const radius = Math.min(width * 0.28, height * 0.38);

  let startAngle = -Math.PI / 2;
  data.forEach((item, i) => {
    const sliceAngle = (item.value / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
    ctx.closePath();
    ctx.fillStyle = CHART_COLORS[i % CHART_COLORS.length];
    ctx.fill();
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Percentage label on slice
    if (item.value / total > 0.05) {
      const midAngle = startAngle + sliceAngle / 2;
      const labelR = radius * 0.65;
      const lx = centerX + Math.cos(midAngle) * labelR;
      const ly = centerY + Math.sin(midAngle) * labelR;
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${((item.value / total) * 100).toFixed(0)}%`, lx, ly);
    }

    startAngle += sliceAngle;
  });

  // Legend
  const legendX = width * 0.68;
  let legendY = 55;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  data.forEach((item, i) => {
    ctx.fillStyle = CHART_COLORS[i % CHART_COLORS.length];
    ctx.fillRect(legendX, legendY - 6, 14, 14);
    ctx.fillStyle = "#374151";
    ctx.font = "13px Arial";
    const label =
      item.label.length > 20 ? item.label.substring(0, 18) + "…" : item.label;
    ctx.fillText(`${label} (${item.value})`, legendX + 20, legendY + 1);
    legendY += 22;
  });

  return canvas.toDataURL("image/png").split(",")[1];
}

export function generateBarChart(
  data: ChartDataItem[],
  title: string,
  width = 600,
  height = 400,
): string {
  const { canvas, ctx } = createCanvas(width, height);
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  // Title
  ctx.fillStyle = "#1E3A5F";
  ctx.font = "bold 18px Arial";
  ctx.textAlign = "center";
  ctx.fillText(title, width / 2, 30);

  const chartLeft = 80;
  const chartRight = width - 30;
  const chartTop = 55;
  const chartBottom = height - 60;
  const chartWidth = chartRight - chartLeft;
  const chartHeight = chartBottom - chartTop;

  // Y-axis gridlines
  const gridLines = 5;
  ctx.strokeStyle = "#E5E7EB";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#6B7280";
  ctx.font = "12px Arial";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let i = 0; i <= gridLines; i++) {
    const y = chartBottom - (i / gridLines) * chartHeight;
    const val = Math.round((i / gridLines) * maxValue);
    ctx.beginPath();
    ctx.moveTo(chartLeft, y);
    ctx.lineTo(chartRight, y);
    ctx.stroke();
    ctx.fillText(String(val), chartLeft - 8, y);
  }

  // Bars
  const barCount = data.length;
  const gap = 8;
  const barWidth = Math.min(50, (chartWidth - gap * (barCount + 1)) / barCount);
  const totalBarsWidth = barCount * barWidth + (barCount - 1) * gap;
  const startX = chartLeft + (chartWidth - totalBarsWidth) / 2;

  data.forEach((item, i) => {
    const barHeight = (item.value / maxValue) * chartHeight;
    const x = startX + i * (barWidth + gap);
    const y = chartBottom - barHeight;

    // Bar with gradient effect
    ctx.fillStyle = CHART_COLORS[i % CHART_COLORS.length];
    ctx.fillRect(x, y, barWidth, barHeight);

    // Value on top
    ctx.fillStyle = "#374151";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(String(item.value), x + barWidth / 2, y - 4);

    // X-axis label
    ctx.fillStyle = "#374151";
    ctx.font = "11px Arial";
    ctx.textBaseline = "top";
    const label =
      item.label.length > 12 ? item.label.substring(0, 10) + "…" : item.label;
    ctx.fillText(label, x + barWidth / 2, chartBottom + 8);
  });

  // Axis lines
  ctx.strokeStyle = "#9CA3AF";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(chartLeft, chartTop);
  ctx.lineTo(chartLeft, chartBottom);
  ctx.lineTo(chartRight, chartBottom);
  ctx.stroke();

  return canvas.toDataURL("image/png").split(",")[1];
}
