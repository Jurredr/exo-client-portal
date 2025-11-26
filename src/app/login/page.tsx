"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Check if Supabase is configured
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <div className="relative z-10 w-full max-w-md px-8">
          <div className="bg-white/80 backdrop-blur-md rounded-[48px] border-2 border-gray-200 p-12 shadow-xl">
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-[#1f1f1f] to-[#404040] bg-clip-text text-transparent mb-8">
              EXO Client Portal
            </h1>
            <p className="text-red-600 mb-4">
              Supabase configuration is missing. Please set
              NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your
              .env.local file.
            </p>
          </div>
        </div>
      </div>
    );
  }

  let supabase;
  try {
    supabase = createClient();
  } catch (error) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <div className="relative z-10 w-full max-w-md px-8">
          <div className="bg-white/80 backdrop-blur-md rounded-[48px] border-2 border-gray-200 p-12 shadow-xl">
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-[#1f1f1f] to-[#404040] bg-clip-text text-transparent mb-8">
              EXO Client Portal
            </h1>
            <p className="text-red-600 mb-4">
              Supabase configuration error. Please check your environment
              variables.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Check your email for the magic link!");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black">
      <div className="relative z-10 w-full max-w-md px-8">
        <div className="bg-white/80 backdrop-blur-md rounded-[48px] border-2 border-gray-200 p-12 shadow-xl">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-[#1f1f1f] to-[#404040] bg-clip-text text-transparent mb-8">
            EXO Client Portal
          </h1>
          <p className="text-gray-600 mb-8 text-lg">
            Enter your email to receive a magic link
          </p>
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full px-6 py-4 rounded-[24px] border-2 border-gray-200 bg-white/50 backdrop-blur-sm focus:outline-none focus:border-gray-400 text-lg"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-[24px] bg-black text-white font-semibold text-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Sending..." : "Send Magic Link"}
            </button>
            {message && (
              <p
                className={`text-sm ${message.includes("error") || message.includes("Check") ? "text-green-600" : "text-red-600"}`}
              >
                {message}
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
