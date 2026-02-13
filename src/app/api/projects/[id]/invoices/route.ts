import { createClient } from "@/lib/supabase/server";
import { canUserAccessProject, getInvoicesByProjectId } from "@/lib/db/queries";
import { NextResponse } from "next/server";

/**
 * Get invoices for a project. Allows access for users who can view the project
 * (clients). Returns only sent, paid, and overdue invoices (not draft/cancelled).
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

    const invoices = await getInvoicesByProjectId(projectId);

    // Only show sent, paid, overdue to clients (not draft or cancelled)
    const clientVisibleStatuses = ["sent", "paid", "overdue"];
    const visibleInvoices = invoices.filter((inv) =>
      clientVisibleStatuses.includes(inv.status)
    );

    return NextResponse.json(visibleInvoices);
  } catch (error) {
    console.error("Error fetching project invoices:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
