import { createClient } from "@/lib/supabase/server";
import {
  createHourRegistration,
  getUserByEmail,
  getHourRegistrationsByUser,
  getHourRegistrationsCountByUser,
  getAllHourRegistrations,
  getAllHourRegistrationsCount,
  deleteHourRegistration,
  updateHourRegistration,
  isAdmin,
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
    const pageSize = parseInt(searchParams.get("pageSize") || "50");
    const search = searchParams.get("search") || undefined;
    const all = searchParams.get("all") === "true"; // For admin to get all registrations

    // Validate pagination
    const limit = Math.min(Math.max(pageSize, 1), 100); // Max 100 per page
    const offset = (page - 1) * limit;

    let registrations;
    let totalCount;

    if (all && isAdmin(user.email)) {
      // Admin can fetch all registrations
      registrations = await getAllHourRegistrations({
        limit,
        offset,
        search,
      });
      totalCount = await getAllHourRegistrationsCount(search);
    } else {
      // Regular users get only their registrations
      const dbUser = await getUserByEmail(user.email);
      if (!dbUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      registrations = await getHourRegistrationsByUser(dbUser.id, {
        limit,
        offset,
        search,
      });
      totalCount = await getHourRegistrationsCountByUser(dbUser.id, search);
    }

    return NextResponse.json(
      {
        data: registrations,
        pagination: {
          page,
          pageSize: limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      },
      {
        headers: {
          "Cache-Control": "private, max-age=30, must-revalidate", // Cache for 30 seconds
        },
      }
    );
  } catch (error) {
    console.error("Error fetching hour registrations:", error);
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

    const dbUser = await getUserByEmail(user.email);
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { description, hours, projectId, date, category } = body;

    if (!description || typeof hours !== "number" || hours <= 0) {
      return NextResponse.json(
        { error: "Invalid input: description and hours are required" },
        { status: 400 }
      );
    }

    // Validate category
    const validCategories = [
      "client",
      "administration",
      "brainstorming",
      "research",
      "labs",
      "client_acquisition",
      "content_creation",
      "traveling",
    ];
    const validCategory = validCategories.includes(category)
      ? category
      : "client";

    // Validate: non-project categories (administration, brainstorming, research, client_acquisition, traveling) should not have a project
    const nonProjectCategories = [
      "administration",
      "brainstorming",
      "research",
      "client_acquisition",
      "traveling",
    ];
    if (nonProjectCategories.includes(validCategory) && projectId) {
      return NextResponse.json(
        {
          error: `${validCategory.charAt(0).toUpperCase() + validCategory.slice(1)} work should not be associated with a project`,
        },
        { status: 400 }
      );
    }

    const registrationDate = date ? new Date(date) : undefined;

    const registration = await createHourRegistration(
      dbUser.id,
      description,
      hours,
      projectId || null,
      registrationDate,
      validCategory
    );

    return NextResponse.json(registration, { status: 201 });
  } catch (error) {
    console.error("Error creating hour registration:", error);
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

    const dbUser = await getUserByEmail(user.email);
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { id, description, hours, projectId, date, category } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Registration ID is required" },
        { status: 400 }
      );
    }

    // Verify the registration belongs to the user
    const registrations = await getHourRegistrationsByUser(dbUser.id);
    const registration = registrations.find((r) => r.id === id);

    if (!registration) {
      return NextResponse.json(
        { error: "Registration not found or unauthorized" },
        { status: 404 }
      );
    }

    // Validate category if provided
    let validCategory = registration.category;
    if (category) {
      const validCategories = [
        "client",
        "administration",
        "brainstorming",
        "research",
        "labs",
        "client_acquisition",
        "content_creation",
        "traveling",
      ];
      validCategory = validCategories.includes(category)
        ? category
        : registration.category;
    }

    // Validate: non-project categories (administration, brainstorming, research, client_acquisition, traveling) should not have a project
    const nonProjectCategories = [
      "administration",
      "brainstorming",
      "research",
      "client_acquisition",
      "traveling",
    ];
    const finalProjectId =
      category && nonProjectCategories.includes(validCategory)
        ? null
        : projectId || registration.projectId;

    if (nonProjectCategories.includes(validCategory) && finalProjectId) {
      return NextResponse.json(
        {
          error: `${validCategory.charAt(0).toUpperCase() + validCategory.slice(1)} work should not be associated with a project`,
        },
        { status: 400 }
      );
    }

    const updateData: {
      description?: string;
      hours?: number;
      projectId?: string | null;
      date?: Date;
      category?:
        | "client"
        | "administration"
        | "brainstorming"
        | "research"
        | "labs"
        | "client_acquisition"
        | "content_creation";
    } = {};
    if (description !== undefined) updateData.description = description;
    if (hours !== undefined) {
      if (typeof hours !== "number" || hours <= 0) {
        return NextResponse.json(
          { error: "Invalid hours: must be a positive number" },
          { status: 400 }
        );
      }
      updateData.hours = hours;
    }
    if (finalProjectId !== undefined) updateData.projectId = finalProjectId;
    if (date !== undefined) updateData.date = new Date(date);
    if (category !== undefined) updateData.category = validCategory;

    const updated = await updateHourRegistration(id, updateData);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating hour registration:", error);
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

    const dbUser = await getUserByEmail(user.email);
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const registrationId = searchParams.get("id");

    if (!registrationId) {
      return NextResponse.json(
        { error: "Registration ID is required" },
        { status: 400 }
      );
    }

    // Verify the registration belongs to the user
    const registrations = await getHourRegistrationsByUser(dbUser.id);
    const registration = registrations.find((r) => r.id === registrationId);

    if (!registration) {
      return NextResponse.json(
        { error: "Registration not found or unauthorized" },
        { status: 404 }
      );
    }

    await deleteHourRegistration(registrationId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting hour registration:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
