import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

/** Per-request server client (reads session cookies, RLS-enforced). */
export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (
          toSet: { name: string; value: string; options?: Record<string, unknown> }[],
        ) => {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(
                name,
                value,
                options as Parameters<typeof cookieStore.set>[2],
              ),
            );
          } catch {
            /* called from a Server Component where set is a no-op */
          }
        },
      },
    },
  );
}

/**
 * Service-role client — bypasses RLS. Server-only (never import from a
 * Client Component). All writes go through this after verifying auth.
 */
export function supabaseAdmin() {
  return createClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );
}

/** Global write kill-switch layered on top of real auth (never a replacement). */
export function writeEnabled(): boolean {
  return (
    (process.env.ENABLE_WRITE_OPERATIONS ?? "true").toLowerCase() !== "false"
  );
}
