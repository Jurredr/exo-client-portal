import { createClient } from "@/lib/supabase/server";
import {
  createProject,
  getAllProjects,
  isAdmin,
  updateProject,
  getTotalHoursByProject,
} from "@/lib/db/queries";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !user.email || !isAdmin(user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projects = await getAllProjects();
    const hoursByProject = await getTotalHoursByProject();
    
    // Add hours to each project
    const projectsWithHours = projects.map((p) => ({
      ...p,
      totalHours: hoursByProject[p.project.id] || 0,
    }));
    
    return NextResponse.json(projectsWithHours);
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
      organizationId,
    } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json(
        { error: "Project title is required" },
        { status: 400 }
      );
    }

    if (!subtotal || typeof subtotal !== "string") {
      return NextResponse.json(
        { error: "Subtotal is required" },
        { status: 400 }
      );
    }

    if (!organizationId || typeof organizationId !== "string") {
      return NextResponse.json(
        { error: "Organization ID is required" },
        { status: 400 }
      );
    }

    const project = await createProject({
      title: title.trim(),
      description: description?.trim() || null,
      status: status || "active",
      stage: stage || "kick_off",
      startDate: startDate ? new Date(startDate) : null,
      deadline: deadline ? new Date(deadline) : null,
      subtotal,
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

    if (!user || !user.email || !isAdmin(user.email)) {
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

    const project = await updateProject(id, {
      ...(updateData.title && { title: updateData.title }),
      ...(updateData.description !== undefined && {
        description: updateData.description,
      }),
      ...(updateData.status && { status: updateData.status }),
      ...(updateData.stage && { stage: updateData.stage }),
      ...(updateData.startDate && { startDate: new Date(updateData.startDate) }),
      ...(updateData.deadline && { deadline: new Date(updateData.deadline) }),
      ...(updateData.subtotal && { subtotal: updateData.subtotal }),
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

