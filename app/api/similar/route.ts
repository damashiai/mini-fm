import { NextResponse } from "next/server";
import { fetchSimilar, fetchTrackById } from "@/lib/catalog";

/**
 * Auto-continue source: similar tracks from OUR OWN catalog (genre/language
 * overlap) — never an external recommendations API.
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const songId = params.get("songId");
  if (!songId) return NextResponse.json({ tracks: [] });
  const exclude = (params.get("exclude") ?? "").split(",").filter(Boolean);
  const track = await fetchTrackById(songId);
  if (!track) return NextResponse.json({ tracks: [] });
  const tracks = await fetchSimilar(track, [...exclude, songId], 10);
  return NextResponse.json({ tracks });
}
