import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUserInEXOCompany } from "@/lib/db/queries";
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

const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword", // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "image/jpeg",
  "image/png",
  "image/gif",
];

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

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const offerId = formData.get("offerId") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Only PDF, Word, and image files are allowed" },
        { status: 400 }
      );
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size exceeds 10MB limit" },
        { status: 400 }
      );
    }

    const tempOfferId =
      offerId ||
      `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const storagePath = `${STORAGE_FOLDER}/${tempOfferId}-${timestamp}-${sanitizedFileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const fileSize = arrayBuffer.byteLength;

    // Use admin client for upload to bypass RLS (user already verified above)
    const uploadClient = createAdminClient() ?? supabase;
    let { data, error } = await uploadClient.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    // If bucket not found, try to create it (requires SUPABASE_SERVICE_ROLE_KEY)
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
          .upload(storagePath, arrayBuffer, {
            contentType: file.type,
            upsert: false,
          });
        data = retry.data;
        error = retry.error;
      }
    }

    if (error) {
      console.error("Error uploading offer file to Storage:", error);
      const isBucketError =
        error?.message?.toLowerCase().includes("bucket") ||
        (error &&
          "statusCode" in error &&
          (error as { statusCode?: number }).statusCode === 404);
      if (isBucketError) {
        return NextResponse.json(
          {
            error:
              "Storage bucket 'offers' not found. Create it in Supabase Dashboard > Storage, or add SUPABASE_SERVICE_ROLE_KEY to enable auto-creation.",
          },
          { status: 500 }
        );
      }
      if (
        error?.message?.toLowerCase().includes("row-level security") ||
        (error &&
          "statusCode" in error &&
          (error as { statusCode?: number }).statusCode === 403)
      ) {
        return NextResponse.json(
          {
            error:
              "Storage upload denied. Add SUPABASE_SERVICE_ROLE_KEY to .env.local to enable server-side uploads.",
          },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { error: "Failed to upload file to Storage" },
        { status: 500 }
      );
    }

    if (!data?.path) {
      return NextResponse.json(
        { error: "Failed to upload file to Storage" },
        { status: 500 }
      );
    }
    return NextResponse.json({
      storagePath: data.path,
      sizeBytes: fileSize,
      fileName: file.name,
    });
  } catch (error) {
    console.error("Error uploading offer file:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
