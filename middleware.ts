import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * - Refreshes the Supabase Auth session on every request (standard SSR pattern).
 * - Gates /admin/* (except /admin/login) behind a real session — the
 *   ENABLE_WRITE_OPERATIONS flag is an additional kill-switch, not the gate.
 */
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (
          toSet: { name: string; value: string; options?: Record<string, unknown> }[],
        ) => {
          toSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value);
            res = NextResponse.next({ request: req });
            res.cookies.set(
              name,
              value,
              options as Parameters<typeof res.cookies.set>[2],
            );
          });
        },
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAdminRoute =
    req.nextUrl.pathname === "/admin" || req.nextUrl.pathname.startsWith("/admin/");
  const isLogin = req.nextUrl.pathname === "/admin/login";
  if (isAdminRoute && !isLogin && !user) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }
  if (isLogin && user) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  matcher: ["/admin/:path*", "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest).*)"],
};
