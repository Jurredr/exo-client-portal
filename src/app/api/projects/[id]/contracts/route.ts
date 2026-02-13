import { createClient } from "@/lib/supabase/server";
import {
  canUserAccessProject,
  getContractsByProjectId,
} from "@/lib/db/queries";
import { NextResponse } from "next/server";

/**
 * Get contracts for a project. Allows access for users who can view the project
 * (clients).
 */
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

    const { id: projectId } = await params;

    const hasAccess = await canUserAccessProject(user.email, projectId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const contracts = await getContractsByProjectId(projectId);

    return NextResponse.json(contracts);
  } catch (error) {
    console.error("Error fetching project contracts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
