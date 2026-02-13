"use client";

import { useState, Suspense } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const LOGO_SIZE = 164;
const FORM_WIDTH = 280;
const INPUT_PLACEHOLDER = "name@example.com";
const BUTTON_LABEL = "Sign in with Email";

const ERROR_MESSAGES: Record<string, string> = {
  not_whitelisted: "Your email is not authorized to access this portal.",
  auth_failed: "Authentication failed. Please try again.",
  config: "Configuration error. Please contact support.",
};

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [formMessage, setFormMessage] = useState("");

  const errorParam = searchParams.get("error");
  const urlErrorMessage =
    errorParam && ERROR_MESSAGES[errorParam]
      ? ERROR_MESSAGES[errorParam]
      : null;
  const message = formMessage || urlErrorMessage || "";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isConfigMissing = !supabaseUrl || !supabaseKey;

  let supabase: ReturnType<typeof createClient> | undefined;
  if (!isConfigMissing) {
    try {
      supabase = createClient();
    } catch {
      // Handled via message state below
    }
  }

  const showConfigError = isConfigMissing || !supabase;
  const configErrorMessage = isConfigMissing
    ? "Supabase configuration is missing. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file."
    : "Supabase configuration error. Please check your environment variables.";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setFormMessage("");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setFormMessage(error.message);
    } else {
      setFormMessage("Check your email for the magic link!");
    }
    setLoading(false);
  };

  return (
    <div
      className="fixed inset-0 flex flex-col items-center bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url(/bg-clear.jpg)" }}
    >
      <div
        className="flex flex-1 flex-col items-center justify-center "
        style={{ width: FORM_WIDTH }}
      >
        <Image
          src="/exo-glass.png"
          alt="EXO"
          width={LOGO_SIZE}
          height={LOGO_SIZE}
          className="mb-0 shrink-0 object-contain"
          priority
        />

        {showConfigError ? (
          <p className="text-center text-sm text-red-500">
            {configErrorMessage}
          </p>
        ) : (
          <form onSubmit={handleLogin} className="flex w-full flex-col gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={INPUT_PLACEHOLDER}
              required
              disabled={loading}
              className="w-full rounded-lg border border-white/20 bg-white/80 px-4 py-3 text-sm text-gray-800 placeholder:text-gray-500 focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/30 disabled:opacity-60"
              aria-label="Email address"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#1f1f1f] py-3 text-sm font-medium text-white shadow-sm transition-opacity hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-600 focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              aria-busy={loading}
            >
              {loading ? "Sending..." : BUTTON_LABEL}
            </button>
            {message && (
              <p
                className={`text-center text-sm ${message.includes("Check your email") ? "text-green-600" : "text-red-500"}`}
                role="status"
              >
                {message}
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div
          className="fixed inset-0 flex flex-col items-center justify-center bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url(/bg-clear.jpg)" }}
        >
          <Image
            src="/exo-glass.png"
            alt="EXO"
            width={164}
            height={164}
            className="shrink-0 object-contain opacity-80"
          />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
