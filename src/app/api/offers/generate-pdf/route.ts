import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUserInEXOCompany } from "@/lib/db/queries";
import { generateOfferPDF } from "@/lib/utils/offer-pdf";
import { NextResponse } from "next/server";

const STORAGE_BUCKET = "offers";
const STORAGE_FOLDER = "offers";

async function ensureOffersBucketExists() {
  const admin = createAdminClient();
  if (!admin) return false;

  const { data: buckets } = await admin.storage.listBuckets();
  if (buckets?.some((b) => b.name === STORAGE_BUCKET)) return true;

  const { error } = await admin.storage.createBucket(STORAGE_BUCKET, {
    public: false,
  });
  return !error;
}

export async function POST(request: Request) {
  try {
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

    const body = await request.json();
    const { content } = body as { content?: string };

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    const pdfBuffer = await generateOfferPDF(content);
    const tempOfferId = `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const timestamp = Date.now();
    const fileName = `offer-${tempOfferId}-${timestamp}.pdf`;
    const storagePath = `${STORAGE_FOLDER}/${fileName}`;

    const uploadClient = createAdminClient() ?? supabase;
    let { data, error } = await uploadClient.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    const isBucketNotFound =
      error?.message?.toLowerCase().includes("bucket") ||
      (error &&
        "statusCode" in error &&
        (error as { statusCode?: number }).statusCode === 404);
    if (isBucketNotFound && createAdminClient()) {
      const created = await ensureOffersBucketExists();
      if (created) {
        const retry = await uploadClient.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, pdfBuffer, {
            contentType: "application/pdf",
            upsert: false,
          });
        data = retry.data;
        error = retry.error;
      }
    }

    if (error) {
      console.error("Error uploading generated offer PDF:", error);
      return NextResponse.json(
        { error: "Failed to upload PDF" },
        { status: 500 }
      );
    }

    if (!data?.path) {
      return NextResponse.json(
        { error: "Failed to upload PDF" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      storagePath: data.path,
      fileName,
      sizeBytes: pdfBuffer.length,
    });
  } catch (error) {
    console.error("Error generating offer PDF:", error);
    return NextResponse.json(
      { error: "Failed to generate offer PDF" },
      { status: 500 }
    );
  }
}
