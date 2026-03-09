import { createClient } from "@/lib/supabase/server";
import {
  isUserInEXOCompany,
  getFinancialsStats,
  getBTWAangifteData,
} from "@/lib/db/queries";
import { generateYearPLPDF } from "@/lib/utils/pl-pdf";
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

    const isInEXO = await isUserInEXOCompany(user.email);
    if (!isInEXO) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get("year");
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

    const [stats, btwQuarters] = await Promise.all([
      getFinancialsStats("year", year),
      getBTWAangifteData(year),
    ]);

    const pdf = await generateYearPLPDF(stats, btwQuarters, year);

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="winst-verlies-${year}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Error exporting P&L PDF:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
