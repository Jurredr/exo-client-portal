import PDFDocument from "pdfkit";
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
    transactionType: string;
    vatIncluded: boolean;
    description: string | null;
    dueDate: string | Date | null;
    paidAt: string | Date | null;
    createdAt: string | Date;
  };
  project: {
    id: string;
    title: string;
    subtotal: string | null;
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
  return new Promise(async (resolve, reject) => {
    const pageWidth = 595.28; // A4 width in points
    const pageHeight = 841.89; // A4 height in points
    const leftColumnWidth = pageWidth * 0.23; // ~25% for dark column (narrower)
    const rightColumnStart = leftColumnWidth + 3; // Start after dark column + line
    const rightColumnWidth = pageWidth - rightColumnStart - 50; // Remaining width minus margin

    const doc = new PDFDocument({
      margin: 0,
      size: "A4",
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
    const isCredit = invoice.transactionType === "credit";
    const vatIncluded =
      invoice.vatIncluded !== undefined ? invoice.vatIncluded : true;

    // Draw dark left column background
    doc
      .rect(0, 0, leftColumnWidth, pageHeight)
      .fillColor("#1a1a1a") // Almost black background (darker)
      .fill()
      .fillColor("black"); // Reset fill color

    // Add vertical branding line separating columns
    doc
      .strokeColor("#1a1a1a") // Almost black
      .lineWidth(3)
      .moveTo(leftColumnWidth, 0)
      .lineTo(leftColumnWidth, pageHeight)
      .stroke()
      .strokeColor("black"); // Reset stroke color

    // Format dates
    const invoiceDateObj = new Date(invoice.createdAt as string);
    const invoiceDay = invoiceDateObj.getDate().toString().padStart(2, "0");
    const invoiceMonth = (invoiceDateObj.getMonth() + 1)
      .toString()
      .padStart(2, "0");
    const invoiceYear = invoiceDateObj.getFullYear();
    const invoiceDate = `${invoiceDay}-${invoiceMonth}-${invoiceYear}`;

    const dueDate = invoice.dueDate
      ? (() => {
          const dueDateObj = new Date(invoice.dueDate as string);
          const day = dueDateObj.getDate().toString().padStart(2, "0");
          const month = (dueDateObj.getMonth() + 1).toString().padStart(2, "0");
          const year = dueDateObj.getFullYear();
          return `${day}-${month}-${year}`;
        })()
      : null;

    // LEFT COLUMN - Dark background with white text
    const leftMargin = 20;
    let currentY = 40;

    // INVOICE title (large, white, bold)
    doc
      .fontSize(20)
      .font("Helvetica-Bold")
      .fillColor("white")
      .text("INVOICE", leftMargin, currentY, {
        width: leftColumnWidth - leftMargin * 2,
      });
    currentY += 50;

    // Invoice details (labels in white, values in gray)
    doc.fontSize(10).font("Helvetica").fillColor("#747474");
    doc.text("Invoice No:", leftMargin, currentY).fillColor("white");
    doc
      .text(invoice.invoiceNumber, leftMargin, currentY + 12)
      .fillColor("#747474");
    currentY += 30;
    doc.text("Invoice Date:", leftMargin, currentY).fillColor("white");
    doc.text(invoiceDate, leftMargin, currentY + 12).fillColor("#747474");
    currentY += 30;
    if (dueDate) {
      doc.text("Due Date:", leftMargin, currentY).fillColor("white");
      doc.text(dueDate, leftMargin, currentY + 12).fillColor("#747474");
      currentY += 30;
    }
    currentY += 20;

    // EXO logo at bottom of left column
    const logoY = pageHeight - 100;
    const logoWidth = 48;
    const logoX = leftMargin;

    // Contact information (white text) - positioned above the logo
    const contactInfoY = logoY - 164;
    doc.fontSize(9);
    doc.text("PHONE:", leftMargin, contactInfoY).fillColor("white");
    doc
      .text("+31 6 13458011", leftMargin, contactInfoY + 12)
      .fillColor("#747474");
    doc.text("EMAIL:", leftMargin, contactInfoY + 30).fillColor("white");
    doc
      .text("exo@jurre.me", leftMargin, contactInfoY + 42)
      .fillColor("#747474");
    doc.text("WEB:", leftMargin, contactInfoY + 60).fillColor("white");
    doc
      .text("www.exo.black", leftMargin, contactInfoY + 72)
      .fillColor("#747474");
    doc.text("KVK:", leftMargin, contactInfoY + 90).fillColor("white");
    doc.text("90251695", leftMargin, contactInfoY + 102).fillColor("#747474");

    // Base64 encoded PNG of the EXO white logo
    const base64Image =
      "iVBORw0KGgoAAAANSUhEUgAAARIAAADZCAMAAADbsU/SAAAAJFBMVEVMaXH///////////////////////////////////////////9tKdXLAAAAC3RSTlMA8DBgQBDQIICgcA6jO98AAAAJcEhZcwAALEoAACxKAXd6dE0AAAPkSURBVHic5d1LYhsxDATRseNESXz/++YA8WdEAo2uJvZazFtpQKl4PV7e1+bl9XKeH4uP9f7rul4jTdZFfl6ZJnsiiSa7Inkm+yJpJhUiWSY1IkkmVSI5JnUiKSaVIhkmtSIJJtUifJN6EbpJhwjbpEeEbNIlwjXpE6GadIowTXpFiCbdIjyTfhGaiUKEZaIRIZmoRDgmOhGKiVKEYaIVIZioRfxN9CLuJhMi3iYzIs4mUyK+JnMiriaTIp4msyKOJtMifibzIm4mDiJeJh4iTiYuIj4mPiIuJk4iHiZeIg4mbiLzJn4i0yaOIrMmniKTJq4icya+IlMmziIzJt4iEybuInoTfxG1CUFEa8IQUZpQRHQmHBGVCUlEY8ISUZjQRPpNeCLdJkSRXhOmSKcJVaTPhCvSZUIW6TFhi3SY0EXqTfgi1SYJIrUmGSKVJikidSY5IlUmSSI1JlkiFSZpIvsmeSK7JokieyaZIjsmv0NFNkxiReQmABGxCUJEagIREZpgRGQmIBGRCUpEYgITua7H273589+j/r35SZrI3fngW/x4x292PnyvOdrkkze9g00+ffc91uSLbcChJl/uR440+WZjdKDJtzu040xubBUPM7m1Zz3K5Obm+SCT27v4Y0yeOJ04xOSp85ojTJ48wTrA5OkzvXiThVPOcJOlc99ok8WT8GCT5d8GxJosi8SabIiEmmyJRJpsigSabIvEmRSIhJmUiESZFIkEmZSJxJgUioSYlIpEmBSLBJiUi+BNGkTgJi0iaJMmEbBJmwjWpFEEatIqgjRpFgGatIvgTAQiMBOJCMpEJAIykYlgTIQiEBOpCMJELAIwWf+X/Nv4vSo9s9MNmL5XpWf2SgqJJrttiTyT/dpGmklFfyTLpKbIkmRS1ajJMamr9qSYVHaMMkxqy04JJtWtK75Jff2LbtLRQ2Ob9BTiyCZdzTyuSV9FkGrS2VVkmvSWJokm3e1Nnkl/jZRmouizskw0xVqSiarhyzHRVY0pJsrOM8NEW74mmKhb4P4m+jq6u8lEL97bZKag72wydaeAr8ncLQuuJpP3TniazN7E4WgyfTeJn8m0iJ/JvIibiYOIl4mHiJOJi4iPiY+Ii4mTiIeJl4iDiZvIvImfyLSJo8isiafIpImryJyJr8iUibPIjIm3yISJu4jexF9EbUIQ0ZowRJQmFBGdCUdEZUIS0ZiwRBQmNJF+E55ItwlRpNeEKdJpQhXpM+GKdJmQRXpM2CIdJnSRehO+SLVJgkitSYZIpUmKSJ1JjkiVSZJIjUmWSIVJmsi+SZ7IrkmiyKbJ2+o4i1zXY/WxXv8BXSqyOWcLKvcAAAAASUVORK5CYII=";

    // Convert base64 to buffer and use directly (PDFKit supports buffers)
    try {
      const imageBuffer = Buffer.from(base64Image, "base64");
      doc.image(imageBuffer, logoX, logoY, {
        width: logoWidth,
      });
    } catch {
      // Fallback: draw EXO text if image fails
      doc.fontSize(24).font("Helvetica-Bold").fillColor("white");
      doc.text("EXO", logoX, logoY);
    }

    // RIGHT COLUMN - White background
    const rightMargin = 30;
    currentY = 40;

    // Billed To section (left side)
    const billedToX = rightColumnStart + rightMargin;
    const payToX = rightColumnStart + rightMargin + 200; // Position Pay To to the right
    const sectionWidth = 180; // Width for each section
    const startY = currentY;

    doc.fillColor("black");
    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .text("Billed To:", billedToX, startY);
    const billedToY = startY + 20;
    doc.fontSize(10).font("Helvetica");
    doc.text(organization.name, billedToX, billedToY, { width: sectionWidth });
    const billedToEndY = billedToY + 20;

    // Pay To section (right side, same Y position as Billed To)
    doc.fontSize(11).font("Helvetica-Bold").text("Pay To:", payToX, startY);
    let payToY = startY + 20;
    doc.fontSize(10).font("Helvetica");
    doc.text("EXO", payToX, payToY, { width: sectionWidth });
    payToY += 15;
    doc.text("Charlotte v Pallandthof 38,", payToX, payToY, {
      width: sectionWidth,
    });
    payToY += 15;
    doc.text("1112ZL,", payToX, payToY, { width: sectionWidth });
    payToY += 15;
    doc.text("Diemen, Nederland", payToX, payToY, { width: sectionWidth });
    payToY += 20;
    doc.fontSize(9);
    doc.text("KVK-nummer: 90251695", payToX, payToY, { width: sectionWidth });
    payToY += 12;
    doc.text("BTW-nummer: NL004799795B92", payToX, payToY, {
      width: sectionWidth,
    });
    payToY += 12;
    doc.text("Bank: NL61 INGB 0792 9410 39", payToX, payToY, {
      width: sectionWidth,
    });

    // Set currentY to the maximum of both sections
    currentY = Math.max(billedToEndY, payToY) + 40; // Added extra spacing

    // Invoice items table
    const tableStartY = currentY;
    const tableWidth = rightColumnWidth - rightMargin * 2;
    const qtyWidth = 50;
    const descWidth = tableWidth - qtyWidth - 100 - 100; // Remaining after QTY, Price, Amount
    const priceWidth = 100;
    const amountWidth = 100;

    // Table headers
    doc.fontSize(9).font("Helvetica-Bold");
    doc.text("QTY", rightColumnStart + rightMargin, tableStartY);
    doc.text(
      "Description",
      rightColumnStart + rightMargin + qtyWidth,
      tableStartY
    );
    doc.text(
      "Price",
      rightColumnStart + rightMargin + qtyWidth + descWidth,
      tableStartY,
      { width: priceWidth, align: "right" }
    );
    doc.text(
      "Amount",
      rightColumnStart + rightMargin + qtyWidth + descWidth + priceWidth,
      tableStartY,
      { width: amountWidth, align: "right" }
    );

    // Table header line
    const headerLineY = tableStartY + 15;
    doc
      .strokeColor("#cccccc")
      .lineWidth(1)
      .moveTo(rightColumnStart + rightMargin, headerLineY)
      .lineTo(rightColumnStart + rightMargin + tableWidth, headerLineY)
      .stroke()
      .strokeColor("black");

    // Invoice line item
    currentY = headerLineY + 10;
    doc.fontSize(9).font("Helvetica");
    const description =
      invoice.description ||
      (project ? `Project: ${project.title}` : "Invoice");

    // Calculate item details
    const amountValue = parseNumeric(invoice.amount);
    let subtotal: number;
    let vat: number;
    let total: number;
    let itemPrice: number;
    const itemQty = 1;

    if (isCredit) {
      total = amountValue;
      subtotal = total;
      vat = 0;
      itemPrice = total;
    } else if (vatIncluded) {
      subtotal = amountValue / (1 + VAT_PERCENTAGE / 100);
      vat = amountValue - subtotal;
      total = amountValue;
      itemPrice = subtotal; // Price per item (without VAT)
    } else {
      subtotal = amountValue;
      vat = 0;
      total = amountValue;
      itemPrice = subtotal;
    }

    // Table row
    doc.text(itemQty.toString(), rightColumnStart + rightMargin, currentY);
    doc.text(description, rightColumnStart + rightMargin + qtyWidth, currentY, {
      width: descWidth,
    });
    doc.text(
      formatCurrency(itemPrice, currency),
      rightColumnStart + rightMargin + qtyWidth + descWidth,
      currentY,
      { width: priceWidth, align: "right" }
    );
    doc.text(
      formatCurrency(amountValue, currency),
      rightColumnStart + rightMargin + qtyWidth + descWidth + priceWidth,
      currentY,
      { width: amountWidth, align: "right" }
    );

    currentY += 40;

    // Totals section
    const totalsStartX = rightColumnStart + rightMargin + qtyWidth + descWidth;

    doc.fontSize(9).font("Helvetica");
    doc.text("Sub Total", totalsStartX, currentY, {
      width: priceWidth,
      align: "right",
    });
    doc.text(
      formatCurrency(subtotal, currency),
      totalsStartX + priceWidth,
      currentY,
      { width: amountWidth, align: "right" }
    );
    currentY += 15;

    // Only show VAT if it's not a credit invoice
    if (!isCredit) {
      const vatPercentage = vatIncluded ? VAT_PERCENTAGE : 0;
      doc.text(`${vatPercentage}% Tax`, totalsStartX, currentY, {
        width: priceWidth,
        align: "right",
      });
      doc.text(
        formatCurrency(vat, currency),
        totalsStartX + priceWidth,
        currentY,
        { width: amountWidth, align: "right" }
      );
      currentY += 15;
    }

    doc.fontSize(10).font("Helvetica-Bold");
    doc.text("Total Due", totalsStartX, currentY, {
      width: priceWidth,
      align: "right",
    });
    doc.text(
      formatCurrency(total, currency),
      totalsStartX + priceWidth,
      currentY,
      { width: amountWidth, align: "right" }
    );

    doc.end();
  });
}
