import { createClient } from "@/lib/supabase/server";
import { getExpenseById, isUserInEXOOrganization } from "@/lib/db/queries";
import { downloadExpenseFile } from "@/lib/utils/file-storage";
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
    const expenseData = await getExpenseById(id);

    if (!expenseData) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    // Check if there's a file in Storage
    if (expenseData.expense.invoiceStoragePath) {
      try {
        const fileBuffer = await downloadExpenseFile(
          expenseData.expense.invoiceStoragePath
        );
        if (fileBuffer) {
          const filename =
            expenseData.expense.invoiceFileName ||
            `expense-${expenseData.expense.id}.pdf`;

          // All expense files are PDFs
          const contentType = "application/pdf";

          return new NextResponse(new Uint8Array(fileBuffer), {
            headers: {
              "Content-Type": contentType,
              "Content-Disposition": `attachment; filename="${filename}"`,
            },
          });
        }
      } catch (error) {
        console.error("Error downloading expense file from Storage:", error);
        // Fall through to return error
      }
    }

    // Otherwise return error
    return NextResponse.json(
      { error: "Expense file not found" },
      { status: 404 }
    );
  } catch (error) {
    console.error("Error downloading expense file:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
