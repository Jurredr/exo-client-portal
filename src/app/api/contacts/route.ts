import { createClient } from "@/lib/supabase/server";
import {
  createContact,
  getAllContacts,
  hasAdminAccess,
  deleteContact,
  updateContact,
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

    const contactsList = await getAllContacts();
    return NextResponse.json(contactsList, {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    console.error("Error fetching contacts:", error);
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
      firstName,
      lastName,
      email,
      phone,
      photo,
      companyId,
      companyIds,
      type,
    } = body;

    if (
      !firstName ||
      typeof firstName !== "string" ||
      firstName.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "First name is required" },
        { status: 400 }
      );
    }

    if (
      !lastName ||
      typeof lastName !== "string" ||
      lastName.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "Last name is required" },
        { status: 400 }
      );
    }

    const contact = await createContact({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      photo: photo || null,
      companyId: companyId || null,
      companyIds:
        companyIds && Array.isArray(companyIds)
          ? companyIds.filter((id: unknown) => typeof id === "string")
          : undefined,
      type: type || "client",
    });
    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    console.error("Error creating contact:", error);
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
    const contactId = searchParams.get("id");

    if (!contactId) {
      return NextResponse.json(
        { error: "Contact ID is required" },
        { status: 400 }
      );
    }

    await deleteContact(contactId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting contact:", error);
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
      firstName,
      lastName,
      email,
      phone,
      photo,
      companyId,
      companyIds,
      type,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Contact ID is required" },
        { status: 400 }
      );
    }

    if (
      !firstName ||
      typeof firstName !== "string" ||
      firstName.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "First name is required" },
        { status: 400 }
      );
    }

    if (
      !lastName ||
      typeof lastName !== "string" ||
      lastName.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "Last name is required" },
        { status: 400 }
      );
    }

    const contact = await updateContact(id, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      photo: photo || null,
      companyId: companyId || null,
      companyIds:
        companyIds !== undefined && Array.isArray(companyIds)
          ? companyIds.filter((cid: unknown) => typeof cid === "string")
          : undefined,
      type: type || "client",
    });

    return NextResponse.json(contact);
  } catch (error) {
    console.error("Error updating contact:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
