import { createClient } from "@/lib/supabase/server";
import {
  getAllInvoicesPaginated,
  getAllInvoicesCount,
  isUserInEXOOrganization,
  createInvoice,
  getNextInvoiceNumber,
  deleteInvoice,
  updateInvoice,
  getInvoiceById,
  getExpenseById,
  invalidateAllInvoiceCaches,
} from "@/lib/db/queries";
import { NextResponse } from "next/server";

function parseMoney(amount: string): number {
  if (!amount) return 0;
  const cleaned = amount.replace(/[€$,\s]/g, "").trim();
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(request: Request) {
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

    // Check if requesting next invoice number
    if (searchParams.get("nextNumber") === "true") {
      const nextNumber = await getNextInvoiceNumber();
      return NextResponse.json({ invoiceNumber: nextNumber });
    }

    // Support pagination (default behavior now)
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "10");
    const status = searchParams.get("status") || undefined;
    const type = searchParams.get("type") || undefined;
    const search = searchParams.get("search") || undefined;

    // Validate pagination
    const limit = Math.min(Math.max(pageSize, 1), 100); // Max 100 per page
    const offset = (page - 1) * limit;

    const filters = {
      ...(status && { status }),
      ...(type && { type }),
      ...(search && { search }),
    };

    const invoices = await getAllInvoicesPaginated({
      limit,
      offset,
      ...filters,
    });
    const totalCount = await getAllInvoicesCount(filters);

    return NextResponse.json(
      {
        data: invoices,
        pagination: {
          page,
          pageSize: limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      },
      {
        headers: {
          "Cache-Control": "private, max-age=60, must-revalidate", // Cache for 1 minute
        },
      }
    );
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
      expenseId,
      amount,
      currency,
      status,
      type,
      transactionType,
      vatIncluded,
      isKOR,
      description,
      invoiceDate,
      dueDate,
      pdfStoragePath, // Path in Supabase Storage
      pdfFileName,
      pdfSizeBytes,
      invoiceNumber: invoiceNumberOverride,
      lineItems,
    } = body;

    const normalizedExpenseId =
      typeof expenseId === "string" && expenseId.trim()
        ? expenseId.trim()
        : null;

    if (!organizationId || typeof organizationId !== "string") {
      return NextResponse.json(
        { error: "Organization ID is required" },
        { status: 400 }
      );
    }

    if ((!amount || typeof amount !== "string") && !normalizedExpenseId) {
      return NextResponse.json(
        { error: "Amount is required (unless this is a reimbursement)" },
        { status: 400 }
      );
    }

    // Use provided invoice number or generate one
    let invoiceNumber = invoiceNumberOverride
      ? invoiceNumberOverride.trim()
      : await getNextInvoiceNumber();

    // Retry logic for duplicate invoice numbers (handles race conditions)
    let retries = 0;
    const maxRetries = 5;

    while (retries < maxRetries) {
      try {
        // If expenseId is provided, this invoice is a reimbursement linked 1:1 to an expense.
        // In that case, we force 0% tax and generate a single line item from the expense.
        let finalAmount = amount;
        let finalCurrency = currency || "EUR";
        let finalIsKOR = isKOR || false;
        let finalLineItems = lineItems || undefined;

        if (normalizedExpenseId) {
          const expense = await getExpenseById(normalizedExpenseId);
          if (!expense) {
            return NextResponse.json(
              { error: "Expense not found" },
              { status: 400 }
            );
          }

          const expenseAmount = parseMoney(expense.expense.amount).toFixed(2);
          finalAmount = expenseAmount;
          finalCurrency = expense.expense.currency || "EUR";
          finalIsKOR = false; // reimbursement is not KOR; tax is handled via 0% line item
          finalLineItems = [
            {
              description: `Reimbursement: ${expense.expense.description}`,
              quantity: "1",
              unitPrice: expenseAmount,
              taxPercentage: "0",
              order: 0,
            },
          ];
        }

        const invoice = await createInvoice({
          invoiceNumber,
          projectId: projectId || null,
          organizationId,
          expenseId: normalizedExpenseId,
          amount: finalAmount,
          currency: finalCurrency,
          status: status || "draft",
          type: type || "manual",
          transactionType: transactionType || "debit",
          vatIncluded: vatIncluded !== undefined ? vatIncluded : null,
          isKOR: finalIsKOR,
          description: description || null,
          invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
          dueDate: dueDate ? new Date(dueDate) : null,
          pdfStoragePath: pdfStoragePath || null,
          pdfFileName: pdfFileName || null,
          pdfSizeBytes: pdfSizeBytes || null,
          lineItems: finalLineItems,
        });

        return NextResponse.json(invoice, { status: 201 });
      } catch (dbError: unknown) {
        // Check if it's a unique constraint violation
        const error = dbError as { code?: string; message?: string };
        if (
          (error?.code === "23505" ||
            error?.message?.includes("unique") ||
            error?.message?.includes("duplicate")) &&
          !invoiceNumberOverride
        ) {
          // If it's a duplicate and we didn't override, generate a new number and retry
          retries++;
          if (retries < maxRetries) {
            invoiceNumber = await getNextInvoiceNumber();
            continue;
          }
          return NextResponse.json(
            {
              error: `Failed to generate unique invoice number after ${maxRetries} attempts`,
            },
            { status: 500 }
          );
        }
        // If it's a duplicate with override, return error
        if (
          error?.code === "23505" ||
          error?.message?.includes("unique") ||
          error?.message?.includes("duplicate")
        ) {
          return NextResponse.json(
            { error: `Invoice number "${invoiceNumber}" already exists` },
            { status: 400 }
          );
        }
        throw dbError;
      }
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

    const normalizedExpenseId =
      typeof updateData.expenseId === "string" && updateData.expenseId.trim()
        ? updateData.expenseId.trim()
        : updateData.expenseId === null
          ? null
          : undefined;

    // If expenseId is being set/changed, force reimbursement rules (0% tax, 1 line item derived from expense).
    let reimbursementOverride:
      | {
          expenseId: string | null;
          amount?: string;
          currency?: string;
          isKOR?: boolean;
          lineItems?: Array<{
            description: string;
            quantity: string;
            unitPrice: string;
            taxPercentage: string;
            order: number;
          }>;
        }
      | undefined;

    if (normalizedExpenseId !== undefined) {
      if (normalizedExpenseId) {
        const expense = await getExpenseById(normalizedExpenseId);
        if (!expense) {
          return NextResponse.json(
            { error: "Expense not found" },
            { status: 400 }
          );
        }

        const expenseAmount = parseMoney(expense.expense.amount).toFixed(2);
        reimbursementOverride = {
          expenseId: normalizedExpenseId,
          amount: expenseAmount,
          currency: expense.expense.currency || "EUR",
          isKOR: false,
          lineItems: [
            {
              description: `Reimbursement: ${expense.expense.description}`,
              quantity: "1",
              unitPrice: expenseAmount,
              taxPercentage: "0",
              order: 0,
            },
          ],
        };
      } else {
        // Clearing the reimbursement link
        reimbursementOverride = { expenseId: null };
      }
    }

    const invoice = await updateInvoice(id, {
      ...(reimbursementOverride || {}),
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
      ...(updateData.vatIncluded !== undefined && {
        vatIncluded: updateData.vatIncluded,
      }),
      ...(updateData.isKOR !== undefined && {
        isKOR: updateData.isKOR,
      }),
      ...(updateData.description !== undefined && {
        description: updateData.description?.trim() || null,
      }),
      ...(updateData.invoiceDate !== undefined && {
        invoiceDate: updateData.invoiceDate
          ? new Date(updateData.invoiceDate)
          : null,
      }),
      ...(updateData.dueDate !== undefined && {
        dueDate: updateData.dueDate ? new Date(updateData.dueDate) : null,
      }),
      ...(updateData.paidAt !== undefined && {
        paidAt: updateData.paidAt ? new Date(updateData.paidAt) : null,
      }),
      ...(updateData.pdfStoragePath !== undefined && {
        pdfStoragePath: updateData.pdfStoragePath || null,
      }),
      ...(updateData.pdfFileName !== undefined && {
        pdfFileName: updateData.pdfFileName || null,
      }),
      ...(updateData.pdfSizeBytes !== undefined && {
        pdfSizeBytes: updateData.pdfSizeBytes || null,
      }),
      ...(reimbursementOverride?.lineItems
        ? { lineItems: reimbursementOverride.lineItems }
        : updateData.lineItems !== undefined
          ? { lineItems: updateData.lineItems }
          : {}),
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

// Endpoint to invalidate all invoice caches
export async function PUT(request: Request) {
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
    if (body.action !== "invalidate-cache") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    await invalidateAllInvoiceCaches();
    return NextResponse.json({
      success: true,
      message: "All invoice caches invalidated",
    });
  } catch (error) {
    console.error("Error invalidating invoice caches:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
