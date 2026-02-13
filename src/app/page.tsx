import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ensureUserExists, isUserInEXOOrganization } from "@/lib/db/queries";

export default async function Home() {
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

  redirect("/projects");
}
