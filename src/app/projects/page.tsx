import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ensureUserExists,
  isUserInEXOOrganization,
  getProjectsForUser,
} from "@/lib/db/queries";

const LOGO_SIZE = 164;

export default async function ProjectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    redirect("/login");
  }

  await ensureUserExists(
    user.email,
    user.user_metadata?.name || user.user_metadata?.full_name,
    user.user_metadata?.avatar_url || user.user_metadata?.image
  );

  const isInEXO = await isUserInEXOOrganization(user.email);
  if (isInEXO) {
    redirect("/dashboard");
  }

  const projects = await getProjectsForUser(user.email);

  return (
    <div
      className="fixed inset-0 flex flex-col bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url(/bg-clear.jpg)" }}
    >
      <div className="flex flex-1 flex-col items-center px-6 py-10">
        <Image
          src="/exo-glass.png"
          alt="EXO"
          width={LOGO_SIZE}
          height={LOGO_SIZE}
          className="shrink-0 object-contain"
          priority
        />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Your projects</h1>
        <p className="text-sm text-gray-700 mb-8">
          Select a project to view details and documents.
        </p>

        {projects.length === 0 ? (
          <p className="text-center text-gray-800 text-sm bg-white/20 rounded-2xl px-4 py-3">
            You do not have access to any projects yet.
          </p>
        ) : (
          <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/project/${project.slug}`}
                className="flex flex-col rounded-2xl border border-gray-200 bg-white/80 px-6 py-5 shadow-sm transition-all hover:border-gray-300 hover:bg-white/95 hover:shadow focus:outline-none"
              >
                <span className="font-semibold text-gray-900">
                  {project.title}
                </span>
                <span className="mt-1 text-sm text-gray-500">
                  {project.organizationName}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
