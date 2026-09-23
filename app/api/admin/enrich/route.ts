import { NextResponse } from "next/server";
import { enrichFromMusicBrainz } from "@/lib/musicbrainz";
import { requireAdmin } from "../_auth";

/**
 * MusicBrainz enrichment for the upload pipeline (keyless: recording search →
 * duration/ISRC, artist genres, release date/type, Cover Art Archive).
 * Never 502s: failures come back as 200 + `warning` so the upload proceeds
 * with manual fields.
 */
export async function POST(req: Request) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  try {
    const { title, artist, album } = (await req.json()) as {
      title?: string;
      artist?: string;
      album?: string;
    };
    if (!title || !artist) {
      return NextResponse.json({ error: "title + artist required" }, { status: 400 });
    }
    const enrichment = await enrichFromMusicBrainz(title, artist, album);
    return NextResponse.json(enrichment);
  } catch (e) {
    const message = e instanceof Error ? e.message : "MusicBrainz lookup failed";
    console.error("[admin/enrich] MusicBrainz lookup failed:", e);
    return NextResponse.json({
      track: null,
      album: null,
      artists: [],
      genres: [],
      warning: message,
    });
  }
}
