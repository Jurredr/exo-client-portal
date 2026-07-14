import { createClient } from "@/lib/supabase/server";
import { deleteOffer, updateOffer, hasAdminAccess } from "@/lib/db/queries";
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
    const body = await request.json();
    const {
      status,
      projectId,
      companyId,
      contactId,
      note,
      fileStoragePath,
      fileName,
      fileSizeBytes,
    } = body;
    const { content } = body;

    const updateData: {
      status?: string;
      projectId?: string | null;
      companyId?: string | null;
      contactId?: string | null;
      note?: string | null;
      content?: string | null;
      fileStoragePath?: string | null;
      fileName?: string | null;
      fileSizeBytes?: number | null;
    } = {};

    const validStatuses = ["draft", "sent", "signed", "discarded"];
    if (typeof status === "string" && validStatuses.includes(status)) {
      updateData.status = status;
    }
    if (projectId !== undefined) {
      updateData.projectId =
        projectId === null || projectId === "" ? null : projectId;
    }
    if (companyId !== undefined) {
      updateData.companyId =
        companyId === null || companyId === "" ? null : companyId;
    }
    if (contactId !== undefined) {
      updateData.contactId =
        contactId === null || contactId === "" ? null : contactId;
    }
    if (note !== undefined) {
      updateData.note = note === null || note === "" ? null : note;
    }
    if (content !== undefined) {
      updateData.content = content === null || content === "" ? null : content;
    }
    if (fileStoragePath !== undefined) {
      updateData.fileStoragePath =
        fileStoragePath === null || fileStoragePath === ""
          ? null
          : fileStoragePath;
    }
    if (fileName !== undefined) {
      updateData.fileName =
        fileName === null || fileName === "" ? null : fileName;
    }
    if (fileSizeBytes !== undefined) {
      updateData.fileSizeBytes =
        fileSizeBytes === null || Number.isNaN(fileSizeBytes)
          ? null
          : Number(fileSizeBytes);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        {
          error:
            "At least one of status, projectId, companyId, contactId, note, or file fields must be provided",
        },
        { status: 400 }
      );
    }

    const offer = await updateOffer(id, updateData);
    return NextResponse.json(offer);
  } catch (error) {
    console.error("Error updating offer:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    await deleteOffer(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting offer:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
