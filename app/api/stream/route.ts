import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * Signed-URL streaming: the server mints a short-lived URL (2h TTL) and the
 * <audio> element streams DIRECTLY from Supabase's CDN, which handles Range
 * requests natively for seeking. Audio bytes are never proxied through a
 * serverless function (spec §5.6 / non-goal).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const songId = searchParams.get("song");
  if (!songId) {
    return NextResponse.json({ error: "missing song" }, { status: 400 });
  }
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("songs")
    .select("file_path")
    .eq("id", songId)
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const TTL_SECONDS = 2 * 60 * 60;
  const { data: signed, error: signError } = await db.storage
    .from("audio")
    .createSignedUrl(data.file_path, TTL_SECONDS);
  if (signError || !signed) {
    return NextResponse.json({ error: "sign failed" }, { status: 500 });
  }
  return NextResponse.json({
    url: signed.signedUrl,
    expiresAt: Date.now() + TTL_SECONDS * 1000,
  });
}
