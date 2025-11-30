import { createClient } from "@/lib/supabase/server";
import {
  getAllInvoices,
  isUserInEXOOrganization,
  createInvoice,
  getNextInvoiceNumber,
  deleteInvoice,
} from "@/lib/db/queries";
import { NextResponse } from "next/server";
import { calculatePaymentAmount } from "@/lib/utils/currency";

export async function GET() {
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

    const invoices = await getAllInvoices();
    return NextResponse.json(invoices);
  } catch (error) {
    console.error("Error fetching invoices:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
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

    const isInEXO = await isUserInEXOOrganization(user.email);
    if (!isInEXO) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      projectId,
      organizationId,
      amount,
      status,
      type,
      description,
      dueDate,
      autoGenerate,
    } = body;

    if (!organizationId || typeof organizationId !== "string") {
      return NextResponse.json(
        { error: "Organization ID is required" },
        { status: 400 }
      );
    }

    if (!amount || typeof amount !== "string") {
      return NextResponse.json(
        { error: "Amount is required" },
        { status: 400 }
      );
    }

    // Generate invoice number
    const invoiceNumber = await getNextInvoiceNumber();

    const invoice = await createInvoice({
      invoiceNumber,
      projectId: projectId || null,
      organizationId,
      amount,
      status: status || "draft",
      type: type || "manual",
      description: description || null,
      dueDate: dueDate ? new Date(dueDate) : null,
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    console.error("Error creating invoice:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const invoiceId = searchParams.get("id");

    if (!invoiceId) {
      return NextResponse.json(
        { error: "Invoice ID is required" },
        { status: 400 }
      );
    }

    await deleteInvoice(invoiceId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting invoice:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}


