import { createClient } from "@/lib/supabase/server";
import {
  getAllInvoices,
  getAllInvoicesPaginated,
  getAllInvoicesCount,
  isUserInEXOOrganization,
  createInvoice,
  getNextInvoiceNumber,
  deleteInvoice,
  updateInvoice,
  getInvoiceById,
  invalidateAllInvoiceCaches,
} from "@/lib/db/queries";
import { NextResponse } from "next/server";

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

    // Support pagination
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "50");
    const usePagination = searchParams.get("paginate") === "true";

    if (usePagination) {
      // Validate pagination
      const limit = Math.min(Math.max(pageSize, 1), 100); // Max 100 per page
      const offset = (page - 1) * limit;

      const invoices = await getAllInvoicesPaginated({ limit, offset });
      const totalCount = await getAllInvoicesCount();

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
    }

    // Fallback to non-paginated for backward compatibility
    const invoices = await getAllInvoices();

    // Add caching headers to reduce database queries
    return NextResponse.json(invoices, {
      headers: {
        "Cache-Control": "private, max-age=60, must-revalidate", // Cache for 1 minute
      },
    });
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
      vatIncluded,
      isKOR,
      description,
      invoiceDate,
      dueDate,
      pdfStoragePath, // Path in Supabase Storage
      pdfFileName,
      pdfFileType,
      pdfSizeBytes,
      invoiceNumber: invoiceNumberOverride,
      lineItems,
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
    let invoiceNumber = invoiceNumberOverride
      ? invoiceNumberOverride.trim()
      : await getNextInvoiceNumber();

    // Retry logic for duplicate invoice numbers (handles race conditions)
    let retries = 0;
    const maxRetries = 5;

    while (retries < maxRetries) {
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
          vatIncluded: vatIncluded !== undefined ? vatIncluded : null,
          isKOR: isKOR || false,
          description: description || null,
          invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
          dueDate: dueDate ? new Date(dueDate) : null,
          pdfStoragePath: pdfStoragePath || null,
          pdfFileName: pdfFileName || null,
          pdfFileType: pdfFileType || null,
          pdfSizeBytes: pdfSizeBytes || null,
          lineItems: lineItems || undefined,
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
      ...(updateData.pdfFileType !== undefined && {
        pdfFileType: updateData.pdfFileType || null,
      }),
      ...(updateData.pdfSizeBytes !== undefined && {
        pdfSizeBytes: updateData.pdfSizeBytes || null,
      }),
      ...(updateData.lineItems !== undefined && {
        lineItems: updateData.lineItems,
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
