import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { resolveLyrics } from "@/lib/lrclib";

/**
 * Lyrics for a song. The DB row is the cache: on upload/enrichment we resolve
 * via lrclib once and store plain/synced lyrics on `songs`. This endpoint
 * serves the cache, and lazily backfills it (once) for rows that predate
 * enrichment — lrclib is never hit on every playback.
 */
export async function GET(req: Request) {
  const songId = new URL(req.url).searchParams.get("song");
  if (!songId) return NextResponse.json({ error: "missing song" }, { status: 400 });
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("songs")
    .select(
      "id, title, is_instrumental, plain_lyrics, synced_lyrics, lyrics_source, duration_seconds, album_id",
    )
    .eq("id", songId)
    .maybeSingle();
  if (error || !data) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (data.is_instrumental) {
    return NextResponse.json({ status: "instrumental", plainLyrics: null, syncedLyrics: null });
  }
  if (data.synced_lyrics || data.plain_lyrics) {
    return NextResponse.json({
      status: data.synced_lyrics ? "synced" : "plain",
      plainLyrics: data.plain_lyrics,
      syncedLyrics: data.synced_lyrics,
    });
  }

  // Lazy backfill: resolve once, cache on the row.
  const artists = await db
    .from("song_artists")
    .select("artists (name)")
    .eq("song_id", songId);
  const artistName =
    ((artists.data?.[0] as unknown as { artists: { name: string } | null })
      ?.artists?.name) ?? "";
  let albumName: string | null = null;
  if (data.album_id) {
    const { data: album } = await db
      .from("albums")
      .select("title")
      .eq("id", data.album_id)
      .maybeSingle();
    albumName = album?.title ?? null;
  }
  const resolved = await resolveLyrics({
    track: data.title,
    artist: artistName,
    album: albumName,
    durationSeconds: data.duration_seconds,
  });
  const cacheUpdate: {
    is_instrumental: boolean;
    plain_lyrics: string | null;
    synced_lyrics: string | null;
    lyrics_source?: string;
  } = {
    is_instrumental: resolved.status === "instrumental",
    plain_lyrics: resolved.plainLyrics ?? data.plain_lyrics,
    synced_lyrics: resolved.syncedLyrics,
  };
  if (resolved.source) cacheUpdate.lyrics_source = resolved.source;
  await db.from("songs").update(cacheUpdate).eq("id", songId);

  // ID3 plain-lyrics fallback note: upload stores embedded USLT text into
  // plain_lyrics, so reaching here with plainLyrics set already handled it.
  return NextResponse.json({
    status: resolved.status === "instrumental" ? "instrumental" : resolved.status,
    plainLyrics: resolved.plainLyrics ?? data.plain_lyrics,
    syncedLyrics: resolved.syncedLyrics,
  });
}
