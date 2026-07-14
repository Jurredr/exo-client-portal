import { createClient } from "@/lib/supabase/server";
import {
  getAssetById,
  updateAsset,
  deleteAsset,
  hasAdminAccess,
} from "@/lib/db/queries";
import { NextResponse } from "next/server";

export async function PATCH(
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

    const isInEXO = await hasAdminAccess(user.email);
    if (!isInEXO) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const existing = await getAssetById(id);
    if (!existing) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
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

    const asset = await updateAsset(id, {
      ...(name !== undefined && { name: name.trim() }),
      ...(description !== undefined && {
        description: description?.trim() || null,
      }),
      ...(purchaseDate !== undefined && {
        purchaseDate: new Date(purchaseDate),
      }),
      ...(purchasePrice !== undefined && { purchasePrice }),
      ...(residualValue !== undefined && { residualValue }),
      ...(usefulLifeYears !== undefined && { usefulLifeYears }),
      ...(category !== undefined && { category: category?.trim() || null }),
      ...(linkedExpenseId !== undefined && {
        linkedExpenseId: linkedExpenseId || null,
      }),
    });

    return NextResponse.json(asset);
  } catch (error) {
    console.error("Error updating asset:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
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

    const isInEXO = await hasAdminAccess(user.email);
    if (!isInEXO) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const existing = await getAssetById(id);
    if (!existing) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    await deleteAsset(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting asset:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
