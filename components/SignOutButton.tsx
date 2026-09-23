"use client";

import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function SignOutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await supabaseBrowser().auth.signOut();
        router.push("/admin/login");
        router.refresh();
      }}
      className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:text-white"
    >
      Sign out
    </button>
  );
}
