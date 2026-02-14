import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { ensureUserExists, getUserByEmail } from "@/lib/db/queries";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const token_hash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const origin = requestUrl.origin;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase environment variables");
    return NextResponse.redirect(`${origin}/login?error=config`);
  }

  // Create redirect response so we can set session cookies on it
  const response = NextResponse.redirect(`${origin}/projects`);

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const handleAuthSuccess = async (
    email: string,
    metadata?: { name?: string; full_name?: string }
  ) => {
    const dbUser = await getUserByEmail(email);
    if (!dbUser) {
      return NextResponse.redirect(`${origin}/auth/unauthorized`);
    }
    await ensureUserExists(email, metadata?.name || metadata?.full_name);
    return response;
  };

  // Token hash flow: works across devices/browsers (no PKCE required)
  // Requires custom Magic Link email template: {{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=magiclink
  if (token_hash && type) {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash,
        type: type as EmailOtpType,
      });

      if (error) {
        console.error("Error verifying OTP:", error);
        return NextResponse.redirect(`${origin}/login?error=auth_failed`);
      }

      if (data.user?.email) {
        return handleAuthSuccess(data.user.email, data.user.user_metadata);
      }
      return response;
    } catch (error) {
      console.error("Error verifying OTP:", error);
      return NextResponse.redirect(`${origin}/login?error=auth_failed`);
    }
  }

  // PKCE code flow: requires same browser (code verifier in cookies)
  if (code) {
    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        const isPkceError =
          error.code === "pkce_code_verifier_not_found" ||
          error.message?.toLowerCase().includes("code verifier");
        console.error("Error exchanging code for session:", error);
        return NextResponse.redirect(
          `${origin}/login?error=${isPkceError ? "pkce_failed" : "auth_failed"}`
        );
      }

      if (data.user?.email) {
        return handleAuthSuccess(data.user.email, data.user.user_metadata);
      }
      return response;
    } catch (error) {
      console.error("Error exchanging code for session:", error);
      return NextResponse.redirect(`${origin}/login?error=auth_failed`);
    }
  }

  return NextResponse.redirect(`${origin}/projects`);
}
