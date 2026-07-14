import { createClient } from "@/lib/supabase/server";
import { hasAdminAccess, getFinancialsStats } from "@/lib/db/queries";
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

    const isInEXO = await hasAdminAccess(user.email);
    if (!isInEXO) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get("timeRange") || "all";
    const taxYearParam = searchParams.get("taxYear");
    const taxYear = taxYearParam ? parseInt(taxYearParam, 10) : undefined;
    const clientDate = searchParams.get("clientDate"); // YYYY-MM-DD from client for consistent date ranges

    const stats = await getFinancialsStats(timeRange, taxYear, clientDate);
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching financials:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
