import { createClient } from "@/lib/supabase/server";
import {
  getContractById,
  isUserInEXOOrganization,
  getUserByEmail,
} from "@/lib/db/queries";
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

    const { id } = await params;
    const contractData = await getContractById(id);
    
    if (!contractData) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    // Check if user can access this contract
    const isInEXO = await isUserInEXOOrganization(user.email);
    const dbUser = await getUserByEmail(user.email);
    
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // User must be in EXO or in the contract's organization
    const canAccess = isInEXO || 
      (dbUser.organizationId === contractData.organization.id);

    if (!canAccess) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(contractData);
  } catch (error) {
    console.error("Error fetching contract:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}


