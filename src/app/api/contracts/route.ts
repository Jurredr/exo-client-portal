import { createClient } from "@/lib/supabase/server";
import {
  getAllContractsPaginated,
  getAllContractsCount,
  isUserInEXOOrganization,
  createContract,
  updateContract,
  getContractById,
  deleteContract,
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
    const signed = searchParams.get("signed") || undefined;
    const search = searchParams.get("search") || undefined;

    // Validate pagination
    const limit = Math.min(Math.max(pageSize, 1), 100); // Max 100 per page
    const offset = (page - 1) * limit;

    const filters = {
      ...(signed && { signed }),
      ...(search && { search }),
    };

    const contracts = await getAllContractsPaginated({
      limit,
      offset,
      ...filters,
    });
    const totalCount = await getAllContractsCount(filters);

    return NextResponse.json(
      {
        data: contracts,
        pagination: {
          page,
          pageSize: limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      },
      {
        headers: {
          "Cache-Control": "private, max-age=60, must-revalidate", // Cache for 1 minute
        },
      }
    );
  } catch (error) {
    console.error("Error fetching contracts:", error);
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
      organizationId,
      projectIds,
      projectId,
      name,
      fileStoragePath, // Path in Supabase Storage
      fileName,
      fileSizeBytes,
      requiresPortalSignature,
    } = body;

    if (!organizationId || typeof organizationId !== "string") {
      return NextResponse.json(
        { error: "Organization ID is required" },
        { status: 400 }
      );
    }

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Contract name is required" },
        { status: 400 }
      );
    }

    // Support both new format (projectIds array) and legacy format (projectId string)
    const finalProjectIds = projectIds || (projectId ? [projectId] : []);

    const contract = await createContract({
      organizationId,
      projectIds: finalProjectIds.length > 0 ? finalProjectIds : undefined,
      name: name.trim(),
      fileStoragePath: fileStoragePath || null,
      fileName: fileName || null,
      fileSizeBytes: fileSizeBytes || null,
      requiresPortalSignature:
        requiresPortalSignature !== undefined ? requiresPortalSignature : true,
    });

    return NextResponse.json(contract, { status: 201 });
  } catch (error) {
    console.error("Error creating contract:", error);
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
      organizationId,
      projectIds,
      name,
      fileStoragePath, // Path in Supabase Storage
      fileName,
      fileSizeBytes,
      requiresPortalSignature,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Contract ID is required" },
        { status: 400 }
      );
    }

    // Check if contract exists
    const existingContract = await getContractById(id);
    if (!existingContract) {
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 }
      );
    }

    const updateData: {
      organizationId?: string;
      name?: string;
      fileStoragePath?: string | null; // Path in Supabase Storage
      fileName?: string | null;
      fileSizeBytes?: number | null;
      requiresPortalSignature?: boolean;
      projectIds?: string[];
    } = {};
    if (organizationId) updateData.organizationId = organizationId;
    if (name !== undefined) updateData.name = name.trim();
    if (fileStoragePath !== undefined)
      updateData.fileStoragePath = fileStoragePath || null;
    if (fileName !== undefined) updateData.fileName = fileName || null;
    if (fileSizeBytes !== undefined)
      updateData.fileSizeBytes = fileSizeBytes || null;
    if (requiresPortalSignature !== undefined)
      updateData.requiresPortalSignature = requiresPortalSignature;
    if (projectIds !== undefined) updateData.projectIds = projectIds;

    const contract = await updateContract(id, updateData);

    return NextResponse.json(contract);
  } catch (error) {
    console.error("Error updating contract:", error);
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
    const contractId = searchParams.get("id");

    if (!contractId) {
      return NextResponse.json(
        { error: "Contract ID is required" },
        { status: 400 }
      );
    }

    await deleteContract(contractId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting contract:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
