import { createClient } from "@/lib/supabase/server";
import {
  getAllAssets,
  createAsset,
  isUserInEXOCompany,
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

    const isInEXO = await isUserInEXOCompany(user.email);
    if (!isInEXO) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const assets = await getAllAssets();
    return NextResponse.json(assets);
  } catch (error) {
    console.error("Error fetching assets:", error);
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

    const isInEXO = await isUserInEXOCompany(user.email);
    if (!isInEXO) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      description,
      purchaseDate,
      purchasePrice,
      residualValue,
      usefulLifeYears,
      category,
      linkedExpenseId,
    } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (!purchaseDate) {
      return NextResponse.json(
        { error: "Purchase date is required" },
        { status: 400 }
      );
    }

    if (
      purchasePrice === undefined ||
      purchasePrice === null ||
      (typeof purchasePrice !== "string" && typeof purchasePrice !== "number")
    ) {
      return NextResponse.json(
        { error: "Purchase price is required" },
        { status: 400 }
      );
    }

    const asset = await createAsset({
      name: name.trim(),
      description: description?.trim() || null,
      purchaseDate: new Date(purchaseDate),
      purchasePrice,
      residualValue: residualValue ?? 0,
      usefulLifeYears: usefulLifeYears ?? 5,
      category: category?.trim() || null,
      linkedExpenseId: linkedExpenseId || null,
    });

    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    console.error("Error creating asset:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
