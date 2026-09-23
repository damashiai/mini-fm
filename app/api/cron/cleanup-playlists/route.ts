import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * Daily Vercel Cron (see vercel.json) — deletes expired saved playlists.
 * Authenticated via CRON_SECRET bearer token, not public.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("playlists")
    .delete()
    .lt("expires_at", new Date().toISOString())
    .select("id");
  if (error) return NextResponse.json({ error: "cleanup failed" }, { status: 500 });
  return NextResponse.json({ deleted: data?.length ?? 0 });
}
