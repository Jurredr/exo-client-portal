import { createClient } from "@/lib/supabase/server";
import {
  getAllInvoices,
  isUserInEXOOrganization,
  createInvoice,
  getNextInvoiceNumber,
  deleteInvoice,
  updateInvoice,
  getInvoiceById,
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
      currency,
      status,
      type,
      transactionType,
      description,
      dueDate,
      autoGenerate,
      pdfUrl,
      pdfFileName,
      pdfFileType,
      invoiceNumber: invoiceNumberOverride,
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

    // Use provided invoice number or generate one
    const invoiceNumber = invoiceNumberOverride
      ? invoiceNumberOverride.trim()
      : await getNextInvoiceNumber();

    try {
      const invoice = await createInvoice({
        invoiceNumber,
        projectId: projectId || null,
        organizationId,
        amount,
        currency: currency || "EUR",
        status: status || "draft",
        type: type || "manual",
        transactionType: transactionType || "debit",
        description: description || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        pdfUrl: pdfUrl || null,
        pdfFileName: pdfFileName || null,
        pdfFileType: pdfFileType || null,
      });

      return NextResponse.json(invoice, { status: 201 });
    } catch (dbError: any) {
      // Check if it's a unique constraint violation
      if (
        dbError?.code === "23505" ||
        dbError?.message?.includes("unique") ||
        dbError?.message?.includes("duplicate")
      ) {
        return NextResponse.json(
          { error: `Invoice number "${invoiceNumber}" already exists` },
          { status: 400 }
        );
      }
      throw dbError;
    }
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

export async function PATCH(request: Request) {
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
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Invoice ID is required" },
        { status: 400 }
      );
    }

    // Verify the invoice exists
    const existingInvoice = await getInvoiceById(id);
    if (!existingInvoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const invoice = await updateInvoice(id, {
      ...(updateData.organizationId && {
        organizationId: updateData.organizationId,
      }),
      ...(updateData.projectId !== undefined && {
        projectId: updateData.projectId || null,
      }),
      ...(updateData.amount && { amount: updateData.amount }),
      ...(updateData.currency && { currency: updateData.currency }),
      ...(updateData.status && { status: updateData.status }),
      ...(updateData.transactionType && {
        transactionType: updateData.transactionType,
      }),
      ...(updateData.description !== undefined && {
        description: updateData.description?.trim() || null,
      }),
      ...(updateData.dueDate !== undefined && {
        dueDate: updateData.dueDate ? new Date(updateData.dueDate) : null,
      }),
      ...(updateData.paidAt !== undefined && {
        paidAt: updateData.paidAt ? new Date(updateData.paidAt) : null,
      }),
      ...(updateData.pdfUrl !== undefined && {
        pdfUrl: updateData.pdfUrl || null,
      }),
      ...(updateData.pdfFileName !== undefined && {
        pdfFileName: updateData.pdfFileName || null,
      }),
      ...(updateData.pdfFileType !== undefined && {
        pdfFileType: updateData.pdfFileType || null,
      }),
    });

    return NextResponse.json(invoice);
  } catch (error) {
    console.error("Error updating invoice:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
