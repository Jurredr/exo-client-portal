import PDFDocument from "pdfkit";
import { formatCurrency } from "./currency";

export interface BTWQuarterData {
  quarter: string;
  year: number;
  quarterNum: number;
  btwCollected: number;
  btwPaid: number;
  netPosition: number;
  isInKORPeriod: boolean;
}

export async function generateBTWAangiftePDF(
  quarters: BTWQuarterData[],
  year: number
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const buffers: Buffer[] = [];

    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    doc.fontSize(18).text("BTW Aangifte Overzicht", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Belastingjaar ${year}`, { align: "center" });
    doc.moveDown(2);

    const korNotice = quarters.some((q) => q.isInKORPeriod);
    if (korNotice) {
      doc
        .fontSize(10)
        .fillColor("#666")
        .text(
          "Let op: EXO was in de Kleine Ondernemersregeling (KOR) van 1 juli 2024 tot 1 april 2026. Geen BTW geheven in die periode.",
          { align: "left", width: 495 }
        );
      doc.moveDown(1.5).fillColor("black");
    }

    const tableTop = doc.y;
    const colWidths = [120, 100, 100, 120];
    const rowHeight = 24;

    doc.fontSize(10).font("Helvetica-Bold");
    doc.text("Kwartaal", 50, tableTop);
    doc.text("1a BTW omzet", 50 + colWidths[0], tableTop);
    doc.text("4a BTW betaald", 50 + colWidths[0] + colWidths[1], tableTop);
    doc.text(
      "Netto positie",
      50 + colWidths[0] + colWidths[1] + colWidths[2],
      tableTop
    );
    doc.moveDown(0.5);

    let y = tableTop + rowHeight;
    doc.font("Helvetica");

    for (const q of quarters) {
      doc.text(q.quarter, 50, y);
      doc.text(formatCurrency(q.btwCollected, "EUR"), 50 + colWidths[0], y);
      doc.text(
        formatCurrency(q.btwPaid, "EUR"),
        50 + colWidths[0] + colWidths[1],
        y
      );
      doc.text(
        formatCurrency(q.netPosition, "EUR"),
        50 + colWidths[0] + colWidths[1] + colWidths[2],
        y
      );
      if (q.isInKORPeriod) {
        doc
          .fontSize(8)
          .fillColor("#666")
          .text(
            "(KOR)",
            50 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] - 20,
            y
          );
        doc.fontSize(10).fillColor("black");
      }
      y += rowHeight;
    }

    doc.moveDown(2);
    doc.fontSize(9).fillColor("#666");
    doc.text(
      "Dit overzicht is gebaseerd op betaalde facturen. Vul 4a (BTW betaald) aan met gegevens uit uw inkoopfacturen. Raadpleeg een belastingadviseur voor uw aangifte.",
      { align: "left", width: 495 }
    );

    doc.end();
  });
}
