import { createClient } from "@/lib/supabase/server";
import { isUserInEXOCompany, getBTWAangifteData } from "@/lib/db/queries";
import { generateBTWAangiftePDF } from "@/lib/utils/btw-pdf";
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

    const data = await getBTWAangifteData(year);
    const pdf = await generateBTWAangiftePDF(data, year);

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="btw-aangifte-${year}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Error exporting BTW aangifte PDF:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
