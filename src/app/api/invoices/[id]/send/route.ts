import { createClient } from "@/lib/supabase/server";
import {
  getInvoiceById,
  isUserInEXOCompany,
  updateInvoice,
} from "@/lib/db/queries";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { downloadInvoicePDF } from "@/lib/utils/invoice-storage";
import { generateInvoicePDF } from "@/lib/utils/invoice-pdf";

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "EXO <exo@jurre.me>";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isInEXO = await isUserInEXOCompany(user.email);
    if (!isInEXO) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "RESEND_API_KEY not configured" },
        { status: 503 }
      );
    }

    const body = await request.json();
    const {
      to,
      subject,
      body: emailBody,
    } = body as {
      to: string;
      subject?: string;
      body?: string;
    };

    if (!to?.trim()) {
      return NextResponse.json(
        { error: "Recipient email (to) is required" },
        { status: 400 }
      );
    }

    const invoiceData = await getInvoiceById(invoiceId);
    if (!invoiceData) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    let pdfBuffer: Buffer | null = null;
    if (invoiceData.invoice.pdfStoragePath) {
      pdfBuffer = await downloadInvoicePDF(invoiceData.invoice.pdfStoragePath);
    }
    if (!pdfBuffer) {
      pdfBuffer = await generateInvoicePDF(invoiceData);
    }

    const fileName =
      invoiceData.invoice.pdfFileName ||
      `${invoiceData.invoice.invoiceNumber}.pdf`;

    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to.trim()],
      subject:
        subject?.trim() || `Factuur ${invoiceData.invoice.invoiceNumber} - EXO`,
      html: emailBody?.trim() || getDefaultInvoiceEmailBody(invoiceData),
      attachments: [
        {
          filename: fileName,
          content: pdfBuffer,
        },
      ],
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json(
        { error: error.message || "Failed to send email" },
        { status: 500 }
      );
    }

    await updateInvoice(invoiceId, {
      sentAt: new Date(),
      sentToEmail: to.trim(),
      status: invoiceData.invoice.status === "draft" ? "sent" : undefined,
    });

    return NextResponse.json({
      success: true,
      messageId: data?.id,
      sentTo: to.trim(),
    });
  } catch (error) {
    console.error("Error sending invoice email:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}

function getDefaultInvoiceEmailBody(invoiceData: {
  invoice: { invoiceNumber: string; amount: string; currency: string };
  company?: { name: string } | null;
}) {
  const companyName = invoiceData.company?.name || "de klant";
  return `
<p>Beste ${companyName},</p>
<p>Hierbij ontvangt u factuur <strong>${invoiceData.invoice.invoiceNumber}</strong> ter waarde van <strong>${invoiceData.invoice.amount} ${invoiceData.invoice.currency}</strong>.</p>
<p>De factuur is als PDF bijgevoegd.</p>
<p>Met vriendelijke groet,<br>EXO</p>
  `.trim();
}
