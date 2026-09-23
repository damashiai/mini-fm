import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer, writeEnabled } from "@/lib/supabase-server";

/**
 * Verifies the request comes from the logged-in admin AND that the global
 * write kill-switch is on. Every /api/admin/* route calls this first.
 */
export async function requireAdmin() {
  if (!writeEnabled()) {
    return {
      error: NextResponse.json(
        { error: "Write operations are disabled (ENABLE_WRITE_OPERATIONS)." },
        { status: 403 },
      ),
    };
  }
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return {
        error: NextResponse.json({ error: "admin login required" }, { status: 401 }),
      };
    }
    return { db: supabaseAdmin(), user };
  } catch {
    return {
      error: NextResponse.json({ error: "auth check failed" }, { status: 500 }),
    };
  }
}
