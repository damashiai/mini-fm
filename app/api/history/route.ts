import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { fetchTracksByIds } from "@/lib/catalog";

/** Recently-played tracks for a session id (no account needed). */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const sessionId = params.get("sessionId");
  const limit = Math.min(30, Number(params.get("limit") ?? 10) || 10);
  if (!sessionId) return NextResponse.json({ tracks: [] });
  const db = supabaseAdmin();
  const { data } = await db
    .from("plays")
    .select("song_id")
    .eq("session_id", sessionId)
    .order("played_at", { ascending: false })
    .limit(limit * 3);
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const r of data ?? []) {
    if (!seen.has(r.song_id)) {
      seen.add(r.song_id);
      ids.push(r.song_id);
    }
    if (ids.length >= limit) break;
  }
  const tracks = await fetchTracksByIds(ids);
  return NextResponse.json({ tracks });
}
