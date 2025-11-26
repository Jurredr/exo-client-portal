import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { ensureUserExists } from "@/lib/db/queries";

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

      // Sync user to database
      if (data.user && data.user.email) {
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

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(`${origin}/`);
}
