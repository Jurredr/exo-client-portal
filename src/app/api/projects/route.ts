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
} from "@/lib/db/queries";
import { NextResponse } from "next/server";
import { calculatePaymentAmount } from "@/lib/utils/currency";

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
    const oldStage = currentProject?.stage;
    const newStage = updateData.stage;

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

    // Auto-generate invoice when project reaches payment stages
    if (newStage && oldStage !== newStage && (newStage === "pay_first" || newStage === "pay_final")) {
      try {
        // Check if invoice already exists for this project and stage
        const allInvoices = await getAllInvoices();
        const existingInvoice = allInvoices.find(
          (inv) =>
            inv.invoice.projectId === project.id &&
            inv.invoice.type === "auto" &&
            inv.invoice.description?.includes(newStage === "pay_first" ? "First" : "Final")
        );

        if (!existingInvoice) {
          const paymentAmount = calculatePaymentAmount(project.subtotal, newStage);
          if (paymentAmount && project.organizationId) {
            const invoiceNumber = await getNextInvoiceNumber();
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 30); // 30 days from now

            await createInvoice({
              invoiceNumber,
              projectId: project.id,
              organizationId: project.organizationId,
              amount: paymentAmount,
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

