import { createClient } from "@/lib/supabase/server";
import { createHourRegistration, getUserByEmail, getHourRegistrationsByUser, deleteHourRegistration } from "@/lib/db/queries";
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

    const dbUser = await getUserByEmail(user.email);
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const registrations = await getHourRegistrationsByUser(dbUser.id);
    return NextResponse.json(registrations);
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
    const validCategories = ["client", "administration", "brainstorming", "research", "labs"];
    const validCategory = validCategories.includes(category) ? category : "client";
    
    // Validate: non-project categories (administration, brainstorming, research) should not have a project
    const nonProjectCategories = ["administration", "brainstorming", "research"];
    if (nonProjectCategories.includes(validCategory) && projectId) {
      return NextResponse.json(
        { error: `${validCategory.charAt(0).toUpperCase() + validCategory.slice(1)} work should not be associated with a project` },
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
