import { createClient } from "@/lib/supabase/server";
import {
  createExpense,
  getAllExpenses,
  isUserInEXOOrganization,
  updateExpense,
  deleteExpense,
  getExpenseById,
  getUserByEmail,
} from "@/lib/db/queries";
import { NextResponse } from "next/server";

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

    const expenses = await getAllExpenses();
    return NextResponse.json(expenses);
  } catch (error) {
    console.error("Error fetching expenses:", error);
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

    const dbUser = await getUserByEmail(user.email);
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      description,
      amount,
      currency,
      date,
      category,
      vendor,
      invoiceUrl,
      invoiceFileName,
      invoiceFileType,
    } = body;

    if (!description || typeof description !== "string" || description.trim().length === 0) {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 }
      );
    }

    if (!amount || typeof amount !== "string") {
      return NextResponse.json(
        { error: "Amount is required" },
        { status: 400 }
      );
    }

    const expenseDate = date ? new Date(date) : undefined;

    const expense = await createExpense({
      userId: dbUser.id,
      description: description.trim(),
      amount,
      currency: currency || "EUR",
      date: expenseDate,
      category: category?.trim() || null,
      vendor: vendor?.trim() || null,
      invoiceUrl: invoiceUrl || null,
      invoiceFileName: invoiceFileName || null,
      invoiceFileType: invoiceFileType || null,
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error("Error creating expense:", error);
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
        { error: "Expense ID is required" },
        { status: 400 }
      );
    }

    // Verify the expense exists
    const existingExpense = await getExpenseById(id);
    if (!existingExpense) {
      return NextResponse.json(
        { error: "Expense not found" },
        { status: 404 }
      );
    }

    const expense = await updateExpense(id, {
      ...(updateData.description && { description: updateData.description.trim() }),
      ...(updateData.amount && { amount: updateData.amount }),
      ...(updateData.currency && { currency: updateData.currency }),
      ...(updateData.date && { date: new Date(updateData.date) }),
      ...(updateData.category !== undefined && { category: updateData.category?.trim() || null }),
      ...(updateData.vendor !== undefined && { vendor: updateData.vendor?.trim() || null }),
      ...(updateData.invoiceUrl !== undefined && { invoiceUrl: updateData.invoiceUrl || null }),
      ...(updateData.invoiceFileName !== undefined && { invoiceFileName: updateData.invoiceFileName || null }),
      ...(updateData.invoiceFileType !== undefined && { invoiceFileType: updateData.invoiceFileType || null }),
    });

    return NextResponse.json(expense);
  } catch (error) {
    console.error("Error updating expense:", error);
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
    const expenseId = searchParams.get("id");

    if (!expenseId) {
      return NextResponse.json(
        { error: "Expense ID is required" },
        { status: 400 }
      );
    }

    await deleteExpense(expenseId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting expense:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

