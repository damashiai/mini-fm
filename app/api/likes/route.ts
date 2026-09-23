import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

/** Anonymous likes keyed by client-generated session id (spec §5.7). */
export async function GET(req: Request) {
  const sessionId = new URL(req.url).searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ songIds: [] });
  const db = supabaseAdmin();
  const { data } = await db.from("likes").select("song_id").eq("session_id", sessionId);
  return NextResponse.json({ songIds: (data ?? []).map((r) => r.song_id) });
}

export async function POST(req: Request) {
  try {
    const { songId, sessionId, liked } = (await req.json()) as {
      songId?: string;
      sessionId?: string;
      liked?: boolean;
    };
    if (!songId || !sessionId) {
      return NextResponse.json({ error: "missing fields" }, { status: 400 });
    }
    const db = supabaseAdmin();
    if (liked === false) {
      await db.from("likes").delete().eq("song_id", songId).eq("session_id", sessionId);
    } else {
      await db.from("likes").upsert(
        { song_id: songId, session_id: sessionId },
        { onConflict: "song_id,session_id" },
      );
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
