import { createClient } from "@/lib/supabase/server";
import { createHourRegistration, getUserByEmail } from "@/lib/db/queries";
import { NextResponse } from "next/server";

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
    const { description, hours, projectId } = body;

    if (!description || typeof hours !== "number" || hours <= 0) {
      return NextResponse.json(
        { error: "Invalid input: description and hours are required" },
        { status: 400 }
      );
    }

    const registration = await createHourRegistration(
      dbUser.id,
      description,
      hours,
      projectId || null
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

