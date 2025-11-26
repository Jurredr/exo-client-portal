import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  getProjectWithOrganization,
  canUserAccessProject,
  ensureUserExists,
} from "@/lib/db/queries";
import UserInfo from "@/components/UserInfo";
import ProjectDetails from "@/components/ProjectDetails";

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Get the current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    redirect("/login");
  }

  // Ensure user exists in database
  await ensureUserExists(
    user.email,
    user.user_metadata?.name || user.user_metadata?.full_name
  );

  // Check if user can access this project
  const hasAccess = await canUserAccessProject(user.email, id);

  if (!hasAccess) {
    redirect("/unauthorized");
  }

  // Get the project data with organization
  const projectWithOrg = await getProjectWithOrganization(id);

  if (!projectWithOrg) {
    redirect("/not-found");
  }

  return (
    <div className="relative min-h-screen">
      {/* Fixed Background - stays in place when scrolling */}
      <div
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: "url(/bg.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="absolute inset-0 bg-black/20" />
      </div>

      {/* Fixed User Info - always in top right */}
      <UserInfo />

      {/* Main Content - scrolls over background */}
      <div className="relative z-10 pt-24 pb-12">
        <ProjectDetails
          project={projectWithOrg.project}
          organizationName={projectWithOrg.organization.name}
        />
      </div>
    </div>
  );
}
