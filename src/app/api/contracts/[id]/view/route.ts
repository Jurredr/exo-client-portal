import { createClient } from "@/lib/supabase/server";
import { getContractById, hasAdminAccess } from "@/lib/db/queries";
import { downloadContractFile } from "@/lib/utils/file-storage";
import { NextResponse } from "next/server";

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

    const isInEXO = await hasAdminAccess(user.email);
    if (!isInEXO) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const contractData = await getContractById(id);

    if (!contractData) {
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 }
      );
    }

    // Check if there's a file in Storage
    if (contractData.contract.fileStoragePath) {
      try {
        const fileBuffer = await downloadContractFile(
          contractData.contract.fileStoragePath
        );
        if (fileBuffer) {
          const filename =
            contractData.contract.fileName ||
            `${contractData.contract.name}.pdf`;

          return new NextResponse(new Uint8Array(fileBuffer), {
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `inline; filename="${filename}"`,
            },
          });
        }
      } catch (error) {
        console.error("Error downloading contract file from Storage:", error);
        // Fall through to return error
      }
    }

    // Otherwise return error
    return NextResponse.json(
      { error: "Contract file not found" },
      { status: 404 }
    );
  } catch (error) {
    console.error("Error viewing contract:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
