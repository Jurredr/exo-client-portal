import PDFDocument from "pdfkit";
import { parseNumeric, formatCurrency } from "./currency";

interface InvoiceLineItem {
  id?: string;
  description: string;
  quantity: string;
  unitPrice: string;
  taxPercentage: string;
  order: number;
}

interface InvoiceData {
  invoice: {
    id: string;
    invoiceNumber: string;
    amount: string;
    currency: string;
    status: string;
    type: string;
    transactionType: string;
    vatIncluded: boolean | null;
    isKOR: boolean;
    expenseId?: string | null;
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
    address?: string | null;
    kvkNumber?: string | null;
    btwNumber?: string | null;
    email?: string | null;
    telephone?: string | null;
  };
  lineItems?: InvoiceLineItem[];
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

    const { invoice, project, organization, lineItems = [] } = invoiceData;
    const currency = invoice.currency || project?.currency || "EUR";
    const isCredit = invoice.transactionType === "credit";
    const isKOR = invoice.isKOR || false;
    const isReimbursement = Boolean(invoice.expenseId);

    // Process line items
    const processedItems = lineItems
      .map((item) => {
        const quantity = parseFloat(item.quantity) || 0;
        const unitPrice = parseFloat(item.unitPrice) || 0;
        const taxPercentage = parseFloat(item.taxPercentage) || 0;
        const subtotal = quantity * unitPrice;
        const tax = subtotal * (taxPercentage / 100);
        const total = subtotal + tax;

        return {
          description: item.description,
          quantity,
          unitPrice,
          taxPercentage,
          subtotal,
          tax,
          total,
        };
      })
      .filter((item) => item.quantity > 0 && item.unitPrice !== 0);

    // Calculate totals
    let grandSubtotal = processedItems.reduce(
      (sum, item) => sum + item.subtotal,
      0
    );
    let grandTotal = processedItems.reduce((sum, item) => sum + item.total, 0);
    let grandVat = grandTotal - grandSubtotal;

    // Apply credit invoice negation (only if values are positive)
    // Legacy credit invoices may already have negative values from conversion, so check before negating
    if (isCredit && grandSubtotal > 0) {
      grandSubtotal = -grandSubtotal;
      grandVat = -grandVat;
      grandTotal = -grandTotal;
    }
    // If grandSubtotal is already negative (from legacy conversion), values are already correct

    // Group tax by percentage for display
    const taxGroups: { [key: string]: number } = {};
    processedItems.forEach((item) => {
      if (item.taxPercentage > 0) {
        const key = item.taxPercentage.toFixed(2);
        const taxAmount = isCredit ? -item.tax : item.tax;
        taxGroups[key] = (taxGroups[key] || 0) + taxAmount;
      }
    });

    // Draw dark left column background
    doc
      .rect(0, 0, leftColumnWidth, pageHeight)
      .fillColor("#1a1a1a")
      .fill()
      .fillColor("black");

    // Add vertical branding line separating columns
    doc
      .strokeColor("#1a1a1a")
      .lineWidth(3)
      .moveTo(leftColumnWidth, 0)
      .lineTo(leftColumnWidth, pageHeight)
      .stroke()
      .strokeColor("black");

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

    // INVOICE title (large, white, bold) - "CREDIT INVOICE" for credit invoices
    doc
      .fontSize(20)
      .font("Helvetica-Bold")
      .fillColor("white")
      .text(
        isReimbursement
          ? "REIMBURSEMENT"
          : isCredit
            ? "CREDIT INVOICE"
            : "INVOICE",
        leftMargin,
        currentY,
        {
          width: leftColumnWidth - leftMargin * 2,
        }
      );
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
    if (isReimbursement) {
      doc.text("Type:", leftMargin, currentY).fillColor("white");
      doc.text("Reimbursement", leftMargin, currentY + 12).fillColor("#747474");
      currentY += 30;
    }
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
      .text(isCredit ? "Credit To:" : "Billed To:", billedToX, startY);
    let billedToY = startY + 20;
    doc.fontSize(10).font("Helvetica");
    doc.text(organization.name, billedToX, billedToY, { width: sectionWidth });
    billedToY += 20;

    // Add organization contact information under "Billed To"
    // Format similar to Pay To section
    if (organization.address) {
      const addressLines = organization.address
        .split(/\n|, /)
        .filter((line) => line.trim());
      addressLines.forEach((line) => {
        doc.text(line.trim(), billedToX, billedToY, { width: sectionWidth });
        billedToY += 15;
      });
      // Add spacing after address (matching Pay To section format)
      billedToY += 5; // Total +20 spacing after last address line (15 + 5)
    } else {
      // If no address, add spacing to match Pay To section
      billedToY += 20;
    }

    // Render organization details in same format as Pay To section
    doc.fontSize(9);
    if (organization.kvkNumber) {
      doc.text(`KVK-number: ${organization.kvkNumber}`, billedToX, billedToY, {
        width: sectionWidth,
      });
      billedToY += 12;
    }

    if (organization.btwNumber) {
      doc.text(`BTW-number: ${organization.btwNumber}`, billedToX, billedToY, {
        width: sectionWidth,
      });
      billedToY += 12;
    }

    if (organization.email) {
      doc.text(`Email: ${organization.email}`, billedToX, billedToY, {
        width: sectionWidth,
      });
      billedToY += 12;
    }

    if (organization.telephone) {
      doc.text(`Phone: ${organization.telephone}`, billedToX, billedToY, {
        width: sectionWidth,
      });
      billedToY += 12;
    }

    const billedToEndY = billedToY;

    // Pay To / From section (right side, same Y position as Billed To)
    // EXO's contact information is always the same (default values)
    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .text(isCredit ? "From:" : "Pay To:", payToX, startY);
    let payToY = startY + 20;
    doc.fontSize(10).font("Helvetica");
    doc.text("EXO", payToX, payToY, { width: sectionWidth });
    payToY += 15;
    doc.text("Charlotte v Pallandthof 38,", payToX, payToY, {
      width: sectionWidth,
    });
    payToY += 15;
    doc.text("1112ZL, Diemen, Nederland", payToX, payToY, {
      width: sectionWidth,
    });
    payToY += 20;
    doc.fontSize(9);
    doc.text("KVK-number: 90251695", payToX, payToY, { width: sectionWidth });
    payToY += 12;
    doc.text("BTW-number: NL004799795B92", payToX, payToY, {
      width: sectionWidth,
    });
    payToY += 12;
    doc.text("Bank: NL61 INGB 0792 9410 39", payToX, payToY, {
      width: sectionWidth,
    });

    // Set currentY to the maximum of both sections
    currentY = Math.max(billedToEndY, payToY) + 40;

    // Invoice items table
    const tableStartY = currentY;
    const tableWidth = rightColumnWidth - rightMargin * 2;
    const qtyWidth = 50;
    const taxPctWidth = 30; // Narrow column for tax percentage (max 3-4 chars like "21%")
    const descWidth = tableWidth - qtyWidth - taxPctWidth - 100 - 100; // Remaining after QTY, Tax %, Price, Amount
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
      "Tax %",
      rightColumnStart + rightMargin + qtyWidth + descWidth,
      tableStartY,
      { width: taxPctWidth, align: "right" }
    );
    doc.text(
      "Price",
      rightColumnStart + rightMargin + qtyWidth + descWidth + taxPctWidth,
      tableStartY,
      { width: priceWidth, align: "right" }
    );
    doc.text(
      "Amount",
      rightColumnStart +
        rightMargin +
        qtyWidth +
        descWidth +
        taxPctWidth +
        priceWidth,
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

    // Invoice line items
    currentY = headerLineY + 10;
    doc.fontSize(9).font("Helvetica");

    if (processedItems.length === 0) {
      // Fallback: use old single-item format if no line items
      const description =
        invoice.description ||
        (project ? `Project: ${project.title}` : "Invoice");
      const amountValue = parseNumeric(invoice.amount);
      const itemQty = 1;
      const itemPrice = isCredit ? -amountValue : amountValue;

      // For fallback, assume 0% tax if not specified
      const fallbackTaxPct = 0;
      doc.text(itemQty.toString(), rightColumnStart + rightMargin, currentY);
      doc.text(
        description,
        rightColumnStart + rightMargin + qtyWidth,
        currentY,
        { width: descWidth }
      );
      doc.text(
        `${fallbackTaxPct}%`,
        rightColumnStart + rightMargin + qtyWidth + descWidth,
        currentY,
        { width: taxPctWidth, align: "right" }
      );
      doc.text(
        formatCurrency(itemPrice, currency),
        rightColumnStart + rightMargin + qtyWidth + descWidth + taxPctWidth,
        currentY,
        { width: priceWidth, align: "right" }
      );
      doc.text(
        formatCurrency(itemPrice, currency),
        rightColumnStart +
          rightMargin +
          qtyWidth +
          descWidth +
          taxPctWidth +
          priceWidth,
        currentY,
        { width: amountWidth, align: "right" }
      );
      currentY += 30;
    } else {
      // Display line items
      processedItems.forEach((item) => {
        // const itemSubtotal = isCredit ? -item.subtotal : item.subtotal; // Unused but kept for potential future use
        const itemTotal = isCredit ? -item.total : item.total;
        const itemUnitPrice = isCredit ? -item.unitPrice : item.unitPrice;

        doc.text(
          item.quantity.toString(),
          rightColumnStart + rightMargin,
          currentY
        );
        doc.text(
          item.description,
          rightColumnStart + rightMargin + qtyWidth,
          currentY,
          { width: descWidth }
        );
        doc.text(
          `${item.taxPercentage}%`,
          rightColumnStart + rightMargin + qtyWidth + descWidth,
          currentY,
          { width: taxPctWidth, align: "right" }
        );
        doc.text(
          formatCurrency(itemUnitPrice, currency),
          rightColumnStart + rightMargin + qtyWidth + descWidth + taxPctWidth,
          currentY,
          { width: priceWidth, align: "right" }
        );
        doc.text(
          formatCurrency(itemTotal, currency),
          rightColumnStart +
            rightMargin +
            qtyWidth +
            descWidth +
            taxPctWidth +
            priceWidth,
          currentY,
          { width: amountWidth, align: "right" }
        );
        currentY += 25;
      });
    }

    currentY += 15;

    // Totals section
    const totalsStartX =
      rightColumnStart + rightMargin + qtyWidth + descWidth + taxPctWidth;

    doc.fontSize(9).font("Helvetica");
    doc.text("Sub Total", totalsStartX, currentY, {
      width: priceWidth,
      align: "right",
    });
    doc.text(
      formatCurrency(grandSubtotal, currency),
      totalsStartX + priceWidth,
      currentY,
      { width: amountWidth, align: "right" }
    );
    currentY += 15;

    // Always show tax line (even if 0.00)
    const sortedTaxKeys = Object.keys(taxGroups).sort(
      (a, b) => parseFloat(b) - parseFloat(a)
    );
    if (sortedTaxKeys.length > 0) {
      // Show tax grouped by percentage
      sortedTaxKeys.forEach((taxKey) => {
        const taxPercentage = parseFloat(taxKey);
        const taxAmount = taxGroups[taxKey];
        doc.text(`${taxPercentage}% Tax`, totalsStartX, currentY, {
          width: priceWidth,
          align: "right",
        });
        doc.text(
          formatCurrency(taxAmount, currency),
          totalsStartX + priceWidth,
          currentY,
          { width: amountWidth, align: "right" }
        );
        currentY += 15;
      });
    } else {
      // No tax items, but still show 0.00 tax
      doc.text("Tax", totalsStartX, currentY, {
        width: priceWidth,
        align: "right",
      });
      doc.text(
        formatCurrency(grandVat, currency),
        totalsStartX + priceWidth,
        currentY,
        { width: amountWidth, align: "right" }
      );
      currentY += 15;
    }

    doc.fontSize(10).font("Helvetica-Bold").fillColor("black");
    doc.text("Total Due", totalsStartX, currentY, {
      width: priceWidth,
      align: "right",
    });

    // Render currency symbol in regular font, number in bold
    const formattedAmount = formatCurrency(grandTotal, currency);
    const symbol = currency === "USD" ? "$" : "€";
    const space = currency === "EUR" ? " " : "";
    const numberPart = formattedAmount.replace(`${symbol}${space}`, "");

    // Calculate positions for right alignment
    const amountX = totalsStartX + priceWidth;
    doc.font("Helvetica").fillColor("black");
    const symbolText = `${symbol}${space}`;
    const symbolWidth = doc.widthOfString(symbolText, { fontSize: 10 });

    doc.font("Helvetica-Bold").fillColor("black");
    const numberWidth = doc.widthOfString(numberPart, { fontSize: 10 });
    const totalWidth = symbolWidth + numberWidth;

    // Render symbol in regular font (positioned first from the right)
    doc.font("Helvetica").fillColor("black");
    doc.text(symbolText, amountX + amountWidth - totalWidth, currentY);

    // Render number in bold (positioned right after symbol)
    doc.font("Helvetica-Bold").fillColor("black");
    doc.text(
      numberPart,
      amountX + amountWidth - totalWidth + symbolWidth,
      currentY
    );

    // Add KOR text at the bottom if enabled
    if (isKOR) {
      currentY += 30;
      doc.fontSize(8).font("Helvetica").fillColor("#666666");
      doc.text(
        "Factuur vrijgesteld van OB o.g.v. artikel 25 Wet OB",
        rightColumnStart + rightMargin,
        currentY,
        { width: rightColumnWidth - rightMargin * 2, align: "center" }
      );
    }

    doc.end();
  });
}
