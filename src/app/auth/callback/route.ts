import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { ensureUserExists, getUserByEmail } from "@/lib/db/queries";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;

  if (code) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error("Error exchanging code for session:", error);
        return NextResponse.redirect(`${origin}/login?error=auth_failed`);
      }

      if (data.user?.email) {
        const dbUser = await getUserByEmail(data.user.email);
        if (!dbUser) {
          return NextResponse.redirect(`${origin}/auth/unauthorized`);
        }
        await ensureUserExists(
          data.user.email,
          data.user.user_metadata?.name || data.user.user_metadata?.full_name
        );
      }
    } catch (error) {
      console.error("Error exchanging code for session:", error);
      return NextResponse.redirect(`${origin}/login?error=auth_failed`);
    }
  }

  return NextResponse.redirect(`${origin}/projects`);
}
