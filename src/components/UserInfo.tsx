"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function UserInfo() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const getUser = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setUser(user);
      } catch (error) {
        console.error("Error getting user:", error);
      } finally {
        setLoading(false);
      }
    };
    getUser();
  }, []);

  const handleSignOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  if (loading) {
    return (
      <div className="fixed top-6 right-6 z-50">
        <div className="bg-white/60 backdrop-blur-md rounded-[73px] px-6 py-3">
          <div className="w-16 h-16 rounded-full bg-gray-200 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <>
      {/* Overlay backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      <div className="fixed top-6 right-6 z-50">
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
              <div className="bg-white/60 backdrop-blur-md rounded-[73px] w-16 h-16 flex items-center justify-center overflow-hidden">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold text-xl">
                  {user.email?.charAt(0).toUpperCase() || "U"}
                </div>
              </div>
              <div className="text-white">
                <p className="font-semibold text-2xl leading-tight tracking-[-0.72px]">
                  {user.user_metadata?.name ||
                    user.email?.split("@")[0] ||
                    "User"}
                </p>
                <p className="font-normal text-xl leading-tight tracking-[-0.6px] text-white/80">
                  {user.email?.split("@")[0] || "Client"}
                </p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56 bg-white/95 backdrop-blur-md border border-gray-200 rounded-lg shadow-lg z-[60]"
          >
            <DropdownMenuItem
              onClick={handleSignOut}
              className="cursor-pointer focus:bg-red-50 focus:text-red-600"
            >
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}
