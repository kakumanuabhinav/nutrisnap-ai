import type { FoodAnalysis, Nutrition } from "../types";
import jsPDF from "jspdf";

function scaleNutrition(n: Nutrition, multiplier: number): Nutrition {
  const scaled = {} as Nutrition;
  (Object.keys(n) as (keyof Nutrition)[]).forEach((k) => {
    scaled[k] = Math.round(n[k] * multiplier * 10) / 10;
  });
  return scaled;
}

/** Renders a branded nutrition summary card to a canvas and returns a PNG
 * data URL, matching the prototype's canvas-based share card. */
export function renderNutritionCard(analysis: FoodAnalysis, multiplier: number): string {
  const nutrition = scaleNutrition(analysis.nutrition, multiplier);
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 1000;
  const ctx = canvas.getContext("2d")!;

  // Background
  const bgGradient = ctx.createLinearGradient(0, 0, 800, 1000);
  bgGradient.addColorStop(0, "#04080a");
  bgGradient.addColorStop(1, "#0d1519");
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, 800, 1000);

  // Header
  ctx.fillStyle = "#00e5ff";
  ctx.font = "bold 32px Arial";
  ctx.fillText("NutriSnap AI", 40, 70);
  ctx.fillStyle = "#4a7280";
  ctx.font = "16px Arial";
  ctx.fillText(new Date().toLocaleDateString(), 40, 100);

  // Foods
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px Arial";
  const foodNames = analysis.detected_foods.map((f) => f.name).join(", ");
  wrapText(ctx, foodNames, 40, 150, 720, 30);

  // Calories
  ctx.fillStyle = "#00e5ff";
  ctx.font = "bold 72px Arial";
  ctx.fillText(`${Math.round(nutrition.calories)}`, 40, 280);
  ctx.fillStyle = "#4a7280";
  ctx.font = "20px Arial";
  ctx.fillText("kcal total", 40, 310);

  // Macro grid
  const macros: [string, number, string][] = [
    ["Protein", nutrition.protein, "#22c55e"],
    ["Carbs", nutrition.carbs, "#00e5ff"],
    ["Fat", nutrition.fat, "#f59e0b"],
    ["Fiber", nutrition.fiber, "#a78bfa"],
  ];
  macros.forEach(([label, value, color], i) => {
    const x = 40 + (i % 2) * 380;
    const y = 380 + Math.floor(i / 2) * 100;
    ctx.fillStyle = "#0d1519";
    roundRect(ctx, x, y, 350, 80, 16);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.font = "bold 28px Arial";
    ctx.fillText(`${Math.round(value)}g`, x + 20, y + 40);
    ctx.fillStyle = "#4a7280";
    ctx.font = "14px Arial";
    ctx.fillText(label, x + 20, y + 62);
  });

  // Insights
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 18px Arial";
  ctx.fillText("Health Insights", 40, 620);
  ctx.font = "15px Arial";
  ctx.fillStyle = "#c9d6da";
  analysis.insights.slice(0, 4).forEach((insight, i) => {
    wrapText(ctx, `• ${insight.text}`, 40, 655 + i * 32, 720, 20);
  });

  // Footer
  ctx.fillStyle = "#4a7280";
  ctx.font = "13px Arial";
  ctx.fillText("Values are AI-generated estimates, not medical measurements.", 40, 960);

  return canvas.toDataURL("image/png");
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(" ");
  let line = "";
  let curY = y;
  for (const word of words) {
    const test = line + word + " ";
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, curY);
      line = word + " ";
      curY += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, curY);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function shareOrCopyImage(dataUrl: string, title: string) {
  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], "nutrisnap-card.png", { type: "image/png" });

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title });
    return "shared";
  }
  if (navigator.clipboard && "write" in navigator.clipboard) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      return "copied";
    } catch {
      // fall through to download
    }
  }
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = "nutrisnap-card.png";
  link.click();
  return "downloaded";
}

export function exportAnalysisPdf(analysis: FoodAnalysis, multiplier: number) {
  const nutrition = scaleNutrition(analysis.nutrition, multiplier);
  const doc = new jsPDF();

  doc.setFontSize(20);
  doc.text("NutriSnap AI — Nutrition Report", 14, 20);
  doc.setFontSize(10);
  doc.text(new Date().toLocaleString(), 14, 27);

  doc.setFontSize(13);
  doc.text("Detected Foods", 14, 40);
  doc.setFontSize(10);
  let y = 47;
  analysis.detected_foods.forEach((f) => {
    doc.text(`• ${f.name} — ${f.confidence}% confidence${f.estimated_quantity ? `, ${f.estimated_quantity}` : ""}`, 16, y);
    y += 6;
  });

  y += 6;
  doc.setFontSize(13);
  doc.text(`Calories: ${Math.round(nutrition.calories)} kcal (serving x${multiplier})`, 14, y);
  y += 10;

  doc.setFontSize(11);
  doc.text("Macronutrients", 14, y);
  y += 6;
  doc.setFontSize(10);
  [
    ["Protein", nutrition.protein],
    ["Carbs", nutrition.carbs],
    ["Fat", nutrition.fat],
    ["Fiber", nutrition.fiber],
  ].forEach(([label, value]) => {
    doc.text(`${label}: ${Math.round(Number(value))} g`, 16, y);
    y += 6;
  });

  y += 4;
  doc.setFontSize(11);
  doc.text("Micronutrients", 14, y);
  y += 6;
  doc.setFontSize(10);
  [
    ["Sugar", `${Math.round(nutrition.sugar)} g`],
    ["Sodium", `${Math.round(nutrition.sodium)} mg`],
    ["Potassium", `${Math.round(nutrition.potassium)} mg`],
    ["Saturated fat", `${Math.round(nutrition.saturated_fat)} g`],
    ["Cholesterol", `${Math.round(nutrition.cholesterol)} mg`],
  ].forEach(([label, value]) => {
    doc.text(`${label}: ${value}`, 16, y);
    y += 6;
  });

  y += 4;
  doc.setFontSize(11);
  doc.text("Health Insights", 14, y);
  y += 6;
  doc.setFontSize(10);
  analysis.insights.forEach((insight) => {
    const lines = doc.splitTextToSize(`[${insight.type.toUpperCase()}] ${insight.text}`, 180);
    doc.text(lines, 16, y);
    y += lines.length * 6;
  });

  y += 8;
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    "Nutrition values are AI-generated estimates from an image and may not be fully accurate. Not a substitute for professional dietary or medical advice.",
    14,
    y,
    { maxWidth: 180 },
  );

  doc.save("nutrisnap-nutrition-report.pdf");
}
