import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import { VAT_PERCENTAGE } from "@/lib/constants";
import { parseNumeric, formatCurrency } from "./currency";

interface InvoiceData {
  invoice: {
    id: string;
    invoiceNumber: string;
    amount: string;
    currency: string;
    status: string;
    type: string;
    description: string | null;
    dueDate: string | Date | null;
    paidAt: string | Date | null;
    createdAt: string | Date;
  };
  project: {
    id: string;
    title: string;
    subtotal: string;
    currency: string;
  } | null;
  organization: {
    id: string;
    name: string;
  };
}

export async function generateInvoicePDF(
  invoiceData: InvoiceData
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // Use built-in fonts to avoid filesystem issues
    const doc = new PDFDocument({
      margin: 50,
      size: "A4",
      // Don't load external font files
      autoFirstPage: true,
    });
    const buffers: Buffer[] = [];

    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => {
      const pdfBuffer = Buffer.concat(buffers);
      resolve(pdfBuffer);
    });
    doc.on("error", reject);

    const { invoice, project, organization } = invoiceData;
    const currency = invoice.currency || project?.currency || "EUR";

    // Header
    doc.fontSize(24).text("INVOICE", { align: "right" });
    doc.moveDown(0.5);
    doc
      .fontSize(12)
      .text(`Invoice #${invoice.invoiceNumber}`, { align: "right" });
    doc.moveDown(2);

    // Company info (EXO)
    doc.fontSize(14).text("EXO", { continued: false });
    doc.fontSize(10).text("exo@jurre.me", { continued: false });
    doc.moveDown(2);

    // Bill to
    doc.fontSize(12).text("Bill To:", { continued: false });
    doc.moveDown(0.5);
    doc.fontSize(11).text(organization.name, { continued: false });
    doc.moveDown(2);

    // Invoice details
    const invoiceDate = new Date(
      invoice.createdAt as string
    ).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const dueDate = invoice.dueDate
      ? new Date(invoice.dueDate as string).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : null;

    doc.fontSize(10);
    doc.text(`Invoice Date: ${invoiceDate}`, { align: "right" });
    if (dueDate) {
      doc.text(`Due Date: ${dueDate}`, { align: "right" });
    }
    doc.text(`Status: ${invoice.status.toUpperCase()}`, { align: "right" });
    doc.moveDown(2);

    // Line items
    const startY = doc.y;
    doc.fontSize(11).text("Description", 50, startY);
    doc.text("Amount", 450, startY, { align: "right" });
    doc
      .moveTo(50, startY + 15)
      .lineTo(550, startY + 15)
      .stroke();
    doc.moveDown(1);

    // Invoice line item
    const description =
      invoice.description ||
      (project ? `Project: ${project.title}` : "Invoice");
    doc.fontSize(10).text(description, 50, doc.y);
    doc.text(invoice.amount, 450, doc.y, { align: "right" });
    doc.moveDown(1.5);

    // Calculate subtotal, VAT, and total
    const amountValue = parseNumeric(invoice.amount);
    const subtotal = amountValue / (1 + VAT_PERCENTAGE / 100);
    const vat = amountValue - subtotal;

    // Totals
    const totalsY = doc.y;
    doc.moveTo(400, totalsY).lineTo(550, totalsY).stroke();
    doc.moveDown(0.5);
    doc.fontSize(10).text("Subtotal:", 400, doc.y);
    doc.text(formatCurrency(subtotal, currency), 450, doc.y, {
      align: "right",
    });
    doc.moveDown(0.5);
    doc.text(`VAT (${VAT_PERCENTAGE}%):`, 400, doc.y);
    doc.text(formatCurrency(vat, currency), 450, doc.y, { align: "right" });
    doc.moveDown(0.5);
    doc.moveTo(400, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(12).font("Helvetica-Bold").text("Total:", 400, doc.y);
    doc.text(invoice.amount, 450, doc.y, { align: "right" });
    doc.font("Helvetica").fontSize(10);

    // Footer
    doc.fontSize(8).fillColor("gray");
    const footerY = 750;
    doc.text("Thank you for your business!", 50, footerY, {
      align: "center",
      width: 500,
    });

    doc.end();
  });
}
