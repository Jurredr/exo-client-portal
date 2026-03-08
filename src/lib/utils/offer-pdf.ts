import PDFDocument from "pdfkit";

/**
 * Convert markdown content to a PDF buffer for offers.
 * Handles: # ## ### headings, **bold**, - bullet lists, paragraphs.
 */
export async function generateOfferPDF(markdown: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 50,
      size: "A4",
      autoFirstPage: true,
    });
    const buffers: Buffer[] = [];

    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => {
      resolve(Buffer.concat(buffers));
    });
    doc.on("error", reject);

    const lines = markdown.split(/\r?\n/);
    let y = 50;
    const pageHeight = 842.89 - 100;
    const leftMargin = 50;
    const rightMargin = 50;
    const maxWidth = 595.28 - leftMargin - rightMargin;

    const ensureSpace = (needed: number) => {
      if (y + needed > pageHeight) {
        doc.addPage();
        y = 50;
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed) {
        y += 8;
        continue;
      }

      // Headings
      if (trimmed.startsWith("### ")) {
        ensureSpace(25);
        doc.fontSize(12).font("Helvetica-Bold");
        y += 8;
        const text = trimmed.slice(4).replace(/\*\*(.+?)\*\*/g, "$1");
        doc.text(text, leftMargin, y, { width: maxWidth });
        y += doc.heightOfString(text, { width: maxWidth }) + 6;
        doc.font("Helvetica");
        continue;
      }
      if (trimmed.startsWith("## ")) {
        ensureSpace(30);
        doc.fontSize(14).font("Helvetica-Bold");
        y += 10;
        const text = trimmed.slice(3).replace(/\*\*(.+?)\*\*/g, "$1");
        doc.text(text, leftMargin, y, { width: maxWidth });
        y += doc.heightOfString(text, { width: maxWidth }) + 8;
        doc.font("Helvetica");
        continue;
      }
      if (trimmed.startsWith("# ")) {
        ensureSpace(35);
        doc.fontSize(18).font("Helvetica-Bold");
        y += 12;
        const text = trimmed.slice(2).replace(/\*\*(.+?)\*\*/g, "$1");
        doc.text(text, leftMargin, y, { width: maxWidth });
        y += doc.heightOfString(text, { width: maxWidth }) + 12;
        doc.font("Helvetica");
        continue;
      }

      // Bullet list
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        ensureSpace(20);
        doc.fontSize(10).font("Helvetica");
        const bulletText = trimmed.slice(2).replace(/\*\*(.+?)\*\*/g, "$1");
        doc.text(`• ${bulletText}`, leftMargin + 10, y, {
          width: maxWidth - 10,
        });
        y +=
          doc.heightOfString(`• ${bulletText}`, { width: maxWidth - 10 }) + 4;
        continue;
      }

      // Horizontal rule
      if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
        y += 10;
        doc
          .moveTo(leftMargin, y)
          .lineTo(leftMargin + maxWidth, y)
          .stroke();
        y += 15;
        continue;
      }

      // Regular paragraph (strip **bold** for simple rendering)
      ensureSpace(20);
      doc.fontSize(10).font("Helvetica");
      const paraText = trimmed.replace(/\*\*(.+?)\*\*/g, "$1");
      doc.text(paraText, leftMargin, y, { width: maxWidth });
      y += doc.heightOfString(paraText, { width: maxWidth }) + 6;
    }

    doc.end();
  });
}
