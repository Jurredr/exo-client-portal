import { createClient } from "@/lib/supabase/server";
import {
  canUserAccessProject,
  getProjectWithOrganization,
} from "@/lib/db/queries";
import { getOrganizationImageUrl } from "@/lib/utils/image-storage";
import { NextResponse } from "next/server";

/**
 * Get the organization image for a project. Allows access for users who can
 * view the project (clients), not just EXO members.
 */
export async function GET(
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

    const { id: projectId } = await params;

    const hasAccess = await canUserAccessProject(user.email, projectId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const projectWithOrg = await getProjectWithOrganization(projectId);
    if (!projectWithOrg?.organization?.imageStoragePath) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    const signedUrl = await getOrganizationImageUrl(
      projectWithOrg.organization.imageStoragePath
    );
    if (!signedUrl) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    // Redirect to the signed URL - img/browser will follow
    return NextResponse.redirect(signedUrl);
  } catch (error) {
    console.error("Error getting project organization image:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
