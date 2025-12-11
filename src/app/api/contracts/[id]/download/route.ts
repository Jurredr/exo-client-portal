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

    // If contract has a file URL, redirect to it or return it
    if (contractData.contract.fileUrl) {
      return NextResponse.redirect(contractData.contract.fileUrl);
    }

    // Otherwise return contract data (could generate PDF here if needed)
    return NextResponse.json({
      contract: contractData.contract,
      project: contractData.project,
      organization: contractData.organization,
    });
  } catch (error) {
    console.error("Error downloading contract:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}



