import { createClient } from "@/lib/supabase/server";
import {
  createOffer,
  getAllOffersPaginated,
  getAllOffersCount,
  isUserInEXOOrganization,
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
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "10");
    const projectId = searchParams.get("projectId") || undefined;
    const search = searchParams.get("search") || undefined;

    const limit = Math.min(Math.max(pageSize, 1), 100);
    const offset = (page - 1) * limit;

    const filters = {
      ...(projectId && { projectId }),
      ...(search && { search }),
    };

    const offersData = await getAllOffersPaginated({
      limit,
      offset,
      ...filters,
    });
    const totalCount = await getAllOffersCount(filters);

    return NextResponse.json(
      {
        data: offersData.map((o) => ({
          offer: o.offer,
          project: o.project,
        })),
        pagination: {
          page,
          pageSize: limit,
          totalCount,
          totalPages: Math.max(1, Math.ceil(totalCount / limit)),
        },
      },
      {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching offers:", error);
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
      note,
      fileStoragePath,
      fileName,
      fileSizeBytes,
      status,
    } = body;

    const offer = await createOffer({
      projectId: projectId || null,
      note: note?.trim() || null,
      fileStoragePath: fileStoragePath || null,
      fileName: fileName || null,
      fileSizeBytes: fileSizeBytes || null,
      status: status ?? "draft",
    });

    return NextResponse.json(offer, { status: 201 });
  } catch (error) {
    console.error("Error creating offer:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
