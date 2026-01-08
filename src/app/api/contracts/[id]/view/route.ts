import { createClient } from "@/lib/supabase/server";
import { getContractById, isUserInEXOOrganization } from "@/lib/db/queries";
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

    const isInEXO = await isUserInEXOOrganization(user.email);
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

    // If contract has a file URL, handle it appropriately
    if (contractData.contract.fileUrl) {
      // If it's a data URL (base64), extract and return it
      if (contractData.contract.fileUrl.startsWith("data:")) {
        // Extract base64 data from data URL
        // Format: data:application/pdf;base64,<base64data>
        const base64Match = contractData.contract.fileUrl.match(/^data:.*?;base64,(.+)$/);
        if (base64Match && base64Match[1]) {
          const base64Data = base64Match[1];
          const pdfBuffer = Buffer.from(base64Data, "base64");
          
          return new NextResponse(new Uint8Array(pdfBuffer), {
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `inline; filename="${contractData.contract.name}.pdf"`,
            },
          });
        }
      } else {
        // If it's a regular URL, redirect to it
        return NextResponse.redirect(contractData.contract.fileUrl);
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
