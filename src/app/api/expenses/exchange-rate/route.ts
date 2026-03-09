import { createClient } from "@/lib/supabase/server";
import { isUserInEXOCompany } from "@/lib/db/queries";
import { NextResponse } from "next/server";

/**
 * Fetch historical exchange rate for a given date.
 * Uses Frankfurter API (free, no key required).
 * Returns rate from currency to EUR (e.g. 1 USD = X EUR).
 */
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date");
    const currency = searchParams.get("currency") || "USD";

    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return NextResponse.json(
        { error: "Valid date (YYYY-MM-DD) required" },
        { status: 400 }
      );
    }

    if (currency === "EUR") {
      return NextResponse.json({ rate: 1, date: dateStr, currency: "EUR" });
    }

    const res = await fetch(
      `https://api.frankfurter.app/${dateStr}?from=${currency}&to=EUR`
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("Frankfurter API error:", err);
      return NextResponse.json(
        { error: "Failed to fetch exchange rate" },
        { status: 502 }
      );
    }

    const data = (await res.json()) as {
      rates?: { EUR?: number };
      date?: string;
    };

    const rate = data.rates?.EUR;
    if (typeof rate !== "number") {
      return NextResponse.json(
        { error: "No rate available for this date" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      rate,
      date: data.date || dateStr,
      currency,
    });
  } catch (error) {
    console.error("Error fetching exchange rate:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
