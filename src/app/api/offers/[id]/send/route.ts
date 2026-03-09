import { createClient } from "@/lib/supabase/server";
import {
  getOfferById,
  isUserInEXOCompany,
  updateOffer,
} from "@/lib/db/queries";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { downloadOfferFile } from "@/lib/utils/file-storage";
import { generateOfferPDF } from "@/lib/utils/offer-pdf";

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "EXO <exo@jurre.me>";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: offerId } = await params;
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

    const offerData = await getOfferById(offerId);
    if (!offerData) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    let pdfBuffer: Buffer | null = null;
    if (offerData.offer.fileStoragePath) {
      pdfBuffer = await downloadOfferFile(offerData.offer.fileStoragePath);
    }
    if (!pdfBuffer && offerData.offer.content) {
      pdfBuffer = await generateOfferPDF(offerData.offer.content);
    }

    if (!pdfBuffer) {
      return NextResponse.json(
        { error: "Offer has no PDF or content to send" },
        { status: 400 }
      );
    }

    const fileName =
      offerData.offer.fileName || `offer-${offerData.offer.id}.pdf`;

    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to.trim()],
      subject: subject?.trim() || `Offerte - EXO`,
      html: emailBody?.trim() || getDefaultOfferEmailBody(offerData),
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

    await updateOffer(offerId, {
      sentAt: new Date(),
      sentToEmail: to.trim(),
      status: offerData.offer.status === "draft" ? "sent" : undefined,
    });

    return NextResponse.json({
      success: true,
      messageId: data?.id,
      sentTo: to.trim(),
    });
  } catch (error) {
    console.error("Error sending offer email:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}

function getDefaultOfferEmailBody(offerData: {
  offer: { note?: string | null };
  project?: { title: string } | null;
}) {
  const projectTitle = offerData.project?.title || "het project";
  return `
<p>Beste,</p>
<p>Hierbij ontvangt u onze offerte voor <strong>${projectTitle}</strong>.</p>
${offerData.offer.note ? `<p>${offerData.offer.note}</p>` : ""}
<p>De offerte is als PDF bijgevoegd.</p>
<p>Met vriendelijke groet,<br>EXO</p>
  `.trim();
}
