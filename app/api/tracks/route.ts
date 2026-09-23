import { NextResponse } from "next/server";
import { fetchTracksByIds } from "@/lib/catalog";

/** Hydrate a list of track ids (likes shelf, share previews). */
export async function GET(req: Request) {
  const ids = (new URL(req.url).searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 30);
  const tracks = await fetchTracksByIds(ids);
  return NextResponse.json({ tracks });
}
