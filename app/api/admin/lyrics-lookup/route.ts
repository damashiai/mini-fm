import { NextResponse } from "next/server";
import { resolveLyrics } from "@/lib/lrclib";
import { requireAdmin } from "../_auth";

/** lrclib lookup for pre-filling lyrics during upload review. */
export async function POST(req: Request) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  try {
    const { track, artist, album, durationSeconds } = (await req.json()) as {
      track?: string;
      artist?: string;
      album?: string;
      durationSeconds?: number;
    };
    if (!track || !artist) {
      return NextResponse.json({ error: "track + artist required" }, { status: 400 });
    }
    const resolved = await resolveLyrics({
      track,
      artist,
      album,
      durationSeconds,
    });
    return NextResponse.json(resolved);
  } catch {
    return NextResponse.json({ error: "lyrics lookup failed" }, { status: 502 });
  }
}
