import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  ensureUserExists,
  isAdmin,
  isUserInEXOOrganization,
} from "@/lib/db/queries";

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

  // If user is in EXO organization, redirect to dashboard
  const isInEXO = await isUserInEXOOrganization(user.email);
  if (isInEXO) {
    redirect("/dashboard");
  }

  // Admins can see all projects, others need organization (exclude labs - internal only)
  if (isAdmin(user.email)) {
    const allProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.type, "client"))
      .limit(1);
    if (allProjects.length > 0) {
      redirect(`/project/${allProjects[0].slug}`);
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
              Please contact your administrator to assign you to an
              organization.
            </p>
          </div>
        </div>
      );
    }

    // Get user's first project (exclude labs - internal only)
    const userProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.organizationId, dbUser.organizationId))
      .limit(10);
    const clientProjects = userProjects.filter((p) => p.type === "client");

    if (clientProjects.length === 0) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-black">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white mb-4">No Projects</h1>
            <p className="text-white/80">
              You don&apos;t have access to any projects yet.
            </p>
          </div>
        </div>
      );
    }

    // Redirect to the first client project
    redirect(`/project/${clientProjects[0].slug}`);
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
