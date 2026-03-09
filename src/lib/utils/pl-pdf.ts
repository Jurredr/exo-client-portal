import PDFDocument from "pdfkit";
import { formatCurrency } from "./currency";
import type { FinancialsStats } from "@/lib/db/queries";
import type { BTWQuarterData } from "./btw-pdf";

export async function generateYearPLPDF(
  stats: FinancialsStats,
  btwQuarters: BTWQuarterData[],
  year: number
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const buffers: Buffer[] = [];

    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    doc.fontSize(18).text("Profit & Loss Overzicht", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Belastingjaar ${year}`, { align: "center" });
    doc.moveDown(2);

    const colWidth = 250;
    let y = doc.y;

    // Revenue
    doc.fontSize(11).font("Helvetica-Bold").text("Omzet", 50, y);
    doc
      .font("Helvetica")
      .text(formatCurrency(stats.revenue.total, "EUR"), 50 + colWidth, y);
    y += 22;

    // Cost of goods/services (simplified: direct expenses excluding depreciation)
    const directCost =
      stats.expenses.total - (stats.expenses.depreciation ?? 0);
    doc.font("Helvetica-Bold").text("Kosten goederen/diensten", 50, y);
    doc
      .font("Helvetica")
      .text(formatCurrency(directCost, "EUR"), 50 + colWidth, y);
    y += 22;

    // Gross profit
    const grossProfit = stats.revenue.total - directCost;
    doc.font("Helvetica-Bold").text("Brutowinst", 50, y);
    doc
      .font("Helvetica")
      .text(formatCurrency(grossProfit, "EUR"), 50 + colWidth, y);
    y += 28;

    // Expenses by category
    doc.font("Helvetica-Bold").text("Kosten per categorie", 50, y);
    y += 20;
    doc.font("Helvetica");
    for (const cat of stats.expenses.byCategory) {
      doc.text(`  ${cat.category}`, 50, y);
      doc.text(formatCurrency(cat.amount, "EUR"), 50 + colWidth, y);
      y += 18;
    }
    y += 10;

    // Depreciation
    const dep = stats.expenses.depreciation ?? 0;
    if (dep > 0) {
      doc.font("Helvetica-Bold").text("Afschrijvingen", 50, y);
      doc.font("Helvetica").text(formatCurrency(dep, "EUR"), 50 + colWidth, y);
      y += 22;
    }

    // Total expenses
    doc.font("Helvetica-Bold").text("Totale kosten", 50, y);
    doc
      .font("Helvetica")
      .text(formatCurrency(stats.expenses.total, "EUR"), 50 + colWidth, y);
    y += 28;

    // Net profit
    doc.fontSize(12).font("Helvetica-Bold").text("Nettowinst", 50, y);
    doc
      .font("Helvetica")
      .text(formatCurrency(stats.profit.net, "EUR"), 50 + colWidth, y);
    y += 40;

    // BTW summary
    doc.fontSize(11).font("Helvetica-Bold").text("BTW Samenvatting", 50, y);
    y += 20;
    doc.font("Helvetica");
    const totalBtwCollected = btwQuarters.reduce(
      (s, q) => s + q.btwCollected,
      0
    );
    const totalBtwPaid = btwQuarters.reduce((s, q) => s + q.btwPaid, 0);
    const totalBtwNet = btwQuarters.reduce((s, q) => s + q.netPosition, 0);
    doc.text(
      `  BTW omzet (1a): ${formatCurrency(totalBtwCollected, "EUR")}`,
      50,
      y
    );
    y += 18;
    doc.text(
      `  BTW betaald (4a): ${formatCurrency(totalBtwPaid, "EUR")}`,
      50,
      y
    );
    y += 18;
    doc.text(
      `  Netto BTW positie: ${formatCurrency(totalBtwNet, "EUR")}`,
      50,
      y
    );
    y += 30;

    doc.fontSize(9).fillColor("#666");
    doc.text(
      "Dit overzicht is een samenvatting. Raadpleeg een belastingadviseur voor uw aangifte.",
      { align: "left", width: 495 }
    );

    doc.end();
  });
}
