import { createClient } from "@/lib/supabase/server";
import { getInvoiceById, isUserInEXOOrganization } from "@/lib/db/queries";
import { NextResponse } from "next/server";
import { generateInvoicePDF } from "@/lib/utils/invoice-pdf";
import { downloadInvoicePDF } from "@/lib/utils/invoice-storage";
import { createHash } from "crypto";

// Force dynamic rendering to always fetch fresh organization data
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isInEXO = await isUserInEXOOrganization(user.email);
    if (!isInEXO) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Await params in Next.js 16
    const resolvedParams = await params;
    const id = resolvedParams.id;

    if (!id) {
      return NextResponse.json(
        { error: "Invoice ID is required" },
        { status: 400 }
      );
    }

    const invoiceData = await getInvoiceById(id);
    if (!invoiceData) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Create ETag based on invoice ID and updatedAt for cache validation
    const etag = createHash("md5")
      .update(`${id}-${invoiceData.invoice.updatedAt}`)
      .digest("hex");

    // Check If-None-Match header for 304 Not Modified
    const ifNoneMatch = request.headers.get("if-none-match");
    if (ifNoneMatch === `"${etag}"`) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: `"${etag}"`,
          "Cache-Control": "public, max-age=3600, must-revalidate",
        },
      });
    }

    // Check if there's a PDF in Storage
    if (invoiceData.invoice.pdfStoragePath) {
      try {
        const pdfBuffer = await downloadInvoicePDF(
          invoiceData.invoice.pdfStoragePath
        );
        if (pdfBuffer) {
          const filename =
            invoiceData.invoice.pdfFileName ||
            `${invoiceData.invoice.invoiceNumber}.pdf`;

          return new NextResponse(new Uint8Array(pdfBuffer), {
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename="${filename}"`,
              ETag: `"${etag}"`,
              "Cache-Control": "public, max-age=3600, must-revalidate",
              "Last-Modified": new Date(
                invoiceData.invoice.updatedAt
              ).toUTCString(),
            },
          });
        }
      } catch (error) {
        console.error("Error downloading PDF from Storage:", error);
        // Fall through to generate PDF if download fails
      }
    }

    // If no PDF in Storage, generate PDF
    // HTTP caching headers will handle browser/CDN caching
    const pdfBuffer = await generateInvoicePDF(invoiceData);

    // Return PDF as response with caching headers
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoiceData.invoice.invoiceNumber}.pdf"`,
        ETag: `"${etag}"`,
        "Cache-Control": "public, max-age=3600, must-revalidate",
        "Last-Modified": new Date(invoiceData.invoice.updatedAt).toUTCString(),
      },
    });
  } catch (error) {
    console.error("Error generating invoice PDF:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
