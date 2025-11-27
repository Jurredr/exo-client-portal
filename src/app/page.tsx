import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { projects, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureUserExists, isAdmin } from "@/lib/db/queries";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    redirect("/login");
  }

  // Ensure user exists in database (sync from Supabase Auth)
  const dbUser = await ensureUserExists(
    user.email,
    user.user_metadata?.name || user.user_metadata?.full_name,
    user.user_metadata?.avatar_url || user.user_metadata?.image
  );

  // Admins can see all projects, others need organization
  if (isAdmin(user.email)) {
    // Get any project for admins
    const allProjects = await db.select().from(projects).limit(1);
    if (allProjects.length > 0) {
      redirect(`/project/${allProjects[0].id}`);
    }
  } else {
    // Non-admins need organization
    if (!dbUser.organizationId) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-black">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white mb-4">
              No Organization Assigned
            </h1>
            <p className="text-white/80">
              Please contact your administrator to assign you to an organization.
            </p>
          </div>
        </div>
      );
    }

    // Get user's first project
    const userProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.organizationId, dbUser.organizationId))
      .limit(1);

    if (userProjects.length === 0) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-black">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white mb-4">
              No Projects
            </h1>
            <p className="text-white/80">
              You don't have access to any projects yet.
            </p>
          </div>
        </div>
      );
    }

    // Redirect to the first project
    redirect(`/project/${userProjects[0].id}`);
  }

  // Fallback if no projects exist
  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">No Projects</h1>
        <p className="text-white/80">No projects available yet.</p>
      </div>
    </div>
  );
}
