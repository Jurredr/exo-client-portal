import { createClient } from "@/lib/supabase/server";
import {
  createUser,
  getAllUsers,
  getAllUsersPaginated,
  getAllUsersCount,
  isUserInEXOOrganization,
  updateUser,
  deleteUser,
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
    const pageSize = parseInt(searchParams.get("pageSize") || "50");
    const usePagination = searchParams.get("paginate") === "true";
    const organizationId = searchParams.get("organizationId") || undefined;
    const search = searchParams.get("search") || undefined;

    if (usePagination) {
      // Validate pagination
      const limit = Math.min(Math.max(pageSize, 1), 100); // Max 100 per page
      const offset = (page - 1) * limit;

      const filters = {
        ...(organizationId && { organizationId }),
        ...(search && { search }),
      };

      const users = await getAllUsersPaginated({ limit, offset, ...filters });
      const totalCount = await getAllUsersCount(filters);

      return NextResponse.json(
        {
          data: users,
          pagination: {
            page,
            pageSize: limit,
            totalCount,
            totalPages: Math.ceil(totalCount / limit),
          },
        },
        {
          headers: {
            "Cache-Control": "private, max-age=120, must-revalidate", // Cache for 2 minutes (users change less frequently)
          },
        }
      );
    }

    // Fallback to non-paginated for backward compatibility
    const users = await getAllUsers();
    return NextResponse.json(users, {
      headers: {
        "Cache-Control": "private, max-age=120, must-revalidate", // Cache for 2 minutes (users change less frequently)
      },
    });
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
    const {
      email,
      name,
      phone,
      note,
      organizationId,
      organizationIds,
      imageStoragePath, // Path in Supabase Storage
      imageSizeBytes,
    } = body;

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
      imageStoragePath || null,
      imageSizeBytes || null,
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
    const {
      id,
      name,
      phone,
      note,
      organizationId,
      organizationIds,
      imageStoragePath, // Path in Supabase Storage
      imageSizeBytes,
    } = body;

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
      ...(imageStoragePath !== undefined && {
        imageStoragePath: imageStoragePath || null,
      }),
      ...(imageSizeBytes !== undefined && {
        imageSizeBytes: imageSizeBytes || null,
      }),
      ...(orgIds !== undefined && { organizationIds: orgIds }),
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
