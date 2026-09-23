import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

/** Record a playback — powers charts + "recently played". No auth required. */
export async function POST(req: Request) {
  try {
    const { songId, sessionId } = (await req.json()) as {
      songId?: string;
      sessionId?: string;
    };
    if (!songId) return NextResponse.json({ error: "missing songId" }, { status: 400 });
    const db = supabaseAdmin();
    await db.from("plays").insert({ song_id: songId, session_id: sessionId ?? null });
    // Fire-and-forget denormalized counter (charts can also aggregate plays).
    await db.rpc("increment_play_count", { p_song_id: songId });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
