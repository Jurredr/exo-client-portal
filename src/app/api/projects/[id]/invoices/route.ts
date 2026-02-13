import { createClient } from "@/lib/supabase/server";
import { canUserAccessProject, getInvoicesByProjectId } from "@/lib/db/queries";
import { db } from "@/db";
import { invoiceLineItems } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { calculateTotalFromLineItems } from "@/lib/utils/currency";
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

    if (visibleInvoices.length === 0) {
      return NextResponse.json([]);
    }

    // Fetch line items to compute Total (for reimbursements, same as InvoicesTable)
    const invoiceIds = visibleInvoices.map((i) => i.id);
    const lineItems = await db
      .select()
      .from(invoiceLineItems)
      .where(inArray(invoiceLineItems.invoiceId, invoiceIds));

    const lineItemsByInvoice = new Map<
      string,
      Array<{ quantity: string; unitPrice: string; taxPercentage: string }>
    >();
    lineItems.forEach((item) => {
      const list = lineItemsByInvoice.get(item.invoiceId) || [];
      list.push({
        quantity: item.quantity?.toString() || "1",
        unitPrice: item.unitPrice?.toString() || "0",
        taxPercentage: item.taxPercentage?.toString() || "0",
      });
      lineItemsByInvoice.set(item.invoiceId, list);
    });

    const result = visibleInvoices.map((inv) => {
      const items = lineItemsByInvoice.get(inv.id) || [];
      let numericAmount: number;
      if (items.length > 0) {
        numericAmount = calculateTotalFromLineItems(items);
      } else {
        numericAmount =
          parseFloat(String(inv.amount).replace(/[€$,\s]/g, "")) || 0;
      }
      if (inv.transactionType === "credit") {
        numericAmount = -Math.abs(numericAmount);
      }
      return {
        ...inv,
        displayAmount: numericAmount,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching project invoices:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
