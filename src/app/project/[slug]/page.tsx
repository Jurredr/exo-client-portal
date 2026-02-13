import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  getProjectWithOrganizationBySlug,
  getProjectWithOrganization,
  canUserAccessProject,
  ensureUserExists,
  isUserInEXOOrganization,
  getUserByEmail,
  getOrganizationById,
} from "@/lib/db/queries";
import { ProjectUserMenu } from "@/components/ProjectUserMenu";
import ProjectDetails from "@/components/ProjectDetails";
import { ProgressiveBlur } from "@/components/ProgressiveBlur";

interface ProjectPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { slug } = await params;
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
    user.user_metadata?.name || user.user_metadata?.full_name,
    user.user_metadata?.avatar_url || user.user_metadata?.image
  );

  // Get the project data by slug or by id (for backward compatibility with old links)
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      slug
    );
  const projectWithOrg = isUuid
    ? await getProjectWithOrganization(slug)
    : await getProjectWithOrganizationBySlug(slug);

  if (!projectWithOrg) {
    redirect("/not-found");
  }

  // EXO Labs projects are internal - no public client pages
  if (projectWithOrg.project.type === "labs") {
    redirect("/not-found");
  }

  // Check if user can access this project
  const hasAccess = await canUserAccessProject(
    user.email,
    projectWithOrg.project.id
  );

  if (!hasAccess) {
    redirect("/unauthorized");
  }

  // Get user data from database
  const dbUser = await getUserByEmail(user.email);
  const isInEXO = await isUserInEXOOrganization(user.email);

  // Get user's organization (not the project's)
  const userOrganization = dbUser?.organizationId
    ? await getOrganizationById(dbUser.organizationId)
    : null;

  // Prepare user data for the menu
  const userData = {
    name:
      dbUser?.name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "User",
    email: user.email || "",
    avatar: dbUser?.imageStoragePath
      ? `/api/users/${dbUser.id}/image`
      : user.user_metadata?.avatar_url || undefined,
  };

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
      />

      {/* Fixed User Menu - always in top right */}
      <ProjectUserMenu
        user={userData}
        organization={userOrganization?.name}
        showAdminLink={isInEXO}
      />

      {/* Progressive blur at bottom - fixed to viewport */}
      <div className="fixed bottom-0 left-0 right-0 z-20">
        <ProgressiveBlur
          position="bottom"
          backgroundColor="#CCCDCD"
          height="100px"
          // blurAmount="2px"
        />
      </div>

      {/* Main Content - scrolls over background */}
      <div className="relative z-10 pt-14 pl-10 pb-12">
        <ProjectDetails
          project={projectWithOrg.project}
          organizationName={projectWithOrg.organization.name}
          organizationImageUrl={
            projectWithOrg.organization.imageStoragePath
              ? `/api/projects/${projectWithOrg.project.id}/organization-image`
              : undefined
          }
          isInEXO={isInEXO}
        />
      </div>
    </div>
  );
}
