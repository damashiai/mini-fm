import { NextResponse } from "next/server";
import { requireAdmin } from "../../_auth";

/**
 * Inline editing for a song + its tags (spec §5.9): metadata, artist/album
 * links, genre/language tags, art, lyrics — everything editable after saving.
 * DELETE removes the row plus its storage objects.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const db = gate.db;

  const allowed: Record<string, string> = {
    title: "title",
    albumId: "album_id",
    durationSeconds: "duration_seconds",
    coverArtUrl: "cover_art_url",
    releaseDate: "release_date",
    languageCode: "language_code",
    isInstrumental: "is_instrumental",
    plainLyrics: "plain_lyrics",
    syncedLyrics: "synced_lyrics",
    lyricsSource: "lyrics_source",
    musicbrainzId: "musicbrainz_id",
    isrc: "isrc",
  };
  const patch: Record<string, unknown> = {};
  for (const [jsonKey, col] of Object.entries(allowed)) {
    if (jsonKey in body) patch[col] = body[jsonKey];
  }
  // release_date is a true date column — drop partial values ("2019").
  if (
    typeof patch.release_date === "string" &&
    !/^\d{4}-\d{2}-\d{2}$/.test(patch.release_date)
  ) {
    patch.release_date = null;
  }
  if (Object.keys(patch).length > 0) {
    const { error } = await db.from("songs").update(patch).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Tag rewrites (full replace semantics — the edit form sends the full set).
  if (Array.isArray(body.genreIds)) {
    await db.from("song_genres").delete().eq("song_id", id);
    const ids = (body.genreIds as string[]).filter(Boolean);
    if (ids.length) {
      await db
        .from("song_genres")
        .upsert(ids.map((genre_id) => ({ song_id: id, genre_id })), {
          onConflict: "song_id,genre_id",
        });
    }
  }
  if (Array.isArray(body.artistIds)) {
    await db.from("song_artists").delete().eq("song_id", id);
    const ids = (body.artistIds as string[]).filter(Boolean);
    if (ids.length) {
      await db
        .from("song_artists")
        .upsert(ids.map((artist_id) => ({ song_id: id, artist_id })), {
          onConflict: "song_id,artist_id",
        });
    }
  }
  if (body.albumId !== undefined) {
    // album_id nullable — null unlinks the track (e.g. single).
    await db.from("songs").update({ album_id: (body.albumId as string) || null }).eq("id", id);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  const { id } = await params;
  const db = gate.db;
  const { data: song } = await db
    .from("songs")
    .select("file_path, cover_art_url")
    .eq("id", id)
    .maybeSingle();
  await db.from("songs").delete().eq("id", id);
  if (song?.file_path) {
    await db.storage.from("audio").remove([song.file_path]);
  }
  // Only delete the cover object if it lives in our images bucket.
  const coverPath = coverStoragePath(song?.cover_art_url ?? null);
  if (coverPath) {
    await db.storage.from("images").remove([coverPath]);
  }
  return NextResponse.json({ ok: true });
}

function coverStoragePath(url: string | null): string | null {
  if (!url) return null;
  const marker = "/images/";
  const i = url.indexOf(marker);
  if (i === -1) return null; // external URL (e.g. archive.org) — leave it
  return url.slice(i + marker.length).split("?")[0];
}
