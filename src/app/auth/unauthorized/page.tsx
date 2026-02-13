"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function UnauthorizedPage() {
  const router = useRouter();

  useEffect(() => {
    const signOutAndRedirect = async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace("/login?error=not_whitelisted");
    };

    signOutAndRedirect();
  }, [router]);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-cover bg-center bg-no-repeat">
      <p className="text-center text-white/90">
        You do not have access. Redirecting to login…
      </p>
    </div>
  );
}
