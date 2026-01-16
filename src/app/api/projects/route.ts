import { createClient } from "@/lib/supabase/server";
import {
  createProject,
  getAllProjects,
  getAllProjectsPaginated,
  getAllProjectsCount,
  isUserInEXOOrganization,
  updateProject,
  getTotalHoursByProject,
  deleteProject,
  getProjectById,
  isAdmin,
  getOrCreateEXOOrganization,
} from "@/lib/db/queries";
import { NextResponse } from "next/server";
import { getDefaultStage } from "@/lib/constants/stages";

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

    if (usePagination) {
      // Validate pagination
      const limit = Math.min(Math.max(pageSize, 1), 100); // Max 100 per page
      const offset = (page - 1) * limit;

      const projects = await getAllProjectsPaginated({ limit, offset });
      const hoursByProject = await getTotalHoursByProject();
      const totalCount = await getAllProjectsCount();

      // Add hours to each project
      const projectsWithHours = projects.map((p) => ({
        ...p,
        totalHours: hoursByProject[p.project.id] || 0,
      }));

      return NextResponse.json(
        {
          data: projectsWithHours,
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
    }

    // Fallback to non-paginated for backward compatibility
    const projects = await getAllProjects();
    const hoursByProject = await getTotalHoursByProject();

    // Add hours to each project
    const projectsWithHours = projects.map((p) => ({
      ...p,
      totalHours: hoursByProject[p.project.id] || 0,
    }));

    return NextResponse.json(projectsWithHours, {
      headers: {
        "Cache-Control": "private, max-age=60, must-revalidate", // Cache for 1 minute
      },
    });
  } catch (error) {
    console.error("Error fetching projects:", error);
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

    if (!user || !user.email || !isAdmin(user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      description,
      status,
      stage,
      startDate,
      deadline,
      subtotal,
      currency,
      type,
      organizationId,
    } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json(
        { error: "Project title is required" },
        { status: 400 }
      );
    }

    const projectType = type === "labs" ? "labs" : "client";

    // Subtotal is optional for all project types

    if (!organizationId || typeof organizationId !== "string") {
      return NextResponse.json(
        { error: "Organization ID is required" },
        { status: 400 }
      );
    }

    // For EXO Labs projects, ensure they're under EXO organization
    if (projectType === "labs") {
      const exoOrg = await getOrCreateEXOOrganization();
      if (organizationId !== exoOrg.id) {
        return NextResponse.json(
          { error: "EXO Labs projects must be under EXO organization" },
          { status: 400 }
        );
      }
    }

    const project = await createProject({
      title: title.trim(),
      description: description?.trim() || null,
      status: status || "active",
      stage: stage || getDefaultStage(projectType),
      startDate: startDate ? new Date(startDate) : null,
      deadline: deadline ? new Date(deadline) : null,
      subtotal: subtotal || null,
      currency: currency || "EUR",
      type: projectType,
      organizationId,
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("Error creating project:", error);
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
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    // Get the current project to check if stage changed
    const currentProject = await getProjectById(id);
    if (!currentProject) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const oldStage = currentProject.stage;
    const newStage = updateData.stage;
    const projectType =
      updateData.type === "labs" ? "labs" : currentProject.type || "client";

    // Subtotal is optional for all project types

    const project = await updateProject(id, {
      ...(updateData.title && { title: updateData.title }),
      ...(updateData.description !== undefined && {
        description: updateData.description,
      }),
      ...(updateData.status && { status: updateData.status }),
      ...(updateData.stage && { stage: updateData.stage }),
      ...(updateData.startDate !== undefined && {
        startDate: updateData.startDate ? new Date(updateData.startDate) : null,
      }),
      ...(updateData.deadline !== undefined && {
        deadline: updateData.deadline ? new Date(updateData.deadline) : null,
      }),
      ...(updateData.subtotal !== undefined && {
        subtotal: updateData.subtotal,
      }),
      ...(updateData.currency && { currency: updateData.currency }),
      ...(updateData.type && { type: projectType }),
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error("Error updating project:", error);
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
    const projectId = searchParams.get("id");

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    await deleteProject(projectId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
