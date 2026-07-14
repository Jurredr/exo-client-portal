import { createClient } from "@/lib/supabase/server";
import {
  createCompany,
  getAllCompanies,
  hasAdminAccess,
  deleteCompany,
  updateCompany,
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

    const isInEXO = await hasAdminAccess(user.email);
    if (!isInEXO) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const companies = await getAllCompanies();
    return NextResponse.json(companies, {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate", // Don't cache to ensure fresh data
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    console.error("Error fetching organizations:", error);
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

    const isInEXO = await hasAdminAccess(user.email);
    if (!isInEXO) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      imageStoragePath, // Path in Supabase Storage
      imageSizeBytes,
      address,
      kvkNumber,
      btwNumber,
      email,
      telephone,
    } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Organization name is required" },
        { status: 400 }
      );
    }

    const company = await createCompany({
      name: name.trim(),
      imageStoragePath: imageStoragePath || null,
      imageSizeBytes: imageSizeBytes || null,
      address: address?.trim() || null,
      kvkNumber: kvkNumber?.trim() || null,
      btwNumber: btwNumber?.trim() || null,
      email: email?.trim() || null,
      telephone: telephone?.trim() || null,
    });
    return NextResponse.json(company, { status: 201 });
  } catch (error) {
    console.error("Error creating organization:", error);
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

    const isInEXO = await hasAdminAccess(user.email);
    if (!isInEXO) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("id");

    if (!companyId) {
      return NextResponse.json(
        { error: "Company ID is required" },
        { status: 400 }
      );
    }

    await deleteCompany(companyId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting organization:", error);
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

    const isInEXO = await hasAdminAccess(user.email);
    if (!isInEXO) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      id,
      name,
      imageStoragePath, // Path in Supabase Storage
      imageSizeBytes,
      address,
      kvkNumber,
      btwNumber,
      email,
      telephone,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Organization ID is required" },
        { status: 400 }
      );
    }

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Organization name is required" },
        { status: 400 }
      );
    }

    const company = await updateCompany(id, {
      name: name.trim(),
      imageStoragePath: imageStoragePath || null,
      imageSizeBytes: imageSizeBytes || null,
      address: address?.trim() || null,
      kvkNumber: kvkNumber?.trim() || null,
      btwNumber: btwNumber?.trim() || null,
      email: email?.trim() || null,
      telephone: telephone?.trim() || null,
    });

    return NextResponse.json(company);
  } catch (error) {
    console.error("Error updating organization:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
