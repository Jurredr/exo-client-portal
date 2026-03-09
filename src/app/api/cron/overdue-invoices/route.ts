/**
 * Cron: daily at 23:00 UTC (= midnight Amsterdam in winter/CET).
 * Vercel cron uses UTC only; in summer (CEST) this runs at 01:00 Amsterdam.
 */
import { NextResponse } from "next/server";
import { markOverdueInvoices } from "@/lib/db/queries";
import { getResendClient } from "@/lib/email/resend";
import { EXO_EMAIL } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const vercelCronHeader = request.headers.get("x-vercel-cron");

  // Allow: Bearer CRON_SECRET, or x-vercel-cron (Vercel sends this for cron invocations),
  // or no auth when CRON_SECRET is not set (local testing)
  const isAuthorized =
    !cronSecret || authHeader === `Bearer ${cronSecret}` || !!vercelCronHeader;

  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const updated = await markOverdueInvoices();

    if (updated.length > 0) {
      const resend = getResendClient();
      const from =
        process.env.RESEND_FROM_EMAIL ?? "Portal <noreply@exo.black>";
      const to = process.env.OVERDUE_ALERT_EMAIL ?? EXO_EMAIL;

      if (resend && to) {
        const rows = updated
          .map(
            (i) =>
              `<tr><td>${i.invoiceNumber}</td><td>${i.companyName}</td><td>${formatDate(i.dueDate)}</td></tr>`
          )
          .join("");
        await resend.emails.send({
          from,
          to: [to],
          subject: `Overdue invoices: ${updated.length} marked as overdue`,
          html: `
            <p>The following invoices were automatically marked as overdue:</p>
            <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse;">
              <thead><tr><th>Invoice #</th><th>Organization</th><th>Due Date</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          `,
        });
      }
    }

    return NextResponse.json({ success: true, updated: updated.length });
  } catch (error) {
    console.error("Cron overdue-invoices error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
