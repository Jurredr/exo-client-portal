import { createClient } from "@/lib/supabase/server";
import {
  createUser,
  getAllUsers,
  isUserInEXOOrganization,
  updateUser,
  deleteUser,
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

    const users = await getAllUsers();
    return NextResponse.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
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
    const { email, name, phone, note, organizationId, organizationIds, image } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { error: "Valid email is required" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existing = await getAllUsers();
    if (existing.some((u) => u.user.email === email)) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 409 }
      );
    }

    // Support both organizationId (single, for backward compatibility) and organizationIds (array)
    const orgIds = organizationIds
      ? Array.isArray(organizationIds)
        ? organizationIds
        : [organizationIds]
      : organizationId
        ? [organizationId]
        : null;

    const newUser = await createUser(
      email.trim(),
      name?.trim() || null,
      orgIds,
      image || null,
      phone?.trim() || null,
      note?.trim() || null
    );
    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error("Error creating user:", error);
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
    const { id, name, phone, note, organizationId, organizationIds, image } = body;

    if (!id) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Support both organizationId (single, for backward compatibility) and organizationIds (array)
    let orgIds: string[] | null | undefined = undefined;
    if (organizationIds !== undefined) {
      orgIds = Array.isArray(organizationIds)
        ? organizationIds.length > 0
          ? organizationIds
          : null
        : organizationIds
          ? [organizationIds]
          : null;
    } else if (organizationId !== undefined) {
      orgIds =
        organizationId && organizationId !== "none" ? [organizationId] : null;
    }

    const updatedUser = await updateUser(id, {
      ...(name !== undefined && { name: name?.trim() || null }),
      ...(phone !== undefined && { phone: phone?.trim() || null }),
      ...(note !== undefined && { note: note?.trim() || null }),
      ...(orgIds !== undefined && { organizationIds: orgIds }),
      ...(image !== undefined && { image: image || null }),
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("Error updating user:", error);
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
    const userId = searchParams.get("id");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    await deleteUser(userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
