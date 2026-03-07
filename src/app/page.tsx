import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  ensureUserExists,
  getUserByEmail,
  isUserInEXOCompany,
} from "@/lib/db/queries";

export default async function Home() {
  const supabase = await createClient();
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

  await ensureUserExists(
    user.email,
    user.user_metadata?.name || user.user_metadata?.full_name,
    user.user_metadata?.avatar_url || user.user_metadata?.image
  );

  const isInEXO = await isUserInEXOCompany(user.email);
  if (isInEXO) {
    redirect("/dashboard");
  }

  redirect("/projects");
}
