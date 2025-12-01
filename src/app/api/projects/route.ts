import { createClient } from "@/lib/supabase/server";
import {
  createProject,
  getAllProjects,
  isUserInEXOOrganization,
  updateProject,
  getTotalHoursByProject,
  deleteProject,
  getProjectById,
  createInvoice,
  getNextInvoiceNumber,
  isAdmin,
  getAllInvoices,
  getOrCreateEXOOrganization,
} from "@/lib/db/queries";
import { NextResponse } from "next/server";
import { calculatePaymentAmount } from "@/lib/utils/currency";
import { getDefaultStage } from "@/lib/constants/stages";

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

    // For client projects, subtotal is required
    if (
      projectType === "client" &&
      (!subtotal || typeof subtotal !== "string")
    ) {
      return NextResponse.json(
        { error: "Subtotal is required for client projects" },
        { status: 400 }
      );
    }

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
      subtotal: projectType === "labs" ? null : subtotal || null,
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

    // Validate subtotal: required for client projects, not for labs
    if (projectType === "client" && updateData.subtotal === null) {
      return NextResponse.json(
        { error: "Subtotal is required for client projects" },
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
      ...(updateData.startDate !== undefined && {
        startDate: updateData.startDate ? new Date(updateData.startDate) : null,
      }),
      ...(updateData.deadline !== undefined && {
        deadline: updateData.deadline ? new Date(updateData.deadline) : null,
      }),
      ...(updateData.subtotal !== undefined && {
        subtotal: projectType === "labs" ? null : updateData.subtotal,
      }),
      ...(updateData.currency && { currency: updateData.currency }),
      ...(updateData.type && { type: projectType }),
    });

    // Auto-generate invoice when client project reaches payment stages (not for labs)
    if (
      projectType === "client" &&
      newStage &&
      oldStage !== newStage &&
      (newStage === "pay_first" || newStage === "pay_final")
    ) {
      try {
        // Check if invoice already exists for this project and stage
        const allInvoices = await getAllInvoices();
        const existingInvoice = allInvoices.find(
          (inv) =>
            inv.invoice.projectId === project.id &&
            inv.invoice.type === "auto" &&
            inv.invoice.description?.includes(
              newStage === "pay_first" ? "First" : "Final"
            )
        );

        if (!existingInvoice && project.subtotal) {
          const paymentAmount = calculatePaymentAmount(
            project.subtotal,
            newStage,
            project.currency || "EUR"
          );
          if (paymentAmount && project.organizationId) {
            const invoiceNumber = await getNextInvoiceNumber();
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 30); // 30 days from now

            await createInvoice({
              invoiceNumber,
              projectId: project.id,
              organizationId: project.organizationId,
              amount: paymentAmount,
              currency: project.currency || "EUR",
              status: "sent",
              type: "auto",
              description: `Payment for ${project.title} - ${newStage === "pay_first" ? "First" : "Final"} payment`,
              dueDate,
            });
          }
        }
      } catch (error) {
        console.error("Error auto-generating invoice:", error);
        // Don't fail the project update if invoice generation fails
      }
    }

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
