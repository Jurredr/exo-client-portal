import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  getProjectWithCompanyBySlug,
  getProjectWithCompany,
  canUserAccessProject,
  ensureUserExists,
  hasAdminAccess,
  getUserByEmail,
  getCompanyById,
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

  const dbUser = await getUserByEmail(user.email);
  if (!dbUser) {
    redirect("/auth/unauthorized");
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
  const projectWithCompany = isUuid
    ? await getProjectWithCompany(slug)
    : await getProjectWithCompanyBySlug(slug);

  if (!projectWithCompany) {
    redirect("/not-found");
  }

  // EXO Labs projects are internal - no public client pages
  if (projectWithCompany.project.type === "labs") {
    redirect("/not-found");
  }

  // Check if user can access this project
  const hasAccess = await canUserAccessProject(
    user.email,
    projectWithCompany.project.id
  );

  if (!hasAccess) {
    redirect("/projects");
  }

  const isInEXO = await hasAdminAccess(user.email);

  // Get user's company (not the project's)
  const userCompany = dbUser?.companyId
    ? await getCompanyById(dbUser.companyId)
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
        organization={userCompany?.name}
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
          project={projectWithCompany.project}
          organizationName={projectWithCompany.company.name}
          organizationImageUrl={
            projectWithCompany.company.imageStoragePath
              ? `/api/projects/${projectWithCompany.project.id}/organization-image`
              : undefined
          }
          isInEXO={isInEXO}
        />
      </div>
    </div>
  );
}
